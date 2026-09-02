import type { Metadata } from "next";
import { cache } from "react";
import PlaceClient from "./PlaceClient";
import { publicSupabase } from "@/lib/supabaseServer";
import { SITE_URL } from "@/lib/siteUrl";
import { CATEGORY_ONE, type Place } from "@/lib/guide";

const getPlace = cache(async (id: string): Promise<Place | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data } = await sb.from("places").select("*").eq("id", id).maybeSingle();
  return (data as Place | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) return { title: "Lieu indisponible — St Barth Guide", robots: { index: false, follow: false } };
  const title = `${place.name} — St Barth Guide`;
  const description = (place.description?.replace(/\s+/g, " ").trim()
    || `${CATEGORY_ONE[place.category]} à ${place.quartier}, Saint-Barthélemy.`).slice(0, 160);
  const url = `${SITE_URL}/guide/lieu/${place.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "fr_FR" },
  };
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaceClient initialPlace={await getPlace(id)} />;
}

