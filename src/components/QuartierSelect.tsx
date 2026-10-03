import { QUARTIERS } from "@/lib/quartiers";

/* Le quartier d'une annonce se choisit, il ne se tape plus : saisi
   librement, « Grand Fond » devenait « Grand Find » et le filtre par
   quartier ne le retrouvait plus. La liste est celle du filtre de
   l'accueil — ce qu'on saisit est donc toujours ce qu'on peut chercher.

   Une valeur déjà enregistrée hors liste (annonce ancienne) reste
   proposée, signalée, jusqu'à ce que l'auteur la corrige. */
export const TOUTE_L_ILE = "Saint-Barthélemy";

export default function QuartierSelect({ valeur, onChange, style }: {
  valeur: string; onChange: (v: string) => void; style?: React.CSSProperties;
}) {
  const connue = (QUARTIERS as readonly string[]).includes(valeur) || valeur === TOUTE_L_ILE;
  return (
    <select className="input" value={valeur} onChange={(e) => onChange(e.target.value)}
      aria-label="Quartier" style={style}>
      <option value="">Quartier…</option>
      {valeur && !connue && <option value={valeur}>{valeur} (à corriger)</option>}
      {QUARTIERS.map((q) => <option key={q} value={q}>{q}</option>)}
      <option value={TOUTE_L_ILE}>Toute l&apos;île</option>
    </select>
  );
}
