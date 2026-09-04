import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

/* Les deux canaux de notification, côté serveur : push web et email
   Resend. Chacun s'active dès que ses clés sont là et se tait sinon —
   aucun des deux ne fait échouer l'autre. */

const CLE_RESEND = process.env.RESEND_API_KEY;
const EXPEDITEUR = process.env.MAIL_FROM || "Ti Kanal <notifications@tikanal.com>";
const VAPID_PUBLIQUE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVEE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUJET = process.env.VAPID_SUBJECT || "mailto:contact@tikanal.com";

export const emailConfigure = Boolean(CLE_RESEND);
export const pushConfigure = Boolean(VAPID_PUBLIQUE && VAPID_PRIVEE);

/* Pousse une notification sur les appareils inscrits d'un compte (la base
   applique elle-même le réglage « notifications push » du profil). Un
   endpoint mort est oublié sur place. Renvoie le nombre d'envois réussis. */
export async function envoyerPushA(
  service: SupabaseClient,
  userId: string,
  charge: { titre: string; corps: string; url: string; tag: string },
): Promise<number> {
  if (!VAPID_PUBLIQUE || !VAPID_PRIVEE) return 0;
  const { data } = await service.rpc("appareils_a_notifier", { p_user_id: userId });
  const appareils = (data as { id: string; endpoint: string; p256dh: string; auth: string }[] | null) ?? [];
  if (appareils.length === 0) return 0;
  webpush.setVapidDetails(VAPID_SUJET, VAPID_PUBLIQUE, VAPID_PRIVEE);
  const corps = JSON.stringify(charge);
  const resultats = await Promise.allSettled(appareils.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, corps);
      return true;
    } catch (cause) {
      const code = (cause as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await service.rpc("oublier_appareil", { p_id: a.id });
      else console.error("Push refusé", code, cause);
      return false;
    }
  }));
  return resultats.filter((r) => r.status === "fulfilled" && r.value).length;
}

/* Envoie un email via Resend. Renvoie true si le service l'a accepté. */
export async function envoyerEmail(to: string, sujet: string, html: string): Promise<boolean> {
  if (!CLE_RESEND) return false;
  try {
    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLE_RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EXPEDITEUR, to: [to], subject: sujet, html }),
    });
    if (!envoi.ok) console.error("Resend a refusé", envoi.status, await envoi.text());
    return envoi.ok;
  } catch (cause) {
    console.error("Envoi email impossible", cause);
    return false;
  }
}

/* Gabarit commun des emails du site : même en-tête, même bouton, même pied. */
export function gabaritEmail({ titre, corps, lienTexte, lienUrl, pied }: {
  titre: string; corps: string; lienTexte: string; lienUrl: string; pied: string;
}): string {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16292b">
      <p style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#8a6a2a;margin:0 0 4px">St Barth</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#05282c;margin:0 0 18px">Ti Kanal</h1>
      <p style="font-size:16px;font-weight:700;line-height:1.5;margin:0 0 8px">${titre}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#3b4a4b">${corps}</p>
      <a href="${lienUrl}" style="display:inline-block;background:#c9a86a;color:#05282c;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:15px">${lienTexte}</a>
      <p style="font-size:12px;line-height:1.5;color:#5f6f70;margin:26px 0 0;border-top:1px solid #e4ddcd;padding-top:14px">${pied}</p>
    </div>`;
}

/* Les textes saisis par des utilisateurs ne rentrent pas tels quels dans du HTML. */
export function echapper(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
