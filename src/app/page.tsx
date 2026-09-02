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
import { SITES, SITE_ORDER } from "@/lib/sites";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";
import InstallBanner from "@/components/InstallBanner";
import { eventDay, islandDayStartIso } from "@/lib/event";

const SITE = SITES.tikanal;

type Tab = "home" | ModuleKey;
type Discovery = { href: string; title: string; meta: string; site: "food" | "guide" | "event" };

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
  const [foodHits, setFoodHits] = useState<{ id: string; name: string; cuisine: string; quartier: string }[]>([]);
  const [guideHits, setGuideHits] = useState<{ id: string; name: string; category: string; quartier: string }[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);

  const activeModule = tab === "home" ? null : tab;
  const m = activeModule ? MODULES[activeModule] : null;
  const accent = m ? m.color : "var(--gold)";
  // Le filet du bandeau peut rester en or ; un aplat de chip, non (texte blanc).
  const accentSolid = m ? m.color : "var(--green)";

  useEffect(() => { recordView("/"); }, []);

  /* L'accueil reste vivant même avant les premières annonces : l'écosystème
     Food, Guide et Event fournit des portes d'entrée utiles plutôt qu'un
     grand écran vide. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* Seules les sections ouvertes alimentent la découverte : proposer une
         porte d'entrée vers une section fermée mène à une page d'attente. */
      const [food, guide, events] = await Promise.all([
        SITES.food.ready
          ? supabase().from("restaurants").select("id,name,cuisine,quartier")
              .eq("status", "active").order("name").limit(2)
          : Promise.resolve({ data: [] }),
        supabase().from("places").select("id,name,category,quartier")
          .eq("status", "active").order("name").limit(3),
        SITES.event.ready
          ? supabase().from("events").select("id,title,category,quartier,starts_at")
              .eq("status", "approved").gte("starts_at", islandDayStartIso()).order("starts_at").limit(2)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      const items: Discovery[] = [
        ...((food.data ?? []) as { id: string; name: string; cuisine: string; quartier: string }[]).map((r) => ({
          href: `/food/resto/${r.id}`, title: r.name, meta: `${r.cuisine} · ${r.quartier}`, site: "food" as const,
        })),
        ...((guide.data ?? []) as { id: string; name: string; category: string; quartier: string }[]).map((p) => ({
          href: `/guide/lieu/${p.id}`, title: p.name, meta: `${p.category} · ${p.quartier}`, site: "guide" as const,
        })),
        ...((events.data ?? []) as { id: string; title: string; category: string; quartier: string; starts_at: string }[]).map((e) => {
          const date = eventDay(e.starts_at);
          return { href: `/event/${e.id}`, title: e.title, meta: `${date.semaine} ${date.jour} ${date.mois} · ${e.quartier}`, site: "event" as const };
        }),
      ];
      setDiscoveries(items);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      let q = supabase()
        .from("listings")
        .select("*, photos:listing_photos(storage_key, position)")
        /* Les vendues récentes restent visibles avec leur bandeau : la RLS
           limite d'elle-même aux 7 jours suivant la vente. */
        .in("status", ["active", "sold"])
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

  /* Recherche globale : depuis l'accueil, la même barre fouille aussi les
     restaurants et le guide — trois univers, un seul champ. Les caractères
     spéciaux de la syntaxe PostgREST sont neutralisés. */
  useEffect(() => {
    const q = query.trim().replace(/[,()%\\]/g, " ").trim();
    if (tab !== "home" || q.length < 2) { setFoodHits([]); setGuideHits([]); return; }
    let cancelled = false;
    (async () => {
      const like = `%${q}%`;
      const [fr, gp] = await Promise.all([
        /* Une section fermée ne doit pas remonter dans les résultats : la
           recherche s'arrête à ce qui est réellement ouvert au public. */
        SITES.food.ready
          ? supabase().from("restaurants").select("id, name, cuisine, quartier").eq("status", "active")
              .or(`name.ilike.${like},cuisine.ilike.${like},quartier.ilike.${like}`).limit(5)
          : Promise.resolve({ data: [] as typeof foodHits }),
        supabase().from("places").select("id, name, category, quartier").eq("status", "active")
          .or(`name.ilike.${like},quartier.ilike.${like},description.ilike.${like}`).limit(5),
      ]);
      if (cancelled) return;
      setFoodHits((fr.data as typeof foodHits) ?? []);
      setGuideHits((gp.data as typeof guideHits) ?? []);
    })();
    return () => { cancelled = true; };
  }, [query, tab]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header home-header">
      <div className="header-island" aria-hidden="true"><Mark size={300} detail="full" /></div>
        <div className="container home-header-inner">
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

          {tab === "home" && (
            <p className="hero-tagline">Le canal des <em>bonnes affaires</em> de l&apos;île.</p>
          )}
          <div className="search-shell">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" />
            </svg>
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m ? `Rechercher dans ${m.label}…` : "Rechercher sur toute l'île…"}
              aria-label="Rechercher une annonce"
              type="search"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Effacer la recherche">×</button>
            )}
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

      {/* Les tuiles des autres sections : SITE_ORDER fait foi, une section
          retirée de la liste disparaît d'ici sans autre changement, et celles
          qui ne sont pas encore ouvertes portent la mention « bientôt ». */}
      {tab === "home" && (
        <div className="container">
          {/* Rappel animé : la famille de sites vit derrière les ••• du bandeau. */}
          <p className="famille-hint">
            Un seul site, <em>plusieurs univers</em> — basculez à tout moment avec les{" "}
            <span className="dots-hint" aria-hidden="true"><i /><i /><i /></span> en haut.
          </p>
          <div className="universe-strip" aria-label="Explorer les univers de l'île">
            {SITE_ORDER.filter((k) => k !== "tikanal").map((k) => SITES[k]).map((s) => (
              <Link
                key={s.key}
                href={s.path}
                data-site={s.key}
                className="universe-card"
                style={{
                  background: "linear-gradient(120deg, var(--green-700), var(--green))",
                }}
              >
                <Mark size={36} color="var(--gold)" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong>{s.name}</strong>
                  {/* Pastille plutôt que texte accolé : dans une tuile compacte,
                      une baseline longue mange la mention par ellipse — or c'est
                      justement l'information à ne pas manquer. */}
                  {s.ready ? (
                    <small>{s.baseline}</small>
                  ) : (
                    <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700,
                      letterSpacing: ".08em", textTransform: "uppercase", marginTop: 2,
                      background: "var(--gold)", color: "var(--green-900)",
                      padding: "2px 8px", borderRadius: 99 }}>
                      Bientôt
                    </span>
                  )}
                </span>
                <span aria-hidden="true" style={{ color: "var(--gold)", fontSize: 18 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="container">
        {m && (
          <div className="filter-row">
            {/* Menu déroulant plutôt que chips défilantes : la totalité des
                sous-catégories tient à l'écran, rien à aller chercher. */}
            <select
              className="input"
              value={sub ?? ""}
              onChange={(e) => setSub(e.target.value || null)}
              aria-label="Sous-catégorie"
              style={{ width: "auto", maxWidth: "100%", minHeight: 40, padding: "8px 34px 8px 14px",
                borderRadius: 999, fontSize: 14, fontWeight: 600, flex: "0 0 auto",
                borderColor: sub ? m.color : undefined, color: sub ? m.dark : undefined }}
            >
              <option value="">Toutes les sous-catégories</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
          <h1 className="section-title">
            {m ? m.label : "Dernières annonces"}
          </h1>
          {!loading && listings.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {listings.length} annonce{listings.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}

        {(foodHits.length > 0 || guideHits.length > 0) && (
          <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
            {foodHits.length > 0 && (
              <div className="panel" data-site="food" style={{ padding: "10px 14px", background: "var(--surface)" }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                  color: "var(--gold-deep)", margin: "0 0 6px" }}>
                  Aussi dans St Barth Food
                </p>
                {foodHits.map((r) => (
                  <Link key={r.id} href={`/food/resto/${r.id}`}
                    style={{ display: "block", padding: "5px 0", fontSize: 13.5, textDecoration: "none", color: "var(--text)" }}>
                    <strong>{r.name}</strong>
                    <span style={{ color: "var(--text-muted)" }}> — {r.cuisine} · {r.quartier}</span>
                    <span style={{ color: "var(--gold-deep)" }}> →</span>
                  </Link>
                ))}
              </div>
            )}
            {guideHits.length > 0 && (
              <div className="panel" data-site="guide" style={{ padding: "10px 14px", background: "var(--surface)" }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                  color: "var(--gold-deep)", margin: "0 0 6px" }}>
                  Aussi dans St Barth Guide
                </p>
                {guideHits.map((p) => (
                  <Link key={p.id} href={`/guide/lieu/${p.id}`}
                    style={{ display: "block", padding: "5px 0", fontSize: 13.5, textDecoration: "none", color: "var(--text)" }}>
                    <strong>{p.name}</strong>
                    <span style={{ color: "var(--text-muted)" }}> — {p.quartier}</span>
                    <span style={{ color: "var(--gold-deep)" }}> →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel skeleton" style={{ height: 210, opacity: 0.6 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-discovery">
            <section className="empty-cta">
              <Mark size={70} color="var(--gold)" />
              <h2>{query || intent || m ? "Aucun résultat" : "Le canal démarre avec vous"}</h2>
              <p>{query || intent || m
                ? "Modifiez vos critères ou publiez gratuitement ce que vous recherchez."
                : "Une vente, une location, un service ou une recherche : publiez votre annonce en quelques minutes."}</p>
              {(query || intent || m) && (
                <button className="btn btn-gold" onClick={() => { setQuery(""); setIntent(null); setSub(null); setMinP(""); setMaxP(""); }}>
                  Effacer les filtres
                </button>
              )}
              {!query && !intent && !m && <Link href="/deposer" className="btn btn-gold">Déposer gratuitement</Link>}
            </section>
            <section>
              <p style={{ margin: "0 0 9px", fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gold-deep)" }}>
                À découvrir sur l&apos;île
              </p>
              <div className="discovery-list">
                {discoveries.slice(0, 5).map((item) => (
                  <Link key={`${item.site}-${item.href}`} href={item.href} className="discovery-link">
                    <span className="discovery-dot" style={{ background: SITES[item.site].dot }} />
                    <span><strong>{item.title}</strong><small>{item.meta}</small></span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
                {discoveries.length === 0 && (
                  <Link href="/guide" className="discovery-link">
                    <span className="discovery-dot" style={{ background: SITES.guide.dot }} />
                    <span><strong>Que faire sur l&apos;île ?</strong><small>Plages, points de vue et bons plans</small></span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </section>
          </div>
        ) : tab === "home" && !query && !intent && listings.length > 3 ? (
          (() => {
            /* « À la une » ne met en avant que du disponible : une annonce
               vendue en vitrine, c'est une invitation à repartir. */
            const featured = listings.filter((l) => l.status === "active").slice(0, 3);
            const featIds = new Set(featured.map((l) => l.id));
            return (
              <>
                <div className="featured-row">
                  {featured.map((l) => <ListingCard key={l.id} l={l} />)}
                </div>
                <div className="grid">
                  {listings.filter((l) => !featIds.has(l.id)).map((l) => <ListingCard key={l.id} l={l} />)}
                </div>
              </>
            );
          })()
        ) : (
          <div className="grid">
            {listings.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
        )}
        {tab === "home" && <div style={{ marginTop: 24 }}><InstallBanner /></div>}
      </main>

      <Link href="/deposer" className="btn btn-gold fab">+ Déposer</Link>

      <footer style={{ background: "var(--green)", color: "rgba(246,242,233,.72)", padding: "26px 0 30px", marginTop: "auto" }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Mark size={72} />
          <span className="overline">{SITE.name} · {SITE.overline}</span>
          <p style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>{SITE.description}</p>
          <span style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12.5 }}>
            <Link href="/retours" style={{ color: "var(--gold)" }}>Une idée ?</Link>
            <Link href="/soutenir" style={{ color: "var(--gold)" }}>Soutenir ♥</Link>
            <Link href="/mentions-legales" style={{ color: "rgba(246,242,233,.6)" }}>Mentions légales</Link>
            <Link href="/confidentialite" style={{ color: "rgba(246,242,233,.6)" }}>Confidentialité</Link>
          </span>
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(201,168,106,.25)", width: "100%", maxWidth: 460 }}>
            <SiteFamilyFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}
