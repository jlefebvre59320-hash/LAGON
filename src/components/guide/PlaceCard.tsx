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

/* Petites marques de ce qu'on trouvera sur la fiche : un conseil, un
   téléphone, un site, une position sur la carte. Elles se lisent d'un
   coup d'œil dans la grille et évitent d'ouvrir une fiche pour rien. */
function Marqueurs({ p, hue }: { p: Place; hue: string }) {
  const marques: { cle: string; titre: string; d: string }[] = [];
  if (p.tip) marques.push({ cle: "tip", titre: "Un conseil pratique",
    d: "M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3M9.5 19h5M10 21.5h4" });
  if (p.phone) marques.push({ cle: "tel", titre: "Téléphone",
    d: "M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3" });
  if (p.website) marques.push({ cle: "web", titre: "Site web",
    d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3" });
  if (p.lat != null && p.lng != null) marques.push({ cle: "geo", titre: "Situé sur la carte",
    d: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" });
  if (marques.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", color: hue, opacity: 0.75 }}>
      {marques.map((m) => (
        <svg key={m.cle} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={m.titre}>
          <title>{m.titre}</title>
          <path d={m.d} />
        </svg>
      ))}
    </span>
  );
}

export default function PlaceCard({ p }: { p: Place }) {
  const hue = CATEGORY_HUE[p.category];
  return (
    <Link
      href={`/guide/lieu/${p.id}`}
      className="card place-card"
      /* La teinte de la catégorie voyage jusque dans le CSS : le liseré, le
         halo du picto et le survol s'y accordent sans dupliquer la palette. */
      style={{ "--place-hue": hue } as React.CSSProperties}
    >
      <span className="place-card-rule" aria-hidden="true" />
      <div className="place-card-body">
        <span className="place-card-glyph">
          <PlaceGlyph category={p.category} size={23} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="place-card-over">
            {CATEGORY_ONE[p.category]}
            <span className="place-card-sep" aria-hidden="true">·</span>
            {p.quartier}
          </span>
          <p className="place-card-name">{p.name}</p>
          <p className="place-card-desc">{p.description}</p>
          {p.tip && <p className="place-card-tip">{p.tip}</p>}
        </div>
      </div>
      <div className="place-card-foot">
        <Marqueurs p={p} hue={hue} />
        <span className="place-card-go" aria-hidden="true">Voir la fiche →</span>
      </div>
    </Link>
  );
}
