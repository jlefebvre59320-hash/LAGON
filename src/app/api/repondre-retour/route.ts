import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/siteUrl";
import { echapper, emailConfigure, envoyerEmail, envoyerPushA, gabaritEmail } from "@/lib/server/envoi";

/* Répondre à un retour (idée, problème, avis) depuis l'administration.
 *
 * La base décide et écrit : admin_repondre_retour vérifie que l'appelant
 * est administrateur, enregistre la réponse sur le retour et, si la
 * personne a un compte, la dépose dans sa messagerie (la pastille
 * s'allume en direct). Cette route ne fait que ce que la base ne peut
 * pas : prévenir, par push et par email, avec les clés du serveur.
 *
 * Contrairement aux emails de messagerie, celui-ci contient la réponse :
 * c'est l'équipe qui parle, à propos d'un message que la personne a
 * elle-même envoyé — pas une négociation privée.
 *
 * Les erreurs sont renvoyées en clair : c'est un administrateur qui lit,
 * il doit savoir si la réponse est partie et par quel canal.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Resultat =
  | { mode: "message"; conversation_id: string; user_id: string }
  | { mode: "email"; contact: string; message: string; kind: string; created_at: string }
  | { mode: "aucun"; contact: string | null };

const NATURE: Record<string, string> = { idee: "votre idée", probleme: "votre signalement", avis: "votre avis" };

function erreur(message: string, statut = 400) {
  return Response.json({ ok: false, erreur: message }, { status: statut });
}

export async function POST(request: Request) {
  if (!URL_SUPABASE || !CLE_ANON) return erreur("Configuration Supabase incomplète.", 500);

  let feedbackId: string, texte: string;
  try {
    const corps = (await request.json()) as { feedback_id?: unknown; body?: unknown };
    if (typeof corps.feedback_id !== "string" || typeof corps.body !== "string") return erreur("Requête invalide.");
    feedbackId = corps.feedback_id;
    texte = corps.body.trim();
  } catch {
    return erreur("Requête invalide.");
  }
  if (!texte) return erreur("La réponse est vide.");

  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return erreur("Connectez-vous.", 401);

  // 1. La fonction s'exécute au nom de l'appelant : c'est elle qui vérifie
  //    qu'il est administrateur, pas cette route.
  const enTantQue = createClient(URL_SUPABASE, CLE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  const { data, error } = await enTantQue.rpc("admin_repondre_retour", { p_feedback_id: feedbackId, p_body: texte });
  if (error) return erreur(error.message, error.message.startsWith("Réservé") ? 403 : 400);
  const resultat = data as Resultat;

  // 2. Prévenir. Sans clé de service, la réponse est en base et la
  //    pastille fera son travail ; on le dit, sans le cacher.
  if (resultat.mode === "aucun") {
    return Response.json({ ok: true, mode: "aucun", contact: resultat.contact });
  }
  if (!CLE_SERVICE) {
    return Response.json({ ok: true, mode: resultat.mode, push: 0, email: false, motif: "configuration-incomplete" });
  }
  const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });

  if (resultat.mode === "message") {
    const lien = `${SITE_URL}/messages?c=${encodeURIComponent(resultat.conversation_id)}`;
    const push = await envoyerPushA(service, resultat.user_id, {
      titre: "Réponse de l'équipe Ti Kanal",
      corps: "À propos de votre retour",
      url: lien,
      tag: `tikanal-${resultat.user_id}`,
    });

    let email = false;
    if (emailConfigure) {
      const { data: compte } = await service.auth.admin.getUserById(resultat.user_id);
      const adresse = compte?.user?.email;
      if (adresse) {
        email = await envoyerEmail(adresse, "L'équipe Ti Kanal a répondu à votre retour", gabaritEmail({
          titre: "Merci pour votre retour — voici notre réponse.",
          corps: citer(texte),
          lienTexte: "Ouvrir la conversation",
          lienUrl: lien,
          pied: "Vous recevez cet email parce que vous avez envoyé un retour depuis Ti Kanal. Vous pouvez répondre directement dans votre messagerie.",
        }));
      }
    }
    if (push > 0 || email) {
      await service.rpc("marquer_notifie", { p_conversation_id: resultat.conversation_id, p_user_id: resultat.user_id });
    }
    return Response.json({ ok: true, mode: "message", push, email });
  }

  // 3. Sans compte : l'email porte tout, retour d'origine compris.
  const quand = new Date(resultat.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const email = emailConfigure && await envoyerEmail(resultat.contact, "L'équipe Ti Kanal a répondu à votre retour", gabaritEmail({
    titre: `Merci pour ${NATURE[resultat.kind] ?? "votre message"} du ${quand} — voici notre réponse.`,
    corps: `${citer(texte)}<br><br><span style="color:#5f6f70;font-size:13px">Votre message : « ${echapper(resultat.message)} »</span>`,
    lienTexte: "Retourner sur Ti Kanal",
    lienUrl: SITE_URL,
    pied: "Vous recevez cet email parce que vous avez laissé cette adresse en envoyant un retour depuis Ti Kanal. Pour poursuivre l'échange, répondez simplement à cet email.",
  }));
  return Response.json({ ok: true, mode: "email", email, contact: resultat.contact });
}

/* La réponse de l'équipe, avec ses retours à la ligne, dans du HTML. */
function citer(texte: string): string {
  return echapper(texte).replace(/\n/g, "<br>");
}
