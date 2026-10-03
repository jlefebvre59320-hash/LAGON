/* Une réponse de la base qu'on attend en liste. PostgREST rend parfois un
   objet là où l'on attend un tableau (erreur rendue comme donnée, ligne
   unique) : un `.map` dessus fait tomber tout l'écran. On préfère une
   liste vide à un écran blanc. */
export function tableau<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}
