"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader, Mark } from "@/components/Brand";
import { DON } from "@/lib/don";
import { recordView } from "@/lib/analytics";

/* Page volontairement sobre : on explique, on remercie, on n'insiste pas.
   Chaque moyen de don n'apparaît que s'il est renseigné dans lib/don.ts. */
export default function SoutenirPage() {
  useEffect(() => { recordView("/soutenir"); }, []);
  const any = DON.wero || DON.paypal || DON.iban;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ maxWidth: 560, paddingTop: 28, paddingBottom: 60, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Mark size={64} color="var(--gold-deep)" />
        </div>
        <h1 className="section-title" style={{ textAlign: "center" }}>Soutenir le projet</h1>
        <div style={{ height: 10 }} />
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)" }}>
          Ti Kanal est gratuit, sans publicité
          et sans commission : le site vit sur son temps libre et ses frais
          d&apos;hébergement. Si le projet vous rend service et que vous voulez
          l&apos;aider à durer, un petit coup de pouce fait toute la différence.
          Merci — et si vous ne pouvez pas donner, en parler autour de vous
          aide tout autant.
        </p>

        {!any && (
          <div className="panel gold-frame" style={{ padding: "18px 16px", marginTop: 18, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
              Les moyens de don arrivent bientôt. En attendant, le meilleur
              soutien reste de faire connaître le site.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          {DON.wero && <MoyenCopie titre="Wero — virement instantané" valeur={DON.wero}
            detail="Dans votre appli bancaire : envoyez par Wero à ce numéro. Instantané, sans frais." />}
          {DON.paypal && (
            <a href={DON.paypal} target="_blank" rel="noopener noreferrer" className="panel"
              style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none" }}>
              <span>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>PayPal</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Carte bancaire acceptée, compte PayPal facultatif.
                </span>
              </span>
              <span className="btn" style={{ fontSize: 13, padding: "9px 16px", flex: "0 0 auto" }}>Ouvrir ↗</span>
            </a>
          )}
          {DON.iban && <MoyenCopie titre="Virement classique (IBAN)" valeur={DON.iban}
            detail="Pour les habitués du virement — libellé « soutien » apprécié." />}
        </div>

        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 22, lineHeight: 1.55 }}>
          Les dons sont libres et sans contrepartie : ils financent l&apos;hébergement,
          le nom de domaine et le développement du site. Pas de reçu fiscal.
        </p>

        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour au site</Link>
        </p>
      </main>
    </div>
  );
}

function MoyenCopie({ titre, valeur, detail }: { titre: string; valeur: string; detail: string }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* navigateur sans presse-papiers : la valeur reste lisible et sélectionnable */
    }
  }
  return (
    <div className="panel" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{titre}</span>
          <span style={{ display: "block", fontSize: 13.5, marginTop: 2, userSelect: "all", fontVariantNumeric: "tabular-nums" }}>
            {valeur}
          </span>
        </span>
        <button onClick={copier} className="btn" style={{ fontSize: 13, padding: "9px 16px", flex: "0 0 auto" }}>
          {copie ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{detail}</p>
    </div>
  );
}
