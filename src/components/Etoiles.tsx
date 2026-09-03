"use client";
import { useId, useState } from "react";

/* Cinq étoiles, en lecture ou en saisie.
 *
 * En lecture, la moyenne se rend au demi-point : 4,3 donne quatre étoiles
 * pleines et une à moitié, 4,6 en donne cinq pleines — c'est l'arrondi
 * que l'œil fait de lui-même, et le chiffre exact est écrit à côté.
 *
 * En saisie, le survol prévisualise la note avant le clic, et le clavier
 * suffit : ce sont de vrais boutons radio pour un lecteur d'écran. */

function Etoile({ remplissage, taille }: { remplissage: 0 | 0.5 | 1; taille: number }) {
  /* useId plutôt qu'un tirage : un identifiant qui change à chaque rendu
     casserait la référence url(#…) du dégradé de la demi-étoile. */
  const id = useId();
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true">
      {remplissage === 0.5 && (
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2.6l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"
        fill={remplissage === 1 ? "currentColor" : remplissage === 0.5 ? `url(#${id})` : "none"}
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  );
}

export function EtoilesLecture({
  note, taille = 15, className,
}: { note: number | null | undefined; taille?: number; className?: string }) {
  const n = note ?? 0;
  const arrondie = Math.round(n * 2) / 2;
  return (
    <span className={`etoiles${className ? ` ${className}` : ""}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Etoile key={i} taille={taille}
          remplissage={arrondie >= i ? 1 : arrondie >= i - 0.5 ? 0.5 : 0} />
      ))}
    </span>
  );
}

const LIBELLES = ["", "Très déçu", "Déçu", "Correct", "Bien", "Excellent"];

export function EtoilesSaisie({
  valeur, onChange, taille = 32,
}: { valeur: number; onChange: (n: number) => void; taille?: number }) {
  const [survol, setSurvol] = useState(0);
  const affichee = survol || valeur;
  return (
    <div className="etoiles-saisie">
      <div role="radiogroup" aria-label="Votre note" style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valeur === i}
            aria-label={`${i} étoile${i > 1 ? "s" : ""} — ${LIBELLES[i]}`}
            className={`etoile-btn${affichee >= i ? " pleine" : ""}`}
            onMouseEnter={() => setSurvol(i)}
            onMouseLeave={() => setSurvol(0)}
            onFocus={() => setSurvol(i)}
            onBlur={() => setSurvol(0)}
            onClick={() => onChange(i)}
          >
            <Etoile taille={taille} remplissage={affichee >= i ? 1 : 0} />
          </button>
        ))}
      </div>
      {/* Le mot sous les étoiles évite le « 3 étoiles, c'est bien ou pas ? »
          — chacun a son échelle, le libellé fixe celle du site. */}
      <span className="etoiles-libelle">{affichee ? LIBELLES[affichee] : "Choisissez une note"}</span>
    </div>
  );
}
