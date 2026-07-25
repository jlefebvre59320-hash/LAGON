import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ti Kanal · Échanges & petites annonces — St Barth",
  description:
    "Ti Kanal, les échanges et petites annonces de Saint-Barthélemy : véhicules et nautisme, immobilier, emploi saisonnier, achats et ventes entre particuliers.",
  applicationName: "Ti Kanal",
  openGraph: {
    title: "Ti Kanal · Échanges & petites annonces — St Barth",
    description:
      "Les échanges et petites annonces de Saint-Barthélemy : véhicules et nautisme, immobilier, emploi, achats et ventes.",
    locale: "fr_FR",
    type: "website",
  },
  appleWebApp: { capable: true, title: "Ti Kanal", statusBarStyle: "black-translucent" },
};

/* Mobile : largeur réelle de l'appareil, zoom utilisateur conservé
   (jamais de maximum-scale=1, qui casse l'accessibilité), et teinte
   de la barre système alignée sur le vert de la charte. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05282c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
