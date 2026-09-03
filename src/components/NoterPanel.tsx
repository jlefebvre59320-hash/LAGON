"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { EtoilesSaisie } from "@/components/Etoiles";
import { COMMENTAIRE_MAX } from "@/lib/membre";
import { messageErreur } from "@/lib/messages";

/* Le formulaire de note, partagé entre le fil de discussion et la fiche
   du membre. Il ne sait rien du contexte : on lui donne la conversation
   qui sert de preuve, le nom de la personne, et il prévient quand c'est
   fait. La note existante, s'il y en a une, est pré-remplie — re-noter
   remplace, et l'écran le dit. */
export default function NoterPanel({
  conversationId, nom, existante, onFait, onAnnuler,
}: {
  conversationId: string;
  nom: string;
  existante?: { stars: number; comment: string | null } | null;
  onFait: () => void;
  onAnnuler?: () => void;
}) {
  const [stars, setStars] = useState(existante?.stars ?? 0);
  const [comment, setComment] = useState(existante?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) { setErreur("Choisissez d'abord une note."); return; }
    setBusy(true);
    setErreur(null);
    const { error } = await supabase().rpc("noter", {
      p_conversation_id: conversationId,
      p_stars: stars,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErreur(messageErreur(error, "La note n’a pas pu être enregistrée."));
      return;
    }
    onFait();
  }

  return (
    <form onSubmit={envoyer} className="noter-panel">
      <p className="noter-titre">
        {existante ? `Modifier votre note pour ${nom}` : `Comment s’est passé votre échange avec ${nom} ?`}
      </p>
      <EtoilesSaisie valeur={stars} onChange={setStars} />
      <textarea
        className="input"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, COMMENTAIRE_MAX))}
        placeholder="Un mot sur l’échange, si vous voulez (facultatif)"
        aria-label="Commentaire"
      />
      <span className="champ-aide" style={{ textAlign: "right" }}>{comment.length}/{COMMENTAIRE_MAX}</span>
      {/* Dit avant d'envoyer : une note publiée sous son nom n'est pas une
          surprise qu'on découvre après. */}
      <p className="champ-aide">
        Votre note et votre commentaire seront visibles publiquement sur la fiche de {nom}, avec votre nom.
      </p>
      {erreur && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        {onAnnuler && (
          <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)" }} onClick={onAnnuler}>
            Annuler
          </button>
        )}
        <button className="btn btn-gold" disabled={busy || stars < 1} style={{ flex: 1 }}>
          {busy ? "Envoi…" : existante ? "Mettre à jour" : "Publier ma note"}
        </button>
      </div>
    </form>
  );
}
