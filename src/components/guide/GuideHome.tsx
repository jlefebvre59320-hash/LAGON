"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { CATEGORY_LABEL, CATEGORY_ORDER, type Place, type PlaceCategory } from "@/lib/guide";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";
import PlaceCard from "@/components/guide/PlaceCard";
import { recordView } from "@/lib/analytics";
import { SITES } from "@/lib/sites";

const GuideMap = dynamic(() => import("@/components/guide/GuideMap"), {
  ssr: false,
  loading: () => <div className="panel skeleton" style={{ height: 420 }} />,
});

const SITE = SITES.guide;

export default function GuideHome() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [all, setAll] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { recordView("/guide"); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase()
        .from("places")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (cancelled) return;
      if (error) setError("Impossible de charger l'annuaire. Réessayez.");
      else setAll((data as Place[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const quartiers = useMemo(
    () => Array.from(new Set(all.map((p) => p.quartier))).sort((a, b) => a.localeCompare(b, "fr")),
    [all]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) =>
      (!category || p.category === category) &&
      (!quartier || p.quartier === quartier) &&
      (!q || `${p.name} ${p.quartier} ${p.description}`.toLowerCase().includes(q))
    );
  }, [all, query, category, quartier]);

  /* Sans filtre : l'annuaire se lit par sections, dans l'ordre des
     catégories — comme un guide papier. Avec filtre : liste simple. */
  const grouped = useMemo(() => {
    if (category || query.trim() || quartier) return null;
    return CATEGORY_ORDER
      .map((c) => ({ c, items: shown.filter((p) => p.category === c) }))
      .filter((g) => g.items.length > 0);
  }, [shown, category, query, quartier]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="header-island" aria-hidden="true"><Mark size={300} detail="full" /></div>
        <div className="container" style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Brand site="guide" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <SiteSwitcher />
              <AccountButton />
            </div>
          </div>

          <p className="hero-tagline">L&apos;île, <em>mode d&apos;emploi</em>.</p>
          <div style={{ position: "relative", margin: "12px 0 12px" }}>
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Une plage, un lieu, un quartier…"
              aria-label="Rechercher dans le guide"
              type="search"
            />
          </div>
        </div>
        <div className="header-accent" />
      </header>

      <div className="container">
        <div className="filter-row wrap">
          <select
            className="input"
            value={category ?? ""}
            onChange={(e) => setCategory((e.target.value || null) as PlaceCategory | null)}
            aria-label="Catégorie"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="">Toutes les catégories</option>
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <select
            className="input"
            value={quartier ?? ""}
            onChange={(e) => setQuartier(e.target.value || null)}
            aria-label="Quartier"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="">Tous les quartiers</option>
            {quartiers.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <button
            className="chip"
            onClick={() => setView(view === "map" ? "list" : "map")}
            aria-pressed={view === "map"}
            style={view === "map" ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}
          >
            {view === "map" ? "◈ Liste" : "◈ Carte"}
          </button>
        </div>
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 60, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h1 className="section-title">
            {category ? CATEGORY_LABEL[category] : "L'île en poche"}
          </h1>
          {!loading && shown.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {shown.length} lieu{shown.length > 1 ? "x" : ""}
            </span>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}

        {loading ? (
          <div className="grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel skeleton" style={{ height: 110, opacity: 0.6 }} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="panel gold-frame" style={{ textAlign: "center", padding: "44px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={64} color="var(--gold-deep)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>Rien ne correspond ici.</p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
              Élargissez la recherche ou retirez un filtre.
            </p>
          </div>
        ) : view === "map" ? (
          <GuideMap places={shown} />
        ) : grouped ? (
          grouped.map(({ c, items }) => (
            <section key={c} style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                color: "var(--gold-deep)", margin: "0 0 10px" }}>
                {CATEGORY_LABEL[c]} <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>· {items.length}</span>
              </h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                {items.map((p) => <PlaceCard key={p.id} p={p} />)}
              </div>
            </section>
          ))
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {shown.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 26, lineHeight: 1.5 }}>
          Informations rassemblées par {SITE.name}, à vérifier sur place — horaires, accès et
          conditions de mer changent. Une adresse manque, une association à ajouter ?{" "}
          <Link href="/retours" style={{ color: "var(--gold-deep)" }}>Proposez-la ici.</Link>
        </p>
      </main>

      <footer style={{ background: "var(--green)", color: "rgba(241,247,248,.72)", padding: "26px 0 30px", marginTop: "auto" }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Mark size={72} />
          <span className="overline">{SITE.name} · {SITE.overline}</span>
          <p style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>{SITE.description}</p>
          <span style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12.5 }}>
            <Link href="/retours" style={{ color: "var(--gold)" }}>Une idée ?</Link>
            <Link href="/soutenir" style={{ color: "var(--gold)" }}>Soutenir ♥</Link>
            <Link href="/mentions-legales" style={{ color: "rgba(241,247,248,.6)" }}>Mentions légales</Link>
            <Link href="/confidentialite" style={{ color: "rgba(241,247,248,.6)" }}>Confidentialité</Link>
          </span>
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(126,200,221,.25)", width: "100%", maxWidth: 460 }}>
            <SiteFamilyFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}
