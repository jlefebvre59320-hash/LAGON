import type { MetadataRoute } from "next";
import { SITE_URL as BASE } from "@/lib/siteUrl";

async function ids(table: string, status = "active"): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const result: string[] = [];
    const pageSize = 1000;
    for (let offset = 0; offset < 20_000; offset += pageSize) {
      const res = await fetch(
        `${url}/rest/v1/${table}?select=id&status=eq.${encodeURIComponent(status)}&order=id&limit=${pageSize}&offset=${offset}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
      );
      if (!res.ok) break;
      const page = (await res.json()) as { id: string }[];
      result.push(...page.map((row) => row.id));
      if (page.length < pageSize) break;
    }
    return result;
  } catch {
    return []; // un sitemap partiel vaut mieux qu'une erreur 500
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, restos, places, events] = await Promise.all([
    ids("listings"), ids("restaurants"), ids("places"), ids("events", "approved"),
  ]);
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/food`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/guide`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/event`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/soutenir`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.1 },
    ...listings.map((id) => ({ url: `${BASE}/annonce/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...restos.map((id) => ({ url: `${BASE}/food/resto/${id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...places.map((id) => ({ url: `${BASE}/guide/lieu/${id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...events.map((id) => ({ url: `${BASE}/event/${id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
