"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader, Mark } from "@/components/Brand";

type Mode = "login" | "signup" | "forgot" | "reset";

const MIN_PASSWORD = 8;

/* Les messages de Supabase sont en anglais et techniques : on les retraduit
   en langage clair, sans jamais indiquer si l'email existe ou non (un message
   « cet email n'existe pas » permettrait d'énumérer les comptes). */
function humanError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Adresse non confirmée : ouvrez l'email de confirmation avant de vous connecter.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet email. Connectez-vous, ou utilisez « Mot de passe oublié ».";
  if (m.includes("password should be")) return `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`;
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Cette adresse email n'est pas valide.";
  /* Deux refus très différents, que Supabase renvoie tous les deux comme un
     « rate limit » : le délai anti-rebond de 60 s, et le quota d'emails du
     projet pour l'heure en cours. Dire « patientez une minute » dans le second
     cas est faux — il faut attendre une heure, ou faire valider l'adresse à la
     main côté administration. */
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) {
    return "Le site a atteint son quota d'emails pour cette heure. Réessayez dans une heure, ou demandez à l'administrateur de valider votre adresse.";
  }
  if (m.includes("for security purposes") || m.includes("only request this after")) return "Patientez une minute avant de redemander un email.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez avant de réessayer.";
  if (m.includes("weak password")) return "Mot de passe trop simple : ajoutez des lettres, chiffres ou symboles.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}

export default function Connexion() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Retour depuis l'email de réinitialisation : Supabase pose la session et
     émet PASSWORD_RECOVERY, on bascule alors sur le choix du nouveau mot de passe. */
  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setNotice("Choisissez votre nouveau mot de passe.");
      }
    });
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("confirme")) {
      setNotice("Adresse confirmée. Vous pouvez vous connecter.");
    }
    return () => data.subscription.unsubscribe();
  }, []);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD;
  const canSubmit =
    mode === "forgot" ? emailOk
    : mode === "reset" ? passwordOk
    : mode === "signup" ? emailOk && passwordOk && name.trim().length >= 2
    : emailOk && password.length > 0;

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const sb = supabase();

    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/deposer");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: origin ? `${origin}/connexion?confirme=1` : undefined,
          },
        });
        if (error) throw error;
        // Session immédiate si la confirmation d'email est désactivée côté Supabase.
        if (data.session) {
          router.replace("/deposer");
          return;
        }
        setNotice(`Compte créé. Un email de confirmation part vers ${email.trim()} : ouvrez-le pour activer votre compte. Rien au bout de quelques minutes ? Regardez vos spams, puis utilisez « Renvoyer l'email de confirmation ».`);
        setPassword("");
        setMode("login");
        return;
      }

      if (mode === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: origin ? `${origin}/connexion` : undefined,
        });
        if (error) throw error;
        setNotice("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
        setMode("login");
        return;
      }

      // mode === "reset"
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/deposer");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : ""));
      setLoading(false);
    }
  }

  /* Recours quand l'email de confirmation n'est jamais arrivé : sans ça, une
     personne dont l'email s'est perdu en route n'a aucun moyen de s'en sortir. */
  async function resendConfirmation() {
    if (!emailOk || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: origin ? `${origin}/connexion?confirme=1` : undefined },
    });
    setLoading(false);
    if (error) setError(humanError(error.message));
    else setNotice(`Si cette adresse attend une confirmation, un nouvel email vient de partir vers ${email.trim()}.`);
  }

  async function magicLink() {
    if (!emailOk || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: origin ? `${origin}/deposer` : undefined },
    });
    setLoading(false);
    if (error) setError(humanError(error.message));
    else setNotice(`Un lien de connexion vient d'être envoyé à ${email.trim()}.`);
  }

  const title =
    mode === "signup" ? "Créer un compte"
    : mode === "forgot" ? "Mot de passe oublié"
    : mode === "reset" ? "Nouveau mot de passe"
    : "Connexion";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ maxWidth: 440, paddingTop: 32, paddingBottom: 56, flex: 1 }}>
        <div className="panel gold-frame" style={{ padding: "24px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <Mark size={72} color="var(--gold-deep)" />
          </div>
          <h1 style={{ fontSize: 23, margin: "0 0 16px", textAlign: "center" }}>{title}</h1>

          {(mode === "login" || mode === "signup") && (
            <div role="tablist" aria-label="Connexion ou inscription"
              style={{ display: "flex", gap: 4, background: "var(--cream-dark)", borderRadius: 999, padding: 4, marginBottom: 18 }}>
              {([["login", "J'ai un compte"], ["signup", "Créer un compte"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mode === k}
                  onClick={() => { setMode(k); setError(null); setNotice(null); }}
                  style={{
                    flex: 1, minHeight: 40, borderRadius: 999, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
                    background: mode === k ? "var(--green)" : "transparent",
                    color: mode === k ? "var(--cream)" : "var(--text-muted)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4a5654" }}>
                Nom affiché sur vos annonces
                <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="ex : Marie L." autoComplete="name" maxLength={40} style={{ marginTop: 5 }} />
              </label>
            )}

            {mode !== "reset" && (
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4a5654" }}>
                Adresse email
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com" autoComplete="email" inputMode="email" style={{ marginTop: 5 }} />
              </label>
            )}

            {mode !== "forgot" && (
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4a5654" }}>
                Mot de passe
                <div style={{ position: "relative", marginTop: 5 }}>
                  <input className="input" type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "login" ? "Votre mot de passe" : `${MIN_PASSWORD} caractères minimum`}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    style={{ paddingRight: 76 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 600, color: "var(--text-muted)", padding: "8px 10px",
                    }}>
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                {mode !== "login" && !passwordOk && password.length > 0 && (
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginTop: 4 }}>
                    Encore {MIN_PASSWORD - password.length} caractère{MIN_PASSWORD - password.length > 1 ? "s" : ""}.
                  </span>
                )}
              </label>
            )}

            {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
            {notice && (
              <p style={{ color: "var(--green)", fontSize: 13, lineHeight: 1.5, margin: 0, background: "var(--green-100)", padding: "10px 12px", borderRadius: 10 }}>
                {notice}
              </p>
            )}

            <button type="submit" className="btn btn-block" disabled={!canSubmit || loading}
              style={{ padding: "14px 0", fontSize: 15 }}>
              {loading ? "Un instant…"
                : mode === "login" ? "Se connecter"
                : mode === "signup" ? "Créer mon compte"
                : mode === "forgot" ? "Envoyer le lien de réinitialisation"
                : "Enregistrer le mot de passe"}
            </button>
          </form>

          {mode === "login" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 16 }}>
              <button className="link-quiet" onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}>
                Mot de passe oublié ?
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", color: "var(--text-muted)", fontSize: 11.5 }}>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                ou
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              <button className="link-quiet" onClick={magicLink} disabled={!emailOk || loading}
                style={{ textDecoration: emailOk ? "underline" : "none", opacity: emailOk ? 1 : 0.55 }}>
                Recevoir plutôt un lien de connexion par email
              </button>
              <button className="link-quiet" onClick={resendConfirmation} disabled={!emailOk || loading}
                style={{ textDecoration: emailOk ? "underline" : "none", opacity: emailOk ? 1 : 0.55 }}>
                Renvoyer l&apos;email de confirmation
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <p style={{ textAlign: "center", marginTop: 14, marginBottom: 0 }}>
              <button className="link-quiet" onClick={() => { setMode("login"); setError(null); }}>
                ← Revenir à la connexion
              </button>
            </p>
          )}

          {mode === "signup" && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 14, marginBottom: 0, textAlign: "center" }}>
              Votre email ne s&apos;affiche jamais sur le site : les acheteurs vous contactent par WhatsApp.
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour aux annonces</Link>
        </p>
      </main>
    </div>
  );
}
