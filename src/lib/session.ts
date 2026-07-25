"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* Session courante, tenue à jour : connexion et déconnexion se répercutent
   immédiatement sur l'en-tête et les boutons favori, sans rechargement. */
export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        setUserId(data.session?.user.id ?? null);
        setReady(true);
      });

    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });

    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  return { userId, ready };
}
