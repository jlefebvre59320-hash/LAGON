"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session";

type Ctx = {
  ids: Set<string>;
  ready: boolean;
  userId: string | null;
  toggle: (targetId: string) => Promise<void>;
};

const FavoritesContext = createContext<Ctx | null>(null);

/* Deux univers, deux listes : les favoris d'annonces et les favoris de
   restaurants ne se mélangent pas — ni en base, ni dans Mon espace. */
export type FavoriteKind = "listing" | "restaurant";

const TABLES: Record<FavoriteKind, { table: string; column: string }> = {
  listing: { table: "favorites", column: "listing_id" },
  restaurant: { table: "restaurant_favorites", column: "restaurant_id" },
};

/* Les favoris de l'utilisateur sont chargés une seule fois pour toute la page,
   pas une requête par carte. L'état bascule tout de suite à l'écran et se
   rattrape en base ensuite. */
export function FavoritesProvider({ children, kind = "listing" }: {
  children: React.ReactNode;
  kind?: FavoriteKind;
}) {
  const { table, column } = TABLES[kind];
  const { userId, ready: sessionReady } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId) { setIds(new Set()); setReady(true); return; }

    let alive = true;
    (async () => {
      const { data } = await supabase().from(table).select(column).eq("user_id", userId);
      if (!alive) return;
      setIds(new Set(((data ?? []) as unknown as Record<string, string>[]).map((r) => r[column])));
      setReady(true);
    })();
    return () => { alive = false; };
  }, [userId, sessionReady, table, column]);

  const toggle = useCallback(async (targetId: string) => {
    if (!userId) return;
    const on = ids.has(targetId);
    const next = new Set(ids);
    if (on) next.delete(targetId); else next.add(targetId);
    setIds(next);

    const sb = supabase();
    const { error } = on
      ? await sb.from(table).delete().eq("user_id", userId).eq(column, targetId)
      : await sb.from(table).insert({ user_id: userId, [column]: targetId });

    if (error) setIds(ids); // la base a refusé : on remet l'état d'avant
  }, [ids, userId, table, column]);

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
