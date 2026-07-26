import type { Metadata, Viewport } from "next";
import { SITES } from "@/lib/sites";

const S = SITES.food;
const TITLE = `${S.name} · ${S.baseline} — ${S.overline}`;

export const metadata: Metadata = {
  title: TITLE,
  description: S.description,
  openGraph: { title: TITLE, description: S.description, locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: S.themeColor,
};

/* data-site pose les couleurs de la section (globals.css) sur tout /food. */
export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-site="food" style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
