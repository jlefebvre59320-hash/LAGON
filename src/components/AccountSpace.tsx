"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import ListingCard, { photoUrl } from "@/components/ListingCard";
import { SiteHeader, Mark } from "@/components/Brand";
import { FavoritesProvider, useFavorites } from "@/lib/favorites";
import type { Restaurant } from "@/lib/food";
import RestaurantCard from "@/components/food/RestaurantCard";

type Tab = "listings" | "favorites" | "resto_favs" | "restaurants";

type Stats = { listing_id: string; views: number; unique_viewers: number; favorites: number };

const STATUS_LABEL: Record<Listing["status"], string> = {
  active: "En ligne",
  sold: "Vendu",
  expired: "Expirée",
  removed: "Retirée",
};

/* Un seul compte pour toute la famille, mais un espace fidèle à la section
   d'où l'on vient : /mon-espace (Ti Kanal) et /food/mon-espace (St Barth
   Food) montent le même composant — seuls la marque, les couleurs et
   l'onglet d'arrivée changent. */
export default function AccountSpace({ site = "tikanal", defaultTab = "listings" }: {
  site?: "tikanal" | "food";
  defaultTab?: Tab;
}) {
  return (
    <FavoritesProvider>
      <MonEspace site={site} defaultTab={defaultTab} />
    </FavoritesProvider>
  );
}

function MonEspace({ site, defaultTab }: { site: "tikanal" | "food"; defaultTab: Tab }) {
  const router = useRouter();
  const { ids: favIds, ready: favReady, userId: favUserId } = useFavorites();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  const [tab, setTab] = useState<Tab>(defaultTab);
  const [mine, setMine] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [restos, setRestos] = useState<Restaurant[]>([]);
  const [restoFavs, setRestoFavs] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) { router.replace("/connexion"); return; }
      setUserId(data.session.user.id);
      setEmail(data.session.user.email ?? "");
      // is_admin() ne répond que pour l'appelant : personne ne peut lister les
      // administrateurs du site en interrogeant la table des profils.
      const { data: admin } = await supabase().rpc("is_admin");
      setIsAdmin(admin === true);
      // Fiches revendiquées sur St Barth Food : le compte est unique, l'espace
      // les montre quel que soit le site où on se connecte.
      const { data: owned } = await supabase()
        .from("restaurants").select("*").eq("owner_id", data.session.user.id).order("name");
      setRestos((owned as Restaurant[]) ?? []);
      // Favoris restaurants : liste séparée des favoris d'annonces.
      const { data: rf } = await supabase()
        .from("restaurant_favorites").select("restaurant_id").eq("user_id", data.session.user.id);
      const rfIds = ((rf ?? []) as { restaurant_id: string }[]).map((x) => x.restaurant_id);
      if (rfIds.length > 0) {
        const { data: rfRestos } = await supabase()
          .from("restaurants").select("*").in("id", rfIds).order("name");
        setRestoFavs((rfRestos as Restaurant[]) ?? []);
      }
      setChecked(true);
    })();
  }, [router]);

  const loadMine = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const sb = supabase();
    const [{ data: listings }, { data: rows }] = await Promise.all([
      sb.from("listings")
        .select("*, photos:listing_photos(storage_key, position)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      sb.rpc("my_listings_stats"),
    ]);
    setMine((listings as Listing[]) ?? []);
    const map: Record<string, Stats> = {};
    for (const r of (rows as Stats[]) ?? []) map[r.listing_id] = r;
    setStats(map);
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadMine(); }, [userId, loadMine]);

  // Les favoris se rechargent quand la liste d'identifiants change (retrait
  // depuis cette page comprise).
  useEffect(() => {
    if (!favReady || !favUserId) return;
    const list = Array.from(favIds);
    if (list.length === 0) { setFavorites([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase()
        .from("listings")
        .select("*, photos:listing_photos(storage_key, position)")
        .in("id", list)
        .order("created_at", { ascending: false });
      if (alive) setFavorites((data as Listing[]) ?? []);
    })();
    return () => { alive = false; };
  }, [favIds, favReady, favUserId]);

  async function setStatus(l: Listing, status: Listing["status"]) {
    setBusy(l.id);
    const { data, error } = await supabase().from("listings").update({ status }).eq("id", l.id).select("id");
    setBusy(null);
    if (error || !data || data.length === 0) {
      alert(error ? `Modification impossible : ${error.message}` : "La base a refusé la modification.");
      return;
    }
    loadMine();
  }

  async function remove(l: Listing) {
    if (!confirm(`Supprimer définitivement « ${l.title} » ? Cette action est irréversible.`)) return;
    setBusy(l.id);
    /* .select("id") : une suppression refusée par la RLS renvoie « succès,
       0 ligne » — sans vérification, l'annonce resterait là sans explication. */
    const { data, error } = await supabase().from("listings").delete().eq("id", l.id).select("id");
    setBusy(null);
    if (error || !data || data.length === 0) {
      alert(error ? `Suppression impossible : ${error.message}` : "La base a refusé la suppression de cette annonce.");
      return;
    }
    loadMine();
  }

  if (!checked) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const totalViews = mine.reduce((n, l) => n + (stats[l.id]?.views ?? 0), 0);
  const totalFavs = mine.reduce((n, l) => n + (stats[l.id]?.favorites ?? 0), 0);
  const online = mine.filter((l) => l.status === "active").length;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader site={site} />

      <main className="container" style={{ paddingTop: 24, paddingBottom: 56, flex: 1, maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Mon espace</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{email}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && (
              <Link href="/stats" className="btn" style={{ fontSize: 13, padding: "10px 16px" }}>
                Statistiques du site
              </Link>
            )}
            <Link href="/retours" className="btn btn-outline-gold"
              style={{ fontSize: 13, padding: "10px 16px", color: "var(--gold-deep)", borderColor: "var(--border-input)" }}>
              Donner un avis
            </Link>
            <button
              className="btn btn-outline-gold"
              style={{ fontSize: 13, padding: "10px 16px", color: "var(--gold-deep)", borderColor: "var(--border-input)" }}
              onClick={async () => { await supabase().auth.signOut(); router.replace(site === "food" ? "/food" : "/"); }}
            >
              Se déconnecter
            </button>
          </div>
        </div>

        {/* Trois chiffres, pas un graphique : à cette échelle, un total se lit
            plus vite qu'une courbe. Côté Food, ces compteurs d'annonces n'ont
            pas leur place. */}
        {site === "tikanal" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "18px 0 20px" }}>
          {[
            { k: "Annonces en ligne", v: online },
            { k: "Vues cumulées", v: totalViews },
            { k: "Mises en favori", v: totalFavs },
          ].map((t) => (
            <div key={t.k} className="panel" style={{ padding: "14px 16px" }}>
              <div className="price" style={{ fontSize: 26, lineHeight: 1.1 }}>{t.v}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t.k}</div>
            </div>
          ))}
        </div>
        )}

        <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "var(--cream-dark)", borderRadius: 20, padding: 4, marginBottom: 18, marginTop: site === "food" ? 18 : 0 }}>
          {([
            ["listings", `Mes annonces (${mine.length})`],
            ["favorites", `Favoris · annonces (${favIds.size})`],
            ["resto_favs", `Favoris · restos (${restoFavs.length})`],
            ...(restos.length > 0 ? [["restaurants", `Mes établissements (${restos.length})`]] as const : []),
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              style={{
                flex: "1 1 45%", minHeight: 42, borderRadius: 999, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
                background: tab === k ? "var(--green)" : "transparent",
                color: tab === k ? "var(--cream)" : "var(--text-muted)",
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "listings" && (
          loading ? (
            <p style={{ color: "var(--text-muted)" }}>Chargement…</p>
          ) : mine.length === 0 ? (
            <Empty
              titre="Vous n'avez pas encore déposé d'annonce."
              texte="Votre première annonce prend deux minutes."
              lien="/deposer"
              bouton="Déposer une annonce"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mine.map((l) => {
                const m = MODULES[l.module];
                const s = stats[l.id];
                const photo = l.photos?.slice().sort((a, b) => a.position - b.position)[0];
                const price = eur(l.price_cents);
                return (
                  <div key={l.id} className="panel" style={{ padding: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Link href={`/annonce/${l.id}`} style={{ flex: "0 0 auto" }}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl(photo.storage_key)} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 10 }} />
                      ) : (
                        <div style={{ width: 76, height: 76, borderRadius: 10, background: m.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Mark size={46} color={m.color} />
                        </div>
                      )}
                    </Link>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                          padding: "3px 9px", borderRadius: 999,
                          background: l.status === "active" ? m.soft : "var(--cream-dark)",
                          color: l.status === "active" ? m.dark : "var(--text-muted)",
                        }}>
                          {STATUS_LABEL[l.status]}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{l.subcategory}</span>
                      </div>

                      <Link href={`/annonce/${l.id}`} style={{ display: "block", fontWeight: 600, fontSize: 14.5, margin: "4px 0 2px", textDecoration: "none" }}>
                        {l.title}
                      </Link>
                      <div className="price" style={{ fontSize: 15, color: m.color }}>
                        {price == null ? "Prix à discuter" : price + priceSuffix(l.module, l.subcategory)}
                      </div>

                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                        <span><strong style={{ color: "var(--text)" }}>{s?.views ?? 0}</strong> vue{(s?.views ?? 0) > 1 ? "s" : ""}</span>
                        <span><strong style={{ color: "var(--text)" }}>{s?.unique_viewers ?? 0}</strong> visiteur{(s?.unique_viewers ?? 0) > 1 ? "s" : ""}</span>
                        <span><strong style={{ color: "var(--text)" }}>{s?.favorites ?? 0}</strong> favori{(s?.favorites ?? 0) > 1 ? "s" : ""}</span>
                      </div>

                      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                        {l.status === "active" ? (
                          <button className="link-quiet" disabled={busy === l.id} onClick={() => setStatus(l, "sold")}>
                            Marquer vendu
                          </button>
                        ) : (
                          <button className="link-quiet" disabled={busy === l.id} onClick={() => setStatus(l, "active")}>
                            Remettre en ligne
                          </button>
                        )}
                        <button className="link-quiet" disabled={busy === l.id} onClick={() => remove(l)} style={{ color: "var(--danger)" }}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "resto_favs" && (
          restoFavs.length === 0 ? (
            <Empty
              titre="Aucun restaurant en favori."
              texte="Appuyez sur le cœur d'une fiche St Barth Food pour la retrouver ici."
              lien="/food"
              bouton="Parcourir les restaurants"
            />
          ) : (
            /* Provider restaurant imbriqué : les cœurs de ces cartes doivent
               écrire dans les favoris de restaurants, pas d'annonces. */
            <FavoritesProvider kind="restaurant">
              <div className="grid" data-site="food">
                {restoFavs.map((res) => <RestaurantCard key={res.id} r={res} />)}
              </div>
            </FavoritesProvider>
          )
        )}

        {tab === "restaurants" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {restos.map((res) => (
              <div key={res.id} className="panel" style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 16, color: "var(--green)" }}>
                    {res.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {res.cuisine} · {res.quartier} · {res.status === "active" ? "En ligne" : "Masquée"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={`/food/resto/${res.id}`} className="link-quiet" style={{ textDecoration: "underline" }}>Voir</Link>
                  <Link href={`/food/resto/${res.id}/modifier`} className="btn" style={{ fontSize: 12.5, padding: "9px 14px", minHeight: 36 }}>
                    Modifier
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "favorites" && (
          favorites.length === 0 ? (
            <Empty
              titre="Aucun favori pour l'instant."
              texte="Appuyez sur le cœur d'une annonce pour la retrouver ici."
              lien="/"
              bouton="Parcourir les annonces"
            />
          ) : (
            <div className="grid">
              {favorites.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function Empty({ titre, texte, lien, bouton }: { titre: string; texte: string; lien: string; bouton: string }) {
  return (
    <div className="panel gold-frame" style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <Mark size={72} color="var(--gold-deep)" />
      </div>
      <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>{titre}</p>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 16px" }}>{texte}</p>
      <Link href={lien} className="btn">{bouton}</Link>
    </div>
  );
}
