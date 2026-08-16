import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ti Kanal — St Barth",
    short_name: "Ti Kanal",
    description: "Annonces, restaurants et sorties de Saint-Barthélemy.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2e9",
    theme_color: "#05282c",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      /* 512 requis pour la bannière d'installation Android (riche) */
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcuts: [
      { name: "St Barth Food", url: "/food" },
      { name: "Déposer une annonce", url: "/deposer" },
    ],
  };
}
