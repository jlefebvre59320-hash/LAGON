import type { MetadataRoute } from "next";
import { SITE_URL as BASE } from "@/lib/siteUrl";

async function ids(table: string): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const res = await fetch(
      `${url}/rest/v1/${table}?select=id&status=eq.active&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    return ((await res.json()) as { id: string }[]).map((r) => r.id);
  } catch {
    return []; // un sitemap partiel vaut mieux qu'une erreur 500
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, restos, places] = await Promise.all([
    ids("listings"), ids("restaurants"), ids("places"),
  ]);
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/food`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/guide`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/event`, changeFrequency: "monthly", priority: 0.3 },
    ...listings.map((id) => ({ url: `${BASE}/annonce/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...restos.map((id) => ({ url: `${BASE}/food/resto/${id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...places.map((id) => ({ url: `${BASE}/guide/lieu/${id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
