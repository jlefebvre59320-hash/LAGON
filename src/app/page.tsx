"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_ORDER, INTENT_FILTER, type Intent, type ModuleKey } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import { FavoritesProvider } from "@/lib/favorites";
import { recordView } from "@/lib/analytics";
import { SITE } from "@/lib/sites";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";

type Tab = "home" | ModuleKey;

export default function HomePage() {
  return (
    <FavoritesProvider>
      <Home />
    </FavoritesProvider>
  );
}

function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [query, setQuery] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeModule = tab === "home" ? null : tab;
  const m = activeModule ? MODULES[activeModule] : null;
  const accent = m ? m.color : "var(--gold)";
  // Le filet du bandeau peut rester en or ; un aplat de chip, non (texte blanc).
  const accentSolid = m ? m.color : "var(--green)";

  useEffect(() => { recordView("/"); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      let q = supabase()
        .from("listings")
        .select("*, photos:listing_photos(storage_key, position)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);

      if (activeModule) q = q.eq("module", activeModule);
      if (activeModule && sub) q = q.eq("subcategory", sub);
      if (intent) q = q.eq("intent", intent);
      if (minP !== "") q = q.gte("price_cents", parseInt(minP, 10) * 100);
      if (maxP !== "") q = q.lte("price_cents", parseInt(maxP, 10) * 100);
      if (query.trim()) q = q.textSearch("search_tsv", query.trim(), { type: "websearch", config: "french" });

      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError("Impossible de charger les annonces. Réessayez.");
      else setListings((data as Listing[]) ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [activeModule, sub, intent, query, minP, maxP]);

  const subs = useMemo(() => (m ? m.subs : []), [m]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="container" style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Brand onClick={() => { setTab("home"); setSub(null); }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <Link href="/deposer" className="btn btn-gold only-desktop">
                + Déposer une annonce
              </Link>
              <SiteSwitcher />
              <AccountButton />
            </div>
          </div>

          <div style={{ position: "relative", margin: "16px 0 12px" }}>
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m ? `Rechercher dans ${m.label}…` : "Rechercher sur toute l'île…"}
              aria-label="Rechercher une annonce"
              type="search"
            />
          </div>

          <nav className="tabs" aria-label="Univers">
            <button
              className={`tab${tab === "home" ? " tab-active" : ""}`}
              onClick={() => { setTab("home"); setSub(null); }}
              aria-current={tab === "home" ? "page" : undefined}
            >
              Accueil
            </button>
            {MODULE_ORDER.map((key) => (
              <button
                key={key}
                className={`tab${tab === key ? " tab-active" : ""}`}
                onClick={() => { setTab(key); setSub(null); }}
                aria-current={tab === key ? "page" : undefined}
                style={tab === key ? { background: MODULES[key].color, borderColor: MODULES[key].color, color: "#fff" } : undefined}
              >
                {MODULES[key].short}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-accent" style={{ background: accent }} />
      </header>

      <div className="container">
        {m && (
          <div className="filter-row">
            <button
              className="chip"
              onClick={() => setSub(null)}
              style={!sub ? { background: m.color, borderColor: m.color, color: "#fff" } : undefined}
            >
              Tout
            </button>
            {subs.map((s) => (
              <button
                key={s}
                className="chip"
                onClick={() => setSub(sub === s ? null : s)}
                style={sub === s ? { background: m.color, borderColor: m.color, color: "#fff" } : undefined}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Sens de l'annonce : proposé ou recherché. Valable dans tous les
            univers, donc affiché aussi sur l'accueil. */}
        <div className="filter-row" style={{ paddingTop: m ? 8 : 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Afficher
          </span>
          <button
            className="chip"
            onClick={() => setIntent(null)}
            style={!intent ? { background: accentSolid, borderColor: accentSolid, color: "#fff" } : undefined}
          >
            Tout
          </button>
          {INTENT_ORDER.map((k) => (
            <button
              key={k}
              className="chip"
              onClick={() => setIntent(intent === k ? null : k)}
              style={intent === k ? { background: accentSolid, borderColor: accentSolid, color: "#fff" } : undefined}
            >
              {INTENT_FILTER[k]}
            </button>
          ))}

          {m && (
            <>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 4px", flex: "0 0 auto" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              Prix
            </span>
            <input
              className="input" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ""))}
              placeholder="min" inputMode="numeric" aria-label="Prix minimum"
              style={{ width: 96, minHeight: 38, padding: "8px 12px", borderRadius: 999, fontSize: 14, flex: "0 0 auto" }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>à</span>
            <input
              className="input" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ""))}
              placeholder="max" inputMode="numeric" aria-label="Prix maximum"
              style={{ width: 96, minHeight: 38, padding: "8px 12px", borderRadius: 999, fontSize: 14, flex: "0 0 auto" }}
            />
            {(minP || maxP) && (
              <button className="link-quiet" onClick={() => { setMinP(""); setMaxP(""); }} style={{ whiteSpace: "nowrap" }}>
                effacer
              </button>
            )}
            </>
          )}
        </div>
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 90, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontSize: 19, margin: 0 }}>
            {m ? m.label : "Dernières annonces sur l'île"}
          </h1>
          {!loading && listings.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {listings.length} annonce{listings.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}

        {loading ? (
          <div className="grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel" style={{ height: 210, opacity: 0.5 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="panel gold-frame" style={{ textAlign: "center", padding: "44px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={84} color="var(--gold-deep)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>
              Aucune annonce ici pour l&apos;instant.
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
              Soyez le premier à ouvrir le canal.
            </p>
            <Link href="/deposer" className="btn">Déposer une annonce</Link>
          </div>
        ) : (
          <div className="grid">
            {listings.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
        )}
      </main>

      <Link href="/deposer" className="btn btn-gold fab">+ Déposer</Link>

      <footer style={{ background: "var(--green)", color: "rgba(246,242,233,.72)", padding: "26px 0 30px", marginTop: "auto" }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Mark size={72} />
          <span className="overline">{SITE.name} · {SITE.overline}</span>
          <p style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>{SITE.description}</p>
          <Link href="/connexion" style={{ fontSize: 12.5, color: "var(--gold)", marginTop: 4 }}>
            Connexion
          </Link>
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(201,168,106,.25)", width: "100%", maxWidth: 460 }}>
            <SiteFamilyFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}
