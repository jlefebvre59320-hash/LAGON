"use client";
import Link from "next/link";
import { Mark } from "@/components/Brand";
import { MIN_RATINGS, isOpenNow, hasHours, priceLabel, type Restaurant, type RatingSummary } from "@/lib/food";
import { StarRow } from "@/components/food/Stars";

/* Pas de photos en v1 — choix juridique assumé : on n'affiche que des faits,
   jamais les visuels des établissements sans leur accord. Le fond varie
   doucement d'une carte à l'autre pour que la grille respire quand même. */
const TINTS = [
  "linear-gradient(140deg, var(--green-100), var(--cream-dark))",
  "linear-gradient(140deg, var(--cream-dark), var(--gold-light))",
  "linear-gradient(140deg, var(--green-100), var(--gold-light))",
];

const tintFor = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return TINTS[h % TINTS.length];
};

export default function RestaurantCard({ r, rating }: { r: Restaurant; rating?: RatingSummary }) {
  const known = hasHours(r.hours);
  const open = known && isOpenNow(r.hours);
  const rated = rating && rating.votes >= MIN_RATINGS;

  return (
    <Link href={`/resto/${r.id}`} className="card">
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: tintFor(r.id) }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
          <Mark size={56} color="var(--gold-deep)" />
        </div>
        <span
          style={{
            position: "absolute", left: 8, top: 8, maxWidth: "calc(100% - 16px)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            background: "rgba(255,253,248,.94)", color: "var(--gold-deep)",
            fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
            padding: "4px 9px", borderRadius: 999,
          }}
        >
          {r.cuisine}
        </span>
        {known && (
          <span
            style={{
              position: "absolute", left: 8, bottom: 8,
              display: "inline-flex", alignItems: "center", gap: 5,
              background: open ? "var(--green)" : "rgba(255,253,248,.94)",
              color: open ? "var(--gold-light)" : "var(--text-muted)",
              fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              padding: "4px 9px", borderRadius: 999,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: open ? "#5ec98a" : "#b9b1a2" }} />
            {open ? "Ouvert" : "Fermé"}
          </span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 16.5, lineHeight: 1.25, color: "var(--green)" }}>
          {r.name}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {r.quartier} · <span style={{ fontWeight: 700, color: "var(--gold-deep)" }}>{priceLabel(r.price_range)}</span>
          {r.takeaway ? " · À emporter" : ""}
        </span>
        {rated && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <StarRow value={rating.avg_rating} size={13} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {rating.avg_rating.toLocaleString("fr-FR")} ({rating.votes})
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
