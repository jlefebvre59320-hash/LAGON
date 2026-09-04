/* Mise en avant d'une annonce — les règles au même endroit.

   Une annonce mise en avant se distingue visuellement, passe en tête de
   l'accueil et des recherches, et accepte davantage de photos.

   La facturation n'est pas encore en place : pendant la phase de test,
   l'option est gratuite et chacun peut l'activer sur ses annonces. Quand
   le paiement arrivera, seul le moment où l'on pose `featured_until`
   changera — l'affichage et les tris n'ont pas à bouger. */

import type { Listing } from "./types";

export const PHOTOS_LIBRE = 3;
export const PHOTOS_EN_AVANT = 10;

/* Durée d'une mise en avant, en jours. */
export const DUREE_JOURS = 30;

/* Pendant la phase de test, une seule annonce en avant par personne : la
   base l'impose (migration 0035), l'interface l'explique avant le refus. */
export const EN_AVANT_MAX = 1;
export const MESSAGE_UNE_SEULE =
  "Pendant la phase de test, une seule annonce en avant par personne. Retirez l’autre de la une pour changer.";

/* L'annonce de la personne déjà en avant, s'il y en a une autre que celle-ci. */
export function autreEnAvant<T extends Pick<Listing, "id" | "status" | "featured_until">>(mine: T[], sauf?: string): T | null {
  return mine.find((l) => l.id !== sauf && l.status === "active" && estEnAvant(l)) ?? null;
}

export function estEnAvant(l: Pick<Listing, "featured_until">): boolean {
  if (!l.featured_until) return false;
  return new Date(l.featured_until).getTime() > Date.now();
}

export function maxPhotos(enAvant: boolean) {
  return enAvant ? PHOTOS_EN_AVANT : PHOTOS_LIBRE;
}

/* Date de fin à enregistrer au moment de l'activation. */
export function finDeMiseEnAvant(depuis = new Date()): string {
  const d = new Date(depuis);
  d.setDate(d.getDate() + DUREE_JOURS);
  return d.toISOString();
}

/* Jours restants, arrondis au supérieur — « expire dans 1 jour » se
   comprend mieux que « expire dans 0 jour ». */
export function joursRestants(l: Pick<Listing, "featured_until">): number {
  if (!l.featured_until) return 0;
  const ms = new Date(l.featured_until).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/* Tri : les mises en avant d'abord, puis les plus récentes. Utilisé après
   la requête, le classement dépendant de l'heure courante et non d'une
   colonne triable côté base. */
export function trierEnAvantDabord<T extends Pick<Listing, "featured_until" | "created_at">>(list: T[]): T[] {
  return list.slice().sort((a, b) => {
    const ea = estEnAvant(a), eb = estEnAvant(b);
    if (ea !== eb) return ea ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
