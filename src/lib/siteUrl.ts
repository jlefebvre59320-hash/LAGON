/* L'URL publique du site vit ici et nulle part ailleurs — métadonnées,
   sitemap, robots, JSON-LD et liens de partage la lisent tous.
   NEXT_PUBLIC_SITE_URL (Vercel → Settings → Environment Variables) permet de
   la surcharger, par exemple pour une préproduction ; sans elle, c'est le
   domaine officiel qui s'applique. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tikanal.com"
).replace(/\/+$/, "");
