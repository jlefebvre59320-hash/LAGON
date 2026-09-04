"use client";

/* Les dernières annonces consultées, dans ce navigateur seulement. Pas en
   base : c'est une commodité personnelle, pas une donnée. Douze suffisent
   pour retrouver « celle que j'ai hésité à contacter hier ». */

const CLE = "tikanal.recents";
const MAX = 12;

export function lireRecents(): string[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function noterRecent(id: string): void {
  try {
    const liste = [id, ...lireRecents().filter((x) => x !== id)].slice(0, MAX);
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* stockage indisponible : on s'en passe */
  }
}

export function oublierRecents(): void {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
