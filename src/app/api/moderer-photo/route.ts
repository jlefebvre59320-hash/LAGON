import { createClient } from "@supabase/supabase-js";

/* Analyse d'une photo d'annonce par Sightengine, côté serveur.
 *
 * Le navigateur appelle cette route juste après avoir déposé une photo,
 * avec le jeton de l'utilisateur. On vérifie que l'annonce lui appartient,
 * on soumet l'URL publique de la photo à Sightengine, on range le
 * résultat sur la ligne listing_photos (clé de service — un compte ne
 * peut pas écrire ces colonnes), puis on relance l'évaluation de
 * l'annonce : c'est la base qui décide quoi en faire.
 *
 * Trois niveaux, et rien d'autre :
 *   certain — nudité explicite ou acte sexuel : l'annonce est retenue ;
 *   fort    — érotisme, arme, drogue, violence, symbole haineux : pèse dans
 *             le score et fait passer l'annonce devant un humain ;
 *   null    — rien à signaler, ou service non configuré.
 *
 * Sans SIGHTENGINE_USER / SIGHTENGINE_SECRET, la route répond 200 avec un
 * motif et ne fait rien : le reste de la modération continue sans image.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SE_USER = process.env.SIGHTENGINE_USER;
const SE_SECRET = process.env.SIGHTENGINE_SECRET;

const MODELES = "nudity-2.1,weapon,recreational_drug,gore-2.0,offensive-2.0";

type Seuils = { sexuel_certain: number; sexuel_fort: number; arme: number; drogue: number; gore: number; offensant: number };
const SEUILS_DEFAUT: Seuils = { sexuel_certain: 0.75, sexuel_fort: 0.5, arme: 0.7, drogue: 0.7, gore: 0.7, offensant: 0.7 };

function ok(motif: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: true, motif, ...extra });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const maxDe = (o: unknown) => (o && typeof o === "object" ? Math.max(0, ...Object.values(o as Record<string, unknown>).map(num)) : 0);

/* Lit la réponse Sightengine et la réduit à un niveau et un résumé lisible. */
function interpreter(r: Record<string, unknown>, s: Seuils): { niveau: "certain" | "fort" | null; resume: string | null; scores: Record<string, number> } {
  const nudite = (r.nudity ?? {}) as Record<string, unknown>;
  const arme = (r.weapon ?? {}) as { classes?: Record<string, unknown> };
  const drogue = (r.recreational_drug ?? {}) as { prob?: unknown };
  const gore = (r.gore ?? {}) as { prob?: unknown };
  const offensant = (r.offensive ?? {}) as Record<string, unknown>;

  const scores = {
    sexuel_explicite: Math.max(num(nudite.sexual_activity), num(nudite.sexual_display)),
    erotisme: Math.max(num(nudite.erotica), num(nudite.very_suggestive)),
    arme: Math.max(num(arme.classes?.firearm), num(arme.classes?.firearm_gesture), num(arme.classes?.knife)),
    drogue: num(drogue.prob),
    gore: num(gore.prob),
    // Le doigt d'honneur n'est pas un symbole haineux : on l'écarte.
    offensant: maxDe(Object.fromEntries(Object.entries(offensant).filter(([k]) => k !== "middle_finger"))),
  };

  if (scores.sexuel_explicite >= s.sexuel_certain) return { niveau: "certain", resume: "nudité explicite", scores };
  const forts: string[] = [];
  if (scores.sexuel_explicite >= s.sexuel_fort || scores.erotisme >= s.sexuel_fort) forts.push("érotisme ou nudité");
  if (scores.arme >= s.arme) forts.push("arme");
  if (scores.drogue >= s.drogue) forts.push("drogue");
  if (scores.gore >= s.gore) forts.push("violence");
  if (scores.offensant >= s.offensant) forts.push("symbole haineux");
  if (forts.length) return { niveau: "fort", resume: forts.join(", "), scores };
  return { niveau: null, resume: null, scores };
}

export async function POST(request: Request) {
  if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) return ok("configuration-incomplete");
  if (!SE_USER || !SE_SECRET) return ok("analyse-non-configuree");

  let listingId: string, storageKey: string;
  try {
    const corps = (await request.json()) as { listing_id?: unknown; storage_key?: unknown };
    if (typeof corps.listing_id !== "string" || typeof corps.storage_key !== "string") return ok("requete-invalide");
    listingId = corps.listing_id;
    storageKey = corps.storage_key;
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

  // La photo existe, sur cette annonce, et l'annonce est à l'appelant.
  const { data: photo } = await service
    .from("listing_photos")
    .select("id, listing_id, storage_key, listing:listings!inner(user_id)")
    .eq("listing_id", listingId)
    .eq("storage_key", storageKey)
    .maybeSingle();
  const proprietaire = (photo as { listing?: { user_id?: string } | { user_id?: string }[] } | null)?.listing;
  const userId = Array.isArray(proprietaire) ? proprietaire[0]?.user_id : proprietaire?.user_id;
  if (!photo || userId !== appelant) return ok("photo-inconnue");

  // L'interrupteur et les seuils vivent dans les réglages de modération.
  const { data: reglages } = await service.from("moderation_settings").select("key, value").in("key", ["regles", "images"]);
  const regles = (reglages ?? []).find((r) => r.key === "regles")?.value as Record<string, boolean> | undefined;
  if (regles && regles.images === false) return ok("analyse-desactivee");
  const seuils = { ...SEUILS_DEFAUT, ...((reglages ?? []).find((r) => r.key === "images")?.value as Partial<Seuils> | undefined) };

  const urlPhoto = `${URL_SUPABASE}/storage/v1/object/public/photos/${storageKey}`;
  const params = new URLSearchParams({ url: urlPhoto, models: MODELES, api_user: SE_USER, api_secret: SE_SECRET });
  let brut: Record<string, unknown>;
  try {
    const rep = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`, { signal: AbortSignal.timeout(15_000) });
    brut = (await rep.json()) as Record<string, unknown>;
    if (brut.status !== "success") {
      console.error("Sightengine :", brut.error ?? brut);
      return ok("analyse-indisponible");
    }
  } catch (e) {
    console.error("Sightengine :", e);
    return ok("analyse-indisponible");
  }

  const lecture = interpreter(brut, seuils);
  // On ne garde que les scores, jamais l'image ni la réponse complète.
  const { error: majErr } = await service
    .from("listing_photos")
    .update({ moderation: { resume: lecture.resume, scores: lecture.scores, le: new Date().toISOString() }, moderation_niveau: lecture.niveau })
    .eq("id", (photo as { id: string }).id);
  if (majErr) {
    console.error("Photo non annotée :", majErr.message);
    return ok("ecriture-impossible");
  }
  const { error: evalErr } = await service.rpc("evaluer_annonce", { p_listing_id: listingId });
  if (evalErr) console.error("Réévaluation :", evalErr.message);

  return ok("analysee", { niveau: lecture.niveau });
}
