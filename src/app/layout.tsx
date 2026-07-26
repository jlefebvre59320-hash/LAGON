import type { Metadata, Viewport } from "next";
import { CURRENT_SITE_KEY, SITE } from "@/lib/sites";
import "./globals.css";

const TITLE = `${SITE.name} · ${SITE.baseline} — ${SITE.overline}`;

export const metadata: Metadata = {
  title: TITLE,
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    title: TITLE,
    description: SITE.description,
    locale: "fr_FR",
    type: "website",
  },
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black-translucent" },
};

/* Mobile : largeur réelle de l'appareil, zoom utilisateur conservé
   (jamais de maximum-scale=1, qui casse l'accessibilité), et teinte
   de la barre système alignée sur le vert de la charte. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: SITE.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* data-site sélectionne le jeu de couleurs du site (globals.css). */
    <html lang="fr" data-site={CURRENT_SITE_KEY}>
      <body>{children}</body>
    </html>
  );
}
