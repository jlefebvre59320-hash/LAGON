import Link from "next/link";
import { Mark } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="container" style={{ maxWidth: 520, paddingTop: 64, paddingBottom: 64, textAlign: "center" }}>
      <div className="panel gold-frame" style={{ padding: "40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Mark size={84} color="var(--gold-deep)" />
        </div>
        <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Cette page n&apos;existe pas</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          Le lien est peut-être ancien, ou l&apos;adresse a changé.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn">Les annonces</Link>
          <Link href="/food" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)", borderColor: "var(--border-input)" }}>
            Les restaurants
          </Link>
        </div>
      </div>
    </main>
  );
}
