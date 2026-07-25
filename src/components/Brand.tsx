import Link from "next/link";

/* Marque « feuille de lagon » du logo, redessinée en SVG :
   deux arcs extérieurs en amande + deux arcs intérieurs, filet or.
   Vectoriel = net sur tous les écrans, et la couleur suit le contexte. */
export function Mark({ size = 34, color = "var(--gold)" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      fill="none"
      aria-hidden="true"
      style={{ flex: "0 0 auto", display: "block" }}
    >
      <g stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M50 10 C 12 44 12 84 50 116" />
        <path d="M50 10 C 88 44 88 84 50 116" />
        <path d="M41 8 C 30 44 34 86 50 116" />
        <path d="M59 8 C 70 44 66 86 50 116" />
      </g>
    </svg>
  );
}

/* Verrouillage typographique du logo : sur-titre ST BARTH, marque en sérif,
   baseline. `compact` = version une ligne pour les bandeaux mobiles. */
export function Brand({ compact = false, href = "/", onClick }: {
  compact?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="brand-lockup" aria-label="Ti Kanal — accueil">
      <Mark size={compact ? 24 : 30} />
      <span style={{ minWidth: 0 }}>
        <span className="overline" style={{ display: "block", marginBottom: 2 }}>
          St Barth
        </span>
        <span className="wordmark" style={compact ? { fontSize: 21 } : undefined}>
          Ti Kanal
        </span>
        {!compact && (
          <span
            className="overline"
            style={{ display: "block", marginTop: 4, fontSize: 8.5, letterSpacing: "0.24em" }}
          >
            Échanges &amp; petites annonces
          </span>
        )}
      </span>
    </Link>
  );
}

/* Bandeau court des pages secondaires (fiche, dépôt, connexion). */
export function SiteHeader({ accent = "var(--gold)" }: { accent?: string }) {
  return (
    <header className="site-header">
      <div
        className="container"
        style={{ paddingTop: 12, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <Brand compact />
        <Link href="/deposer" className="btn btn-gold only-desktop" style={{ fontSize: 13.5 }}>
          + Déposer une annonce
        </Link>
      </div>
      <div className="header-accent" style={{ background: accent }} />
    </header>
  );
}
