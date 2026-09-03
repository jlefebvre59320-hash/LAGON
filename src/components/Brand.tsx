"use client";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { usePathname } from "next/navigation";
import { SITES, siteFromPath, type SiteKey } from "@/lib/sites";
import SiteSwitcher from "@/components/SiteSwitcher";
import { connexionUrl } from "@/lib/urls";
import MessagesBadge, { useMessagesNonLus } from "@/components/MessagesBadge";

/* Contour de Saint-Barthélemy, tracé vectoriel du logo.
   Deux niveaux de détail : le tracé complet pour le logo, une version
   simplifiée dès que la marque descend sous ~56 px de large, où les découpes
   de côte se referment en pâté. */
const ISLAND_FULL =
  "M0.3 3.3 L0.8 3.8 L4.3 3.8 L5.5 6.3 L5.5 8.5 L0.5 10.5 L0.0 11.3 L4.3 12.0 L6.3 16.3 L10.3 17.3 L17.8 23.6 L23.3 23.1 L26.8 25.6 L27.6 26.8 L27.8 29.1 L28.8 30.3 L28.8 32.6 L28.1 33.3 L28.8 36.6 L32.8 39.6 L35.6 39.6 L37.6 43.1 L50.4 54.1 L51.1 53.9 L54.6 46.1 L57.6 46.1 L61.2 50.1 L61.9 50.1 L61.9 46.9 L64.9 46.4 L65.2 42.1 L68.7 39.3 L70.7 39.3 L72.2 41.6 L73.9 41.6 L74.7 43.1 L78.4 44.6 L81.2 41.4 L80.2 38.6 L80.2 35.1 L81.0 32.6 L93.2 23.6 L95.2 23.6 L97.2 26.3 L99.7 24.8 L98.2 19.8 L98.2 17.5 L100.0 14.0 L99.0 6.0 L98.2 6.3 L94.0 13.0 L92.0 13.0 L90.7 11.8 L90.5 6.5 L90.0 6.0 L87.2 6.8 L87.2 9.5 L86.7 10.0 L84.5 10.0 L83.2 9.0 L83.2 4.8 L79.9 6.5 L77.9 6.5 L77.7 4.5 L75.7 2.8 L72.9 4.0 L70.7 4.0 L68.4 0.8 L65.4 4.0 L65.9 9.0 L63.2 15.3 L58.6 17.0 L56.4 17.0 L55.9 15.0 L54.1 15.0 L49.1 20.3 L49.1 23.6 L44.9 24.1 L42.1 22.1 L42.4 18.8 L40.9 16.0 L37.6 16.5 L35.3 14.5 L35.1 9.5 L30.1 9.8 L26.8 4.3 L20.6 9.0 L17.0 9.3 L14.3 7.0 L13.0 8.3 L11.0 8.3 L7.8 5.3 L7.8 2.5 L5.5 0.0 Z";

const ISLAND_SIMPLE =
  "M0.3 3.3 L4.3 3.8 L5.5 8.5 L0.0 11.3 L4.3 12.1 L6.3 16.3 L17.8 23.6 L23.4 23.1 L26.9 25.6 L28.9 36.7 L35.7 39.7 L50.5 54.3 L54.8 46.2 L62.1 50.3 L62.1 47.0 L65.1 46.5 L65.3 42.2 L68.8 39.4 L78.6 44.7 L81.4 41.5 L81.2 32.7 L93.5 23.6 L97.5 26.4 L100.0 24.9 L99.2 6.0 L92.2 13.1 L90.2 6.0 L84.7 10.1 L83.4 4.8 L78.1 6.5 L75.9 2.8 L70.9 4.0 L68.6 0.8 L65.6 4.0 L63.3 15.3 L56.5 17.1 L54.3 15.1 L49.2 20.4 L49.2 23.6 L45.0 24.1 L42.2 22.1 L41.5 16.6 L35.4 14.6 L35.2 9.5 L30.2 9.8 L26.9 4.3 L17.1 9.3 L14.3 7.0 L11.1 8.3 L5.5 0.0 Z";

/* `size` = largeur du tracé ; la hauteur suit la forme de l'île (~54 %). */
export function Mark({
  size = 60,
  color = "var(--gold)",
  detail,
}: {
  size?: number;
  color?: string;
  detail?: "full" | "simple";
}) {
  const simple = (detail ?? (size < 44 ? "simple" : "full")) === "simple";
  return (
    <svg
      width={size}
      height={Math.round(size * 0.545)}
      viewBox="0 0 100 54.3"
      fill="none"
      aria-hidden="true"
      style={{ flex: "0 0 auto", display: "block", overflow: "visible" }}
    >
      <path
        d={simple ? ISLAND_SIMPLE : ISLAND_FULL}
        fill="none"
        stroke={color}
        strokeWidth={simple ? 4 : 2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Verrouillage typographique du logo : sur-titre ST BARTH, marque en sérif,
   baseline. `compact` = version une ligne pour les bandeaux mobiles. */
export function Brand({ compact = false, href, onClick, site = "tikanal" }: {
  compact?: boolean;
  href?: string;
  onClick?: () => void;
  site?: SiteKey;
}) {
  const SITE = SITES[site];
  return (
    <Link href={href ?? SITE.path} onClick={onClick} className="brand-lockup" aria-label={`${SITE.name} — accueil`}>
      <Mark size={compact ? 54 : 70} />
      <span style={{ minWidth: 0 }}>
        <span className="overline" style={{ display: "block", marginBottom: 2 }}>
          {SITE.overline}
        </span>
        <span className="wordmark" style={compact ? { fontSize: 21 } : undefined}>
          {SITE.name}
        </span>
        {!compact && (
          <span
            className="overline brand-baseline"
            style={{ marginTop: 4, fontSize: 8.5, letterSpacing: "0.24em" }}
          >
            {SITE.baseline}
          </span>
        )}
      </span>
    </Link>
  );
}

/* Accès au compte, en haut à droite de toutes les pages : « Se connecter »
   quand on ne l'est pas, « Mon espace » quand on l'est. Tant que la session
   n'est pas connue, on n'affiche rien plutôt que de faire clignoter le mauvais
   libellé. */
export function AccountButton() {
  const { userId, ready } = useSession();
  const pathname = usePathname();
  /* Le compteur s'abonne à la réplication : il est appelé à chaque rendu
     du bouton, donc avant le retour anticipé — un hook ne se saute pas. */
  const nonLus = useMessagesNonLus();
  if (!ready) return <span style={{ minWidth: 92, minHeight: 40 }} aria-hidden="true" />;

  // Depuis Food, l'espace s'ouvre aux couleurs de Food, sur ses restaurants.
  const espace = siteFromPath(pathname ?? "/") === "food" ? "/food/mon-espace" : "/mon-espace";

  return (
    <Link
      href={userId ? espace : connexionUrl(pathname ?? "/")}
      className="btn btn-outline-gold acct-btn"
      style={{ fontSize: 13, padding: "10px 16px", whiteSpace: "nowrap", position: "relative" }}
    >
      {userId ? "Mon espace" : "Connexion"}
      {userId && <MessagesBadge n={nonLus} />}
    </Link>
  );
}

/* Bandeau court des pages secondaires (fiche, dépôt, connexion). */
export function SiteHeader({ accent = "var(--gold)", site }: { accent?: string; site?: SiteKey }) {
  const pathname = usePathname();
  const currentSite = site ?? siteFromPath(pathname ?? "/");
  return (
    <header className="site-header">
      <div className="header-island" aria-hidden="true"><Mark size={300} detail="full" /></div>
      <div
        className="container"
        style={{ paddingTop: 12, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <Brand compact site={currentSite} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Le dépôt d'annonce n'a de sens que côté annonces */}
          {currentSite === "tikanal" && (
            <Link href="/deposer" className="btn btn-gold only-desktop" style={{ fontSize: 13.5 }}>
              + Déposer une annonce
            </Link>
          )}
          <SiteSwitcher />
          <AccountButton />
        </div>
      </div>
      <div className="header-accent" style={{ background: accent }} />
    </header>
  );
}
