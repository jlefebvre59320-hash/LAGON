import type { Metadata, Viewport } from "next";
import { SITES } from "@/lib/sites";
import { SITE_URL } from "@/lib/siteUrl";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import MobileDock from "@/components/MobileDock";
import "./globals.css";

const S = SITES.tikanal;
const TITLE = `${S.name} · ${S.baseline} — ${S.overline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: S.description,
  applicationName: S.name,
  openGraph: { title: TITLE, description: S.description, locale: "fr_FR", type: "website" },
  appleWebApp: { capable: true, title: S.name, statusBarStyle: "black-translucent" },
};

/* Mobile : largeur réelle de l'appareil, zoom utilisateur conservé, barre
   système aux couleurs de Ti Kanal — les sections /food et /event posent la
   leur dans leur propre layout. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: S.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <MobileDock />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
