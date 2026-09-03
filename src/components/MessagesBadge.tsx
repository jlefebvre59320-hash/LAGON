"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* Nombre de messages non lus, tenu à jour en direct.
 *
 * Deux sources se complètent : un décompte au chargement, et l'écoute
 * de la réplication temps réel de Postgres pour la suite. Sans la
 * première, la pastille resterait vide jusqu'au prochain message ;
 * sans la seconde, il faudrait recharger la page pour la voir bouger.
 *
 * Un seul compteur circule dans l'application via cet événement
 * interne : plusieurs pastilles à l'écran (bandeau, dock) restent donc
 * d'accord entre elles sans se parler.
 */
const EVENEMENT = "tikanal:messages-non-lus";

export function rafraichirPastille(n: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENEMENT, { detail: n }));
}

export function useMessagesNonLus(): number {
  const [n, setN] = useState(0);

  const recompter = useCallback(async () => {
    const { data, error } = await supabase().rpc("mes_messages_non_lus");
    // La fonction n'existe pas tant que la migration 0025 n'est pas passée :
    // dans ce cas on laisse la pastille éteinte plutôt que d'afficher une erreur.
    if (!error && typeof data === "number") {
      setN(data);
      rafraichirPastille(data);
    }
  }, []);

  useEffect(() => {
    let vivant = true;
    let canal: ReturnType<ReturnType<typeof supabase>["channel"]> | null = null;

    (async () => {
      const { data: session } = await supabase().auth.getSession();
      if (!vivant || !session.session) return;
      await recompter();
      if (!vivant) return;

      /* La réplication respecte la RLS : on ne reçoit que les insertions
         des conversations auxquelles on participe. Le décompte exact est
         redemandé à la base — le calculer ici obligerait à savoir si le
         fil concerné est déjà ouvert à l'écran. */
      canal = supabase()
        .channel("messages-non-lus")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => { void recompter(); })
        .subscribe();
    })();

    const surEvenement = (e: Event) => setN((e as CustomEvent<number>).detail);
    window.addEventListener(EVENEMENT, surEvenement);
    // Revenir sur l'onglet après une absence : la réplication a pu manquer
    // des événements pendant la mise en veille.
    const surReveil = () => { if (document.visibilityState === "visible") void recompter(); };
    document.addEventListener("visibilitychange", surReveil);

    return () => {
      vivant = false;
      window.removeEventListener(EVENEMENT, surEvenement);
      document.removeEventListener("visibilitychange", surReveil);
      if (canal) supabase().removeChannel(canal);
    };
  }, [recompter]);

  return n;
}

/* Pastille compacte, à poser sur un bouton existant. Au-delà de 9,
   « 9+ » : le chiffre exact n'apporte rien et casse la largeur. */
export default function MessagesBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="msg-pastille"
      aria-label={`${n} message${n > 1 ? "s" : ""} non lu${n > 1 ? "s" : ""}`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
