"use client";
import Link from "next/link";
import { MIN_RATINGS, isOpenNow, hasHours, priceLabel, type Restaurant, type RatingSummary } from "@/lib/food";
import { CuisineVisual } from "@/components/food/CuisineIcon";
import FavoriteButton from "@/components/FavoriteButton";
import { StarRow } from "@/components/food/Stars";

/* Petit lien externe posé sur une carte : la carte entière est déjà un lien,
   un <a> imbriqué est interdit — on ouvre donc à la main, sans suivre la carte. */
function MiniLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <span
      role="link"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(href, "_blank", "noopener,noreferrer"); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); window.open(href, "_blank", "noopener,noreferrer"); } }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 999, cursor: "pointer",
        background: "var(--cream-dark)", color: "var(--gold-deep)",
      }}
    >
      {children}
    </span>
  );
}

const Glyph = ({ d }: { d: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const G_SITE = "M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 M2 12 h20 M12 2 c-3 3 -3 17 0 20 c3 -3 3 -17 0 -20";
const G_INSTA = "M7 3 h10 a4 4 0 0 1 4 4 v10 a4 4 0 0 1 -4 4 h-10 a4 4 0 0 1 -4 -4 v-10 a4 4 0 0 1 4 -4 M12 8.5 a3.5 3.5 0 1 0 0 7 a3.5 3.5 0 0 0 0 -7 M17.2 6.8 v0.01";
const G_FB = "M15 3 h-2 a4 4 0 0 0 -4 4 v3 h-3 v4 h3 v7 h4 v-7 h3 l1 -4 h-4 v-2.5 a1 1 0 0 1 1 -1 h3 z";
const G_SNAP = "M12 3 a6 6 0 0 1 6 6 v2.5 l2.5 2.5 c-1 .9 -2.2 1.2 -3.5 1.2 c-.2 2 -2.3 3.3 -5 3.3 s-4.8 -1.3 -5 -3.3 c-1.3 0 -2.5 -.3 -3.5 -1.2 L6 11.5 V9 a6 6 0 0 1 6 -6";
const G_TIKTOK = "M14 4 v11.5 a3.5 3.5 0 1 1 -3.5 -3.5 M14 4 c.5 2.5 2.5 4.5 5 5";
const G_MAIL = "M3 5.5 h18 v13 h-18 z M3 6 l9 7.5 L21 6";

export default function RestaurantCard({ r, rating }: { r: Restaurant; rating?: RatingSummary }) {
  const known = hasHours(r.hours);
  const open = known && isOpenNow(r.hours);
  const rated = rating && rating.votes >= MIN_RATINGS;

  return (
    <Link href={`/food/resto/${r.id}`} className="card">
      <div style={{ position: "relative", aspectRatio: "4 / 3" }}>
        <CuisineVisual cuisine={r.cuisine} />
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
        <span style={{ position: "absolute", right: 8, bottom: 8 }}>
          <FavoriteButton targetId={r.id} />
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
          {r.avg_price_eur ? ` · ~${r.avg_price_eur}\u00A0€/pers.` : ""}
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
        {(r.website || r.instagram || r.facebook || r.snapchat || r.tiktok || r.email) && (
          <span style={{ display: "inline-flex", gap: 6, marginTop: 6 }}>
            {r.website && <MiniLink href={r.website} label="Site web"><Glyph d={G_SITE} /></MiniLink>}
            {r.instagram && <MiniLink href={`https://instagram.com/${r.instagram.replace(/^@/, "")}`} label="Instagram"><Glyph d={G_INSTA} /></MiniLink>}
            {r.facebook && <MiniLink href={r.facebook} label="Facebook"><Glyph d={G_FB} /></MiniLink>}
            {r.snapchat && <MiniLink href={`https://www.snapchat.com/add/${r.snapchat.replace(/^@/, "")}`} label="Snapchat"><Glyph d={G_SNAP} /></MiniLink>}
            {r.tiktok && <MiniLink href={`https://www.tiktok.com/@${r.tiktok.replace(/^@/, "")}`} label="TikTok"><Glyph d={G_TIKTOK} /></MiniLink>}
            {r.email && <MiniLink href={`mailto:${r.email}`} label="Email"><Glyph d={G_MAIL} /></MiniLink>}
          </span>
        )}
      </div>
    </Link>
  );
}
