"use client";
import { useRouter } from "next/navigation";
import { useFavorites } from "@/lib/favorites";

function Heart({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z" />
    </svg>
  );
}

/* `variant="overlay"` : posé sur la photo d'une carte, donc dans un lien —
   d'où le preventDefault, sinon un appui sur le cœur ouvre l'annonce. */
export default function FavoriteButton({
  targetId,
  variant = "overlay",
  label = false,
}: {
  targetId: string;
  variant?: "overlay" | "plain";
  label?: boolean;
}) {
  const router = useRouter();
  const { ids, userId, toggle } = useFavorites();
  const on = ids.has(targetId);

  const overlay = variant === "overlay";

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!userId) { router.push("/connexion"); return; }
        toggle(targetId);
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        minHeight: overlay ? 36 : 44, minWidth: overlay ? 36 : undefined,
        padding: overlay ? 0 : "10px 18px",
        justifyContent: "center", cursor: "pointer", fontFamily: "inherit",
        fontSize: 14, fontWeight: 700,
        borderRadius: 999,
        border: overlay ? "none" : `1.5px solid ${on ? "var(--gold-deep)" : "var(--border-input)"}`,
        background: overlay ? "rgba(255,253,248,.92)" : on ? "var(--cream-dark)" : "var(--surface)",
        color: on ? "var(--gold-deep)" : overlay ? "#5f6f70" : "var(--text-muted)",
        boxShadow: overlay ? "0 1px 4px rgba(5,40,44,.12)" : "none",
      }}
    >
      <Heart filled={on} size={overlay ? 17 : 18} />
      {label && <span>{on ? "En favori" : "Ajouter aux favoris"}</span>}
    </button>
  );
}
