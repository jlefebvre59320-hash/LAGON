import { Suspense } from "react";
import type { Metadata } from "next";
import MessagesClient from "./MessagesClient";

export const metadata: Metadata = {
  title: "Mes messages · Ti Kanal",
  description: "Vos conversations avec les auteurs d'annonces sur Ti Kanal.",
  robots: { index: false, follow: false },
};

export default function MessagesPage() {
  /* useSearchParams impose une frontière Suspense côté serveur : sans elle
     le build échoue au prérendu de la page. */
  return (
    <Suspense fallback={null}>
      <MessagesClient />
    </Suspense>
  );
}
