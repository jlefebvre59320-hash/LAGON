/* Fiche publique d'un membre — ce que rend fiche_membre() côté SQL. */

export type Avis = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  auteur_id: string;
  auteur_nom: string;
  annonce: string | null;
};

export type FicheMembre = {
  id: string;
  display_name: string;
  is_pro: boolean;
  membre_depuis: string;
  quartier: string | null;
  a_whatsapp: boolean;
  messagerie: boolean;
  note_moyenne: number | null;
  nb_notes: number;
  repartition: Record<"1" | "2" | "3" | "4" | "5", number>;
  annonces_total: number;
  annonces_actives: number;
  annonces_vendues: number;
  conversations_recues: number;
  /* null tant qu'il y a moins de trois conversations : un pourcentage sur
     deux échanges ne veut rien dire. */
  taux_reponse: number | null;
  avis: Avis[];
  /* Pour le visiteur connecté : la conversation depuis laquelle il peut
     noter cette personne, s'il en a une où elle a répondu. */
  conversation_notable: string | null;
  ma_note: { stars: number; comment: string | null; conversation_id: string } | null;
};

export const COMMENTAIRE_MAX = 300;

/* « 4,7 » plutôt que « 4.70 » : une note se lit comme un nombre français,
   et la seconde décimale n'apporte rien à l'œil. */
export function noteCourte(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/* Le temps passé sur le site est un signal de confiance à lui seul : on
   l'exprime en mots plutôt qu'en date brute. */
export function ancienneteMembre(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (jours < 30) return "Nouveau membre";
  if (jours < 365) {
    const mois = Math.floor(jours / 30);
    return `Membre depuis ${mois} mois`;
  }
  const ans = Math.floor(jours / 365);
  return `Membre depuis ${ans} an${ans > 1 ? "s" : ""}`;
}

/* Le libellé qui accompagne une moyenne. Il ne dit jamais « 0 étoile » :
   l'absence de note est un état, pas une mauvaise note. */
export function libelleNote(moyenne: number | null, nb: number): string {
  if (moyenne == null || nb === 0) return "Pas encore de note";
  return `${noteCourte(moyenne)} sur 5 · ${nb} avis`;
}
