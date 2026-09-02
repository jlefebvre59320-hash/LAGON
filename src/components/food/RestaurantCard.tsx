"use client";
import Link from "next/link";
import { MIN_RATINGS, isOpenNow, hasHours, priceLabel, type Restaurant, type RatingSummary } from "@/lib/food";
import { CuisineVisual } from "@/components/food/CuisineIcon";
import FavoriteButton from "@/components/FavoriteButton";
import { StarRow } from "@/components/food/Stars";
import { emailHref, safeExternalUrl, socialUrl } from "@/lib/urls";

function MiniLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 999, cursor: "pointer",
        background: "var(--cream-dark)", color: "var(--gold-deep)", position: "relative", zIndex: 2,
      }}
    >
      {children}
    </a>
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

  const website = safeExternalUrl(r.website);
  const instagram = socialUrl("instagram", r.instagram);
  const facebook = safeExternalUrl(r.facebook);
  const snapchat = socialUrl("snapchat", r.snapchat);
  const tiktok = socialUrl("tiktok", r.tiktok);
  const email = emailHref(r.email);
  const hasLinks = website || instagram || facebook || snapchat || tiktok || email;

  return (
    <article className="card" style={{ position: "relative" }}>
      <Link
        href={`/food/resto/${r.id}`}
        className="card-link-overlay"
        aria-label={`Voir la fiche de ${r.name}`}
      >
        <span className="sr-only">Voir la fiche de {r.name}</span>
      </Link>
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
        <span style={{ position: "absolute", right: 8, bottom: 8, zIndex: 2 }}>
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
        {hasLinks && (
          <span style={{ display: "inline-flex", gap: 6, marginTop: 6, position: "relative", zIndex: 2 }}>
            <MiniLink href={website} label="Site web"><Glyph d={G_SITE} /></MiniLink>
            <MiniLink href={instagram} label="Instagram"><Glyph d={G_INSTA} /></MiniLink>
            <MiniLink href={facebook} label="Facebook"><Glyph d={G_FB} /></MiniLink>
            <MiniLink href={snapchat} label="Snapchat"><Glyph d={G_SNAP} /></MiniLink>
            <MiniLink href={tiktok} label="TikTok"><Glyph d={G_TIKTOK} /></MiniLink>
            <MiniLink href={email} label="Email"><Glyph d={G_MAIL} /></MiniLink>
          </span>
        )}
      </div>
    </article>
  );
}
