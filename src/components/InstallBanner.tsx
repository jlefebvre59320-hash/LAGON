"use client";
import { useEffect, useState } from "react";
import { Mark } from "@/components/Brand";

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* « Ajouter l'appli à l'écran d'accueil » — deux mondes très différents :
   - Android/Chrome envoie beforeinstallprompt : on peut déclencher la vraie
     installation native d'un appui.
   - iPhone : Apple n'offre aucune API. On ne peut qu'expliquer le geste
     (Partager → Sur l'écran d'accueil).
   La bannière ne s'affiche jamais si l'appli est déjà installée, et un
   refus est mémorisé : on ne harcèle pas. */
export default function InstallBanner() {
  const [bip, setBip] = useState<BipEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem("tk-install-ferme")) return;

    /* Une proposition d'installation avant même d'avoir découvert le service
       coupe le parcours. Elle apparaît à partir de la deuxième visite. */
    const visits = Number.parseInt(localStorage.getItem("tk-visites") ?? "0", 10) + 1;
    localStorage.setItem("tk-visites", String(Math.min(visits, 20)));
    const canSuggest = visits >= 2;

    if (canSuggest && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      setVisible(true);
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BipEvent);
      if (canSuggest) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  async function installer() {
    if (bip) {
      await bip.prompt();
      const { outcome } = await bip.userChoice;
      if (outcome === "accepted") setVisible(false);
      return;
    }
    setIosHelp(!iosHelp);
  }

  function fermer() {
    localStorage.setItem("tk-install-ferme", "1");
    setVisible(false);
  }

  return (
    <div className="panel gold-frame" style={{ padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark size={34} color="var(--gold-deep)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--green)" }}>
            L&apos;appli sur votre écran d&apos;accueil
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            Gratuit, sans passer par un store.
          </p>
        </div>
        <button className="btn" onClick={installer} style={{ fontSize: 13, padding: "9px 16px", flex: "0 0 auto" }}>
          {ios && !bip ? (iosHelp ? "Masquer" : "Comment ?") : "Installer"}
        </button>
        <button
          onClick={fermer}
          aria-label="Ne plus proposer"
          title="Ne plus proposer"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
            fontSize: 17, lineHeight: 1, padding: 6, flex: "0 0 auto" }}
        >
          ×
        </button>
      </div>

      {iosHelp && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)",
          fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
          Dans Safari : appuyez sur <strong>Partager</strong>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            style={{ display: "inline", verticalAlign: "-2px", margin: "0 3px" }}>
            <path d="M12 3 v12 M8 7 l4 -4 4 4 M5 11 v9 h14 v-9" />
          </svg>
          (en bas de l&apos;écran), faites défiler, puis choisissez
          {" "}<strong>« Sur l&apos;écran d&apos;accueil »</strong>.
        </div>
      )}
    </div>
  );
}
