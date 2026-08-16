import type { Metadata, Viewport } from "next";
import { SITES } from "@/lib/sites";

const S = SITES.guide;
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

/* data-site pose les couleurs bleu clair de la section sur tout /guide. */
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-site="guide" style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
