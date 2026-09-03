"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MOTIFS_SIGNALEMENT, type MotifSignalement } from "@/lib/moderation";

/* Signaler une annonce : un motif fermé, un détail libre facultatif.
   Le motif fermé, c'est ce qui rend le signalement exploitable — par
   l'administration qui trie, et par le score qui compte. Le texte libre
   reste là pour ce que la liste ne prévoit pas. */
export default function SignalerPanel({ listingId, reporterId, onFait, onAnnuler }: {
  listingId: string; reporterId: string; onFait: () => void; onAnnuler: () => void;
}) {
  const [motif, setMotif] = useState<MotifSignalement | null>(null);
  const [detail, setDetail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const detailRequis = motif === "autre";
  const pret = motif != null && (!detailRequis || detail.trim().length >= 3);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || !motif) return;
    setEnvoi(true);
    setErreur(null);
    const libelle = MOTIFS_SIGNALEMENT.find((m) => m.code === motif)?.label ?? motif;
    /* reason garde une phrase lisible même sans le motif : les anciens
       écrans et le journal d'administration la montrent telle quelle. */
    const reason = detail.trim() ? `${libelle} — ${detail.trim()}` : libelle;
    const { error } = await supabase().from("reports").insert({
      listing_id: listingId,
      reporter_id: reporterId,
      reason: reason.slice(0, 500),
      motif,
    });
    setEnvoi(false);
    if (error) {
      setErreur(error.message.includes("déjà") || error.code === "23505"
        ? "Vous avez déjà signalé cette annonce, merci."
        : "Le signalement n’a pas pu être envoyé. Réessayez dans un instant.");
      return;
    }
    onFait();
  }

  return (
    <form onSubmit={envoyer} className="signaler-panel" aria-label="Signaler cette annonce">
      <p className="signaler-titre">Pourquoi signaler cette annonce ?</p>
      <div role="radiogroup" className="signaler-motifs">
        {MOTIFS_SIGNALEMENT.map((m) => (
          <label key={m.code} className={`signaler-motif${motif === m.code ? " choisi" : ""}`}>
            <input type="radio" name="motif" value={m.code} checked={motif === m.code}
              onChange={() => setMotif(m.code)} />
            <span>
              <strong>{m.label}</strong>
              <small>{m.aide}</small>
            </span>
          </label>
        ))}
      </div>
      <textarea
        className="input" rows={2}
        value={detail}
        onChange={(e) => setDetail(e.target.value.slice(0, 400))}
        placeholder={detailRequis ? "Expliquez en quelques mots (obligatoire)" : "Précisions (facultatif)"}
        aria-label="Précisions"
      />
      <p className="signaler-note">
        Le signalement est confidentiel : l’auteur de l’annonce ne sait pas qui l’a envoyé.
        Un seul signalement ne retire jamais une annonce ; il déclenche une vérification.
      </p>
      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)", flex: "0 0 auto" }}
          onClick={onAnnuler}>
          Annuler
        </button>
        <button className="btn" style={{ flex: 1, background: "var(--danger)" }} disabled={!pret || envoi}>
          {envoi ? "Envoi…" : "Envoyer le signalement"}
        </button>
      </div>
    </form>
  );
}
