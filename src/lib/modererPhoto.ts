"use client";
import { supabase } from "./supabase";

/* Demande au serveur d'analyser une photo qui vient d'être déposée.
   Silencieux par construction : l'analyse est un filet, pas une étape du
   dépôt. Si la clé manque ou si le service répond mal, la photo reste et
   l'annonce suit son cours ; la base tranchera avec les autres signaux. */
export async function modererPhoto(listingId: string, storageKey: string): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/moderer-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ listing_id: listingId, storage_key: storageKey }),
      keepalive: true,
    });
  } catch {
    /* silence volontaire */
  }
}
