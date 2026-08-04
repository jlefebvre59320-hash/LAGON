import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/mon-espace", "/food/mon-espace", "/stats", "/deposer"] }],
    sitemap: "https://lagon-orcin.vercel.app/sitemap.xml",
  };
}
