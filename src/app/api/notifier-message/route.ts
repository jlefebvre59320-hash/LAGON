import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
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
const VAPID_PUBLIQUE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVEE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUJET = process.env.VAPID_SUBJECT || "mailto:contact@tikanal.com";

function ok(motif: string) {
  return Response.json({ ok: true, motif });
}

export async function POST(request: Request) {
  // Supabase est indispensable ; l'email et le push sont deux canaux
  // indépendants, chacun actif dès que ses propres clés sont là.
  if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) {
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

  // 4. Le push part en premier : c'est le canal le plus rapide, et il ne
  //    doit pas attendre l'aller-retour avec le service d'emails. Il est
  //    aussi le seul possible pour un compte sans adresse exploitable.
  const pushEnvoye = await envoyerPush(service, cible);

  const marquer = () => service.rpc("marquer_notifie", {
    p_conversation_id: conversationId,
    p_user_id: cible.user_id,
  });

  const { data: destinataire } = await service.auth.admin.getUserById(cible.user_id);
  const email = destinataire?.user?.email;

  if (!CLE_RESEND || !email) {
    if (pushEnvoye > 0) { await marquer(); return ok("push-seul"); }
    return ok(email ? "email-non-configure" : "sans-adresse");
  }

  // 5. L'email ne contient pas le message. Une notification qui recopie
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
      return ok(pushEnvoye > 0 ? "push-seul" : "envoi-refuse");
    }
  } catch (cause) {
    console.error("Notification message : envoi impossible", cause);
    return ok(pushEnvoye > 0 ? "push-seul" : "envoi-impossible");
  }

  // 6. Marqué seulement après un envoi réussi : un échec doit pouvoir
  //    être retenté au message suivant.
  await marquer();
  return ok("envoye");
}

/* Pousse la notification sur les appareils inscrits. Renvoie le nombre
   d'envois réussis.

   Un endpoint refusé (410 ou 404) désigne un appareil qui n'existe plus :
   application désinstallée, navigateur réinitialisé. Il est supprimé sur
   place, sinon chaque message suivant repartirait pour rien. */
async function envoyerPush(
  service: SupabaseClient,
  cible: { user_id: string; autre_nom: string; listing_title: string },
): Promise<number> {
  if (!VAPID_PUBLIQUE || !VAPID_PRIVEE) return 0;

  const { data } = await service.rpc("appareils_a_notifier", { p_user_id: cible.user_id });
  const appareils = (data as { id: string; endpoint: string; p256dh: string; auth: string }[] | null) ?? [];
  if (appareils.length === 0) return 0;

  webpush.setVapidDetails(VAPID_SUJET, VAPID_PUBLIQUE, VAPID_PRIVEE);

  const charge = JSON.stringify({
    titre: `Message de ${cible.autre_nom}`,
    corps: `À propos de « ${cible.listing_title} »`,
    url: `${SITE_URL}/messages`,
    tag: `tikanal-${cible.user_id}`,
  });

  const resultats = await Promise.allSettled(appareils.map(async (a) => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        charge,
      );
      return true;
    } catch (cause) {
      const code = (cause as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await service.rpc("oublier_appareil", { p_id: a.id });
      } else {
        console.error("Push refusé", code, cause);
      }
      return false;
    }
  }));

  return resultats.filter((r) => r.status === "fulfilled" && r.value).length;
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
