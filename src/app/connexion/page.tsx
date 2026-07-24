"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Connexion() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/deposer` : undefined },
    });
    setLoading(false);
    if (error) setError("Envoi impossible. Vérifiez l'adresse et réessayez.");
    else setSent(true);
  }

  return (
    <div>
      <header style={{ background: "#f0f4f5", borderBottom: "3px solid var(--ink)" }}>
        <div className="container" style={{ padding: "14px 16px" }}>
          <Link href="/" className="wordmark">LAGON</Link>
        </div>
      </header>
      <main className="container" style={{ maxWidth: 440, paddingTop: 40, paddingBottom: 48 }}>
        <h1 style={{ fontFamily: "'Archivo', sans-serif", fontVariationSettings: "'wght' 800", fontSize: 24 }}>
          Connexion
        </h1>
        {sent ? (
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            Un lien de connexion vient d'être envoyé à <strong>{email}</strong>.
            Ouvrez l'email et cliquez sur le lien pour continuer.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Pas de mot de passe : entrez votre email, vous recevez un lien de connexion.
            </p>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com" style={{ margin: "10px 0" }} />
            {error && <p style={{ color: "#b0341f", fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button className="btn" onClick={send} disabled={loading || !email.includes("@")}
              style={{ background: "var(--ink)", width: "100%", padding: "13px 0", fontSize: 15 }}>
              {loading ? "Envoi…" : "Recevoir le lien de connexion"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
