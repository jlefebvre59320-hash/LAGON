"use client";
import { Mark } from "@/components/Brand";

/* Un picto par type de cuisine, dessiné au trait dans la charte — même filet
   que le contour de l'île. Illustrations à nous : on n'a pas le droit d'usage
   des photos des établissements, et une image d'archive générique mentirait
   sur l'assiette. Le tracé est volontairement simple : il se lit à 60 px sur
   une carte comme à 110 px sur une fiche. */

const STROKE = 2.6;

const PATHS: Record<string, React.ReactNode> = {
  /* Cloche de service */
  "Français": (
    <>
      <path d="M8 32 h32" />
      <path d="M10 32 a14 14 0 0 1 28 0" />
      <path d="M24 16 v-3" />
      <circle cx="24" cy="11" r="1.8" />
      <path d="M6 37 h36" />
    </>
  ),
  /* Piment */
  "Créole & Caribéen": (
    <>
      <path d="M30 12 c1 -4 4 -6 8 -6 -3 1 -4 3 -4 6" />
      <path d="M30 12 c8 0 10 7 6 15 c-4 8 -14 14 -22 14 c-6 0 -8 -4 -5 -7 c6 2 12 0 16 -6 c3 -5 3 -12 5 -16 z" />
    </>
  ),
  /* Fourchette et torsade de pâtes */
  "Italien": (
    <>
      <path d="M15 6 v10 M20 6 v10 M25 6 v10" />
      <path d="M15 16 h10 a5 5 0 0 1 -5 5 a5 5 0 0 1 -5 -5 z" />
      <path d="M20 21 v20" />
      <path d="M30 34 a8 8 0 1 1 8 -8" />
      <path d="M33 32 a4.5 4.5 0 1 1 4.5 -4.5" />
    </>
  ),
  /* Poisson */
  "Poissons & Fruits de mer": (
    <>
      <path d="M8 24 c6 -8 16 -10 24 -4 l8 -6 -2 10 2 10 -8 -6 c-8 6 -18 4 -24 -4 z" />
      <circle cx="15" cy="22.5" r="1.6" />
    </>
  ),
  /* Flamme sur grille */
  "Grillades & Viandes": (
    <>
      <path d="M24 6 c4 5 8 8 8 13 a8 8 0 0 1 -16 0 c0 -3 1.5 -5 4 -8 c0 3 1 4 3 5 c0 -4 -1 -7 1 -10 z" />
      <path d="M10 34 h28 M14 40 h20" />
    </>
  ),
  /* Maki et baguettes */
  "Sushi & Asiatique": (
    <>
      <circle cx="20" cy="28" r="11" />
      <circle cx="20" cy="28" r="5" />
      <path d="M32 8 l10 22 M38 6 l4 26" />
    </>
  ),
  /* Part de pizza */
  "Pizza": (
    <>
      <path d="M8 14 a34 34 0 0 1 32 0 l-16 28 z" />
      <path d="M10 15.5 a30 30 0 0 1 28 0" />
      <circle cx="22" cy="22" r="2.2" />
      <circle cx="29" cy="27" r="2.2" />
      <circle cx="21" cy="31" r="2.2" />
    </>
  ),
  /* Burger */
  "Burgers & Snack": (
    <>
      <path d="M10 20 a14 10 0 0 1 28 0 z" />
      <path d="M9 26 h30" />
      <path d="M11 32 a4 4 0 0 0 4 4 h18 a4 4 0 0 0 4 -4 v-2 h-26 z" />
      <circle cx="18" cy="14" r="0.8" /><circle cx="24" cy="12.5" r="0.8" /><circle cx="30" cy="14" r="0.8" />
    </>
  ),
  /* Bol et feuille */
  "Salades & Healthy": (
    <>
      <path d="M8 24 h32 a16 16 0 0 1 -32 0 z" />
      <path d="M24 18 c0 -8 6 -12 12 -12 c0 8 -5 12 -12 12 z" />
      <path d="M24 18 c3 -4 6 -6 9 -7" />
    </>
  ),
  /* Tasse fumante */
  "Café & Brunch": (
    <>
      <path d="M10 20 h22 v10 a10 10 0 0 1 -22 0 z" />
      <path d="M32 22 h4 a4 4 0 0 1 0 8 h-4" />
      <path d="M17 14 c0 -2.5 2 -2.5 2 -5 M25 14 c0 -2.5 2 -2.5 2 -5" />
    </>
  ),
  /* Cornet deux boules */
  "Glaces & Desserts": (
    <>
      <path d="M16 22 l8 20 8 -20" />
      <circle cx="19" cy="16" r="6" />
      <circle cx="29" cy="16" r="6" />
    </>
  ),
  /* Camion */
  "Food truck": (
    <>
      <path d="M6 14 h22 v18 h-22 z" />
      <path d="M28 20 h8 l6 6 v6 h-14" />
      <circle cx="14" cy="36" r="3.5" />
      <circle cx="34" cy="36" r="3.5" />
      <path d="M9 18 h10 v6 h-10 z" />
    </>
  ),
  /* Plateau sous cloche basse */
  "Traiteur": (
    <>
      <path d="M12 28 a12 9 0 0 1 24 0" />
      <path d="M24 19 v-3" />
      <circle cx="24" cy="14" r="1.6" />
      <path d="M6 28 h36" />
      <path d="M14 34 h20" />
    </>
  ),
  /* Verre à cocktail */
  "Tapas & Cocktails": (
    <>
      <path d="M10 8 h28 l-14 14 z" />
      <path d="M24 22 v14 M16 40 h16" />
      <circle cx="19" cy="12" r="2" />
      <path d="M19 10 l3 -5" />
    </>
  ),
};

export default function CuisineIcon({ cuisine, size = 60, color = "var(--gold-deep)" }: {
  cuisine: string;
  size?: number;
  color?: string;
}) {
  const paths = PATHS[cuisine];
  /* Cuisine inconnue ou « À classer » : l'île, comme partout ailleurs. */
  if (!paths) return <Mark size={size} color={color} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"
      style={{ display: "block", color }}
      fill="none" stroke="currentColor" strokeWidth={STROKE}
      strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}
