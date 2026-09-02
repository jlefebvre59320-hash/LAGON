import type { Metadata } from "next";
import { cache } from "react";
import RestaurantClient from "./RestaurantClient";
import { publicSupabase } from "@/lib/supabaseServer";
import { SITE_URL } from "@/lib/siteUrl";
import type { Restaurant } from "@/lib/food";

const getRestaurant = cache(async (id: string): Promise<Restaurant | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data } = await sb.from("restaurants").select("*").eq("id", id).maybeSingle();
  return (data as Restaurant | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const restaurant = await getRestaurant(id);
  if (!restaurant) return { title: "Restaurant indisponible — St Barth Food", robots: { index: false, follow: false } };
  const title = `${restaurant.name} — St Barth Food`;
  const description = (restaurant.description?.replace(/\s+/g, " ").trim()
    || `${restaurant.cuisine} à ${restaurant.quartier}, Saint-Barthélemy.`).slice(0, 160);
  const url = `${SITE_URL}/food/resto/${restaurant.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "fr_FR" },
  };
}

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RestaurantClient initialRestaurant={await getRestaurant(id)} />;
}

