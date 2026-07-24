"use client";
import Link from "next/link";
import { MODULES, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Il y a ${d} j`;
};

export function photoUrl(key: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${key}`;
}

export default function ListingCard({ l }: { l: Listing }) {
  const m = MODULES[l.module];
  const photo = l.photos?.slice().sort((a, b) => a.position - b.position)[0];
  const price = eur(l.price_cents);

  return (
    <Link href={`/annonce/${l.id}`} className="card">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(photo.storage_key)}
          alt={l.title}
          style={{ height: 140, objectFit: "cover", width: "100%" }}
        />
      ) : (
        <div
          style={{
            height: 140,
            background: `linear-gradient(135deg, ${m.soft}, ${m.color}22)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
          }}
        >
          {m.icon}
        </div>
      )}
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: m.dark }}>{l.subcategory}</span>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{l.title}</span>
        <span
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontVariationSettings: "'wght' 800",
            fontSize: 17,
            color: m.color,
            marginTop: 2,
          }}
        >
          {price == null
            ? l.module === "job" ? "Selon profil" : "Prix à discuter"
            : price + priceSuffix(l.module, l.subcategory)}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "auto" }}>
          {l.location} · {ago(l.created_at)}
        </span>
      </div>
    </Link>
  );
}
