"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, fieldsFor, type ModuleKey, type FieldDef } from "@/lib/taxonomy";

const MAX_PHOTOS = 5;

function Field({ f, v, set }: { f: FieldDef; v: string; set: (k: string, v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#4a4a4a" }}>
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

  if (!checked) return <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>;

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
    <div>
      <header style={{ background: m ? m.soft : "#f0f4f5", borderBottom: `3px solid ${m ? m.color : "var(--ink)"}` }}>
        <div className="container" style={{ padding: "14px 16px" }}>
          <Link href="/" className="wordmark">LAGON</Link>
        </div>
      </header>

      <main className="container" style={{ maxWidth: 640, paddingTop: 24, paddingBottom: 48 }}>
        <h1 style={{ fontFamily: "'Archivo', sans-serif", fontVariationSettings: "'wght' 800", fontSize: 24, margin: "0 0 4px" }}>
          Déposer une annonce
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
          {step === 0 ? "Étape 1 sur 3 · Choisissez l'univers"
            : step === 1 ? "Étape 2 sur 3 · Choisissez la catégorie"
            : "Étape 3 sur 3 · Décrivez votre annonce"}
        </p>

        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 16 }}>
            {MODULE_ORDER.map((key) => {
              const mm = MODULES[key];
              return (
                <button key={key}
                  onClick={() => { setMod(key); setSub(null); setAttrs({}); setShowMore(false); setStep(1); }}
                  style={{ border: `2px solid ${mm.color}`, background: mm.soft, borderRadius: 14, padding: "22px 16px",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 30 }}>{mm.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: mm.dark, marginTop: 6 }}>{mm.label}</div>
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

        {step === 2 && m && sub && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, color: m.dark, background: m.soft, padding: "4px 12px", borderRadius: 99 }}>
              {m.label} · {sub}
            </span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'annonce" maxLength={100} style={{ fontSize: 15 }} />
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Description" rows={4} maxLength={5000} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: 12 }}>
              <input className="input" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="Prix (€) — laisser vide si à discuter" inputMode="decimal" style={{ flex: 1 }} />
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Quartier (ex. Lorient)" style={{ flex: 1 }} />
            </div>
            <input className="input" value={phoneWa} onChange={(e) => setPhoneWa(e.target.value)}
              placeholder="Numéro WhatsApp (ex. +590690XXXXXX)" inputMode="tel" />

            {fields.length > 0 && (
              <div style={{ border: `1.5px solid ${m.color}33`, background: m.soft + "66", borderRadius: 12, padding: "14px 14px 16px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: m.dark, marginBottom: 10, letterSpacing: ".03em", textTransform: "uppercase" }}>
                  Détails · {sub}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {baseFields.map((f) => <Field key={f.k} f={f} v={attrs[f.k] || ""} set={setAttr} />)}
                  {showMore && advFields.map((f) => <Field key={f.k} f={f} v={attrs[f.k] || ""} set={setAttr} />)}
                </div>
                {advFields.length > 0 && (
                  <button onClick={() => setShowMore(!showMore)}
                    style={{ marginTop: 12, background: "#fff", border: `1.5px solid ${m.color}`, color: m.dark,
                      borderRadius: 99, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {showMore
                      ? "− Masquer les détails supplémentaires"
                      : `+ Plus de détails (${advFields.length} champs${advFilled ? `, ${advFilled} rempli${advFilled > 1 ? "s" : ""}` : ""})`}
                  </button>
                )}
                <div style={{ fontSize: 11.5, color: "#8a8a8a", marginTop: 10 }}>
                  Tous ces champs sont facultatifs, mais une annonce détaillée se vend plus vite.
                </div>
              </div>
            )}

            <div>
              <label htmlFor="photos" style={{
                display: "block", border: "2px dashed var(--border-input)", borderRadius: 12,
                padding: "22px 0", textAlign: "center", color: "#9a9a9a", fontSize: 13, cursor: "pointer",
              }}>
                📷 {files.length === 0 ? `Ajouter des photos (${MAX_PHOTOS} max)` : `${files.length} photo${files.length > 1 ? "s" : ""} sélectionnée${files.length > 1 ? "s" : ""} — cliquer pour changer`}
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

            {error && <p style={{ color: "#b0341f", fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button className="btn" disabled={title.trim().length < 3 || publishing} onClick={publish}
              style={{ background: m.color, padding: "13px 0", fontSize: 15 }}>
              {publishing ? "Publication…" : "Publier l'annonce"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 16 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
              ← Retour
            </button>
          )}
          <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13 }}>Annuler</Link>
        </div>
      </main>
    </div>
  );
}
