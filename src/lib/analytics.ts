"use client";
import { supabase } from "./supabase";

const VIEWER_KEY = "tk_viewer";

/* Identifiant aléatoire de navigateur, tiré une fois et gardé en local.
   Aucun lien avec un compte, aucune donnée personnelle : il sert seulement à
   ne pas compter dix visiteurs quand une personne recharge dix fois la page. */
function viewerKey(): string | null {
  try {
    let key = localStorage.getItem(VIEWER_KEY);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(VIEWER_KEY, key);
    }
    return key;
  } catch {
    return null; // navigation privée, stockage refusé : on compte sans dédoublonner
  }
}

/* Une vue par page et par onglet. L'échec est silencieux : une statistique
   perdue ne doit jamais casser l'affichage d'une annonce. */
export async function recordView(path: string, listingId?: string) {
  if (typeof window === "undefined") return;
  try {
    const once = `tk_seen:${path}`;
    if (sessionStorage.getItem(once)) return;
    sessionStorage.setItem(once, "1");
    await supabase().from("page_views").insert({
      path,
      listing_id: listingId ?? null,
      viewer_key: viewerKey(),
    });
  } catch {
    /* ignoré volontairement */
  }
}
