"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_ORDER, INTENT_LABEL, fieldsFor, type Intent, type ModuleKey, type FieldDef } from "@/lib/taxonomy";
import { SiteHeader, Mark } from "@/components/Brand";
import { compressImage, thumbKey } from "@/lib/images";
import { PHOTOS_LIBRE, PHOTOS_EN_AVANT, finDeMiseEnAvant, DUREE_JOURS } from "@/lib/featured";
import { connexionUrl, normalizePhoneNumber } from "@/lib/urls";
import { empreinteFichier, MESSAGE_CONTENU_REFUSE } from "@/lib/moderation";
import { modererPhoto } from "@/lib/modererPhoto";
import { notifierAlertes } from "@/lib/alertes";


function Field({ f, v, set }: { f: FieldDef; v: string; set: (k: string, v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "#4a5654" }}>
      {f.k}
      {f.t === "select" ? (
        <select className="input" value={v} onChange={(e) => set(f.k, e.target.value)}>
          <option value="">—</option>
          {f.o!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="input" value={v} onChange={(e) => set(f.k, e.target.value)}
          inputMode={f.t === "number" ? "numeric" : "text"} placeholder={f.ph || ""} />
      )}
    </label>
  );
}

export default function Deposer() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const [step, setStep] = useState(0);
  const [mod, setMod] = useState<ModuleKey | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [subQuery, setSubQuery] = useState("");
  const [enAvant, setEnAvant] = useState(false);
  const [intent, setIntent] = useState<Intent>("offer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [phoneWa, setPhoneWa] = useState("");
  const [messagerie, setMessagerie] = useState(true);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) { router.replace(connexionUrl("/deposer")); return; }
      setUserId(data.session.user.id);
      const { data: profile } = await supabase()
        .from("profiles").select("phone_wa, allow_messages").eq("id", data.session.user.id).single();
      if (profile?.phone_wa) setPhoneWa(profile.phone_wa);
      if (profile && "allow_messages" in profile) setMessagerie(profile.allow_messages !== false);
      setChecked(true);
    })();
  }, [router]);

  if (!checked) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const m = mod ? MODULES[mod] : null;
  const fields = mod && sub ? fieldsFor(mod, sub) : [];
  const baseFields = fields.filter((f) => !f.adv);
  const advFields = fields.filter((f) => f.adv);
  const advFilled = advFields.filter((f) => attrs[f.k]).length;
  const setAttr = (k: string, v: string) => setAttrs((a) => ({ ...a, [k]: v }));
  const maxPhotos = enAvant ? PHOTOS_EN_AVANT : PHOTOS_LIBRE;

  async function publish() {
    if (!mod || !sub || !userId) return;
    setPublishing(true);
    setError(null);
    const sb = supabase();
    let createdListingId: string | null = null;
    const uploadedKeys: string[] = [];
    try {
      // 1. Le contact : au moins une voie ouverte, puis on enregistre le choix
      //    sur le profil — il vaut pour toutes les annonces de la personne.
      if (!phoneWa.trim() && !messagerie) throw new Error("contact");
      const normalizedPhone = phoneWa.trim() ? normalizePhoneNumber(phoneWa) : null;
      if (phoneWa.trim() && !normalizedPhone) throw new Error("phone");
      const { error: profileError } = await sb
        .from("profiles")
        .update({ phone_wa: normalizedPhone, allow_messages: messagerie })
        .eq("id", userId);
      if (profileError) throw profileError;

      // 2. Créer l'annonce
      const cleanAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== ""));
      const numericPrice = price === "" ? null : Number.parseFloat(price.replace(",", "."));
      if (numericPrice != null && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
        throw new Error("price");
      }
      const { data: listing, error: insErr } = await sb
        .from("listings")
        .insert({
          user_id: userId,
          module: mod,
          subcategory: sub,
          intent,
          title: title.trim(),
          description: description.trim(),
          price_cents: numericPrice == null ? null : Math.round(numericPrice * 100),
          location: location.trim() || "Saint-Barthélemy",
          attrs: cleanAttrs,
          /* La colonne n'est mentionnée que si l'option est demandée : sur une
             base où la migration 0021 n'est pas encore passée, un dépôt
             ordinaire continue de fonctionner au lieu d'échouer en bloc. */
          ...(enAvant ? { featured_until: finDeMiseEnAvant() } : {}),
        })
        .select("id")
        .single();
      if (insErr || !listing) throw insErr ?? new Error("insert failed");
      createdListingId = listing.id;

      // 3. Compresser puis uploader les photos dans le dossier de l'utilisateur.
      // Sans compression, une photo de téléphone dépasse souvent la limite du
      // bucket (5 Mo) et le dépôt perd ses images sans explication.
      for (let i = 0; i < files.length; i++) {
        /* L'empreinte de l'original, avant compression : elle permet de
           reconnaître une photo déjà déposée ailleurs (migration 0032). Si
           le navigateur ne sait pas la calculer, la photo passe sans. */
        const [{ full, thumb }, hash] = await Promise.all([compressImage(files[i]), empreinteFichier(files[i])]);
        if (!full.type.match(/^image\/(jpeg|png|webp)$/) || full.size > 5 * 1024 * 1024) {
          throw new Error("photo");
        }
        const ext = full.name.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${userId}/${listing.id}/${i}.${ext}`;
        const { error: upErr } = await sb.storage.from("photos").upload(key, full, { upsert: false });
        if (upErr) throw upErr;
        uploadedKeys.push(key);
        const { error: photoError } = await sb
          .from("listing_photos")
          .insert({ listing_id: listing.id, storage_key: key, position: i, ...(hash ? { content_hash: hash } : {}) });
        if (photoError) throw photoError;
        // L'analyse d'image part en tâche de fond ; la base réévaluera l'annonce.
        void modererPhoto(listing.id, key);
        /* La vignette est une optimisation : si elle échoue, l'affichage se
           rabat sur l'original sans faire échouer toute la publication. */
        if (thumb) {
          const thumbnailKey = thumbKey(key);
          const { error: thumbError } = await sb.storage.from("photos").upload(thumbnailKey, thumb, { upsert: false });
          if (!thumbError) uploadedKeys.push(thumbnailKey);
        }
      }

      /* La base a évalué l'annonce à la volée. Retenue : on le dit ici,
         sans les détails, et on ne renvoie pas vers une fiche invisible.
         En attente : la fiche l'explique elle-même, on y va. */
      const { data: etat } = await sb.from("listings").select("review_state").eq("id", listing.id).maybeSingle();
      const reviewState = (etat as { review_state?: string } | null)?.review_state;
      if (reviewState === "blocked") {
        setError(`${MESSAGE_CONTENU_REFUSE} Elle a été transmise à la modération et n’est pas visible. Vous la retrouvez dans Mon espace.`);
        setPublishing(false);
        return;
      }
      /* Publiée : ceux qui ont une alerte pour cette recherche sont prévenus.
         En attente : la passe quotidienne s'en chargera après validation. */
      if (reviewState !== "pending") void notifierAlertes(listing.id);
      router.push(`/annonce/${listing.id}`);
    } catch (cause) {
      // Pas d'annonce incomplète : on nettoie les objets et la ligne créés
      // avant d'afficher l'erreur à l'utilisateur.
      if (uploadedKeys.length > 0) await sb.storage.from("photos").remove(uploadedKeys);
      if (createdListingId) await sb.from("listings").delete().eq("id", createdListingId);
      /* Les erreurs de Supabase ne sont pas des Error : sans cette lecture,
         leur message se perdrait et l'écran resterait muet sur la cause. */
      const message =
        cause instanceof Error ? cause.message
        : typeof cause === "object" && cause !== null && "message" in cause
          ? String((cause as { message: unknown }).message)
          : "";
      /* Une erreur technique ne doit pas se déguiser en faute de saisie :
         renvoyer « vérifiez les champs » sur une colonne manquante envoie
         l'utilisateur relire un formulaire pourtant correct. On distingue
         donc nos propres motifs de validation du message de la base. */
      const nôtre = ["phone", "price", "photo", "contact"].includes(message);
      if (!nôtre) console.error("Publication :", cause);
      /* Un compte suspendu par la modération reçoit le message de la base
         tel quel : il dit jusqu'à quand, c'est tout ce qu'il faut savoir. */
      const suspendu = message.startsWith("Votre compte est suspendu");
      setError(suspendu ? message
        : message === "contact"
        ? "Indiquez un numéro WhatsApp ou laissez la messagerie du site active : votre annonce doit rester joignable."
        : message === "phone"
        ? "Le numéro WhatsApp doit être au format international, par exemple +590690XXXXXX."
        : message === "price"
          ? "Le prix indiqué n’est pas valide."
          : message === "photo"
            ? "Une photo n’a pas pu être préparée. Utilisez une image JPG, PNG ou WebP de moins de 5 Mo."
            : `La publication a échoué et aucune annonce incomplète n’a été créée. Détail technique : ${message || "erreur inconnue"}`);
      setPublishing(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader accent={m ? m.color : "var(--gold)"} />

      <main className="container" style={{ maxWidth: 640, paddingTop: 24, paddingBottom: 56, flex: 1 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Déposer une annonce</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
          {step === 0 ? "Étape 1 sur 3 · Choisissez l'univers"
            : step === 1 ? "Étape 2 sur 3 · Choisissez la catégorie"
            : "Étape 3 sur 3 · Décrivez votre annonce"}
        </p>


        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 18 }}>
            {MODULE_ORDER.map((key) => {
              const mm = MODULES[key];
              return (
                <button key={key}
                  onClick={() => { setMod(key); setSub(null); setAttrs({}); setShowMore(false); setStep(1); }}
                  style={{ border: `1.5px solid ${mm.color}55`, background: mm.soft, borderRadius: 16, padding: "20px 16px",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14, minHeight: 84 }}>
                  <Mark size={54} color={mm.color} />
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 17, color: mm.dark }}>
                    {mm.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && m && (() => {
          /* Certains univers comptent plus de trente catégories : en mur de
             pastilles, on lit tout pour trouver une ligne. Un champ de
             recherche et une liste verticale vont droit au but — et la
             comparaison ignore les accents, personne ne tape « Électroménager »
             avec son accent sur un téléphone. */
          const sansAccent = (t: string) =>
            t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const q = sansAccent(subQuery.trim());
          const visibles = q ? m.subs.filter((s) => sansAccent(s).includes(q)) : m.subs;
          const choisir = (s: string) => {
            setSub(s); setAttrs({}); setShowMore(false); setSubQuery(""); setStep(2);
          };

          return (
            <div style={{ marginTop: 16 }}>
              <input
                className="input"
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && visibles.length > 0) choisir(visibles[0]); }}
                placeholder={`Rechercher dans ${m.label.toLowerCase()}…`}
                aria-label="Rechercher une catégorie"
                type="search"
                autoFocus
                style={{ marginBottom: 10 }}
              />

              {visibles.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", padding: "14px 2px" }}>
                  Aucune catégorie ne correspond. Essayez un autre mot, ou choisissez
                  « Autre » en effaçant la recherche.
                </p>
              ) : (
                <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                  {visibles.map((s, i) => (
                    <button key={s} onClick={() => choisir(s)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", minHeight: 48, padding: "12px 16px", gap: 12,
                        background: "none", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 14.5, fontWeight: 600, color: m.dark, textAlign: "left",
                        border: "none", borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      }}>
                      {s}
                      <span aria-hidden="true" style={{ color: m.color, fontSize: 15 }}>→</span>
                    </button>
                  ))}
                </div>
              )}

              {q && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 2px 0" }}>
                  {visibles.length} catégorie{visibles.length > 1 ? "s" : ""} sur {m.subs.length}
                </p>
              )}
            </div>
          );
        })()}

        {step === 2 && mod && m && sub && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              color: m.dark, background: m.soft, padding: "5px 12px", borderRadius: 99 }}>
              {m.label} · {sub}
            </span>
            {/* Proposition ou recherche : le premier choix du formulaire, il
                change le sens de tout le reste. */}
            <div role="radiogroup" aria-label="Sens de l'annonce"
              style={{ display: "flex", gap: 4, background: "var(--cream-dark)", borderRadius: 999, padding: 4 }}>
              {INTENT_ORDER.map((k) => (
                <button key={k} role="radio" aria-checked={intent === k} onClick={() => setIntent(k)}
                  style={{
                    flex: 1, minHeight: 42, borderRadius: 999, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                    background: intent === k ? m.color : "transparent",
                    color: intent === k ? "#fff" : "var(--text-muted)",
                  }}>
                  {INTENT_LABEL[mod][k]}
                </button>
              ))}
            </div>

            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={intent === "wanted" ? "Ce que vous recherchez" : "Titre de l'annonce"}
              maxLength={100} style={{ fontSize: 15 }} />
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Description" rows={4} maxLength={5000} style={{ resize: "vertical" }} />
            {/* Deux colonnes dès 420 px, empilées sur les petits téléphones */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              <input className="input" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder={intent === "wanted" ? "Budget (€) — vide si à discuter" : "Prix (€) — vide si à discuter"}
                inputMode="decimal" />
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Quartier (ex. Lorient)" />
            </div>
            {/* Être joignable n'est pas une option : une annonce que personne
                ne peut contacter ne sert à rien, ni à son auteur ni au site.
                Deux voies, au moins une des deux. */}
            <div className="contact-bloc">
              <span className="contact-titre">Comment vous joindre</span>
              <input className="input" value={phoneWa} onChange={(e) => setPhoneWa(e.target.value)}
                placeholder="Numéro WhatsApp (ex. +590690XXXXXX)" inputMode="tel" />
              <label className="contact-case">
                <input type="checkbox" checked={messagerie} onChange={(e) => setMessagerie(e.target.checked)} />
                <span>
                  <strong>Recevoir des messages sur Ti Kanal</strong>
                  <small>Les intéressés vous écrivent sans avoir votre numéro ; vous répondez depuis « Mes messages ».</small>
                </span>
              </label>
              {!phoneWa.trim() && !messagerie && (
                <p className="contact-alerte">
                  Renseignez un numéro WhatsApp ou laissez la messagerie active : sinon personne ne pourra
                  répondre à votre annonce.
                </p>
              )}
            </div>

            {fields.length > 0 && (
              <div style={{ border: `1px solid ${m.color}33`, background: m.soft + "66", borderRadius: 14, padding: "14px 14px 16px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: m.dark, marginBottom: 12, letterSpacing: ".07em", textTransform: "uppercase" }}>
                  Détails · {sub}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  {baseFields.map((f) => <Field key={f.k} f={f} v={attrs[f.k] || ""} set={setAttr} />)}
                  {showMore && advFields.map((f) => <Field key={f.k} f={f} v={attrs[f.k] || ""} set={setAttr} />)}
                </div>
                {advFields.length > 0 && (
                  <button onClick={() => setShowMore(!showMore)}
                    style={{ marginTop: 14, background: "var(--surface)", border: `1.5px solid ${m.color}`, color: m.dark,
                      borderRadius: 99, padding: "9px 16px", minHeight: 40, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {showMore
                      ? "− Masquer les détails supplémentaires"
                      : `+ Plus de détails (${advFields.length} champs${advFilled ? `, ${advFilled} rempli${advFilled > 1 ? "s" : ""}` : ""})`}
                  </button>
                )}
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>
                  Tous ces champs sont facultatifs, mais une annonce détaillée se vend plus vite.
                </div>
              </div>
            )}

            {/* Mise en avant : gratuite pendant la phase de test. L'option est
                posée avant les photos parce qu'elle en change le nombre permis. */}
            <div className="panel gold-frame" style={{ padding: "14px 16px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={enAvant} style={{ marginTop: 3 }}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setEnAvant(on);
                    // Repasser en formule libre : on ne garde que ce qui y tient.
                    if (!on) setFiles((prev) => prev.slice(0, PHOTOS_LIBRE));
                  }} />
                <span>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--green)" }}>
                    Mettre mon annonce en avant
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
                    Encadré doré, place en tête de l&apos;accueil et des recherches,
                    et {PHOTOS_EN_AVANT} photos au lieu de {PHOTOS_LIBRE} — pendant {DUREE_JOURS} jours.
                  </span>
                  <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 800,
                    letterSpacing: ".07em", textTransform: "uppercase", background: "var(--gold)",
                    color: "var(--green-900)", padding: "3px 10px", borderRadius: 99 }}>
                    Gratuit pendant la phase de test
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="photos" style={{
                display: "block", border: "1.5px dashed var(--border-input)", borderRadius: 14,
                padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5,
                cursor: "pointer", background: "var(--surface)",
              }}>
                {files.length === 0 ? `+ Ajouter des photos (${maxPhotos} max)` : `${files.length} photo${files.length > 1 ? "s" : ""} sélectionnée${files.length > 1 ? "s" : ""} — appuyer pour changer`}
              </label>
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
                style={{ display: "none" }}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, maxPhotos))} />
              {files.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {files.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${f.name}-${i}`} src={previews[i]} alt={`Aperçu ${i + 1}`}
                      style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 6 }} />
                  ))}
                </div>
              )}
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button className="btn btn-block" disabled={title.trim().length < 3 || publishing} onClick={publish}
              style={{ background: m.color, padding: "15px 0", fontSize: 15.5 }}>
              {publishing ? "Publication…" : "Publier l'annonce"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 18, alignItems: "center" }}>
          {step > 0 && (
            <button onClick={() => { setSubQuery(""); setStep(step - 1); }} className="link-quiet">
              ← Retour
            </button>
          )}
          <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13 }}>Annuler</Link>
          <button
            className="link-quiet"
            style={{ marginLeft: "auto" }}
            onClick={async () => { await supabase().auth.signOut(); router.replace("/"); }}
          >
            Se déconnecter
          </button>
        </div>
      </main>
    </div>
  );
}
