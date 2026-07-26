"use client";
import { useEffect, useRef, useState } from "react";
import { CURRENT_SITE_KEY, SITES, SITE_ORDER } from "@/lib/sites";

/* Bascule entre les sites de la famille St Barth. Un site pas encore en ligne
   (url null) s'affiche « bientôt » et n'est pas cliquable : mieux vaut une
   promesse assumée qu'un lien mort. */
export default function SiteSwitcher() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /* Le bouton est au milieu du bandeau : un panneau simplement accroché à sa
     droite sortirait de l'écran sur un téléphone. On le place donc par rapport
     à la fenêtre, en gardant 12 px de marge. */
  function place() {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(300, window.innerWidth - 24);
    // Aligné sur le bouton quand la place le permet, sinon ramené dans l'écran :
    // 12 px de marge de chaque côté, jamais de débordement.
    const anchored = window.innerWidth - r.right;
    const maxRight = window.innerWidth - width - 12;
    setPos({ top: r.bottom + 8, right: Math.max(12, Math.min(anchored, maxRight)) });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onScrollOrResize = () => place();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Changer de site"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          minHeight: 40, padding: "9px 12px", borderRadius: 999,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          background: "rgba(255,255,255,.08)",
          border: "1px solid color-mix(in srgb, var(--gold) 45%, transparent)",
          color: "var(--cream)",
        }}
      >
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 3 }}>
          {SITE_ORDER.map((k) => (
            <span key={k} style={{
              width: 6, height: 6, borderRadius: 999, background: SITES[k].dot,
              opacity: k === CURRENT_SITE_KEY ? 1 : 0.45,
            }} />
          ))}
        </span>
        <span className="only-desktop" style={{ whiteSpace: "nowrap" }}>Nos sites</span>
        <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.75 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "fixed", top: pos?.top ?? 64, right: pos?.right ?? 12, zIndex: 60,
            width: "min(300px, calc(100vw - 24px))",
            background: "var(--surface)", color: "var(--text)",
            border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "var(--shadow-lg)", overflow: "hidden",
          }}
        >
          <div style={{
            padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: ".14em",
            textTransform: "uppercase", color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
          }}>
            La famille St Barth
          </div>

          {SITE_ORDER.map((k) => {
            const s = SITES[k];
            const current = k === CURRENT_SITE_KEY;
            const soon = !s.url && !current;

            const row = (
              <>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: s.dot, flex: "0 0 auto", marginTop: 5 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: "block", fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 700, fontSize: 15.5, color: "var(--green)",
                  }}>
                    {s.name}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{s.baseline}</span>
                </span>
                {current && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold-deep)", marginTop: 4 }}>Vous êtes ici</span>}
                {soon && <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>bientôt</span>}
              </>
            );

            const base: React.CSSProperties = {
              display: "flex", gap: 10, alignItems: "flex-start",
              padding: "12px 14px", textDecoration: "none",
              borderTop: k === SITE_ORDER[0] ? "none" : "1px solid var(--border)",
              background: current ? "var(--cream)" : "transparent",
            };

            return s.url && !current ? (
              <a key={k} href={s.url} role="menuitem" style={base}>{row}</a>
            ) : (
              <div key={k} role="menuitem" aria-disabled={soon} style={{ ...base, opacity: soon ? 0.62 : 1 }}>
                {row}
              </div>
            );
          })}

          <div style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--text-muted)", background: "var(--cream)" }}>
            Un compte unique, valable sur les trois sites.
          </div>
        </div>
      )}
    </div>
  );
}

/* Rappel discret en pied de page : le sélecteur du bandeau ne se voit que si on
   le cherche. */
export function SiteFamilyFooter() {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", fontSize: 12 }}>
      {SITE_ORDER.map((k) => {
        const s = SITES[k];
        const current = k === CURRENT_SITE_KEY;
        const content = (
          <>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, display: "inline-block", marginRight: 6 }} />
            {s.name}
            {!s.url && !current ? " (bientôt)" : ""}
          </>
        );
        return s.url && !current ? (
          <a key={k} href={s.url} style={{ color: "rgba(246,242,233,.8)" }}>{content}</a>
        ) : (
          <span key={k} style={{ color: current ? "var(--gold)" : "rgba(246,242,233,.5)", fontWeight: current ? 700 : 400 }}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
