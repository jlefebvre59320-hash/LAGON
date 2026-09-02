import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Modifier une annonce",
  robots: { index: false, follow: false },
};

export default function ModifierAnnonceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
