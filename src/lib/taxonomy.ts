/* Taxonomie des 4 univers + définitions de champs dynamiques.
   Source unique de vérité v1 (en code, pas en base) : un critère s'ajoute
   ici et se déploie. Passage en table de config seulement si le besoin
   d'édition sans déploiement se confirme. */

export type ModuleKey = "vehicle" | "housing" | "job" | "goods";

/* Sens de l'annonce : 'offer' = je propose (le cas courant, valeur par défaut),
   'wanted' = je recherche. Le vocabulaire change selon l'univers — on ne « vend »
   pas une location ni un poste. */
export type Intent = "offer" | "wanted";

export const INTENT_ORDER: Intent[] = ["offer", "wanted"];

export const INTENT_LABEL: Record<ModuleKey, Record<Intent, string>> = {
  vehicle: { offer: "Je vends", wanted: "Je recherche" },
  housing: { offer: "Je propose", wanted: "Je recherche" },
  job:     { offer: "Je propose", wanted: "Je recherche" },
  goods:   { offer: "Je vends", wanted: "Je recherche" },
};

/* Filtre de l'accueil : on se place du côté du visiteur, pas de l'annonceur. */
export const INTENT_FILTER: Record<Intent, string> = {
  offer: "Propositions",
  wanted: "Recherches",
};

/* Pastille sur la carte : rien pour une proposition (c'est la norme, l'afficher
   ne dirait rien), une pastille nette pour une recherche. */
export const INTENT_BADGE: Record<Intent, string | null> = {
  offer: null,
  wanted: "Recherche",
};

export type FieldDef = {
  k: string;                       // libellé = clé dans attrs (affichage direct)
  t: "text" | "number" | "select";
  o?: string[];                    // options si select
  ph?: string;                     // placeholder
  adv?: boolean;                   // replié derrière "Plus de détails"
};

/* Palette dérivée de la charte Ti Kanal : chaque univers garde sa couleur
   propre — marine, bronze, palme, terre cuite — mais toujours dans les tons
   de la charte, jamais une couleur vive hors charte. L'accueil, lui, reste
   en vert lagon et or : la marque d'abord, les univers ensuite.
   `color` : aplats et texte sur blanc (contraste ≥ 4.5:1)
   `soft`  : fond teinté crème · `dark` : texte sur ce fond. */
export const MODULES: Record<ModuleKey, {
  label: string; short: string; color: string; soft: string; dark: string;
  subs: string[];
}> = {
  vehicle: {
    label: "Véhicules & Nautisme", short: "Véhicules",
    color: "#14607f", soft: "#e5eef2", dark: "#0f4c63",
    subs: [
      "Voitures", "Utilitaires", "Scooters & Motos", "Quads & Buggys",
      "Vélos & Trottinettes", "Bateaux à moteur", "Voiliers", "Jetskis",
      "Pièces auto/moto", "Accastillage & équipement bateau", "Places de port",
    ],
  },
  housing: {
    label: "Immobilier", short: "Immobilier",
    color: "#96691d", soft: "#f6eeda", dark: "#6f4c10",
    subs: [
      "Location à l'année", "Location saisonnière", "Colocation",
      "Vente", "Bureaux & Locaux", "Terrains",
    ],
  },
  job: {
    label: "Emploi & Services", short: "Emploi",
    color: "#2f6b4f", soft: "#e8f1eb", dark: "#1e4b37",
    subs: [
      "Offres d'emploi", "Candidats", "Services entre particuliers", "Cours & Formations",
    ],
  },
  goods: {
    label: "Achats & Ventes", short: "Achats",
    color: "#a04e30", soft: "#f8ece6", dark: "#7a3a22",
    /* Ordonné par thème : la maison d'abord (le plus demandé sur l'île),
       puis l'électronique, la personne, les loisirs, le pro. */
    subs: [
      "Meubles", "Maison & Déco", "Cuisine & Arts de la table", "Linge de maison",
      "Électroménager", "Climatisation & Ventilation", "Énergie & Groupe électrogène",
      "Mobilier de jardin & Extérieur", "Piscine & Spa",
      "Bricolage & Jardin", "Outillage", "Matériaux & Chantier",
      "Électronique & TV", "Informatique", "Téléphonie", "Jeux vidéo & Consoles",
      "Vêtements & Chaussures", "Bagagerie & Voyage", "Beauté & Bien-être",
      "Sport & Loisirs", "Plage & Plein air", "Instruments de musique",
      "Livres, Musique & Films", "Puériculture", "Animaux (accessoires)",
      "Matériel pro & Restauration", "Dons (gratuit)", "Autre",
    ],
  },
};

/* Ordre voulu par l'éditeur du site, appliqué partout d'un seul endroit :
   filtres de l'accueil, choix de catégorie au dépôt, colonnes des stats. */
export const MODULE_ORDER: ModuleKey[] = ["goods", "vehicle", "job", "housing"];

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
    case "goods": {
      if (sub === "Matériaux & Chantier") return [
        ETAT,
        { k: "Quantité", t: "text", ph: "ex : 12 sacs, 30 m²" },
        { k: "Dimensions", t: "text", ph: "ex : L 200 x P 90 cm", adv: true },
        { k: "Remise", t: "select", o: ["Main propre", "Livraison possible sur l'île", "Les deux"], adv: true },
      ];
      return [
        ETAT,
        { k: "Marque", t: "text", ph: "optionnel", adv: true },
        { k: "Dimensions", t: "text", ph: "ex : L 200 x P 90 cm", adv: true },
        { k: "Sous garantie", t: "select", o: ["Oui", "Non"], adv: true },
        { k: "Remise", t: "select", o: ["Main propre", "Livraison possible sur l'île", "Les deux"], adv: true },
      ];
    }
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
