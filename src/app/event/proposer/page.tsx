"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/event";
import { QUARTIERS } from "@/lib/food";
import { SiteHeader } from "@/components/Brand";
import { connexionUrl, normalizeExternalUrl } from "@/lib/urls";

/* Dépôt d'un événement par son organisateur. Compte requis (anti-spam,
   et la RLS l'exige de toute façon) ; rien ne paraît sans validation. */
export default function ProposerEvenement() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Soirée");
  const [venue, setVenue] = useState("");
  const [quartier, setQuartier] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [contact, setContact] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      setUserId(data.session?.user.id ?? null);
      setChecked(true);
    })();
  }, []);

  const valid = title.trim().length >= 3 && date && heure && organizer.trim() && contact.trim();

  async function envoyer() {
    if (!valid || sending || !userId) return;
    setSending(true);
    setError(null);
    /* La date saisie est l'heure locale de l'île : on la fige avec le
       décalage AST (UTC-4, sans heure d'été) pour ne pas dépendre du
       fuseau du téléphone qui la dépose. */
    const starts = `${date}T${heure}:00-04:00`;
    const safeLink = normalizeExternalUrl(link);
    if (link.trim() && !safeLink) {
      setSending(false);
      setError("Le lien de billetterie n’est pas valide.");
      return;
    }
    const { error } = await supabase().from("events").insert({
      title: title.trim().slice(0, 100),
      category,
      venue: venue.trim().slice(0, 200),
      quartier,
      starts_at: starts,
      price: price.trim().slice(0, 100),
      description: description.trim().slice(0, 2000),
      link: safeLink,
      organizer: organizer.trim().slice(0, 120),
      contact: contact.trim().slice(0, 200),
      submitted_by: userId,
    });
    setSending(false);
    if (error) setError("Envoi impossible. Vérifiez les champs et réessayez.");
    else setSent(true);
  }

  if (!checked) return (
    <>
      <SiteHeader site="event" />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  if (!userId) return (
    <>
      <SiteHeader site="event" />
      <main className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 56 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>Un compte suffit</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
            Pour proposer un événement, connectez-vous — c&apos;est gratuit et
            ça nous permet de vous répondre.
          </p>
          <button className="btn" onClick={() => router.push(connexionUrl("/event/proposer"))}>Se connecter</button>
        </div>
      </main>
    </>
  );

  if (sent) return (
    <>
      <SiteHeader site="event" />
      <main className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 56 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>✓ Bien reçu, merci !</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
            Votre événement est en relecture : il paraîtra dans l&apos;agenda
            après validation, généralement sous 24 h.
          </p>
          <Link href="/event" className="btn">← Retour à l&apos;agenda</Link>
        </div>
      </main>
    </>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader site="event" />
      <main className="container" style={{ maxWidth: 640, paddingTop: 24, paddingBottom: 56, flex: 1 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Proposer un événement</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 18px" }}>
          Gratuit. Relu avant parution. <Link href="/event" style={{ color: "inherit" }}>← L&apos;agenda</Link>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Champ label="Titre de l'événement *">
            <input className="input" value={title} maxLength={100}
              onChange={(e) => setTitle(e.target.value)} placeholder="ex : Régate de la Saint-Barth" />
          </Champ>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Champ label="Catégorie">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Champ>
            <Champ label="Date *">
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Champ>
            <Champ label="Heure *">
              <input className="input" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </Champ>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <Champ label="Lieu">
              <input className="input" value={venue} maxLength={200} onChange={(e) => setVenue(e.target.value)}
                placeholder="ex : Quai du port, Shell Beach…" />
            </Champ>
            <Champ label="Quartier">
              <select className="input" value={quartier} onChange={(e) => setQuartier(e.target.value)}>
                <option value="">—</option>
                {QUARTIERS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Champ>
            <Champ label="Prix">
              <input className="input" value={price} maxLength={100} onChange={(e) => setPrice(e.target.value)}
                placeholder="ex : Gratuit, 25 €…" />
            </Champ>
          </div>

          <Champ label="Description">
            <textarea className="input" rows={4} value={description} maxLength={2000}
              onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }}
              placeholder="Programme, artistes, infos pratiques…" />
          </Champ>

          <Champ label="Lien billetterie ou infos">
            <input className="input" type="url" inputMode="url" value={link} maxLength={500} onChange={(e) => setLink(e.target.value)}
              placeholder="https://…" />
          </Champ>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <Champ label="Organisateur *">
              <input className="input" value={organizer} maxLength={120} onChange={(e) => setOrganizer(e.target.value)}
                placeholder="Association, établissement, vous…" />
            </Champ>
            <Champ label="Votre contact (jamais publié) *">
              <input className="input" value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)}
                placeholder="Email ou téléphone" />
            </Champ>
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}

          <button className="btn btn-block" onClick={envoyer} disabled={!valid || sending}
            style={{ padding: "15px 0", fontSize: 15.5, opacity: valid ? 1 : 0.55 }}>
            {sending ? "Envoi…" : "Envoyer pour validation"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#4a5654" }}>
      {label}
      {children}
    </label>
  );
}
