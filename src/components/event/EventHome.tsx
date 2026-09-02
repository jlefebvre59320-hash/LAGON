"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES, eventDay, type IslandEvent } from "@/lib/event";
import { AccountButton, Brand, Mark } from "@/components/Brand";
import SiteSwitcher, { SiteFamilyFooter } from "@/components/SiteSwitcher";
import ShareButton from "@/components/ShareButton";
import { recordView } from "@/lib/analytics";
import { SITES } from "@/lib/sites";
import { SITE_URL } from "@/lib/siteUrl";

const SITE = SITES.event;

export default function EventHome() {
  const [category, setCategory] = useState<string | null>(null);
  const [all, setAll] = useState<IslandEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { recordView("/event"); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* Les événements du jour restent affichés jusqu'au bout de la nuit :
         on remonte à minuit moins douze heures, pas à l'instant présent. */
      const depuis = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data, error } = await supabase()
        .from("events")
        .select("*")
        .eq("status", "approved")
        .gte("starts_at", depuis)
        .order("starts_at");
      if (cancelled) return;
      if (error) setError("Impossible de charger l'agenda. Réessayez.");
      else setAll((data as IslandEvent[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(
    () => all.filter((e) => !category || e.category === category),
    [all, category]
  );

  /* Groupés par jour : un agenda se lit comme un calendrier. */
  const parJour = useMemo(() => {
    const map = new Map<string, IslandEvent[]>();
    for (const e of shown) {
      const cle = eventDay(e.starts_at).cle;
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle)!.push(e);
    }
    return Array.from(map.values());
  }, [shown]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="header-island" aria-hidden="true"><Mark size={300} detail="full" /></div>
        <div className="container" style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Brand site="event" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <SiteSwitcher />
              <AccountButton />
            </div>
          </div>
          <p className="hero-tagline">Ce soir, <em>sur l&apos;île</em>.</p>
          <div style={{ height: 12 }} />
        </div>
        <div className="header-accent" />
      </header>

      <div className="container">
        <div className="filter-row wrap">
          <select
            className="input"
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value || null)}
            aria-label="Catégorie"
            style={{ width: "auto", minHeight: 40, padding: "8px 34px 8px 14px", borderRadius: 999, fontSize: 14, flex: "0 0 auto", fontWeight: 600 }}
          >
            <option value="">Toutes les catégories</option>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Link href="/event/proposer" className="btn btn-gold" style={{ fontSize: 13, padding: "10px 16px", flex: "0 0 auto" }}>
            + Proposer un événement
          </Link>
        </div>
      </div>

      <main className="container" style={{ paddingTop: 16, paddingBottom: 60, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h1 className="section-title">{category ?? "À venir"}</h1>
          {!loading && shown.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {shown.length} événement{shown.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel skeleton" style={{ height: 92, opacity: 0.6 }} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="panel gold-frame" style={{ textAlign: "center", padding: "44px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={64} color="var(--gold-deep)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>
              Rien à l&apos;agenda pour l&apos;instant.
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
              Vous organisez quelque chose sur l&apos;île ? C&apos;est gratuit.
            </p>
            <Link href="/event/proposer" className="btn">Proposer un événement</Link>
          </div>
        ) : (
          parJour.map((jour) => {
            const d = eventDay(jour[0].starts_at);
            return (
              <section key={d.cle} style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                  color: "var(--gold-deep)", margin: "0 0 10px" }}>
                  {d.semaine} {d.jour} {d.mois}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {jour.map((e) => <EventCard key={e.id} e={e} />)}
                </div>
              </section>
            );
          })
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 26, lineHeight: 1.5 }}>
          Les événements sont proposés par leurs organisateurs et relus avant parution.
          Billets et renseignements directement auprès de l&apos;organisateur — nous ne
          vendons rien.
        </p>
      </main>

      <footer style={{ background: "var(--green)", color: "rgba(247,243,238,.72)", padding: "26px 0 30px", marginTop: "auto" }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Mark size={72} />
          <span className="overline">{SITE.name} · {SITE.overline}</span>
          <p style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>{SITE.description}</p>
          <span style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12.5 }}>
            <Link href="/retours" style={{ color: "var(--gold)" }}>Une idée ?</Link>
            <Link href="/soutenir" style={{ color: "var(--gold)" }}>Soutenir ♥</Link>
            <Link href="/mentions-legales" style={{ color: "rgba(247,243,238,.6)" }}>Mentions légales</Link>
          </span>
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(224,133,95,.25)", width: "100%", maxWidth: 460 }}>
            <SiteFamilyFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}

function EventCard({ e }: { e: IslandEvent }) {
  const [open, setOpen] = useState(false);
  const d = eventDay(e.starts_at);
  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
      >
        <span style={{ flex: "0 0 auto", width: 52, textAlign: "center", background: "var(--green)",
          color: "var(--gold-light)", borderRadius: 10, padding: "7px 0" }}>
          <span style={{ display: "block", fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{d.jour}</span>
          <span style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em" }}>{d.mois}</span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}>{e.title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {d.heure}{e.venue ? ` · ${e.venue}` : ""}{e.quartier ? ` · ${e.quartier}` : ""}
          </span>
          <span style={{ display: "inline-flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              background: "var(--cream-dark)", color: "var(--gold-deep)", padding: "3px 9px", borderRadius: 99 }}>
              {e.category}
            </span>
            {e.price && (
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em",
                background: "var(--green)", color: "var(--gold-light)", padding: "3px 9px", borderRadius: 99 }}>
                {e.price}
              </span>
            )}
          </span>
        </span>
        <span aria-hidden="true" style={{ color: "var(--gold-deep)", fontSize: 13, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          ▶
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px 80px" }}>
          {e.description && (
            <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: "0 0 10px" }}>{e.description}</p>
          )}
          {e.organizer && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>Organisé par {e.organizer}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.link && (
              <a href={e.link} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 13, padding: "9px 16px" }}>
                Billets / infos ↗
              </a>
            )}
            <ShareButton
              title={e.title}
              text={`${e.title} — ${d.semaine} ${d.jour} ${d.mois}${e.venue ? ` à ${e.venue}` : ""} · sur St Barth Event`}
              url={`${SITE_URL}/event`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
