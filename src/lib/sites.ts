/* Famille de sites St Barth.
   Un seul code, une charte commune, une couleur et un contenu par site.
   Le site courant est choisi par NEXT_PUBLIC_SITE au déploiement : la même base
   de code sert donc plusieurs domaines, sans copier-coller de projet.

   Ajouter un site = une entrée ici + un bloc de couleurs dans globals.css
   (`:root[data-site="…"]`). Rien d'autre à toucher : tous les composants lisent
   les variables de la charte. */

export type SiteKey = "tikanal" | "event" | "food";

export type SiteDef = {
  key: SiteKey;
  /* Nom affiché dans le logo (sérif) */
  name: string;
  /* Sur-titre en capitales espacées */
  overline: string;
  /* Baseline sous la marque */
  baseline: string;
  /* Phrase de description (métadonnées, pied de page) */
  description: string;
  /* Point de couleur dans le sélecteur */
  dot: string;
  /* Teinte de la barre système du téléphone : le fond de bandeau du site */
  themeColor: string;
  /* Adresse publique. null = pas encore en ligne : le sélecteur l'affiche
     « bientôt » plutôt que de proposer un lien mort. */
  url: string | null;
};

export const SITES: Record<SiteKey, SiteDef> = {
  tikanal: {
    key: "tikanal",
    name: "Ti Kanal",
    overline: "St Barth",
    baseline: "Échanges & petites annonces",
    description:
      "Les échanges et petites annonces de Saint-Barthélemy : véhicules et nautisme, immobilier, emploi, achats et ventes.",
    dot: "#c9a86a",
    themeColor: "#05282c",
    url: "https://lagon-orcin.vercel.app",
  },
  event: {
    key: "event",
    name: "St Barth Event",
    overline: "St Barth",
    baseline: "Sorties & évènements",
    description:
      "L'agenda de Saint-Barthélemy : soirées, concerts, régates, marchés et évènements de l'île.",
    dot: "#e0855f",
    themeColor: "#101f3c",
    url: null,
  },
  food: {
    key: "food",
    name: "St Barth Food",
    overline: "St Barth",
    baseline: "Tables & saveurs",
    description:
      "Où manger à Saint-Barthélemy : restaurants, tables de plage, food trucks, traiteurs et bonnes adresses de l'île.",
    dot: "#d9a05b",
    themeColor: "#33201c",
    url: "https://st-barth-food.vercel.app",
  },
};

export const SITE_ORDER: SiteKey[] = ["tikanal", "event", "food"];

function readSiteKey(): SiteKey {
  const raw = process.env.NEXT_PUBLIC_SITE;
  return raw && raw in SITES ? (raw as SiteKey) : "tikanal";
}

export const CURRENT_SITE_KEY = readSiteKey();
export const SITE = SITES[CURRENT_SITE_KEY];
