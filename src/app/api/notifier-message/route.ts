import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/siteUrl";

/* Prévenir par email la personne qui vient de recevoir un message.
 *
 * Appelée par le navigateur juste après l'envoi, avec le jeton de
 * l'expéditeur. Deux vérifications avant tout envoi : le jeton est
 * valide, et son porteur participe bien à cette conversation. Sans
 * quoi n'importe qui pourrait faire envoyer des emails en boucle
 * en devinant des identifiants de conversation.
 *
 * La décision d'envoyer, elle, appartient à la base : la fonction
 * destinataire_a_prevenir applique les règles du silence (déjà lu,
 * déjà prévenu il y a moins d'un quart d'heure, notifications
 * coupées) et ne rend une adresse que si l'envoi est justifié.
 *
 * Rien ici n'est bloquant pour l'utilisateur : si la configuration
 * d'envoi manque ou si Resend refuse, le message est déjà en base et
 * la pastille du site fera son travail. On renvoie donc toujours 200
 * avec un motif, jamais une erreur qui inquiéterait l'expéditeur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLE_RESEND = process.env.RESEND_API_KEY;
const EXPEDITEUR = process.env.MAIL_FROM || "Ti Kanal <notifications@tikanal.com>";

function ok(motif: string) {
  return Response.json({ ok: true, motif });
}

export async function POST(request: Request) {
  if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE || !CLE_RESEND) {
    return ok("configuration-incomplete");
  }

  let conversationId: string;
  try {
    const corps = (await request.json()) as { conversation_id?: unknown };
    if (typeof corps.conversation_id !== "string") return ok("requete-invalide");
    conversationId = corps.conversation_id;
  } catch {
    return ok("requete-invalide");
  }

  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return ok("non-authentifie");

  // 1. Qui appelle ? Le jeton est vérifié par Supabase, pas décodé ici.
  const anon = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false } });
  const { data: auth } = await anon.auth.getUser(jeton);
  const appelant = auth?.user?.id;
  if (!appelant) return ok("jeton-invalide");

  const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });

  // 2. L'appelant participe-t-il vraiment à cette conversation ?
  const { data: conv } = await service
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return ok("conversation-inconnue");
  if (conv.buyer_id !== appelant && conv.seller_id !== appelant) return ok("non-participant");

  // 3. Y a-t-il quelqu'un à prévenir ? C'est la base qui tranche.
  const { data: cibles } = await service.rpc("destinataire_a_prevenir", {
    p_conversation_id: conversationId,
  });
  const cible = (cibles as { user_id: string; autre_nom: string; listing_title: string; listing_id: string }[] | null)?.[0];
  if (!cible) return ok("rien-a-envoyer");

  const { data: destinataire } = await service.auth.admin.getUserById(cible.user_id);
  const email = destinataire?.user?.email;
  if (!email) return ok("sans-adresse");

  // 4. L'email ne contient pas le message. Une notification qui recopie
  //    le contenu se retrouve dans les aperçus d'écran verrouillé et dans
  //    les boîtes partagées — et elle enlève toute raison de revenir.
  const lien = `${SITE_URL}/messages`;
  const sujet = `Nouveau message de ${cible.autre_nom} — ${cible.listing_title}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16292b">
      <p style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#8a6a2a;margin:0 0 4px">St Barth</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#05282c;margin:0 0 18px">Ti Kanal</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px">
        <strong>${echapper(cible.autre_nom)}</strong> vous a écrit au sujet de
        « ${echapper(cible.listing_title)} ».
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#5f6f70">
        Le message vous attend dans votre boîte sur Ti Kanal.
      </p>
      <a href="${lien}" style="display:inline-block;background:#c9a86a;color:#05282c;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:15px">
        Lire le message
      </a>
      <p style="font-size:12px;line-height:1.5;color:#5f6f70;margin:26px 0 0;border-top:1px solid #e4ddcd;padding-top:14px">
        Vous recevez cet email parce que vous avez une annonce ou une conversation sur Ti Kanal.
        Pour ne plus être prévenu, décochez « Recevoir un email » dans
        <a href="${SITE_URL}/mon-espace" style="color:#8a6a2a">votre profil</a>.
      </p>
    </div>`;

  try {
    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLE_RESEND}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EXPEDITEUR, to: [email], subject: sujet, html }),
    });
    if (!envoi.ok) {
      console.error("Notification message : Resend a refusé", envoi.status, await envoi.text());
      return ok("envoi-refuse");
    }
  } catch (cause) {
    console.error("Notification message : envoi impossible", cause);
    return ok("envoi-impossible");
  }

  // 5. Marqué seulement après un envoi réussi : un échec doit pouvoir
  //    être retenté au message suivant.
  await service.rpc("marquer_notifie", {
    p_conversation_id: conversationId,
    p_user_id: cible.user_id,
  });

  return ok("envoye");
}

/* Le nom affiché et le titre d'annonce sont saisis par des utilisateurs :
   ils ne rentrent pas tels quels dans du HTML. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
