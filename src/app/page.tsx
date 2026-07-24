"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, type ModuleKey } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import ListingCard from "@/components/ListingCard";

type Tab = "home" | ModuleKey;

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeModule = tab === "home" ? null : tab;
  const m = activeModule ? MODULES[activeModule] : null;
  const accent = m ? m.color : "var(--ink)";
  const headerBg = m ? m.soft : "#f0f4f5";

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
  }, [activeModule, sub, query, minP, maxP]);

  const subs = useMemo(() => (m ? m.subs : []), [m]);

  return (
    <div>
      <header style={{ background: headerBg, borderBottom: `3px solid ${accent}`, transition: "background .25s, border-color .25s" }}>
        <div className="container" style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Link href="/" className="wordmark" onClick={() => { setTab("home"); setSub(null); }}>
              LAGON
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: m ? m.dark : "var(--text-muted)", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginLeft: 8, verticalAlign: "3px" }}>
                Annonces · Saint-Barthélemy
              </span>
            </Link>
            <Link href="/deposer" className="btn" style={{ background: accent, textDecoration: "none" }}>
              + Déposer une annonce
            </Link>
          </div>

          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m ? `Rechercher dans ${m.label}…` : "Rechercher sur toute l'île…"}
            style={{ margin: "12px 0", fontSize: 14.5 }}
          />

          <nav style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            <button className="tab" onClick={() => { setTab("home"); setSub(null); }}
              style={tab === "home" ? { background: "var(--ink)", color: "#fff" } : undefined}>
              Accueil
            </button>
            {MODULE_ORDER.map((key) => (
              <button key={key} className="tab" onClick={() => { setTab(key); setSub(null); }}
                style={tab === key ? { background: MODULES[key].color, color: "#fff" } : undefined}>
                {MODULES[key].icon} {MODULES[key].short}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {m && (
        <div className="container" style={{ paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="chip" onClick={() => setSub(null)}
            style={!sub ? { background: m.color, borderColor: m.color, color: "#fff" } : undefined}>
            Tout
          </button>
          {subs.map((s) => (
            <button key={s} className="chip" onClick={() => setSub(sub === s ? null : s)}
              style={sub === s ? { background: m.color, borderColor: m.color, color: "#fff" } : undefined}>
              {s}
            </button>
          ))}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <input className="input" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ""))}
              placeholder="Prix min" inputMode="numeric" style={{ width: 90, padding: "6px 10px", borderRadius: 99, fontSize: 12.5 }} />
            <span style={{ color: "#9a9a9a", fontSize: 12 }}>à</span>
            <input className="input" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ""))}
              placeholder="Prix max" inputMode="numeric" style={{ width: 90, padding: "6px 10px", borderRadius: 99, fontSize: 12.5 }} />
          </div>
        </div>
      )}

      <main className="container" style={{ paddingTop: 16, paddingBottom: 48 }}>
        {tab === "home" && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 14px" }}>
            Dernières annonces sur l'île, tous univers confondus.
          </p>
        )}
        {error && <p style={{ color: "#b0341f", fontWeight: 600 }}>{error}</p>}
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Chargement…</p>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a" }}>
            <div style={{ fontSize: 36 }}>🌴</div>
            <p style={{ fontWeight: 600, color: "var(--text-muted)" }}>Aucune annonce ici pour l'instant.</p>
            <p style={{ fontSize: 13 }}>
              Soyez le premier : <Link href="/deposer">déposez la vôtre</Link> en 2 minutes.
            </p>
          </div>
        ) : (
          <div className="grid">
            {listings.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
        )}
      </main>
    </div>
  );
}
