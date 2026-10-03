/* Le temps réel de l'administration : la forme de ce que rend
   admin_temps_reel() (migration 0037), et quelques aides d'affichage. */

export type TempsReel = {
  a: string;
  maintenant: {
    visiteurs_5min: number; pages_5min: number;
    visiteurs_60min: number; pages_60min: number;
    visiteurs_jour: number; pages_jour: number;
  };
  par_minute: { t: string; n: number }[];
  sessions_actives: {
    cle: string; debut: string; fin: string; duree_s: number; pages: number;
    device: string | null; source: string | null; derniere: string; titre: string | null;
  }[];
  sessions_jour: {
    nb: number; duree_moyenne_s: number; duree_mediane_s: number; duree_max_s: number;
    pages_moyennes: number; rebond_pct: number; visiteurs_revenus: number;
  };
  appareils_60min: Record<string, number>;
  sources_60min: Record<string, number>;
  appareils_jour: Record<string, number>;
  sources_jour: Record<string, number>;
  pages_top: { path: string; titre: string | null; n: number; visiteurs: number }[];
  flux: { t: string; path: string; titre: string | null; device: string | null; source: string | null; cle: string }[];
  comptes: {
    total: number; connectes_30min: number; connectes_24h: number;
    connexions_jour: number; nouveaux_jour: number; nouveaux_7j: number;
    dernieres: { id: string; nom: string; email: string | null; quand: string; inscrit: string; nouveau: boolean }[];
  };
  activite_jour: {
    annonces: number; annonces_60min: number; messages: number; messages_60min: number;
    conversations: number; signalements: number; alertes: number; favoris: number;
    en_attente: number; en_ligne: number;
  };
};

/* « 2 min 05 », « 48 s », « 1 h 12 » : une durée qu'on lit d'un coup. */
export function duree(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0 s";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  if (m < 60) return `${m} min${r ? ` ${String(r).padStart(2, "0")}` : ""}`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h} h${rm ? ` ${String(rm).padStart(2, "0")}` : ""}`;
}

/* « à l'instant », « il y a 40 s », « il y a 3 min », « il y a 2 h ». */
export function ilYA(iso: string, maintenant = Date.now()): string {
  const s = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 1000));
  if (s < 8) return "à l’instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/* Le nom lisible d'une page mesurée. */
export function nomPage(path: string, titre: string | null): string {
  if (titre) return titre;
  if (path === "/") return "Accueil";
  if (path === "/soutenir") return "Soutenir";
  if (path.startsWith("/annonce/")) return "Annonce supprimée";
  return path;
}

export function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
