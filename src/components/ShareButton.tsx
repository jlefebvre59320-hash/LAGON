"use client";

function ShareIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

/* Le partage natif (feuille système) quand il existe — c'est le cas sur
   quasiment tous les téléphones. À défaut (desktop), on ouvre WhatsApp
   directement : c'est LE canal de l'île, pas la peine de faire un menu. */
export default function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* partage annulé par l'utilisateur : rien à faire */
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Partager"
      title="Partager"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
        padding: "10px 18px", justifyContent: "center", cursor: "pointer",
        fontFamily: "inherit", fontSize: 14, fontWeight: 700, borderRadius: 999,
        border: "1.5px solid var(--border-input)", background: "var(--surface)",
        color: "var(--text-muted)",
      }}
    >
      <ShareIcon size={17} />
      <span>Partager</span>
    </button>
  );
}
