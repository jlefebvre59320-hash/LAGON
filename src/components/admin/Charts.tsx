"use client";
import { useId, useMemo, useRef, useState } from "react";

/* Graphiques du tableau de bord, en SVG écrit à la main.
 *
 * Pas de bibliothèque : celles qui font ça pèsent 150 à 400 Ko de
 * JavaScript pour un écran que seuls les administrateurs ouvrent, et
 * imposent leur propre palette qu'il faudrait ensuite combattre. Ici les
 * couleurs sont celles de la charte, lues dans les variables CSS, et le
 * rendu suit le thème sans une ligne de plus.
 *
 * Le tracé vit dans un viewBox fixe, étiré à la largeur disponible. Les
 * traits portent vector-effect="non-scaling-stroke" : sans lui, un même
 * graphique aurait des courbes fines sur grand écran et épaisses sur
 * mobile, l'étirement s'appliquant aussi à l'épaisseur.
 */

const L = 1000;   // largeur du viewBox
const H = 300;    // hauteur du viewBox
const MARGE_H = 8;
/* Les dates sont sorties du SVG : plus besoin de leur réserver une bande
   en bas, la courbe occupe toute la hauteur de la carte. */
const MARGE_B = 10;

export type Serie = { cle: string; label: string; couleur: string; valeurs: number[] };

export function LineChart({
  labels, labelsLongs, series, unite = "",
}: {
  labels: string[];
  labelsLongs: string[];
  series: Serie[];
  unite?: string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const [caches, setCaches] = useState<Set<string>>(new Set());

  const visibles = series.filter((s) => !caches.has(s.cle));
  const n = labels.length;

  const max = useMemo(() => {
    const valeurs = visibles.flatMap((s) => s.valeurs);
    return Math.max(1, ...valeurs);
  }, [visibles]);

  /* Une échelle qui s'arrête pile sur la valeur maximale colle la courbe au
     bord haut. On arrondit au cran supérieur, ce qui donne aussi des
     graduations lisibles plutôt que 37, 74, 111. */
  const plafond = useMemo(() => {
    const cran = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / cran) * cran || 1;
  }, [max]);

  const x = (i: number) => n <= 1 ? L / 2 : MARGE_H + (i * (L - 2 * MARGE_H)) / (n - 1);
  const y = (v: number) => (H - MARGE_B) - (v / plafond) * (H - MARGE_B - MARGE_H);

  function pointerVers(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setSurvol(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  }

  const vide = series.every((s) => s.valeurs.every((v) => v === 0));
  if (n === 0 || vide) return <EtatVide />;

  return (
    <div>
      <div className="chart-legend">
        {series.map((s) => {
          const actif = !caches.has(s.cle);
          return (
            <button
              key={s.cle}
              type="button"
              className="chart-legend-item"
              aria-pressed={actif}
              style={{ opacity: actif ? 1 : 0.4 }}
              onClick={() => setCaches((c) => {
                const suivant = new Set(c);
                // On ne masque jamais la dernière série visible : un graphique
                // sans aucune courbe n'apprend rien et déroute.
                if (suivant.has(s.cle)) suivant.delete(s.cle);
                else if (visibles.length > 1) suivant.add(s.cle);
                return suivant;
              })}
            >
              <i style={{ background: s.couleur }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="chart-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${L} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`Graphique : ${series.map((s) => s.label).join(", ")}`}
          onPointerMove={pointerVers}
          onPointerLeave={() => setSurvol(null)}
        >
          <defs>
            {visibles.map((s) => (
              <linearGradient key={s.cle} id={`${id}-${s.cle}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.couleur} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.couleur} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grille : trois traits, à peine visibles. Une grille qu'on
              remarque concurrence les courbes qu'elle est censée servir. */}
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={0} x2={L} y1={y(plafond * f)} y2={y(plafond * f)} className="chart-grid" />
          ))}

          {visibles.map((s) => (
            <g key={s.cle}>
              <path
                d={`${s.valeurs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${H - MARGE_B} L${x(0)},${H - MARGE_B} Z`}
                fill={`url(#${id}-${s.cle})`}
              />
              <path
                d={s.valeurs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")}
                fill="none" stroke={s.couleur} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="chart-line"
              />
            </g>
          ))}

          {survol != null && (
            <>
              <line x1={x(survol)} x2={x(survol)} y1={MARGE_H} y2={H - MARGE_B} className="chart-curseur" />
              {visibles.map((s) => (
                <circle key={s.cle} cx={x(survol)} cy={y(s.valeurs[survol] ?? 0)} r="5"
                  fill="var(--surface)" stroke={s.couleur} strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke" />
              ))}
            </>
          )}

        </svg>

        {/* Graduations et dates en HTML, pas en SVG : un texte tracé dans le
            viewBox rétrécit avec la carte, et devenait illisible dans les
            graphiques secondaires. En HTML il garde sa taille partout. */}
        <span className="chart-plafond">{plafond.toLocaleString("fr-FR")}</span>

        {survol != null && (
          <div
            className="chart-tooltip"
            style={{
              // L'infobulle bascule de côté au-delà du milieu, sinon elle
              // sort de l'écran sur les derniers points.
              left: `${(survol / Math.max(1, n - 1)) * 100}%`,
              transform: survol > n / 2 ? "translateX(-100%) translateX(-10px)" : "translateX(10px)",
            }}
          >
            <strong>{labelsLongs[survol]}</strong>
            {visibles.map((s) => (
              <span key={s.cle}>
                <i style={{ background: s.couleur }} />
                {s.label} : <b>{(s.valeurs[survol] ?? 0).toLocaleString("fr-FR")}{unite}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Deux repères seulement : les dates intermédiaires se lisent dans
          l'infobulle, les empiler ici serait illisible sur un téléphone. */}
      <div className="chart-dates">
        <span>{labels[0]}</span>
        <span>{labels[n - 1]}</span>
      </div>
    </div>
  );
}

/* Classement en barres horizontales : la bonne forme dès que les libellés
   sont des mots. En vertical ils se chevauchent ou basculent à 45°. */
export function BarList({
  items, couleur = "var(--green)", suffixe = "",
}: {
  items: { cle: string; label: string; valeur: number; detail?: string }[];
  couleur?: string;
  suffixe?: string;
}) {
  if (items.length === 0 || items.every((i) => i.valeur === 0)) return <EtatVide />;
  const max = Math.max(1, ...items.map((i) => i.valeur));
  return (
    <ul className="bar-list">
      {items.map((i) => (
        <li key={i.cle}>
          <span className="bar-list-haut">
            <span className="bar-list-label" title={i.label}>{i.label}</span>
            <span className="bar-list-valeur">
              {i.valeur.toLocaleString("fr-FR")}{suffixe}
              {i.detail && <small>{i.detail}</small>}
            </span>
          </span>
          <span className="bar-list-piste">
            <span className="bar-list-barre"
              style={{ width: `${Math.max(2, (i.valeur / max) * 100)}%`, background: couleur }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* Micro-courbe des cartes d'indicateurs : pas d'axe, pas de graduation,
   pas d'infobulle. Elle ne donne pas une valeur, elle donne une allure. */
export function Sparkline({ valeurs, couleur }: { valeurs: number[]; couleur: string }) {
  if (valeurs.length < 2 || valeurs.every((v) => v === 0)) return null;
  const max = Math.max(...valeurs);
  const min = Math.min(...valeurs);
  const etendue = max - min || 1;
  const pts = valeurs.map((v, i) => {
    const px = (i / (valeurs.length - 1)) * 100;
    const py = 26 - ((v - min) / etendue) * 22;
    return `${i === 0 ? "M" : "L"}${px},${py}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="sparkline" preserveAspectRatio="none" aria-hidden="true">
      <path d={pts} fill="none" stroke={couleur} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function EtatVide({ texte = "Pas encore assez de données", aide }: { texte?: string; aide?: string }) {
  return (
    <div className="chart-vide">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M3 20h18M6 20V12M11 20V8M16 20v-4M21 20V6" opacity=".45" />
      </svg>
      <p>{texte}</p>
      {aide && <small>{aide}</small>}
    </div>
  );
}
