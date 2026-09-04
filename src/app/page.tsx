"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_ORDER, INTENT_FILTER, ZONES_SERVICE, TARIFS_SERVICE, DISPOS_SERVICE, type Intent, type ModuleKey } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import { FavoritesProvider } from "@/lib/favorites";
import { recordView } from "@/lib/analytics";
import { SITES, SITE_ORDER } from "@/lib/sites";
import { trierEnAvantDabord, estEnAvant } from "@/lib/featured";
import ALaUne from "@/components/ALaUne";
import { QUARTIERS } from "@/lib/quartiers";
import { creerAlerte, decrireAlerte, type CriteresAlerte } from "@/lib/alertes";
import { connexionUrl } from "@/lib/urls";
import { useRouter } from "next/navigation";

/* Taille d'une page du fil : assez pour remplir l'écran d'un ordinateur,
   assez peu pour arriver vite sur un téléphone. La suite se charge en
   descendant. */
const PAGE = 30;
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

/* Les trois filtres de services partagent la même mise en forme : une seule
   définition évite qu'ils divergent au premier ajustement. */
function SelectFiltre({
  valeur, set, defaut, options, aria,
}: {
  valeur: string; set: (v: string) => void;
  defaut: string; options: readonly string[]; aria: string;
}) {
  return (
    <select
      className="input"
      value={valeur}
      onChange={(e) => set(e.target.value)}
      aria-label={aria}
      style={{
        width: "auto", minHeight: 38, padding: "8px 32px 8px 13px",
        borderRadius: 999, fontSize: 13.5, flex: "0 0 auto", fontWeight: 600,
        ...(valeur ? { borderColor: "var(--green)", color: "var(--green)" } : {}),
      }}
    >
      <option value="">{defaut}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* « M'alerter » : crée une alerte à partir des critères courants. Sans
   compte, on passe par la connexion et on revient. Une fois créée, le
   bouton le dit et renvoie vers Mon espace pour la gérer. */
function BoutonAlerte({ criteres }: { criteres: CriteresAlerte }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const cle = JSON.stringify(criteres);
  /* Les critères ont changé : le bouton redevient disponible. */
  useEffect(() => { setEtat("idle"); setMsg(null); }, [cle]);

  async function creer() {
    setEtat("busy");
    const { error } = await creerAlerte(criteres);
    if (error === "connexion") { router.push(connexionUrl("/")); return; }
    if (error) {
      setEtat("err");
      setMsg(error.includes("dix") ? "Vous avez déjà dix alertes : supprimez-en une dans Mon espace." : "L’alerte n’a pas pu être créée.");
      return;
    }
    setEtat("ok");
  }

  if (etat === "ok") return (
    <span style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 600, whiteSpace: "nowrap" }}>
      ✓ Alerte créée · <Link href="/mon-espace" style={{ color: "var(--gold-deep)" }}>gérer</Link>
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" className="btn btn-outline-gold" onClick={creer} disabled={etat === "busy"}
        title={`Être prévenu des prochaines annonces : ${decrireAlerte(criteres)}`}
        style={{ color: "var(--gold-deep)", fontSize: 12.5, padding: "7px 13px", minHeight: 34, whiteSpace: "nowrap" }}>
        🔔 M’alerter
      </button>
      {msg && <span style={{ fontSize: 12, color: "var(--danger)" }}>{msg}</span>}
    </span>
  );
}

function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [query, setQuery] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  /* Critères propres aux services : ils ne s'affichent que dans cet univers,
     et se vident en le quittant — un filtre invisible qui continue d'agir
     donne une liste inexplicablement courte. */
  const [zone, setZone] = useState("");
  const [tarif, setTarif] = useState("");
  const [dispo, setDispo] = useState("");
  /* Le quartier : l'île se lit par quartier plus que par distance. */
  const [quartier, setQuartier] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Fil sans fin : la date de la dernière annonce ordinaire chargée sert de
     curseur ; « fin » quand une page revient incomplète. */
  const curseur = useRef<string | null>(null);
  const [fin, setFin] = useState(false);
  const [chargementPlus, setChargementPlus] = useState(false);
  const sentinelle = useRef<HTMLDivElement>(null);
  /* Nombre d'annonces en ligne par univers, pour les onglets. */
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [foodHits, setFoodHits] = useState<{ id: string; name: string; cuisine: string; quartier: string }[]>([]);
  const [guideHits, setGuideHits] = useState<{ id: string; name: string; category: string; quartier: string }[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);

  const activeModule = tab === "home" ? null : tab;
  const m = activeModule ? MODULES[activeModule] : null;
  const accent = m ? m.color : "var(--gold)";
  // Le filet du bandeau peut rester en or ; un aplat de chip, non (texte blanc).
  const accentSolid = m ? m.color : "var(--green)";

  /* Les filtres n'existent que dans une catégorie : les laisser actifs en
     revenant à l'accueil donnerait un fil silencieusement amputé, sans
     aucun bouton à l'écran pour l'expliquer. */
  function retourAccueil() {
    setTab("home");
    setSub(null);
    setIntent(null);
    setMinP("");
    setMaxP("");
    setQuartier("");
    viderCriteresService();
  }

  function viderCriteresService() {
    setZone("");
    setTarif("");
    setDispo("");
  }

  useEffect(() => { recordView("/"); }, []);

  /* Les compteurs des onglets : une requête, au chargement. Absents tant
     que la migration 0034 n'est pas passée — l'onglet reste alors sans
     chiffre, rien d'autre ne change. */
  useEffect(() => {
    (async () => {
      const { data } = await supabase().rpc("annonces_par_univers");
      if (data && typeof data === "object") setCompteurs(data as Record<string, number>);
    })();
  }, []);

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
        SITES.guide.ready
          ? supabase().from("places").select("id,name,category,quartier")
              .eq("status", "active").order("name").limit(3)
          : Promise.resolve({ data: [] }),
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

  /* La requête du fil avec tous les filtres courants. Partagée entre le
     premier chargement, les mises en avant et les pages suivantes. */
  const requeteFiltree = useCallback(() => {
    let r = supabase()
      .from("listings")
      .select("*, photos:listing_photos(storage_key, position)")
      /* Les vendues récentes restent visibles avec leur bandeau : la RLS
         limite d'elle-même aux 7 jours suivant la vente. */
      .in("status", ["active", "sold"]);
    if (activeModule) r = r.eq("module", activeModule);
    if (activeModule && sub) r = r.eq("subcategory", sub);
    if (intent) r = r.eq("intent", intent);
    if (minP !== "") r = r.gte("price_cents", parseInt(minP, 10) * 100);
    if (maxP !== "") r = r.lte("price_cents", parseInt(maxP, 10) * 100);
    if (quartier) r = r.ilike("location", `%${quartier}%`);
    /* contains plutôt qu'une comparaison sur attrs->>clé : les libellés
       contiennent espaces et apostrophes, que la syntaxe de chemin de
       PostgREST digère mal. L'index GIN de la migration 0030 sert
       justement cet opérateur. */
    const critere: Record<string, string> = {};
    if (activeModule === "service") {
      if (zone) critere["Zone d'intervention"] = zone;
      if (tarif) critere["Tarification"] = tarif;
      if (dispo) critere["Disponibilité"] = dispo;
    }
    if (Object.keys(critere).length > 0) r = r.contains("attrs", critere);
    if (query.trim()) r = r.textSearch("search_tsv", query.trim(), { type: "websearch", config: "french" });
    return r;
  }, [activeModule, sub, intent, minP, maxP, quartier, zone, tarif, dispo, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFin(false);
    curseur.current = null;

    (async () => {
      /* Deux requêtes plutôt qu'une : sans cela, une annonce mise en avant
         mais ancienne tomberait hors de la première page et ne remonterait
         jamais — ce pour quoi la mise en avant est justement payée. */
      const [ordinaires, enAvant] = await Promise.all([
        requeteFiltree().order("created_at", { ascending: false }).limit(PAGE),
        requeteFiltree()
          .gt("featured_until", new Date().toISOString())
          .order("featured_until", { ascending: false })
          .limit(12),
      ]);

      if (cancelled) return;
      if (ordinaires.error) {
        /* Le détail technique est affiché, en petit : « Réessayez » seul ne
           dit pas si c'est le réseau ou une migration qui manque — et c'est
           presque toujours la seconde. */
        setError(`Impossible de charger les annonces. Réessayez.\n${ordinaires.error.message}`);
      } else {
        const page = Array.isArray(ordinaires.data) ? (ordinaires.data as Listing[]) : [];
        const vus = new Set<string>();
        const fusion = [...((enAvant.data as Listing[]) ?? []), ...page]
          .filter((l) => !vus.has(l.id) && vus.add(l.id));
        setListings(trierEnAvantDabord(fusion));
        curseur.current = page.length > 0 ? page[page.length - 1].created_at : null;
        setFin(page.length < PAGE);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [requeteFiltree]);

  /* La page suivante : tout ce qui est plus ancien que la dernière annonce
     chargée, mêmes filtres. Les doublons (une mise en avant déjà en tête)
     sont écartés. */
  const chargerPlus = useCallback(async () => {
    if (fin || chargementPlus || loading || !curseur.current) return;
    setChargementPlus(true);
    const { data, error: err } = await requeteFiltree()
      .lt("created_at", curseur.current)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    setChargementPlus(false);
    if (err || !Array.isArray(data)) { setFin(true); return; }
    const page = data as Listing[];
    curseur.current = page.length > 0 ? page[page.length - 1].created_at : curseur.current;
    setFin(page.length < PAGE);
    setListings((prev) => {
      const vus = new Set(prev.map((l) => l.id));
      return [...prev, ...page.filter((l) => !vus.has(l.id))];
    });
  }, [fin, chargementPlus, loading, requeteFiltree]);

  useEffect(() => {
    const s = sentinelle.current;
    if (!s || fin) return;
    const obs = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) chargerPlus();
    }, { rootMargin: "600px 0px" });
    obs.observe(s);
    return () => obs.disconnect();
  }, [chargerPlus, fin, loading]);

  const subs = useMemo(() => (m ? m.subs : []), [m]);

  /* « À la une » ne vit que sur l'accueil, hors recherche, et seulement à
     partir de trois annonces en avant. Ce qu'elle montre sort de la grille :
     la mise en avant se voit une fois, en grand, pas deux fois. Dans une
     catégorie ou une recherche, le fil unique reprend, mises en avant en
     tête comme avant. */
  const enAvantListe = useMemo(() => listings.filter(estEnAvant), [listings]);
  const montrerUne = tab === "home" && !query.trim() && enAvantListe.length >= 3;
  const grille = useMemo(
    () => (montrerUne ? listings.filter((l) => !estEnAvant(l)) : listings),
    [listings, montrerUne],
  );

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
        SITES.guide.ready
          ? supabase().from("places").select("id, name, category, quartier").eq("status", "active")
              .or(`name.ilike.${like},quartier.ilike.${like},description.ilike.${like}`).limit(5)
          : Promise.resolve({ data: [] as typeof guideHits }),
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
            <Brand onClick={() => retourAccueil()} />
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
        </div>
      </header>

      {/* Recherche et univers restent collés en haut quand on descend dans le
          fil : chercher ou changer d'univers ne demande jamais de remonter. */}
      <div className="search-dock">
        <div className="container">
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
              onClick={() => retourAccueil()}
              aria-current={tab === "home" ? "page" : undefined}
            >
              Accueil
            </button>
            {MODULE_ORDER.map((key) => (
              <button
                key={key}
                className={`tab${tab === key ? " tab-active" : ""}`}
                onClick={() => { setTab(key); setSub(null); viderCriteresService(); }}
                aria-current={tab === key ? "page" : undefined}
                style={tab === key ? { background: MODULES[key].color, borderColor: MODULES[key].color, color: "#fff" } : undefined}
              >
                {MODULES[key].short}
                {(compteurs[key] ?? 0) > 0 && <span className="tab-compte">{compteurs[key]}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-accent" style={{ background: accent }} />
      </div>

      {/* Les tuiles des autres sections de la famille : elles n'apparaissent
          que si une autre section que Ti Kanal est ouverte (SITE_ORDER).
          Aujourd'hui l'accueil va droit aux annonces. */}
      {tab === "home" && SITE_ORDER.length > 1 && (
        <div className="container">
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

        {/* Filtres réservés aux catégories. L'accueil est un fil, pas un
            outil de recherche : on y montre les dernières annonces, mises
            en avant d'abord. Quelqu'un qui sait ce qu'il cherche entre
            d'abord dans une catégorie — c'est là que trier a un sens. */}
        {m && (
        <div className="filter-row" style={{ paddingTop: 8 }}>
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

            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 4px", flex: "0 0 auto" }} />
            <SelectFiltre valeur={quartier} set={setQuartier} defaut="Toute l'île" options={QUARTIERS} aria="Quartier" />
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
        </div>
        )}

        {/* Trois questions décident si l'on appelle un artisan : vient-il
            jusqu'à moi, comment facture-t-il, et quand est-il disponible.
            Ce sont exactement les trois filtres — pas un de plus. */}
        {activeModule === "service" && (
          <div className="filter-row" style={{ paddingTop: 0, paddingBottom: 4 }}>
            <SelectFiltre valeur={zone} set={setZone} defaut="Toute zone" options={ZONES_SERVICE} aria="Zone d'intervention" />
            <SelectFiltre valeur={tarif} set={setTarif} defaut="Tout tarif" options={TARIFS_SERVICE} aria="Tarification" />
            <SelectFiltre valeur={dispo} set={setDispo} defaut="Toute disponibilité" options={DISPOS_SERVICE} aria="Disponibilité" />
            {(zone || tarif || dispo) && (
              <button className="link-quiet" onClick={viderCriteresService} style={{ whiteSpace: "nowrap" }}>
                effacer
              </button>
            )}
          </div>
        )}
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 90, flex: 1 }}>
        {!loading && montrerUne && <ALaUne annonces={enAvantListe} />}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <h1 className="section-title">
            {m ? m.label : "Dernières annonces"}
          </h1>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!loading && grille.length > 0 && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {grille.length}{!fin ? "+" : ""} annonce{grille.length > 1 ? "s" : ""}
              </span>
            )}
            {/* Une recherche qu'on garde : dès qu'il y a un critère, on peut
                demander à être prévenu des prochaines annonces qui y répondent. */}
            {(m || query.trim() || quartier) && (
              <BoutonAlerte criteres={{
                module: activeModule, subcategory: activeModule && sub ? sub : null, intent,
                query: query.trim() || null,
                min_cents: minP !== "" ? parseInt(minP, 10) * 100 : null,
                max_cents: maxP !== "" ? parseInt(maxP, 10) * 100 : null,
                quartier: quartier || null,
              }} />
            )}
          </span>
        </div>

        {error && (
          <p style={{ color: "var(--danger)", fontWeight: 600, whiteSpace: "pre-line" }}>
            {error.split("\n")[0]}
            {error.includes("\n") && (
              <span style={{ display: "block", marginTop: 4, fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>
                Détail technique : {error.split("\n").slice(1).join(" ")}
              </span>
            )}
          </p>
        )}

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
            {/* Les portes vers les autres sections n'existent que si l'une
                d'elles est ouverte : pas de lien vers une page d'attente. */}
            {discoveries.length > 0 && (
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
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Le fil, du plus utile au plus ancien. Quand « À la une » est
             affichée au-dessus, les mises en avant en sont retirées ; sinon
             elles ouvrent le fil, bordure dorée et première place. */
          <>
            <div className="grid">
              {grille.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
            {/* La sentinelle : quand elle approche de l'écran, la page suivante
                arrive. Un bouton la double, pour qui préfère décider. */}
            <div ref={sentinelle} style={{ height: 1 }} />
            {!fin && (
              <p style={{ textAlign: "center", margin: "18px 0 0" }}>
                <button className="btn btn-outline-gold" style={{ color: "var(--gold-deep)" }}
                  disabled={chargementPlus} onClick={chargerPlus}>
                  {chargementPlus ? "Chargement…" : "Voir plus d’annonces"}
                </button>
              </p>
            )}
            {fin && grille.length >= PAGE && (
              <p style={{ textAlign: "center", margin: "18px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                Vous avez tout vu.
              </p>
            )}
          </>
        )}
        {tab === "home" && <div style={{ marginTop: 24 }}><InstallBanner /></div>}
      </main>

      <Link href="/deposer" className="btn btn-gold fab">+ Déposer</Link>

      <footer style={{ background: "var(--green)", color: "rgba(246,242,233,.72)", padding: "26px 0 30px", marginTop: "auto" }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Mark size={72} />
          <span className="overline">{SITE.name} · {SITE.overline}</span>
          <p style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>{SITE.description}</p>
          <span style={{ display: "flex", gap: "6px 14px", marginTop: 4, fontSize: 12.5, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/retours" style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>Une idée ?</Link>
            <Link href="/soutenir" style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>Soutenir ♥</Link>
            <Link href="/mentions-legales" style={{ color: "rgba(246,242,233,.6)", whiteSpace: "nowrap" }}>Mentions légales</Link>
            <Link href="/confidentialite" style={{ color: "rgba(246,242,233,.6)", whiteSpace: "nowrap" }}>Confidentialité</Link>
          </span>
          {/* Le rappel de la famille de sites n'a de sens qu'avec au moins
              deux sections ouvertes ; sinon, pas même le filet qui l'encadre. */}
          {SITE_ORDER.length > 1 && (
            <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(201,168,106,.25)", width: "100%", maxWidth: 460 }}>
              <SiteFamilyFooter />
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
