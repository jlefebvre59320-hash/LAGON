"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORY_HUE, CATEGORY_ONE, mapsUrlPlace, type Place } from "@/lib/guide";
import { SiteHeader, Mark } from "@/components/Brand";
import { PlaceGlyph } from "@/components/guide/PlaceCard";
import ShareButton from "@/components/ShareButton";
import { recordView } from "@/lib/analytics";
import { SITE_URL } from "@/lib/siteUrl";
import { safeExternalUrl } from "@/lib/urls";

export default function LieuPage({ initialPlace = null }: { initialPlace?: Place | null }) {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Place | null>(initialPlace);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialPlace) {
      recordView(`/guide/lieu/${id}`);
      return;
    }
    (async () => {
      const { data } = await supabase().from("places").select("*").eq("id", id).single();
      if (data) {
        setP(data as Place);
        recordView(`/guide/lieu/${id}`);
      } else {
        setNotFound(true);
      }
    })();
  }, [id, initialPlace]);

  if (notFound) return (
    <>
      <SiteHeader site="guide" />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>Ce lieu n&apos;est pas (ou plus) dans le guide.</p>
        <Link href="/guide">← Retour au guide</Link>
      </div>
    </>
  );
  if (!p) return (
    <>
      <SiteHeader site="guide" />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const hue = CATEGORY_HUE[p.category];
  const website = safeExternalUrl(p.website);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader site="guide" />

      <main className="container" style={{ paddingTop: 16, paddingBottom: 60, maxWidth: 740, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <Link href="/guide" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Tout le guide</Link>
          <ShareButton
            title={p.name}
            text={`${p.name} — ${CATEGORY_ONE[p.category]}, ${p.quartier} · sur St Barth Guide`}
            url={`${SITE_URL}/guide/lieu/${p.id}`}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0 6px" }}>
          <span style={{ flex: "0 0 auto", width: 56, height: 56, borderRadius: 16, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: `color-mix(in srgb, ${hue} 12%, var(--surface))`, color: hue,
            border: "1px solid var(--border)" }}>
            <PlaceGlyph category={p.category} size={30} />
          </span>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: hue }}>
              {CATEGORY_ONE[p.category]} · {p.quartier}
            </span>
            <h1 style={{ margin: "2px 0 0", fontSize: "clamp(24px, 5.5vw, 32px)", lineHeight: 1.15 }}>{p.name}</h1>
          </div>
        </div>

        {p.description && (
          <p style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap", margin: "14px 0 0" }}>
            {p.description}
          </p>
        )}

        {p.tip && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12,
            background: "color-mix(in srgb, var(--gold) 14%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--gold) 45%, transparent)",
            fontSize: 13.5, lineHeight: 1.55 }}>
            <strong style={{ color: "var(--gold-deep)" }}>Bon à savoir · </strong>{p.tip}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <a href={mapsUrlPlace(p)} target="_blank" rel="noopener noreferrer" className="btn"
            style={{ fontSize: 14 }}>
            Itinéraire
          </a>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn-outline-gold"
              style={{ fontSize: 14, color: "var(--gold-deep)" }}>
              Site web ↗
            </a>
          )}
          {p.phone && (
            <a href={`tel:${p.phone}`} className="btn btn-outline-gold" style={{ fontSize: 14, color: "var(--gold-deep)" }}>
              Appeler
            </a>
          )}
        </div>

        {p.address && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 14 }}>{p.address}</p>
        )}

        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 26, lineHeight: 1.5 }}>
          Informations données à titre indicatif, à vérifier sur place — accès, horaires et
          conditions de mer changent. Position sur la carte : repère approximatif.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 30, opacity: 0.5 }}>
          <Mark size={54} color="var(--gold-deep)" />
        </div>
      </main>
    </div>
  );
}
