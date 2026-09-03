"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizePhoneNumber } from "@/lib/urls";
import { messageErreur } from "@/lib/messages";

/* Réglages du compte : nom affiché, numéro WhatsApp, messagerie interne,
   et l'adresse de connexion.

   L'email ne se change pas comme un champ ordinaire — c'est l'identifiant
   de connexion. Supabase envoie un lien de confirmation à la nouvelle
   adresse (et, si le projet l'exige, à l'ancienne) : tant que le lien n'est
   pas suivi, rien ne bouge. C'est volontaire, et c'est dit à l'écran, sinon
   l'utilisateur croit que sa modification a échoué. */
export default function ProfilForm() {
  const [chargement, setChargement] = useState(true);
  const [emailActuel, setEmailActuel] = useState("");

  const [nom, setNom] = useState("");
  const [phone, setPhone] = useState("");
  const [messagerie, setMessagerie] = useState(true);
  const [enregistre, setEnregistre] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [nouvelEmail, setNouvelEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailInfo, setEmailInfo] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) { setChargement(false); return; }
      setEmailActuel(session.session.user.email ?? "");
      const { data } = await sb
        .from("profiles")
        .select("display_name, phone_wa, allow_messages")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (data) {
        const p = data as { display_name: string; phone_wa: string | null; allow_messages?: boolean };
        setNom(p.display_name ?? "");
        setPhone(p.phone_wa ?? "");
        setMessagerie(p.allow_messages !== false);
      }
      setChargement(false);
    })();
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErreur(null);
    setEnregistre(false);

    const nomPropre = nom.trim();
    if (nomPropre.length < 1 || nomPropre.length > 80) {
      setErreur("Le nom affiché doit faire entre 1 et 80 caractères.");
      setBusy(false);
      return;
    }

    let numero: string | null = null;
    if (phone.trim()) {
      numero = normalizePhoneNumber(phone);
      if (!numero) {
        setErreur("Le numéro WhatsApp doit être au format international, par exemple +590690XXXXXX.");
        setBusy(false);
        return;
      }
    }

    /* La règle du site : joignable d'une façon ou d'une autre. Couper la
       messagerie sans laisser de numéro rendrait ses propres annonces
       inatteignables — autant ne pas les publier. */
    if (!numero && !messagerie) {
      setErreur("Laissez la messagerie interne active, ou renseignez un numéro WhatsApp : sans l'un des deux, personne ne peut vous joindre.");
      setBusy(false);
      return;
    }

    const sb = supabase();
    const { data: session } = await sb.auth.getSession();
    if (!session.session) { setBusy(false); return; }

    /* .select() force PostgREST à renvoyer la ligne : sans ça, une écriture
       refusée par les privilèges passe pour un succès à zéro ligne. */
    const { data, error } = await sb
      .from("profiles")
      .update({ display_name: nomPropre, phone_wa: numero, allow_messages: messagerie })
      .eq("id", session.session.user.id)
      .select("id");

    setBusy(false);
    if (error) {
      setErreur(messageErreur(error, "L’enregistrement a échoué."));
      return;
    }
    if (!data || data.length === 0) {
      setErreur("La base a refusé la modification. Vérifiez que la migration 0025 a bien été exécutée.");
      return;
    }
    setPhone(numero ?? "");
    setEnregistre(true);
  }

  async function changerEmail(e: React.FormEvent) {
    e.preventDefault();
    const cible = nouvelEmail.trim().toLowerCase();
    setEmailErr(null);
    setEmailInfo(null);
    if (!cible || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cible)) {
      setEmailErr("Cette adresse ne semble pas valide.");
      return;
    }
    if (cible === emailActuel.toLowerCase()) {
      setEmailErr("C’est déjà votre adresse actuelle.");
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase().auth.updateUser({ email: cible });
    setEmailBusy(false);
    if (error) {
      setEmailErr(messageErreur(error, "Le changement d’adresse a échoué."));
      return;
    }
    setNouvelEmail("");
    setEmailInfo(`Un lien de confirmation vient d’être envoyé à ${cible}. Votre adresse de connexion ne changera qu’une fois ce lien ouvert — pensez à regarder les indésirables.`);
  }

  if (chargement) return <p style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <form onSubmit={enregistrer} className="panel" style={{ padding: "16px 16px 18px", display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Mon profil</h2>

        <label style={{ display: "grid", gap: 5 }}>
          <span className="champ-label">Nom affiché</span>
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)}
            maxLength={80} placeholder="Le nom vu sur vos annonces" />
          <span className="champ-aide">C’est ce que voient les autres sur vos annonces et dans vos messages.</span>
        </label>

        <label style={{ display: "grid", gap: 5 }}>
          <span className="champ-label">Numéro WhatsApp</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)}
            inputMode="tel" placeholder="+590690XXXXXX" />
          <span className="champ-aide">
            Format international, indicatif compris. Laissez vide si vous préférez n’être joint que par messagerie.
          </span>
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={messagerie} onChange={(e) => setMessagerie(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 auto", accentColor: "var(--green)" }} />
          <span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Recevoir des messages sur le site</span>
            <span className="champ-aide" style={{ display: "block" }}>
              Les personnes intéressées peuvent vous écrire sans avoir votre numéro. Vous répondez depuis « Mes messages ».
            </span>
          </span>
        </label>

        {erreur && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13.5, margin: 0 }}>{erreur}</p>}
        {enregistre && <p style={{ color: "var(--green)", fontWeight: 700, fontSize: 13.5, margin: 0 }}>Profil enregistré.</p>}

        <button className="btn btn-gold" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </form>

      <form onSubmit={changerEmail} className="panel" style={{ padding: "16px 16px 18px", display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Adresse de connexion</h2>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
          Actuellement <strong style={{ color: "var(--text)" }}>{emailActuel || "—"}</strong>
        </p>

        <label style={{ display: "grid", gap: 5 }}>
          <span className="champ-label">Nouvelle adresse</span>
          <input className="input" type="email" value={nouvelEmail} autoComplete="email"
            onChange={(e) => setNouvelEmail(e.target.value)} placeholder="nouvelle@adresse.com" />
          <span className="champ-aide">
            Un lien de confirmation y sera envoyé. Tant que vous ne l’avez pas ouvert, vous continuez à vous
            connecter avec l’adresse actuelle.
          </span>
        </label>

        {emailErr && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13.5, margin: 0 }}>{emailErr}</p>}
        {emailInfo && <p style={{ color: "var(--green)", fontWeight: 600, fontSize: 13.5, margin: 0 }}>{emailInfo}</p>}

        <button className="btn btn-outline-gold" style={{ color: "var(--gold-deep)" }} disabled={emailBusy}>
          {emailBusy ? "Envoi…" : "Envoyer le lien de confirmation"}
        </button>
      </form>
    </div>
  );
}
