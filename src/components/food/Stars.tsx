"use client";
import { useState } from "react";

function Star({ fill, size }: { fill: number; size: number }) {
  // fill : 0 à 1 — l'étoile se remplit partiellement pour les moyennes (4,3…)
  const id = `sg${Math.round(fill * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="currentColor" />
          <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"
      />
    </svg>
  );
}

/* Affichage d'une moyenne : cinq étoiles, remplissage au dixième. */
export function StarRow({ value, size = 15, color = "var(--gold-deep)" }: {
  value: number; size?: number; color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color }} role="img"
      aria-label={`Note : ${value.toLocaleString("fr-FR")} sur 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={Math.max(0, Math.min(1, value - i))} />
      ))}
    </span>
  );
}

/* Saisie d'une note : cinq boutons-étoiles, survol prévisualisé. */
export function StarInput({ value, onRate, disabled }: {
  value: number | null;
  onRate: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <span style={{ display: "inline-flex", gap: 2 }} role="radiogroup" aria-label="Votre note sur 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          disabled={disabled}
          onClick={() => onRate(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          style={{
            background: "none", border: "none", padding: 4, cursor: disabled ? "default" : "pointer",
            color: n <= shown ? "var(--gold-deep)" : "var(--border-input)",
            minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Star size={26} fill={n <= shown ? 1 : 0} />
        </button>
      ))}
    </span>
  );
}
