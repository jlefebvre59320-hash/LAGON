import Link from "next/link";
import { Mark } from "@/components/Brand";

export const metadata = { title: "Hors connexion — Ti Kanal" };

export default function HorsLigne() {
  return (
    <main className="container" style={{ minHeight: "100dvh", maxWidth: 520, display: "grid", placeItems: "center", paddingTop: 32, paddingBottom: 32 }}>
      <div className="panel gold-frame" style={{ padding: "30px 22px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Mark size={88} color="var(--gold-deep)" />
        </div>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Connexion indisponible</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
          Ti Kanal n’arrive pas à joindre Internet. Les pages déjà consultées restent accessibles ; réessayez dès que le réseau revient.
        </p>
        <Link href="/" className="btn">Réessayer</Link>
      </div>
    </main>
  );
}

