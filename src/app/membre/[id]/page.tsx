import type { Metadata } from "next";
import MembreClient from "./MembreClient";

/* Les fiches de membres ne sont pas indexées : elles n'apportent rien à
   quelqu'un qui cherche une annonce sur Google, et personne n'a demandé
   à voir son nom apparaître dans un moteur pour avoir vendu une table. */
export const metadata: Metadata = {
  title: "Profil du membre · Ti Kanal",
  robots: { index: false, follow: true },
};

export default function MembrePage() {
  return <MembreClient />;
}
