/** JSON sûr à placer dans un élément <script>. Le remplacement de « < »
 * empêche un contenu utilisateur contenant </script> de fermer la balise. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

