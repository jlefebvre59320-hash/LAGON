/* St Barth Food — types, référentiels et horaires.
   Même philosophie que taxonomy.ts : la source de vérité est en code,
   un référentiel s'ajoute ici et se déploie. */

export type RestaurantStatus = "active" | "hidden";

/* { mon: [["11:30","14:30"],["19:00","22:30"]], ... } — clés mon..sun.
   Jour absent ou vide = fermé. Fin avant début = service qui déborde sur
   le lendemain (ex. 19:00 → 01:00). */
export type HoursMap = Partial<Record<DayKey, [string, string][]>>;

export type Restaurant = {
  id: string;
  owner_id: string | null;
  name: string;
  cuisine: string;
  quartier: string;
  address: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  snapchat: string | null;
  tiktok: string | null;
  email: string | null;
  description: string;
  price_range: 1 | 2 | 3;
  /* Prix moyen par personne en euros, renseigné par l'établissement */
  avg_price_eur: number | null;
  takeaway: boolean;
  hours: HoursMap;
  status: RestaurantStatus;
  /* Position OSM d'origine ; null pour les fiches créées à la main */
  lat: number | null;
  lng: number | null;
  created_at: string;
};

export const CUISINES = [
  "Français",
  "Créole & Caribéen",
  "Italien",
  "Poissons & Fruits de mer",
  "Grillades & Viandes",
  "Sushi & Asiatique",
  "Pizza",
  "Burgers & Snack",
  "Salades & Healthy",
  "Café & Brunch",
  "Glaces & Desserts",
  "Food truck",
  "Traiteur",
  "Tapas & Cocktails",
] as const;

export const QUARTIERS = [
  "Gustavia", "St-Jean", "Lorient", "Flamands", "Colombier", "Corossol",
  "Public", "Anse des Cayes", "Pointe Milou", "Marigot", "Vitet",
  "Grand Cul-de-Sac", "Petit Cul-de-Sac", "Toiny", "Saline", "Lurin", "Gouverneur",
] as const;

export const priceLabel = (n: 1 | 2 | 3) => "€".repeat(n);

/* ---------- Notes ---------- */

export type RatingSummary = { avg_rating: number; votes: number };

/* En dessous de ce nombre de votes, la moyenne ne s'affiche pas : une seule
   note à 1 étoile ne doit pas pouvoir exécuter un restaurant. */
export const MIN_RATINGS = 3;

/* ---------- Horaires ---------- */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/* Indexé par Date.getDay() : dimanche = 0. */
const DAY_BY_GETDAY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi",
  fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
};

/* Heure de l'île, où que soit le visiteur : un client à Paris qui regarde si
   un restaurant de Gustavia est ouvert veut l'heure de Gustavia (UTC-4, sans
   heure d'été), pas la sienne. */
export function islandNow(): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/St_Barthelemy",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  const day = DAY_ORDER.includes(wd) ? wd : DAY_BY_GETDAY[new Date().getDay()];
  // Intl peut rendre "24" pour minuit selon les moteurs : on replie sur 0h.
  const hour = parseInt(get("hour"), 10) % 24;
  return { day, minutes: hour * 60 + parseInt(get("minute"), 10) };
}

const prevDay = (d: DayKey): DayKey =>
  DAY_ORDER[(DAY_ORDER.indexOf(d) + 6) % 7];

/* Ouvert en ce moment ? Tient compte des services qui débordent sur le
   lendemain : à 0h30, c'est le créneau 19:00 → 01:00 de la veille qui compte. */
export function isOpenNow(hours: HoursMap, now = islandNow()): boolean {
  const today = hours[now.day] ?? [];
  for (const [start, end] of today) {
    const s = toMinutes(start), e = toMinutes(end);
    if (e > s ? now.minutes >= s && now.minutes < e : now.minutes >= s) return true;
  }
  for (const [start, end] of hours[prevDay(now.day)] ?? []) {
    const s = toMinutes(start), e = toMinutes(end);
    if (e < s && now.minutes < e) return true;
  }
  return false;
}

export const hasHours = (hours: HoursMap | null | undefined): hours is HoursMap =>
  !!hours && Object.values(hours).some((v) => (v ?? []).length > 0);

export const formatDay = (slots: [string, string][] | undefined) =>
  !slots || slots.length === 0
    ? "Fermé"
    : slots.map(([a, b]) => `${a.replace(":", "h")} – ${b.replace(":", "h")}`).join(" · ");

/* Lien d'itinéraire : une recherche par nom + adresse vieillit mieux qu'une
   paire de coordonnées qu'on ne collecte pas. */
export const mapsUrl = (r: Restaurant) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${r.name} ${r.address} Saint-Barthélemy`
  )}`;
