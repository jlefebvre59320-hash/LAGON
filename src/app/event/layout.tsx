import type { Metadata, Viewport } from "next";
import { SITES } from "@/lib/sites";

const S = SITES.event;
const TITLE = `${S.name} · ${S.baseline} — ${S.overline}`;

export const metadata: Metadata = {
  title: TITLE,
  description: S.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: S.themeColor,
};

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-site="event" style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
