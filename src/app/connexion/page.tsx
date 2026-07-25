"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader, Mark } from "@/components/Brand";

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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ maxWidth: 440, paddingTop: 36, paddingBottom: 56, flex: 1 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Mark size={30} color="var(--gold-deep)" />
          </div>
          <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Connexion</h1>

          {sent ? (
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>
              Un lien de connexion vient d&apos;être envoyé à <strong style={{ color: "var(--text)" }}>{email}</strong>.
              Ouvrez l&apos;email et appuyez sur le lien pour continuer.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
                Pas de mot de passe : entrez votre email, vous recevez un lien de connexion.
              </p>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com" autoComplete="email" inputMode="email"
                aria-label="Adresse email" style={{ marginBottom: 10, textAlign: "center" }} />
              {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>{error}</p>}
              <button className="btn btn-block" onClick={send} disabled={loading || !email.includes("@")}
                style={{ padding: "14px 0", fontSize: 15 }}>
                {loading ? "Envoi…" : "Recevoir le lien de connexion"}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour aux annonces</Link>
        </p>
      </main>
    </div>
  );
}
