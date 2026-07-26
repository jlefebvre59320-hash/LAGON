/* Famille St Barth — une seule application, une seule adresse.
   Ti Kanal est le site ; St Barth Food et St Barth Event en sont des
   sections (/food, /event), chacune avec sa marque et ses couleurs.
   Les couleurs d'une section viennent d'un bloc [data-site="…"] dans
   globals.css, posé par le layout de la section. */

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
  /* Teinte de la barre système du téléphone sur cette section */
  themeColor: string;
  /* Chemin de la section dans l'application */
  path: string;
  /* false = la section existe en page d'attente ; le sélecteur l'annonce « bientôt » */
  ready: boolean;
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
    path: "/",
    ready: true,
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
    path: "/event",
    ready: false,
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
    path: "/food",
    ready: true,
  },
};

export const SITE_ORDER: SiteKey[] = ["tikanal", "event", "food"];

/* Section correspondant à un chemin — pour marquer « Vous êtes ici ». */
export function siteFromPath(pathname: string): SiteKey {
  if (pathname === "/food" || pathname.startsWith("/food/")) return "food";
  if (pathname === "/event" || pathname.startsWith("/event/")) return "event";
  return "tikanal";
}
