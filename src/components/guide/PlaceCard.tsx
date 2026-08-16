"use client";
import Link from "next/link";
import { CATEGORY_GLYPH, CATEGORY_HUE, CATEGORY_ONE, type Place } from "@/lib/guide";

export function PlaceGlyph({ category, size = 22 }: { category: Place["category"]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CATEGORY_GLYPH[category]} />
    </svg>
  );
}

export default function PlaceCard({ p }: { p: Place }) {
  const hue = CATEGORY_HUE[p.category];
  return (
    <Link href={`/guide/lieu/${p.id}`} className="card" style={{ padding: "14px 14px 13px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ flex: "0 0 auto", width: 42, height: 42, borderRadius: 12, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `color-mix(in srgb, ${hue} 12%, var(--surface))`, color: hue }}>
          <PlaceGlyph category={p.category} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: hue }}>
            {CATEGORY_ONE[p.category]} · {p.quartier}
          </span>
          <p style={{ margin: "3px 0 4px", fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>
            {p.name}
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {p.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
