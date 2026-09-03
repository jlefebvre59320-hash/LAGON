import { AVERTISSEMENT_PAIEMENT } from "@/lib/moderation";

/* Le rappel qui ne coûte rien et évite le pire : Ti Kanal ne touche pas à
   l'argent. Le même encart sur la fiche et dans la messagerie, pour qu'on
   le reconnaisse sans le relire. */
export default function AvertissementPaiement({ compact = false, style }: { compact?: boolean; style?: React.CSSProperties }) {
  return (
    <p className={`avert-paiement${compact ? " compact" : ""}`} role="note" style={style}>
      <span aria-hidden="true">⚠️</span>
      <span>
        <strong>Ti Kanal ne gère pas les paiements.</strong>{" "}
        {compact
          ? "Aucun acompte, aucun paiement à distance : remise en main propre."
          : AVERTISSEMENT_PAIEMENT.replace(/^Ti Kanal ne gère pas les paiements entre acheteurs et vendeurs\.\s*/, "")}
      </span>
    </p>
  );
}
