import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { SITES } from "@/lib/sites";

export default function robots(): MetadataRoute.Robots {
  /* Espaces privés, plus les sections pas encore ouvertes : tant qu'une
     section n'est pas publique, ses pages n'ont rien à faire dans l'index. */
  const disallow = ["/mon-espace", "/food/mon-espace", "/stats", "/deposer"];
  if (!SITES.food.ready) disallow.push("/food");
  if (!SITES.event.ready) disallow.push("/event");

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
