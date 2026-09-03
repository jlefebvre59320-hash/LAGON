/* Tableau de bord administrateur — types et mise en forme.
   Tout vient de la fonction SQL admin_dashboard : rien n'est calculé
   deux fois côté navigateur, rien n'est inventé quand la donnée manque. */

export type Granularite = "heure" | "jour" | "semaine" | "mois";

export type Periode = {
  jours: number;
  granularite: Granularite;
  debut: string;
  fin: string;
  debut_precedent: string;
};

export type Kpi = { actuel: number; precedent?: number };

export type PointFrequentation = { t: string; vues: number; visiteurs: number };
export type PointAnnonces = { t: string; publiees: number; vendues: number };
export type PointComptes = { t: string; nouveaux: number };

export type Dashboard = {
  periode: Periode;
  kpi: {
    vues: Kpi; visiteurs: Kpi; annonces: Kpi;
    comptes: Kpi; favoris: Kpi; annonces_actives: Kpi;
  };
  serie: PointFrequentation[];
  serie_annonces: PointAnnonces[];
  serie_comptes: PointComptes[];
  categories: { module: string; annonces: number; vues: number }[];
  pages: { path: string; titre: string; vues: number; visiteurs: number }[];
  sources: { cle: string; vues: number }[];
  appareils: { cle: string; vues: number }[];
};

export const PERIODES: { jours: number; label: string; court: string }[] = [
  { jours: 1, label: "Aujourd'hui", court: "Auj." },
  { jours: 7, label: "7 jours", court: "7 j" },
  { jours: 30, label: "30 jours", court: "30 j" },
  { jours: 90, label: "3 mois", court: "3 m" },
  { jours: 365, label: "12 mois", court: "12 m" },
];

export const SOURCE_LABEL: Record<string, string> = {
  direct: "Accès direct",
  google: "Recherche Google",
  bing: "Recherche Bing",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  autre: "Autres sites",
};

export const APPAREIL_LABEL: Record<string, string> = {
  mobile: "Mobile",
  ordinateur: "Ordinateur",
  tablette: "Tablette",
};

/* L'axe des abscisses ne dit pas la même chose selon le pas : une heure
   sur une journée, un mois sur un an. Un format unique serait illisible
   dans un cas et redondant dans l'autre. */
export function libelleTemps(iso: string, g: Granularite, long = false): string {
  const d = new Date(iso);
  switch (g) {
    case "heure":
      return long
        ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : `${d.getHours()} h`;
    case "jour":
      return d.toLocaleDateString("fr-FR",
        long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
    case "semaine":
      return long
        ? `Semaine du ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
        : `${d.getDate()} ${d.toLocaleDateString("fr-FR", { month: "short" })}`;
    case "mois":
      return d.toLocaleDateString("fr-FR",
        long ? { month: "long", year: "numeric" } : { month: "short" });
  }
}

/* Évolution en pourcentage, ou null quand elle ne veut rien dire.
   Partir de zéro n'est pas « +100 % », c'est un départ : afficher un
   pourcentage dans ce cas donnerait une progression imaginaire. */
export function evolution(k: Kpi): number | null {
  if (k.precedent == null) return null;
  if (k.precedent === 0) return null;
  return Math.round(((k.actuel - k.precedent) / k.precedent) * 100);
}

export function entier(n: number): string {
  return n.toLocaleString("fr-FR");
}

/* Le libellé de comparaison suit la période choisie : « vs hier » est plus
   parlant que « vs période précédente » quand la période est la journée. */
export function libelleComparaison(jours: number): string {
  switch (jours) {
    case 1: return "vs hier";
    case 7: return "vs 7 jours avant";
    case 30: return "vs 30 jours avant";
    case 90: return "vs 3 mois avant";
    default: return "vs 12 mois avant";
  }
}
