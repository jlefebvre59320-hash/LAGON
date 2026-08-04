"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CUISINES, QUARTIERS, isOpenNow, hasHours, type Restaurant, type RatingSummary } from "@/lib/food";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";
import RestaurantCard from "@/components/food/RestaurantCard";
import { recordView } from "@/lib/analytics";
import { SITES } from "@/lib/sites";
import { FavoritesProvider } from "@/lib/favorites";

const SITE = SITES.food;

export default function FoodHome() {
  return (
    <FavoritesProvider kind="restaurant">
      <FoodHomeInner />
    </FavoritesProvider>
  );
}

function FoodHomeInner() {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<"name" | "rating" | "open">("name");
  const [takeaway, setTakeaway] = useState(false);
  const [all, setAll] = useState<Restaurant[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { recordView("/food"); }, []);

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
    const list = all.filter((r) =>
      (!cuisine || r.cuisine === cuisine) &&
      (!quartier || r.quartier === quartier) &&
      (!takeaway || r.takeaway) &&
      (!openOnly || (hasHours(r.hours) && isOpenNow(r.hours))) &&
      (!q || `${r.name} ${r.cuisine} ${r.quartier}`.toLowerCase().includes(q))
    );
    if (sort === "rating") {
      // Les notés d'abord (meilleure moyenne, puis nombre d'avis) ; les autres
      // suivent par nom — sans note, impossible de les départager autrement.
      list.sort((a, b) => {
        const ra = ratings[a.id], rb = ratings[b.id];
        if (!!ra !== !!rb) return ra ? -1 : 1;
        if (ra && rb) return (rb.avg_rating - ra.avg_rating) || (rb.votes - ra.votes) || a.name.localeCompare(b.name, "fr");
        return a.name.localeCompare(b.name, "fr");
      });
    } else if (sort === "open") {
      const isOpen = (r: Restaurant) => hasHours(r.hours) && isOpenNow(r.hours);
      list.sort((a, b) => (Number(isOpen(b)) - Number(isOpen(a))) || a.name.localeCompare(b.name, "fr"));
    }
    return list;
  }, [all, query, cuisine, quartier, openOnly, takeaway, sort, ratings]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
      <div className="header-island" aria-hidden="true"><Mark size={300} detail="full" /></div>
        <div className="container" style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Brand site="food" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <SiteSwitcher />
              <AccountButton />
            </div>
          </div>

          <p className="hero-tagline">Bien manger, <em>toute l&apos;île</em>.</p>
          <div style={{ position: "relative", margin: "12px 0 12px" }}>
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un restaurant, une cuisine, un quartier…"
              aria-label="Rechercher un restaurant"
              type="search"
            />
          </div>

        </div>
        <div className="header-accent" />
      </header>

      <div className="container">
        <div className="filter-row">
          <select
            className="input"
            value={cuisine ?? ""}
            onChange={(e) => setCuisine(e.target.value || null)}
            aria-label="Type de cuisine"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="">Toutes les cuisines</option>
            {CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="input"
            value={quartier ?? ""}
            onChange={(e) => setQuartier(e.target.value || null)}
            aria-label="Quartier"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="">Tous les quartiers</option>
            {QUARTIERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <select
            className="input"
            value={sort}
            onChange={(e) => setSort(e.target.value as "name" | "rating" | "open")}
            aria-label="Trier"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="name">Tri : nom</option>
            <option value="rating">Tri : mieux notés</option>
            <option value="open">Tri : ouverts d&apos;abord</option>
          </select>
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
        </div>
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 60, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h1 className="section-title">
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
              <div key={i} className="panel skeleton" style={{ height: 210, opacity: 0.6 }} />
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
        ) : (() => {
          const noFilter = !query && !cuisine && !quartier && !openOnly && !takeaway && sort === "name";
          const top = noFilter
            ? shown.filter((r) => ratings[r.id] && ratings[r.id].votes >= 3)
                .sort((a, b) => ratings[b.id].avg_rating - ratings[a.id].avg_rating).slice(0, 4)
            : [];
          const topIds = new Set(top.map((r) => r.id));
          return (
            <>
              {top.length >= 2 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold-deep)", margin: "0 0 8px" }}>
                    Les tables préférées de l&apos;île
                  </p>
                  <div className="featured-row">
                    {top.map((r) => <RestaurantCard key={r.id} r={r} rating={ratings[r.id]} />)}
                  </div>
                </>
              )}
              <div className="grid">
                {shown.filter((r) => !topIds.has(r.id)).map((r) => <RestaurantCard key={r.id} r={r} rating={ratings[r.id]} />)}
              </div>
            </>
          );
        })()}

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
          <span style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12.5 }}>
            <Link href="/retours" style={{ color: "var(--gold)" }}>Une idée ?</Link>
            <Link href="/mentions-legales" style={{ color: "rgba(246,242,233,.6)" }}>Mentions légales</Link>
            <Link href="/confidentialite" style={{ color: "rgba(246,242,233,.6)" }}>Confidentialité</Link>
          </span>
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
