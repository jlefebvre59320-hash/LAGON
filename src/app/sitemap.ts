import type { MetadataRoute } from "next";
import { SITE_URL as BASE } from "@/lib/siteUrl";
import { SITES } from "@/lib/sites";

async function ids(table: string, status = "active"): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const res = await fetch(
      `${url}/rest/v1/${table}?select=id&status=eq.${status}&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    return ((await res.json()) as { id: string }[]).map((r) => r.id);
  } catch {
    return []; // un sitemap partiel vaut mieux qu'une erreur 500
  }
}

/* Une section fermée n'entre pas au sitemap : proposer à Google une page
   « bientôt en ligne » et des fiches inaccessibles au public gaspille le
   budget d'exploration et donne une mauvaise première impression. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const foodOuvert = SITES.food.ready;
  const eventOuvert = SITES.event.ready;

  const [listings, restos, places, events] = await Promise.all([
    ids("listings"),
    foodOuvert ? ids("restaurants") : Promise.resolve([]),
    ids("places"),
    eventOuvert ? ids("events", "approved") : Promise.resolve([]),
  ]);

  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/guide`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/soutenir`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.1 },
    ...(foodOuvert ? [{ url: `${BASE}/food`, changeFrequency: "daily" as const, priority: 0.9 }] : []),
    ...(eventOuvert ? [{ url: `${BASE}/event`, changeFrequency: "daily" as const, priority: 0.7 }] : []),
    ...listings.map((id) => ({ url: `${BASE}/annonce/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...restos.map((id) => ({ url: `${BASE}/food/resto/${id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...places.map((id) => ({ url: `${BASE}/guide/lieu/${id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...events.map((id) => ({ url: `${BASE}/event/${id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
