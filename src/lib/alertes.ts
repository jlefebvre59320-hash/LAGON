"use client";
import { supabase } from "./supabase";
import { MODULES, type Intent, type ModuleKey } from "./taxonomy";

/* Alertes de recherche : une recherche qu'on garde, et qui prévient. */

export type Alerte = {
  id: string;
  module: ModuleKey | null;
  subcategory: string | null;
  intent: Intent | null;
  query: string | null;
  min_cents: number | null;
  max_cents: number | null;
  quartier: string | null;
  /* Critères d'un univers (zone d'intervention, tarification…), migration 0036. */
  attrs?: Record<string, string> | null;
  created_at: string;
  last_hit_at: string | null;
};

export type CriteresAlerte = Omit<Alerte, "id" | "created_at" | "last_hit_at">;

export const ALERTES_MAX = 10;

/* Une phrase qui dit ce qu'on surveille : « Véhicules · Voiture · à vendre ·
   jusqu'à 15 000 € · Lorient ». */
export function decrireAlerte(a: CriteresAlerte): string {
  const parts: string[] = [];
  if (a.module) parts.push(MODULES[a.module].label);
  if (a.subcategory) parts.push(a.subcategory);
  if (a.intent) parts.push(a.intent === "wanted" ? "recherches" : "propositions");
  if (a.query) parts.push(`« ${a.query} »`);
  if (a.min_cents != null && a.max_cents != null) parts.push(`${a.min_cents / 100} à ${a.max_cents / 100} €`);
  else if (a.min_cents != null) parts.push(`à partir de ${a.min_cents / 100} €`);
  else if (a.max_cents != null) parts.push(`jusqu’à ${a.max_cents / 100} €`);
  if (a.quartier) parts.push(a.quartier);
  if (a.attrs) parts.push(...Object.values(a.attrs).filter(Boolean));
  return parts.join(" · ") || "Toutes les annonces";
}

export async function creerAlerte(c: CriteresAlerte): Promise<{ error: string | null }> {
  const sb = supabase();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return { error: "connexion" };
  /* attrs n'existe qu'à partir de 0036 : on ne l'envoie que s'il y a
     quelque chose dedans, pour ne pas faire échouer une base pas encore
     migrée sur une alerte sans critère de service. */
  const { attrs, ...reste } = c;
  const ligne = { user_id: s.session.user.id, ...reste, ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}) };
  const { error } = await sb.from("search_alerts").insert(ligne);
  return { error: error ? error.message : null };
}

export async function mesAlertes(): Promise<Alerte[]> {
  const { data } = await supabase().from("search_alerts").select("*").order("created_at", { ascending: false });
  return Array.isArray(data) ? (data as Alerte[]) : [];
}

export async function supprimerAlerte(id: string): Promise<boolean> {
  const { error } = await supabase().from("search_alerts").delete().eq("id", id);
  return !error;
}

/* Demande au serveur de prévenir les alertes qui attendent cette annonce.
   Silencieux : c'est un bonus pour les autres, pas une étape du dépôt. */
export async function notifierAlertes(listingId: string): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/alertes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ listing_id: listingId }),
      keepalive: true,
    });
  } catch {
    /* silence volontaire */
  }
}
