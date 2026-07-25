"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session";

type Ctx = {
  ids: Set<string>;
  ready: boolean;
  userId: string | null;
  toggle: (listingId: string) => Promise<void>;
};

const FavoritesContext = createContext<Ctx | null>(null);

/* Les favoris de l'utilisateur sont chargés une seule fois pour toute la page,
   pas une requête par carte. L'état bascule tout de suite à l'écran et se
   rattrape en base ensuite. */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { userId, ready: sessionReady } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId) { setIds(new Set()); setReady(true); return; }

    let alive = true;
    (async () => {
      const { data } = await supabase().from("favorites").select("listing_id").eq("user_id", userId);
      if (!alive) return;
      setIds(new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id)));
      setReady(true);
    })();
    return () => { alive = false; };
  }, [userId, sessionReady]);

  const toggle = useCallback(async (listingId: string) => {
    if (!userId) return;
    const on = ids.has(listingId);
    const next = new Set(ids);
    if (on) next.delete(listingId); else next.add(listingId);
    setIds(next);

    const sb = supabase();
    const { error } = on
      ? await sb.from("favorites").delete().eq("user_id", userId).eq("listing_id", listingId)
      : await sb.from("favorites").insert({ user_id: userId, listing_id: listingId });

    if (error) setIds(ids); // la base a refusé : on remet l'état d'avant
  }, [ids, userId]);

  return (
    <FavoritesContext.Provider value={{ ids, ready, userId, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

/* Hors provider (page sans favoris), renvoie un état inerte plutôt que de
   planter : le bouton favori peut alors être monté n'importe où. */
export function useFavorites(): Ctx {
  return useContext(FavoritesContext) ?? {
    ids: new Set<string>(), ready: false, userId: null, toggle: async () => {},
  };
}
