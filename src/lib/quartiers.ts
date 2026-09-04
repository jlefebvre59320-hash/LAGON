/* Les quartiers de Saint-Barthélemy, tels qu'on les dit sur l'île. L'ordre
   suit l'usage : les plus peuplés d'abord. Sert au filtre de l'accueil, aux
   alertes et à la saisie du lieu d'une annonce. */
export const QUARTIERS = [
  "Gustavia", "Saint-Jean", "Lorient", "Flamands", "Colombier", "Corossol",
  "Public", "Anse des Cayes", "Pointe Milou", "Marigot", "Vitet", "Camaruche",
  "Grand Cul-de-Sac", "Petit Cul-de-Sac", "Toiny", "Grand Fond", "Saline",
  "Lurin", "Gouverneur", "Devé", "Merlette", "Terre Neuve",
] as const;

export type Quartier = (typeof QUARTIERS)[number];
