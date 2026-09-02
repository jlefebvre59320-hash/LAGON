"use client";

import { useEffect, useState } from "react";

const OPT_OUT_KEY = "tk_analytics_optout";

export default function AudienceOptOut() {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    try { setDisabled(localStorage.getItem(OPT_OUT_KEY) === "1"); } catch { /* stockage indisponible */ }
  }, []);

  function update(next: boolean) {
    try {
      if (next) {
        localStorage.setItem(OPT_OUT_KEY, "1");
        localStorage.removeItem("tk_viewer");
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("tk_seen:")) sessionStorage.removeItem(key);
        }
      } else {
        localStorage.removeItem(OPT_OUT_KEY);
      }
      setDisabled(next);
    } catch { /* le navigateur bloque déjà tout stockage */ }
  }

  return (
    <div className="panel" style={{ padding: "12px 14px", marginTop: 10, display: "flex", gap: 12,
      alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13.5 }}>
        Mesure d’audience : <strong>{disabled ? "désactivée" : "activée"}</strong>
      </span>
      <button type="button" className="btn btn-outline-gold" onClick={() => update(!disabled)}
        style={{ minHeight: 40, color: "var(--gold-deep)" }}>
        {disabled ? "Réactiver" : "Désactiver"}
      </button>
    </div>
  );
}

