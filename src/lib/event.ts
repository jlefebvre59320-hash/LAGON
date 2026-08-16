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
  contact: string;
  status: EventStatus;
  submitted_by: string | null;
  created_at: string;
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
