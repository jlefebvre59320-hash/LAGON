"use client";
import Link from "next/link";
import { MODULES, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { Mark } from "@/components/Brand";

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
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: m.soft }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(photo.storage_key)}
            alt={l.title}
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(140deg, ${m.soft}, ${m.color}26)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Mark size={30} color={m.color} />
          </div>
        )}
        <span
          style={{
            position: "absolute", left: 8, top: 8,
            background: "rgba(255,253,248,.94)", color: m.dark,
            fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
            padding: "4px 9px", borderRadius: 999,
          }}
        >
          {l.subcategory}
        </span>
      </div>

      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: "var(--text)" }}>{l.title}</span>
        <span className="price" style={{ fontSize: 18, color: m.color, marginTop: 2 }}>
          {price == null
            ? l.module === "job" ? "Selon profil" : "Prix à discuter"
            : price + priceSuffix(l.module, l.subcategory)}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "auto", paddingTop: 6 }}>
          {l.location} · {ago(l.created_at)}
        </span>
      </div>
    </Link>
  );
}
