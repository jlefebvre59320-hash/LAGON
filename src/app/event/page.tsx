"use client";
import Link from "next/link";
import { SiteHeader, Mark } from "@/components/Brand";

/* Page d'attente : la section existe, l'agenda arrive. Mieux qu'une entrée
   grisée — on peut la visiter, comprendre ce qui vient, et repartir. */
export default function EventPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader site="event" />
      <main className="container" style={{ maxWidth: 520, paddingTop: 48, paddingBottom: 64, flex: 1 }}>
        <div className="panel gold-frame" style={{ padding: "36px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Mark size={84} color="var(--gold-deep)" />
          </div>
          <p className="overline" style={{ color: "var(--gold-deep)" }}>St Barth</p>
          <h1 style={{ fontSize: 28, margin: "4px 0 8px" }}>St Barth Event</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            L&apos;agenda des sorties de l&apos;île — soirées, concerts, régates, marchés —
            ouvre prochainement.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" className="btn">Ti Kanal — les annonces</Link>
            <Link href="/food" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)", borderColor: "var(--border-input)" }}>
              St Barth Food
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
