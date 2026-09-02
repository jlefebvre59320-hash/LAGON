import type { Metadata } from "next";
import { cache } from "react";
import AnnonceClient from "./AnnonceClient";
import { publicSupabase } from "@/lib/supabaseServer";
import { SITE_URL } from "@/lib/siteUrl";
import type { Listing } from "@/lib/types";

const getListing = cache(async (id: string): Promise<Listing | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("listings")
    .select("*, photos:listing_photos(storage_key, position), profile:profiles!listings_user_id_fkey(display_name, phone_wa)")
    .eq("id", id)
    .maybeSingle();
  return (data as Listing | null) ?? null;
});

const summary = (value: string | null | undefined, fallback: string) =>
  (value?.replace(/\s+/g, " ").trim() || fallback).slice(0, 160);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Annonce indisponible — Ti Kanal", robots: { index: false, follow: false } };
  const title = `${listing.title} — Ti Kanal`;
  const description = summary(listing.description, `${listing.subcategory} à ${listing.location} sur Ti Kanal.`);
  const url = `${SITE_URL}/annonce/${listing.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "fr_FR" },
  };
}

export default async function AnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnnonceClient initialListing={await getListing(id)} />;
}
