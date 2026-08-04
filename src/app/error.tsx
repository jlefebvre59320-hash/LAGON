"use client";
import { Mark } from "@/components/Brand";

/* Filet de sécurité global : si un écran plante, l'utilisateur voit la
   maison, pas une stack trace. reset() retente le rendu. */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Erreur d'écran :", error);
  return (
    <main className="container" style={{ maxWidth: 520, paddingTop: 64, paddingBottom: 64, textAlign: "center" }}>
      <div className="panel gold-frame" style={{ padding: "40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Mark size={84} color="var(--gold-deep)" />
        </div>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Un pépin de notre côté</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          L&apos;écran n&apos;a pas pu s&apos;afficher. Réessayez — si ça persiste, revenez un peu plus tard.
        </p>
        <button className="btn" onClick={reset}>Réessayer</button>
      </div>
    </main>
  );
}
