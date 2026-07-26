"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CUISINES, QUARTIERS, isOpenNow, hasHours, type Restaurant, type RatingSummary } from "@/lib/food";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";
import RestaurantCard from "@/components/food/RestaurantCard";
import { recordView } from "@/lib/analytics";
import { SITE } from "@/lib/sites";

export default function FoodHome() {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [takeaway, setTakeaway] = useState(false);
  const [all, setAll] = useState<Restaurant[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { recordView("/"); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase()
        .from("restaurants")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (cancelled) return;
      if (error) setError("Impossible de charger les restaurants. Réessayez.");
      else setAll((data as Restaurant[]) ?? []);
      setLoading(false);

      // Les moyennes arrivent après la liste : elles habillent, elles ne bloquent pas.
      const { data: sums } = await supabase().rpc("ratings_summary");
      if (cancelled || !sums) return;
      const map: Record<string, RatingSummary> = {};
      for (const s of sums as ({ restaurant_id: string } & RatingSummary)[]) {
        map[s.restaurant_id] = { avg_rating: Number(s.avg_rating), votes: Number(s.votes) };
      }
      setRatings(map);
    })();
    return () => { cancelled = true; };
  }, []);

  /* « Ouvert maintenant » se calcule côté client : l'état change avec l'heure,
     pas avec les données — inutile de refaire une requête. */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) =>
      (!cuisine || r.cuisine === cuisine) &&
      (!quartier || r.quartier === quartier) &&
      (!takeaway || r.takeaway) &&
      (!openOnly || (hasHours(r.hours) && isOpenNow(r.hours))) &&
      (!q || `${r.name} ${r.cuisine} ${r.quartier}`.toLowerCase().includes(q))
    );
  }, [all, query, cuisine, quartier, openOnly, takeaway]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="container" style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Brand />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <SiteSwitcher />
              <AccountButton />
            </div>
          </div>

          <div style={{ position: "relative", margin: "16px 0 12px" }}>
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un restaurant, une cuisine, un quartier…"
              aria-label="Rechercher un restaurant"
              type="search"
            />
          </div>

          <nav className="tabs" aria-label="Cuisines">
            <button
              className={`tab${!cuisine ? " tab-active" : ""}`}
              onClick={() => setCuisine(null)}
            >
              Toutes
            </button>
            {CUISINES.map((c) => (
              <button
                key={c}
                className={`tab${cuisine === c ? " tab-active" : ""}`}
                onClick={() => setCuisine(cuisine === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-accent" />
      </header>

      <div className="container">
        <div className="filter-row">
          <button
            className="chip"
            onClick={() => setOpenOnly(!openOnly)}
            aria-pressed={openOnly}
            style={openOnly ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}
          >
            Ouvert maintenant
          </button>
          <button
            className="chip"
            onClick={() => setTakeaway(!takeaway)}
            aria-pressed={takeaway}
            style={takeaway ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}
          >
            À emporter
          </button>
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 4px", flex: "0 0 auto" }} />
          {QUARTIERS.map((q) => (
            <button
              key={q}
              className="chip"
              onClick={() => setQuartier(quartier === q ? null : q)}
              style={quartier === q ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 60, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontSize: 19, margin: 0 }}>
            {cuisine ?? "Où manger sur l'île"}
          </h1>
          {!loading && shown.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {shown.length} adresse{shown.length > 1 ? "s" : ""}
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
        ) : shown.length === 0 ? (
          <div className="panel gold-frame" style={{ textAlign: "center", padding: "44px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={64} color="var(--gold-deep)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>
              {openOnly ? "Rien d'ouvert avec ces critères en ce moment." : "Aucune adresse ne correspond."}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
              Élargissez la recherche ou retirez un filtre.
            </p>
          </div>
        ) : (
          <div className="grid">
            {shown.map((r) => <RestaurantCard key={r.id} r={r} rating={ratings[r.id]} />)}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 26, lineHeight: 1.5 }}>
          Informations rassemblées par {SITE.name}, à vérifier auprès de l&apos;établissement.
          Réservation et commande directement auprès du restaurant — nous ne gérons ni
          livraison ni paiement.
        </p>
      </main>

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
          {/* Attribution requise par la licence ODbL : une partie des fiches
              est initialement issue d'OpenStreetMap. */}
          <p style={{ fontSize: 10.5, margin: "6px 0 0", color: "rgba(246,242,233,.5)" }}>
            Données initiales partiellement issues d&apos;
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
              style={{ color: "inherit" }}>
              © les contributeurs OpenStreetMap
            </a>{" "}(ODbL)
          </p>
        </div>
      </footer>
    </div>
  );
}
