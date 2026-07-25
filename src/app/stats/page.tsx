"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_FILTER, type Intent, type ModuleKey } from "@/lib/taxonomy";
import { SiteHeader } from "@/components/Brand";

type Daily = { day: string; visits: number };
type Top = { id: string; title: string; module: ModuleKey; views: number };

type SiteStats = {
  listings_total: number; listings_active: number; listings_30d: number; listings_7d: number;
  users_total: number; users_30d: number;
  views_total: number; views_7d: number;
  visits_7d: number; visitors_7d: number;
  favorites_total: number;
  by_module: Partial<Record<ModuleKey, number>>;
  by_intent: Partial<Record<Intent, number>>;
  daily: Daily[];
  top_listings: Top[];
};

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export default function Stats() {
  const router = useRouter();
  const [s, setS] = useState<SiteStats | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase().auth.getSession();
      if (!session.session) { router.replace("/connexion"); return; }
      const { data, error } = await supabase().rpc("site_stats");
      if (error || !data) setDenied(true);
      else setS(data as SiteStats);
    })();
  }, [router]);

  if (denied) return (
    <>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 56 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>Réservé à l&apos;administration</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Ce tableau de bord n&apos;est visible que par les comptes administrateurs.
          </p>
          <Link href="/mon-espace" className="btn" style={{ marginTop: 8 }}>Retour à mon espace</Link>
        </div>
      </main>
    </>
  );

  if (!s) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const maxVisits = Math.max(1, ...s.daily.map((d) => d.visits));
  const maxModule = Math.max(1, ...MODULE_ORDER.map((k) => s.by_module[k] ?? 0));

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ paddingTop: 24, paddingBottom: 56, flex: 1, maxWidth: 940 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Statistiques du site</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
          Fréquentation mesurée sur le site lui-même, visiteurs non connectés compris.
        </p>

        <Section titre="Vue d'ensemble">
          <Tiles items={[
            { k: "Annonces en ligne", v: s.listings_active, sub: `${s.listings_total} au total` },
            { k: "Déposées sur 30 j", v: s.listings_30d, sub: `${s.listings_7d} sur 7 j` },
            { k: "Comptes", v: s.users_total, sub: `${s.users_30d} sur 30 j` },
            { k: "Vues d'annonces", v: s.views_total, sub: `${s.views_7d} sur 7 j` },
            { k: "Visiteurs (7 j)", v: s.visitors_7d, sub: `${s.visits_7d} pages vues` },
            { k: "Mises en favori", v: s.favorites_total, sub: "toutes annonces" },
          ]} />
        </Section>

        <Section titre="Fréquentation des 14 derniers jours" sousTitre="Pages vues par jour, toutes pages confondues">
          <div className="panel" style={{ padding: "18px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 132 }}>
              {s.daily.map((d) => {
                const h = Math.round((d.visits / maxVisits) * 100);
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
                    title={`${jour(d.day)} · ${d.visits} page${d.visits > 1 ? "s" : ""} vue${d.visits > 1 ? "s" : ""}`}>
                    {d.visits === maxVisits && d.visits > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 4 }}>
                        {d.visits}
                      </span>
                    )}
                    {/* Un jour sans visite garde un trait : sinon un zéro se lit
                        comme une donnée manquante. */}
                    <div style={{
                      height: `${Math.max(h, 2)}%`, minHeight: 3,
                      background: d.visits === 0 ? "var(--cream-dark)" : "var(--green)",
                      borderRadius: "4px 4px 0 0",
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2, fontSize: 11.5, color: "var(--text-muted)" }}>
              <span>{s.daily.length > 0 ? jour(s.daily[0].day) : ""}</span>
              <span>{s.daily.length > 0 ? jour(s.daily[s.daily.length - 1].day) : ""}</span>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}>Voir les chiffres</summary>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 0", color: "var(--text-muted)", fontWeight: 600 }}>Jour</th>
                    <th style={{ textAlign: "right", padding: "6px 0", color: "var(--text-muted)", fontWeight: 600 }}>Pages vues</th>
                  </tr>
                </thead>
                <tbody>
                  {s.daily.map((d) => (
                    <tr key={d.day} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 0" }}>{jour(d.day)}</td>
                      <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 600 }}>{d.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </Section>

        <Section titre="Annonces en ligne par univers">
          <div className="panel" style={{ padding: "16px" }}>
            {MODULE_ORDER.map((k) => {
              const n = s.by_module[k] ?? 0;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
                  <span style={{ flex: "0 0 42%", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {MODULES[k].label}
                  </span>
                  <span style={{ flex: 1, height: 10, background: "var(--cream-dark)", borderRadius: 999, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.round((n / maxModule) * 100)}%`, height: "100%", background: "var(--green)", borderRadius: 999 }} />
                  </span>
                  <strong style={{ flex: "0 0 auto", fontSize: 13, minWidth: 28, textAlign: "right" }}>{n}</strong>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", gap: 18, fontSize: 13, color: "var(--text-muted)" }}>
              {(["offer", "wanted"] as Intent[]).map((i) => (
                <span key={i}>
                  {INTENT_FILTER[i]} : <strong style={{ color: "var(--text)" }}>{s.by_intent[i] ?? 0}</strong>
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section titre="Annonces les plus consultées">
          <div className="panel" style={{ padding: "6px 16px 10px" }}>
            {s.top_listings.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Pas encore de consultation enregistrée.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <tbody>
                  {s.top_listings.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 0" }}>
                        <Link href={`/annonce/${t.id}`} style={{ fontWeight: 600 }}>{t.title}</Link>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{MODULES[t.module]?.label}</div>
                      </td>
                      <td style={{ padding: "9px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                        <strong>{t.views}</strong>{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>vue{t.views > 1 ? "s" : ""}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Section>

        <p style={{ marginTop: 24 }}>
          <Link href="/mon-espace" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour à mon espace</Link>
        </p>
      </main>
    </div>
  );
}

function Section({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>{titre}</h2>
      {sousTitre && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>{sousTitre}</p>}
      {!sousTitre && <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

function Tiles({ items }: { items: { k: string; v: number; sub: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map((t) => (
        <div key={t.k} className="panel" style={{ padding: "14px 16px" }}>
          <div className="price" style={{ fontSize: 26, lineHeight: 1.1 }}>{t.v.toLocaleString("fr-FR")}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{t.k}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
