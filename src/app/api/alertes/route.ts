import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/siteUrl";
import { envoyerPushA, envoyerEmail, gabaritEmail, echapper, emailConfigure } from "@/lib/server/envoi";

/* Alertes de recherche : prévenir ceux qui attendent cette annonce.
 *
 * Deux entrées :
 *   POST { listing_id }  — appelée par le navigateur juste après un dépôt,
 *                          avec le jeton du déposant ; on vérifie que
 *                          l'annonce est bien la sienne.
 *   GET                  — passe quotidienne (Vercel Cron, en-tête
 *                          Authorization: Bearer CRON_SECRET) qui repasse
 *                          sur les annonces des 36 dernières heures : celles
 *                          publiées après une vérification humaine n'ont
 *                          jamais déclenché le POST.
 *
 * La base dit qui prévenir (alertes_correspondantes) et se souvient de ce
 * qui a été envoyé (alert_hits) : un couple alerte × annonce ne sonne
 * qu'une fois, quel que soit le chemin. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

type Cible = { alert_id: string; user_id: string; email: string | null; notify_email: boolean; notify_push: boolean; resume: string };

function ok(motif: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: true, motif, ...extra });
}

async function traiterAnnonce(service: SupabaseClient, listingId: string): Promise<{ envoyes: number; cibles: number }> {
  const { data: l } = await service.from("listings").select("id, title, price_cents, location, module, review_state, status").eq("id", listingId).maybeSingle();
  if (!l) return { envoyes: 0, cibles: 0 };
  const { data } = await service.rpc("alertes_correspondantes", { p_listing_id: listingId });
  const cibles = (data as Cible[] | null) ?? [];
  if (cibles.length === 0) return { envoyes: 0, cibles: 0 };

  /* Une personne peut avoir plusieurs alertes qui matchent la même annonce :
     un seul message, mais toutes ses alertes sont marquées. */
  const parPersonne = new Map<string, Cible[]>();
  for (const c of cibles) parPersonne.set(c.user_id, [...(parPersonne.get(c.user_id) ?? []), c]);

  const lien = `${SITE_URL}/annonce/${l.id}`;
  const prix = l.price_cents != null ? `${Math.round(l.price_cents / 100).toLocaleString("fr-FR")} €` : null;
  const sousTitre = [prix, l.location].filter(Boolean).join(" · ");
  const marques: string[] = [];
  let envoyes = 0;

  for (const [userId, alertes] of parPersonne) {
    const c = alertes[0];
    let touche = false;
    if (c.notify_push) {
      const n = await envoyerPushA(service, userId, {
        titre: "Nouvelle annonce pour votre alerte",
        corps: `${l.title}${sousTitre ? ` — ${sousTitre}` : ""}`,
        url: lien,
        tag: `tikanal-alerte-${l.id}`,
      });
      if (n > 0) touche = true;
    }
    if (c.notify_email && c.email && emailConfigure) {
      const html = gabaritEmail({
        titre: `Nouvelle annonce : ${echapper(l.title)}`,
        corps: `${sousTitre ? echapper(sousTitre) + ". " : ""}Elle correspond à votre alerte « ${echapper(c.resume || "recherche")} ».`,
        lienTexte: "Voir l’annonce",
        lienUrl: lien,
        pied: `Vous recevez cet email parce que vous avez créé une alerte sur Ti Kanal. Gérez vos alertes depuis <a href="${SITE_URL}/mon-espace" style="color:#8a6a2a">votre espace</a>.`,
      });
      if (await envoyerEmail(c.email, `Nouvelle annonce : ${l.title}`, html)) touche = true;
    }
    /* Même sans canal actif, on marque : pas de canal aujourd'hui, ce n'est
       pas une raison de re-sonner demain pour la même annonce. */
    marques.push(...alertes.map((a) => a.alert_id));
    if (touche) envoyes += 1;
  }

  if (marques.length > 0) await service.rpc("marquer_alertes_envoyees", { p_listing_id: l.id, p_alert_ids: marques });
  return { envoyes, cibles: parPersonne.size };
}

export async function POST(request: Request) {
  if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) return ok("configuration-incomplete");
  let listingId: string;
  try {
    const corps = (await request.json()) as { listing_id?: unknown };
    if (typeof corps.listing_id !== "string") return ok("requete-invalide");
    listingId = corps.listing_id;
  } catch {
    return ok("requete-invalide");
  }
  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return ok("non-authentifie");
  const anon = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false } });
  const { data: auth } = await anon.auth.getUser(jeton);
  const appelant = auth?.user?.id;
  if (!appelant) return ok("jeton-invalide");

  const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });
  const { data: l } = await service.from("listings").select("id, user_id").eq("id", listingId).maybeSingle();
  if (!l || (l as { user_id: string }).user_id !== appelant) return ok("annonce-inconnue");

  const r = await traiterAnnonce(service, listingId);
  return ok("traite", r);
}

export async function GET(request: Request) {
  if (!URL_SUPABASE || !CLE_SERVICE) return ok("configuration-incomplete");
  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!CRON_SECRET || jeton !== CRON_SECRET) return new Response("Non autorisé", { status: 401 });
  const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });
  const { data } = await service.rpc("annonces_recentes_pour_alertes", { p_heures: 36 });
  const ids = (data as string[] | null) ?? [];
  let envoyes = 0;
  for (const id of ids) envoyes += (await traiterAnnonce(service, id)).envoyes;
  return ok("passe-terminee", { annonces: ids.length, envoyes });
}
