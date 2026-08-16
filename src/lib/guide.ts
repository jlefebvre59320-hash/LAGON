/* St Barth Guide — l'annuaire de l'île : plages, points de vue,
   incontournables, lieux publics, associations, bons plans. */

export type PlaceCategory =
  | "plage"
  | "point_de_vue"
  | "incontournable"
  | "lieu_public"
  | "association"
  | "bon_plan";

export type Place = {
  id: string;
  category: PlaceCategory;
  name: string;
  quartier: string;
  description: string;
  /* Conseil pratique : accès, meilleur moment, prudence… */
  tip: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  /* Position indicative — affinable fiche par fiche par l'admin */
  lat: number | null;
  lng: number | null;
  status: "active" | "hidden";
  created_at: string;
};

export const CATEGORY_ORDER: PlaceCategory[] = [
  "plage",
  "point_de_vue",
  "incontournable",
  "lieu_public",
  "association",
  "bon_plan",
];

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  plage: "Plages",
  point_de_vue: "Points de vue",
  incontournable: "Incontournables",
  lieu_public: "Lieux publics",
  association: "Associations",
  bon_plan: "Bons plans",
};

export const CATEGORY_ONE: Record<PlaceCategory, string> = {
  plage: "Plage",
  point_de_vue: "Point de vue",
  incontournable: "Incontournable",
  lieu_public: "Lieu public",
  association: "Association",
  bon_plan: "Bon plan",
};

/* Pictos filaires (paths 24×24), dans l'esprit des glyphes Food */
export const CATEGORY_GLYPH: Record<PlaceCategory, string> = {
  plage: "M2 18 q5 -3 10 0 t10 0 M2 21.5 q5 -3 10 0 t10 0 M17 3 a4.5 4.5 0 0 0 -4.5 7.5 L17 7 z M17 3 a4.5 4.5 0 0 1 4.2 6.2 L17 7 z",
  point_de_vue: "M12 5 a9 9 0 0 1 9 9 h-3.5 a5.5 5.5 0 0 0 -11 0 H3 a9 9 0 0 1 9 -9 M12 14 l4 -4 M2 19 h20",
  incontournable: "M12 3 l2.5 5.5 6 .7 -4.4 4.1 1.2 5.9 -5.3 -3 -5.3 3 1.2 -5.9 L3.5 9.2 l6 -.7 z",
  lieu_public: "M4 21 v-11 l8 -6 8 6 v11 M9 21 v-6 h6 v6 M2 21 h20",
  association: "M8 11 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 M2.5 20 a5.5 5.5 0 0 1 11 0 M16 11 a3 3 0 1 0 0 -6 M15 14.6 a5.5 5.5 0 0 1 6.5 5.4",
  bon_plan: "M12 2 l1.8 4.6 4.9 .3 -3.8 3.1 1.3 4.8 -4.2 -2.7 -4.2 2.7 1.3 -4.8 L5.3 6.9 l4.9 -.3 z M12 17 v5 M8 20 h8",
};

/* Nuance propre à chaque catégorie, dans la gamme bleue du Guide */
export const CATEGORY_HUE: Record<PlaceCategory, string> = {
  plage: "#1f7089",
  point_de_vue: "#23697b",
  incontournable: "#8a6d2f",
  lieu_public: "#3f6470",
  association: "#2f7a5f",
  bon_plan: "#a05e3b",
};

export function mapsUrlPlace(p: Place) {
  if (p.lat != null && p.lng != null)
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} Saint-Barthélemy`)}`;
}
