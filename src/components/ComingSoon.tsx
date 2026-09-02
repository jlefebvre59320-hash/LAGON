"use client";
import Link from "next/link";
import { SiteHeader, Mark } from "@/components/Brand";
import { SITES, SITE_ORDER, type SiteKey } from "@/lib/sites";

/* Page d'attente d'une section pas encore ouverte. Le contenu et le code de
   la section restent en place : seul l'indicateur `ready` de src/lib/sites.ts
   décide si l'on sert la vraie page ou celle-ci. Basculer l'indicateur suffit
   à ouvrir la section, sans rien réécrire. */
export default function ComingSoon({ site }: { site: SiteKey }) {
  const S = SITES[site];
  const ouverts = SITE_ORDER.filter((k) => SITES[k].ready && k !== site);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader site={site} />
      <main className="container" style={{ maxWidth: 520, paddingTop: 48, paddingBottom: 64, flex: 1 }}>
        <div className="panel gold-frame" style={{ padding: "36px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Mark size={84} color="var(--gold-deep)" />
          </div>
          <p className="overline" style={{ color: "var(--gold-deep)" }}>{S.overline}</p>
          <h1 style={{ fontSize: 28, margin: "4px 0 10px" }}>{S.name}</h1>

          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
            textTransform: "uppercase", background: "var(--green)", color: "var(--gold-light)",
            padding: "6px 16px", borderRadius: 99, marginBottom: 16 }}>
            Bientôt en ligne
          </span>

          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 22px" }}>
            {S.description}
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {ouverts.map((k) => (
              <Link key={k} href={SITES[k].path}
                className={k === "tikanal" ? "btn" : "btn btn-outline-gold"}
                style={k === "tikanal" ? undefined : { color: "var(--gold-deep)", borderColor: "var(--border-input)" }}>
                {SITES[k].name}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
