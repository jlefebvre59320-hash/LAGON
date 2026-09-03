/* Modération et anti-arnaque : le vocabulaire partagé entre la fiche
   d'une annonce (signaler), l'espace de l'auteur (comprendre pourquoi son
   annonce attend) et l'administration (décider). La logique du score vit
   dans la base (migration 0032) ; ici on ne fait que la rendre lisible. */

/* Ti Kanal ne gère aucun paiement. La phrase est la même partout — fiche,
   messagerie — pour qu'on la reconnaisse d'un coup d'œil. */
export const AVERTISSEMENT_PAIEMENT =
  "Ti Kanal ne gère pas les paiements entre acheteurs et vendeurs. Ne versez jamais d’acompte ni de paiement à distance : privilégiez la remise en main propre, sur l’île.";

/* ---------- Signalement ---------- */

export type MotifSignalement =
  | "arnaque" | "interdit" | "sexuel" | "fausse" | "prix_trompeur"
  | "photo_suspecte" | "mauvaise_categorie" | "deja_vendue" | "spam" | "inapproprie" | "autre";

export const MOTIFS_SIGNALEMENT: { code: MotifSignalement; label: string; aide: string }[] = [
  { code: "arnaque",            label: "Arnaque ou annonce suspecte", aide: "Paiement à distance demandé, vendeur à l’étranger, histoire qui ne tient pas." },
  { code: "interdit",           label: "Produit ou service interdit", aide: "Arme, drogue, médicament, contrefaçon, document officiel…" },
  { code: "sexuel",             label: "Contenu sexuel",              aide: "Annonce ou photo à caractère sexuel, service sexuel proposé." },
  { code: "fausse",             label: "Annonce fausse",              aide: "Le bien n’existe pas ou n’est pas celui décrit." },
  { code: "prix_trompeur",      label: "Prix trompeur",               aide: "Prix affiché sans rapport avec ce qui est demandé ensuite." },
  { code: "photo_suspecte",     label: "Photo suspecte",              aide: "Photo volée, vue ailleurs, ou qui ne correspond pas." },
  { code: "mauvaise_categorie", label: "Mauvaise catégorie",          aide: "L’annonce n’est pas dans le bon univers ou la bonne rubrique." },
  { code: "deja_vendue",        label: "Déjà vendue",                 aide: "Le vendeur a confirmé que ce n’est plus disponible." },
  { code: "spam",               label: "Spam ou doublon",             aide: "Annonce répétée, publicité déguisée." },
  { code: "inapproprie",        label: "Contenu inapproprié",         aide: "Insultes, menaces, propos haineux, contenu choquant." },
  { code: "autre",              label: "Autre",                       aide: "Expliquez en quelques mots." },
];

/* La phrase que lit l'auteur d'une annonce ou d'un message refusé. Jamais
   les termes détectés : un filtre dont on connaît la liste se contourne. */
export const MESSAGE_CONTENU_REFUSE =
  "Cette annonce ne peut pas être publiée car son contenu ne respecte pas les règles de Ti Kanal.";

export const MOTIF_LABEL: Record<string, string> = Object.fromEntries(
  MOTIFS_SIGNALEMENT.map((m) => [m.code, m.label]),
);

/* ---------- Le score et ses raisons ---------- */

export type RaisonRisque = { code: string; detail: string; points: number };

export const RAISON_LABEL: Record<string, string> = {
  terme_interdit:     "Terme interdit",
  texte_interdit:     "Terme de la liste de blocage",
  contenu_sexuel:     "Contenu sexuel",
  insulte:            "Insultes",
  menace:             "Menaces",
  haine:              "Contenu haineux",
  illegal:            "Contenu illégal",
  phishing:           "Arnaque ou phishing",
  contournement:      "Orthographe déguisée",
  incertain:          "Incertain : vérification humaine",
  image_explicite:    "Photo au contenu sexuel explicite",
  image_suspecte:     "Photo à vérifier",
  prix_tres_bas:      "Prix très en dessous du marché",
  prix_bas:           "Prix en dessous du marché",
  prix_non_evalue:    "Prix non évalué",
  compte_recent:      "Compte récent",
  rafale:             "Plusieurs annonces en peu de temps",
  rafale_automatisee: "Création en rafale",
  texte_copie:        "Texte copié d’une autre annonce",
  doublon:            "Doublon sur le même compte",
  photo_reutilisee:   "Photo déjà utilisée",
  contact_suspect:    "Contact ou paiement hors site",
  signalements:       "Signalements en attente",
};

export type ReviewState = "published" | "watch" | "pending" | "blocked";

export const ETAT_LABEL: Record<ReviewState, string> = {
  published: "Publiée",
  watch:     "Publiée · surveillée",
  pending:   "En attente de vérification",
  blocked:   "Retenue",
};

/* Quatre paliers, alignés sur les seuils par défaut de la base. Le libellé
   sert à l'administration ; le public ne voit jamais un score. */
export function niveauRisque(score: number): { cle: "faible" | "surveille" | "eleve" | "critique"; label: string } {
  if (score >= 81) return { cle: "critique",  label: "Critique" };
  if (score >= 61) return { cle: "eleve",     label: "Élevé" };
  if (score >= 31) return { cle: "surveille", label: "À surveiller" };
  return { cle: "faible", label: "Faible" };
}

/* ---------- Ce que voit l'administration ---------- */

/* Les familles de risque, telles que l'administration les voit. */
export const CATEGORIE_LABEL: Record<string, string> = {
  contenu_sexuel: "Sexuel", insulte: "Insulte", menace: "Menace", haine: "Haine",
  illegal: "Illégal", phishing: "Arnaque", texte_interdit: "Bloqué", contact_suspect: "Hors site",
  image_explicite: "Image explicite", image_suspecte: "Image",
};

/* Ce que l'admin seul lit : les termes détectés, par famille. */
export type DetailModeration = { code: string; termes: string[]; niveau: "certain" | "fort" | "faible" };

export type DossierModeration = {
  case_id: string;
  source: "auto" | "signalement" | "admin";
  opened_at: string;
  details?: DetailModeration[];
  certitude?: "certain" | "fort" | "faible" | "aucun" | null;
  listing: {
    id: string; title: string; description: string; module: string; subcategory: string;
    price_cents: number | null; status: string; review_state: ReviewState;
    risk_score: number; risk_reasons: RaisonRisque[]; created_at: string; photos: string[];
  };
  auteur: {
    id: string; display_name: string; created_at: string; is_banned: boolean;
    suspended_until: string | null; email: string | null;
    nb_annonces: number; nb_signalements: number; nb_retirees: number; nb_decisions_contre: number;
  };
  signalements: { id: string; motif: MotifSignalement | null; reason: string | null; created_at: string; par: string | null }[];
};

export type SousSurveillance = {
  id: string; title: string; risk_score: number; risk_reasons: RaisonRisque[];
  created_at: string; auteur: string;
};

export type Decision =
  | "publier" | "maintenir" | "masquer" | "supprimer"
  | "demander_modification" | "suspendre" | "bannir" | "erreur";

export const DECISIONS: { code: Decision; label: string; aide: string; grave?: boolean; confirmer?: string }[] = [
  { code: "publier",               label: "Publier",                 aide: "L’annonce est bonne : elle paraît, les signalements sont classés." },
  { code: "erreur",                label: "Erreur de détection",     aide: "Le filtre s’est trompé : l’annonce paraît et le faux positif est noté pour corriger le lexique." },
  { code: "demander_modification", label: "Demander une correction", aide: "L’annonce reste hors ligne ; l’auteur voit votre note et corrige." },
  { code: "masquer",               label: "Retirer l’annonce",       aide: "Retirée du site ; l’auteur la voit « retirée par la modération ».", grave: true, confirmer: "Retirer cette annonce du site ?" },
  { code: "suspendre",             label: "Suspendre le compte",     aide: "Annonce retirée et compte suspendu quelques jours.", grave: true, confirmer: "Suspendre ce compte ? Il ne pourra plus publier pendant la durée indiquée." },
  { code: "bannir",                label: "Bannir",                  aide: "Toutes ses annonces sont retirées, le compte ne publie plus.", grave: true, confirmer: "Bannir ce compte définitivement et retirer toutes ses annonces ?" },
  { code: "supprimer",             label: "Supprimer",               aide: "Effacée pour de bon — pour un contenu qui ne doit pas rester en base.", grave: true, confirmer: "Supprimer définitivement cette annonce ? Irréversible." },
];

/* ---------- Réglages ---------- */

export type Reglages = {
  seuils: { surveillance: number; verification: number; blocage?: number };
  poids: Record<string, number>;
  prix: { min_comparables: number; ratio_bas: number; ratio_tres_bas: number };
  rafale: { moderee: number; forte: number; blocage: number };
  termes_interdits: string[];
  motifs_contact: string[];
  /* Interrupteurs par famille (0033). Absent tant que la migration n'est pas passée. */
  regles?: Record<string, boolean>;
  images?: Record<string, number>;
};

export const REGLES_LABEL: Record<string, string> = {
  texte: "Filtre de texte (lexique)", prix: "Prix face au marché", compte: "Ancienneté du compte",
  rafale: "Rafale de publications", doublons: "Texte copié", photos: "Photo réutilisée",
  contact: "Contact hors site", signalements: "Signalements", messages: "Filtre des messages", images: "Analyse des photos",
};

export const IMAGES_LABEL: Record<string, string> = {
  sexuel_certain: "Nudité explicite : bloque à partir de", sexuel_fort: "Érotisme : à vérifier à partir de",
  arme: "Arme", drogue: "Drogue", gore: "Violence", offensant: "Symbole haineux",
};

/* Le lexique, ligne par ligne. */
export type LigneLexique = {
  id: number; terme: string; categorie: string; niveau: "certain" | "fort" | "faible" | "exception";
  poids: number; actif: boolean; note: string | null;
};
export const NIVEAU_LABEL: Record<LigneLexique["niveau"], string> = {
  certain: "Certain — bloque seul", fort: "Fort — met en attente", faible: "Faible — pèse seulement", exception: "Exception — ignoré",
};
export const CATEGORIES_LEXIQUE = ["sexuel", "insulte", "menace", "haine", "illegal", "phishing", "exception"] as const;

/* Un message signalé par le filtre, vu de l'administration. */
export type MessageSignale = {
  id: string; message_id: string | null; body: string; score: number;
  reasons: RaisonRisque[]; details: DetailModeration[]; created_at: string;
  conversation_id: string; listing_id: string | null; listing_title: string | null;
  expediteur: { id: string; display_name: string | null; email: string | null; is_banned: boolean | null; suspended_until: string | null; nb_signales: number };
  destinataire: string | null;
};
export type DecisionMessage = "ignorer" | "erreur" | "supprimer" | "suspendre" | "bannir";

export const POIDS_LABEL: Record<string, string> = {
  prix_bas: "Prix bas", prix_tres_bas: "Prix très bas",
  compte_jour: "Compte de moins de 24 h", compte_semaine: "Compte de moins de 7 jours",
  rafale_moderee: "Rafale modérée", rafale_forte: "Rafale forte",
  texte_copie_autre: "Texte copié (autre compte)", texte_copie_soi: "Doublon (même compte)",
  photo_reutilisee_autre: "Photo réutilisée (autre compte)", photo_reutilisee_soi: "Photo réutilisée (même compte)",
  contact_suspect: "Contact ou paiement hors site",
  signalement: "Par signalement", signalements_max: "Plafond des signalements",
  contournement: "Orthographe déguisée", titre: "Bonus si le terme est dans le titre",
  texte_categorie_max: "Plafond par famille de texte", image_suspecte: "Photo à vérifier",
};

/* Empreinte d'un fichier, calculée dans le navigateur. On hache l'original
   tel que déposé : deux personnes qui envoient le même fichier obtiennent
   la même empreinte, quel que soit le téléphone qui a compressé ensuite. */
export async function empreinteFichier(file: File): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
