"use client";
import Link from "next/link";
import { MODULES, INTENT_BADGE, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { Mark } from "@/components/Brand";
import FavoriteButton from "@/components/FavoriteButton";
import { thumbKey } from "@/lib/images";
import { estEnAvant } from "@/lib/featured";

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Il y a ${d} j`;
};

export function photoUrl(key: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${key}`;
}

/* Vignette pour les grilles : ~30 Ko au lieu de ~400 Ko. Les photos déposées
   avant l'arrivée des vignettes n'en ont pas — l'attribut onError bascule
   alors sur l'image pleine taille, sans que le visiteur voie quoi que ce soit. */
function Vignette({ storageKey, alt }: { storageKey: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(thumbKey(storageKey))}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget;
        const plein = photoUrl(storageKey);
        if (img.src !== plein) img.src = plein;
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

export default function ListingCard({ l }: { l: Listing }) {
  const m = MODULES[l.module];
  const photo = l.photos?.slice().sort((a, b) => a.position - b.position)[0];
  const price = eur(l.price_cents);
  const badge = INTENT_BADGE[l.intent ?? "offer"];
  const wanted = l.intent === "wanted";
  const enAvant = estEnAvant(l);

  return (
    <article className={`card listing-card${enAvant ? " listing-featured" : ""}`} style={{ position: "relative" }}>
      <Link
        href={`/annonce/${l.id}`}
        className="card-link-overlay"
        aria-label={`Voir l'annonce ${l.title}`}
      >
        <span className="sr-only">Voir l&apos;annonce {l.title}</span>
      </Link>
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: m.soft }}>
        {photo ? (
          <Vignette storageKey={photo.storage_key} alt={l.title} />
        ) : (
          <div
            style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(140deg, ${m.soft}, ${m.color}26)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Mark size={64} color={m.color} />
          </div>
        )}
        {enAvant && (
          <span className="featured-badge" aria-label="Annonce mise en avant">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5l2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 16.4 6.4 19.5l1.3-6.1L3 9.1l6.3-.7z" />
            </svg>
            À la une
          </span>
        )}
        {(l.photos?.length ?? 0) > 1 && (
          <span className="photo-count" aria-label={`${l.photos!.length} photos`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="15" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6M9 9h.01" />
            </svg>
            {l.photos!.length}
          </span>
        )}
        {/* Sous-catégorie en haut, sens de l'annonce en bas : les deux pastilles
            ne se disputent jamais la même ligne, même sur un libellé long. */}
        <span
          className="subcat-pill"
          style={{
            position: "absolute", left: 8, top: 8, maxWidth: "calc(100% - 16px)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            background: "rgba(255,253,248,.94)", color: m.dark,
            fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
            padding: "4px 9px", borderRadius: 999,
          }}
        >
          {l.subcategory}
        </span>
        <span style={{ position: "absolute", right: 8, bottom: 8, zIndex: 2 }}>
          <FavoriteButton targetId={l.id} />
        </span>
        {badge && l.status !== "sold" && (
          <span
            style={{
              position: "absolute", left: 8, bottom: 8,
              background: "var(--green)", color: "var(--gold-light)",
              fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              padding: "4px 9px", borderRadius: 999,
            }}
          >
            {badge}
          </span>
        )}
        {l.status === "sold" && (
          <span
            style={{
              position: "absolute", left: 8, bottom: 8,
              background: "var(--gold)", color: "var(--green)",
              fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
              padding: "4px 11px", borderRadius: 999, boxShadow: "0 1px 4px rgba(5,40,44,.25)",
            }}
          >
            Vendu
          </span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: "var(--text)" }}>{l.title}</span>
        <span className="price" style={{ fontSize: 18, color: m.color, marginTop: 2 }}>
          {price == null
            ? wanted ? "Budget à discuter" : l.module === "job" ? "Selon profil" : "Prix à discuter"
            : (wanted ? "Budget " : "") + price + priceSuffix(l.module, l.subcategory)}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "auto", paddingTop: 6 }}>
          {l.location} · {ago(l.created_at)}
        </span>
      </div>
    </article>
  );
}
