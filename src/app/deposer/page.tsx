"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_ORDER, INTENT_LABEL, fieldsFor, type Intent, type ModuleKey, type FieldDef } from "@/lib/taxonomy";
import { SiteHeader, Mark } from "@/components/Brand";

const MAX_PHOTOS = 5;

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
  const [intent, setIntent] = useState<Intent>("offer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [phoneWa, setPhoneWa] = useState("");
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) { router.replace("/connexion"); return; }
      setUserId(data.session.user.id);
      const { data: profile } = await supabase()
        .from("profiles").select("phone_wa").eq("id", data.session.user.id).single();
      if (profile?.phone_wa) setPhoneWa(profile.phone_wa);
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

  async function publish() {
    if (!mod || !sub || !userId) return;
    setPublishing(true);
    setError(null);
    try {
      // 1. Mettre à jour le numéro WhatsApp du profil si renseigné
      if (phoneWa.trim()) {
        await supabase().from("profiles").update({ phone_wa: phoneWa.trim() }).eq("id", userId);
      }

      // 2. Créer l'annonce
      const cleanAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== ""));
      const { data: listing, error: insErr } = await supabase()
        .from("listings")
        .insert({
          user_id: userId,
          module: mod,
          subcategory: sub,
          intent,
          title: title.trim(),
          description: description.trim(),
          price_cents: price === "" ? null : Math.round(parseFloat(price.replace(",", ".")) * 100),
          location: location.trim() || "Saint-Barthélemy",
          attrs: cleanAttrs,
        })
        .select("id")
        .single();
      if (insErr || !listing) throw insErr ?? new Error("insert failed");

      // 3. Uploader les photos dans le dossier de l'utilisateur
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${userId}/${listing.id}/${i}.${ext}`;
        const { error: upErr } = await supabase().storage.from("photos").upload(key, f, { upsert: true });
        if (!upErr) {
          await supabase().from("listing_photos").insert({ listing_id: listing.id, storage_key: key, position: i });
        }
      }

      router.push(`/annonce/${listing.id}`);
    } catch {
      setError("La publication a échoué. Vérifiez les champs et réessayez.");
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

        {/* Progression : trois filets, lisibles d'un coup d'œil sur mobile */}
        <div style={{ display: "flex", gap: 6, margin: "0 0 4px" }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              height: 3, flex: 1, borderRadius: 99,
              background: i <= step ? (m ? m.color : "var(--gold)") : "var(--cream-dark)",
            }} />
          ))}
        </div>

        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 18 }}>
            {MODULE_ORDER.map((key) => {
              const mm = MODULES[key];
              return (
                <button key={key}
                  onClick={() => { setMod(key); setSub(null); setAttrs({}); setShowMore(false); setStep(1); }}
                  style={{ border: `1.5px solid ${mm.color}55`, background: mm.soft, borderRadius: 16, padding: "20px 16px",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14, minHeight: 84 }}>
                  <Mark size={26} color={mm.color} />
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 17, color: mm.dark }}>
                    {mm.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && m && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {m.subs.map((s) => (
              <button key={s} className="chip"
                onClick={() => { setSub(s); setAttrs({}); setShowMore(false); setStep(2); }}
                style={{ borderColor: m.color, color: m.dark, padding: "8px 16px", fontSize: 13.5 }}>
                {s}
              </button>
            ))}
          </div>
        )}

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
            <input className="input" value={phoneWa} onChange={(e) => setPhoneWa(e.target.value)}
              placeholder="Numéro WhatsApp (ex. +590690XXXXXX)" inputMode="tel" />

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

            <div>
              <label htmlFor="photos" style={{
                display: "block", border: "1.5px dashed var(--border-input)", borderRadius: 14,
                padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5,
                cursor: "pointer", background: "var(--surface)",
              }}>
                {files.length === 0 ? `+ Ajouter des photos (${MAX_PHOTOS} max)` : `${files.length} photo${files.length > 1 ? "s" : ""} sélectionnée${files.length > 1 ? "s" : ""} — appuyer pour changer`}
              </label>
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
                style={{ display: "none" }}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))} />
              {files.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {files.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={URL.createObjectURL(f)} alt=""
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
            <button onClick={() => setStep(step - 1)} className="link-quiet">
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
