/* L'URL publique du site vit ici et nulle part ailleurs : le jour où un vrai
   domaine remplace l'adresse Vercel, on renseigne NEXT_PUBLIC_SITE_URL dans
   Vercel (Settings → Environment Variables), on redéploie, et tout suit —
   metadata, sitemap, robots, JSON-LD. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lagon-orcin.vercel.app"
).replace(/\/+$/, "");
