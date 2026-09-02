/* St Barth Event — l'agenda de l'île. */

export type EventStatus = "pending" | "approved" | "rejected";

export type IslandEvent = {
  id: string;
  title: string;
  category: string;
  venue: string;
  quartier: string;
  starts_at: string;
  ends_at: string | null;
  price: string;
  description: string;
  link: string | null;
  organizer: string;
  /* Présent uniquement dans le RPC d'administration, jamais dans l'API publique. */
  contact?: string;
  status: EventStatus;
};

export const EVENT_CATEGORIES = [
  "Soirée",
  "Concert & Musique",
  "Régate & Nautisme",
  "Marché & Brocante",
  "Gastronomie",
  "Sport",
  "Culture & Expo",
  "Famille",
  "Autre",
] as const;

/* L'île vit à l'heure de l'île : les dates de l'agenda aussi. */
const TZ = "America/St_Barthelemy";

/** Minuit du jour courant à Saint-Barthélemy. L'île reste en UTC-4 toute
 * l'année, ce qui évite qu'un visiteur à Paris ou Montréal filtre le mauvais
 * jour. */
export function islandDayStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T00:00:00-04:00`;
}

export function eventDay(iso: string) {
  const d = new Date(iso);
  return {
    jour: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric" }).format(d),
    mois: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" }).format(d).replace(".", ""),
    semaine: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" }).format(d),
    heure: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d),
    cle: new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, dateStyle: "short" }).format(d),
  };
}
