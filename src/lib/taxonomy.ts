/* Taxonomie des 4 univers + définitions de champs dynamiques.
   Source unique de vérité v1 (en code, pas en base) : un critère s'ajoute
   ici et se déploie. Passage en table de config seulement si le besoin
   d'édition sans déploiement se confirme. */

export type ModuleKey = "vehicle" | "housing" | "job" | "goods";

export type FieldDef = {
  k: string;                       // libellé = clé dans attrs (affichage direct)
  t: "text" | "number" | "select";
  o?: string[];                    // options si select
  ph?: string;                     // placeholder
  adv?: boolean;                   // replié derrière "Plus de détails"
};

export const MODULES: Record<ModuleKey, {
  label: string; short: string; color: string; soft: string; dark: string;
  icon: string; subs: string[];
}> = {
  vehicle: {
    label: "Véhicules & Nautisme", short: "Véhicules",
    color: "#1e6fd9", soft: "#e8f1fc", dark: "#154e99", icon: "🛵",
    subs: [
      "Voitures", "Utilitaires", "Scooters & Motos", "Quads & Buggys",
      "Vélos & Trottinettes", "Bateaux à moteur", "Voiliers", "Jetskis",
      "Pièces auto/moto", "Accastillage & équipement bateau", "Places de port",
    ],
  },
  housing: {
    label: "Immobilier", short: "Immobilier",
    color: "#c78f00", soft: "#fdf6e0", dark: "#8f6700", icon: "🏠",
    subs: [
      "Location à l'année", "Location saisonnière", "Colocation",
      "Vente", "Bureaux & Locaux", "Terrains",
    ],
  },
  job: {
    label: "Emploi & Services", short: "Emploi",
    color: "#1f9d55", soft: "#e6f6ec", dark: "#15703c", icon: "💼",
    subs: [
      "Offres d'emploi", "Candidats", "Services entre particuliers", "Cours & Formations",
    ],
  },
  goods: {
    label: "Achats & Ventes", short: "Achats",
    color: "#e0532f", soft: "#fdece7", dark: "#a83a1e", icon: "📦",
    subs: [
      "Meubles", "Électroménager", "Électronique & TV", "Informatique",
      "Téléphonie", "Jeux vidéo & Consoles", "Vêtements & Chaussures",
      "Maison & Déco", "Sport & Loisirs", "Plage & Plein air",
      "Bricolage & Jardin", "Puériculture", "Animaux (accessoires)",
      "Dons (gratuit)", "Autre",
    ],
  },
};

export const MODULE_ORDER: ModuleKey[] = ["vehicle", "housing", "job", "goods"];

const BOAT_SUBS = ["Bateaux à moteur", "Voiliers", "Jetskis"];
const BIKE_SUBS = ["Vélos & Trottinettes"];
const SALE_SUBS = ["Vente", "Terrains"];
const ETAT: FieldDef = { k: "État", t: "select", o: ["Neuf", "Très bon", "Bon", "À réparer"] };

export function fieldsFor(module: ModuleKey, sub: string): FieldDef[] {
  switch (module) {
    case "vehicle": {
      if (BOAT_SUBS.includes(sub)) return [
        { k: "Longueur (m)", t: "number" },
        { k: "Année", t: "number" },
        { k: "Moteur", t: "text", ph: "ex : Yamaha 90cv" },
        { k: "Heures moteur", t: "number" },
        { k: "Nombre de places", t: "number", adv: true },
        { k: "Place de port incluse", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Annexe incluse", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Remorque incluse", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Électronique", t: "text", ph: "ex : GPS, sondeur, VHF", adv: true },
        { ...ETAT, adv: true },
      ];
      if (BIKE_SUBS.includes(sub)) return [
        { k: "Type", t: "select", o: ["Vélo classique", "Vélo électrique", "Trottinette électrique"] },
        ETAT,
        { k: "Marque", t: "text", adv: true },
        { k: "Autonomie (km)", t: "number", adv: true },
        { k: "Taille cadre", t: "text", ph: "ex : M, 54 cm", adv: true },
      ];
      return [
        { k: "Marque", t: "text" },
        { k: "Modèle", t: "text" },
        { k: "Année", t: "number" },
        { k: "Kilométrage (km)", t: "number" },
        ETAT,
        { k: "Carburant", t: "select", o: ["Essence", "Diesel", "Électrique", "Hybride"], adv: true },
        { k: "Boîte", t: "select", o: ["Manuelle", "Automatique"], adv: true },
        { k: "Puissance (cv)", t: "number", adv: true },
        { k: "Nombre de places", t: "number", adv: true },
        { k: "Couleur", t: "text", adv: true },
        { k: "Première main", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Contrôle technique", t: "select", o: ["OK", "À prévoir", "Non concerné"], adv: true },
        { k: "Entretien suivi (factures)", t: "select", o: ["Oui", "Non"], adv: true },
      ];
    }
    case "housing": {
      const base: FieldDef[] = [
        { k: "Type de bien", t: "select", o: ["Studio", "Appartement", "Maison", "Villa", "Chambre", "Terrain", "Local"] },
        { k: "Surface (m²)", t: "number" },
        { k: "Nombre de pièces", t: "number" },
        { k: "Nombre de chambres", t: "number", adv: true },
        { k: "Salles de bain", t: "number", adv: true },
        { k: "Vue mer", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Piscine", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Climatisation", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Terrasse / Jardin", t: "select", o: ["Terrasse", "Jardin", "Les deux", "Aucun"], adv: true },
        { k: "Parking", t: "select", o: ["Oui", "Non"], adv: true },
      ];
      if (SALE_SUBS.includes(sub)) return base;
      const rental: FieldDef[] = [
        ...base.slice(0, 3),
        { k: "Meublé", t: "select", o: ["Oui", "Non"] },
        { k: "Disponible à partir de", t: "text", ph: "ex : 01/09/2026" },
        ...base.slice(3),
        { k: "Durée", t: "text", ph: "ex : saison 2026-2027, à l'année", adv: true },
        { k: "Charges comprises", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Caution demandée", t: "text", ph: "ex : 1 mois", adv: true },
        { k: "Colocataires acceptés", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Animaux acceptés", t: "select", o: ["Oui", "Non"], adv: true },
      ];
      if (sub === "Colocation") rental.push(
        { k: "Salle de bain privée", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Nombre de colocataires", t: "number", adv: true },
      );
      return rental;
    }
    case "job": return [
      { k: "Contrat", t: "select", o: ["CDI", "CDD", "Saisonnier", "Extra", "Freelance"] },
      { k: "Secteur", t: "select", o: ["Hôtellerie", "Restauration", "Bâtiment", "Nautisme", "Commerce", "Services", "Autre"] },
      { k: "Logé", t: "select", o: ["Oui", "Non", "À discuter"] },
      { k: "Date de début", t: "text", ph: "ex : 01/11/2026" },
      { k: "Salaire indicatif", t: "text", ph: "ex : 2 400 € net + logé", adv: true },
      { k: "Temps de travail", t: "select", o: ["Temps plein", "Temps partiel", "Extra / ponctuel"], adv: true },
      { k: "Expérience requise", t: "select", o: ["Débutant accepté", "1-3 ans", "3 ans et +"], adv: true },
      { k: "Permis requis", t: "select", o: ["Oui", "Non"], adv: true },
      { k: "Langues", t: "text", ph: "ex : français, anglais", adv: true },
      { k: "Nourri", t: "select", o: ["Oui", "Non"], adv: true },
    ];
    case "goods": return [
      ETAT,
      { k: "Marque", t: "text", ph: "optionnel", adv: true },
      { k: "Dimensions", t: "text", ph: "ex : L 200 x P 90 cm", adv: true },
      { k: "Sous garantie", t: "select", o: ["Oui", "Non"], adv: true },
      { k: "Remise", t: "select", o: ["Main propre", "Livraison possible sur l'île", "Les deux"], adv: true },
    ];
  }
}

export const eur = (cents: number | null) =>
  cents === 0 ? "Gratuit"
  : cents == null ? null
  : (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export const priceSuffix = (module: ModuleKey, sub: string) => {
  if (module === "housing" && !SALE_SUBS.includes(sub)) return " /mois";
  if (sub === "Places de port") return " /mois";
  if (sub === "Services entre particuliers") return " /h";
  return "";
};
