import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/mon-espace", "/food/mon-espace", "/stats", "/deposer"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
