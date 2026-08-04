"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader, Mark } from "@/components/Brand";

type Kind = "idee" | "probleme" | "avis";
const KINDS: [Kind, string][] = [
  ["idee", "Une idée pour le site"],
  ["probleme", "Un problème à signaler"],
  ["avis", "Un avis, un encouragement"],
];

/* Boîte à idées : ouverte à tous, compte ou pas — une bonne idée ne doit
   pas exiger une inscription. Le contact est optionnel. */
export default function Retours() {
  const [kind, setKind] = useState<Kind>("idee");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (message.trim().length < 3 || sending) return;
    setSending(true);
    setError(null);
    const { data: session } = await supabase().auth.getSession();
    const { error } = await supabase().from("feedback").insert({
      kind,
      message: message.trim().slice(0, 2000),
      contact: contact.trim().slice(0, 200) || null,
      user_id: session.session?.user.id ?? null,
    });
    setSending(false);
    if (error) setError("Envoi impossible. Réessayez dans un instant.");
    else setSent(true);
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 560, paddingTop: 28, paddingBottom: 64, flex: 1 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Mark size={64} color="var(--gold-deep)" />
          </div>
          <h1 style={{ fontSize: 24, margin: "0 0 6px", textAlign: "center" }}>Votre avis compte</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.55, margin: "0 0 18px" }}>
            Le site est fait pour l&apos;île : une idée, un truc qui cloche,
            un encouragement — tout se lit, tout aide.
          </p>

          {sent ? (
            <p style={{ color: "var(--green)", fontSize: 14, background: "var(--green-100)", padding: "12px 14px", borderRadius: 10, textAlign: "center" }}>
              ✓ Merci ! Votre message est bien arrivé.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {KINDS.map(([k, label]) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
                    <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                    {label}
                  </label>
                ))}
              </div>
              <textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Dites-nous tout…" maxLength={2000} style={{ resize: "vertical" }} />
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)}
                placeholder="Email ou téléphone si vous voulez une réponse (optionnel)" maxLength={200} />
              {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
              <button className="btn btn-block" onClick={send} disabled={sending || message.trim().length < 3}
                style={{ padding: "14px 0", fontSize: 15 }}>
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          )}
        </div>
        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour au site</Link>
        </p>
      </main>
    </div>
  );
}
