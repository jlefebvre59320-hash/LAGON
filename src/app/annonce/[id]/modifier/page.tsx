"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/Brand";
import { compressImage, thumbKey } from "@/lib/images";
import { supabase } from "@/lib/supabase";
import { fieldsFor, INTENT_LABEL, INTENT_ORDER, MODULES, type FieldDef, type Intent } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { connexionUrl, normalizePhoneNumber } from "@/lib/urls";

type Photo = { id: string; storage_key: string; position: number };
type EditableListing = Omit<Listing, "photos"> & { photos: Photo[] };

function DetailField({ field, value, onChange }: {
  field: FieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "#4a5654" }}>
      {field.k}
      {field.t === "select" ? (
        <select className="input" value={value} onChange={(event) => onChange(field.k, event.target.value)}>
          <option value="">—</option>
          {field.o?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(field.k, event.target.value)}
          inputMode={field.t === "number" ? "numeric" : "text"}
          placeholder={field.ph ?? ""}
        />
      )}
    </label>
  );
}

export default function ModifierAnnonce() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [listing, setListing] = useState<EditableListing | null>(null);
  const [checked, setChecked] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [phoneWa, setPhoneWa] = useState("");
  const [intent, setIntent] = useState<Intent>("offer");
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabase();
      const { data: authData } = await sb.auth.getSession();
      const session = authData.session;
      if (!session) {
        router.replace(connexionUrl(`/annonce/${id}/modifier`));
        return;
      }

      const [{ data, error: listingError }, { data: profile }] = await Promise.all([
        sb.from("listings")
          .select("*, photos:listing_photos(id, storage_key, position)")
          .eq("id", id)
          .eq("user_id", session.user.id)
          .maybeSingle(),
        sb.from("profiles").select("phone_wa").eq("id", session.user.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (listingError || !data) {
        setError("Cette annonce n’existe pas ou ne vous appartient pas.");
        setChecked(true);
        return;
      }

      const current = data as EditableListing;
      const cleanAttrs = Object.fromEntries(
        Object.entries(current.attrs ?? {}).map(([key, value]) => [key, String(value ?? "")]),
      );
      current.photos = [...(current.photos ?? [])].sort((a, b) => a.position - b.position);
      setUserId(session.user.id);
      setListing(current);
      setTitle(current.title);
      setDescription(current.description);
      setPrice(current.price_cents == null ? "" : String(current.price_cents / 100));
      setLocation(current.location);
      setPhoneWa(profile?.phone_wa ?? "");
      setIntent(current.intent);
      setAttrs(cleanAttrs);
      setChecked(true);
    })();
    return () => { alive = false; };
  }, [id, router]);

  const fields = listing ? fieldsFor(listing.module, listing.subcategory) : [];
  const moduleInfo = listing ? MODULES[listing.module] : null;
  const maxNewPhotos = Math.max(0, 5 - (listing?.photos.length ?? 0));

  async function save() {
    if (!listing || !userId || title.trim().length < 3) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    const numericPrice = price.trim() === "" ? null : Number.parseFloat(price.replace(",", "."));
    if (numericPrice != null && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
      setError("Le prix indiqué n’est pas valide.");
      setSaving(false);
      return;
    }
    const normalizedPhone = phoneWa.trim() ? normalizePhoneNumber(phoneWa) : null;
    if (phoneWa.trim() && !normalizedPhone) {
      setError("Le numéro WhatsApp doit être au format international, par exemple +590690XXXXXX.");
      setSaving(false);
      return;
    }

    const sb = supabase();
    const cleanAttrs = Object.fromEntries(Object.entries(attrs).filter(([, value]) => value.trim() !== ""));
    const { error: profileError } = await sb.from("profiles")
      .update({ phone_wa: normalizedPhone })
      .eq("id", userId);
    if (profileError) {
      setError(`Le numéro de contact n’a pas pu être enregistré : ${profileError.message}`);
      setSaving(false);
      return;
    }

    const { data: updated, error: updateError } = await sb.from("listings")
      .update({
        title: title.trim(),
        description: description.trim(),
        price_cents: numericPrice == null ? null : Math.round(numericPrice * 100),
        location: location.trim() || "Saint-Barthélemy",
        intent,
        attrs: cleanAttrs,
      })
      .eq("id", listing.id)
      .eq("user_id", userId)
      .select("id");
    if (updateError || !updated || updated.length === 0) {
      setError(updateError?.message ?? "La base a refusé la modification de cette annonce.");
      setSaving(false);
      return;
    }

    const uploadedKeys: string[] = [];
    const insertedPhotoIds: string[] = [];
    const addedPhotos: Photo[] = [];
    try {
      const basePosition = listing.photos.reduce((max, photo) => Math.max(max, photo.position), -1) + 1;
      for (let index = 0; index < files.length; index += 1) {
        const { full, thumb } = await compressImage(files[index]);
        if (!full.type.match(/^image\/(jpeg|png|webp)$/) || full.size > 5 * 1024 * 1024) {
          throw new Error("photo");
        }
        const extension = full.name.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${userId}/${listing.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await sb.storage.from("photos").upload(key, full, { upsert: false });
        if (uploadError) throw uploadError;
        uploadedKeys.push(key);
        const position = basePosition + index;
        const { data: photoRow, error: photoError } = await sb.from("listing_photos")
          .insert({ listing_id: listing.id, storage_key: key, position })
          .select("id, storage_key, position")
          .single();
        if (photoError || !photoRow) throw photoError ?? new Error("photo");
        insertedPhotoIds.push(photoRow.id);
        addedPhotos.push(photoRow as Photo);
        if (thumb) {
          const thumbnailKey = thumbKey(key);
          const { error: thumbError } = await sb.storage.from("photos").upload(thumbnailKey, thumb, { upsert: false });
          if (!thumbError) uploadedKeys.push(thumbnailKey);
        }
      }
    } catch (cause) {
      if (insertedPhotoIds.length > 0) await sb.from("listing_photos").delete().in("id", insertedPhotoIds);
      if (uploadedKeys.length > 0) await sb.storage.from("photos").remove(uploadedKeys);
      setListing({ ...listing, title: title.trim(), description: description.trim(), intent, attrs: cleanAttrs });
      setError(cause instanceof Error && cause.message === "photo"
        ? "L’annonce a été modifiée, mais une photo n’a pas pu être préparée."
        : "L’annonce a été modifiée, mais les nouvelles photos n’ont pas pu être ajoutées.");
      setSaving(false);
      return;
    }

    setListing({
      ...listing,
      title: title.trim(),
      description: description.trim(),
      price_cents: numericPrice == null ? null : Math.round(numericPrice * 100),
      location: location.trim() || "Saint-Barthélemy",
      intent,
      attrs: cleanAttrs,
      photos: [...listing.photos, ...addedPhotos],
    });
    setFiles([]);
    setNotice("Modifications enregistrées.");
    setSaving(false);
  }

  async function removePhoto(photo: Photo) {
    if (!listing || !confirm("Supprimer cette photo ?")) return;
    setRemovingPhoto(photo.id);
    setError(null);
    const sb = supabase();
    const { data, error: rowError } = await sb.from("listing_photos")
      .delete()
      .eq("id", photo.id)
      .eq("listing_id", listing.id)
      .select("id");
    if (rowError || !data || data.length === 0) {
      setError(rowError?.message ?? "La photo n’a pas pu être supprimée.");
      setRemovingPhoto(null);
      return;
    }
    const { error: storageError } = await sb.storage.from("photos").remove([
      photo.storage_key,
      thumbKey(photo.storage_key),
    ]);
    setListing({ ...listing, photos: listing.photos.filter((item) => item.id !== photo.id) });
    if (storageError) setError("La photo est retirée de l’annonce, mais le fichier n’a pas pu être nettoyé.");
    setRemovingPhoto(null);
  }

  if (!checked) return (
    <><SiteHeader /><main className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</main></>
  );

  if (!listing || !moduleInfo) return (
    <><SiteHeader /><main className="container" style={{ maxWidth: 640, padding: "40px 16px" }}>
      <h1 style={{ fontSize: 24 }}>Modifier l’annonce</h1>
      <p style={{ color: "var(--danger)" }}>{error}</p>
      <Link href="/mon-espace" className="btn">Retour à mon espace</Link>
    </main></>
  );

  const photoBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/`;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader accent={moduleInfo.color} />
      <main className="container" style={{ maxWidth: 680, paddingTop: 24, paddingBottom: 56, flex: 1 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Modifier l’annonce</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
          {moduleInfo.label} · {listing.subcategory}
        </p>

        {listing.status === "removed" ? (
          <div className="panel" style={{ padding: 18 }}>
            <p style={{ marginTop: 0 }}>Cette annonce a été retirée par la modération et ne peut plus être modifiée.</p>
            <Link href="/mon-espace" className="btn">Retour à mon espace</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
            <div role="radiogroup" aria-label="Sens de l’annonce" style={{ display: "flex", gap: 4, background: "var(--cream-dark)", borderRadius: 999, padding: 4 }}>
              {INTENT_ORDER.map((value) => (
                <button key={value} type="button" role="radio" aria-checked={intent === value} onClick={() => setIntent(value)}
                  style={{ flex: 1, minHeight: 42, borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: intent === value ? moduleInfo.color : "transparent", color: intent === value ? "#fff" : "var(--text-muted)" }}>
                  {INTENT_LABEL[listing.module][value]}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700 }}>Titre
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={100} style={{ marginTop: 5 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Description
              <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={5} style={{ marginTop: 5, resize: "vertical" }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Prix ou budget (€)
                <input className="input" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="Vide si à discuter" style={{ marginTop: 5 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Quartier
                <input className="input" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} style={{ marginTop: 5 }} />
              </label>
            </div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Numéro WhatsApp
              <input className="input" value={phoneWa} onChange={(event) => setPhoneWa(event.target.value)} inputMode="tel" placeholder="+590690XXXXXX" style={{ marginTop: 5 }} />
            </label>

            {fields.length > 0 && (
              <section style={{ border: `1px solid ${moduleInfo.color}33`, background: `${moduleInfo.soft}66`, borderRadius: 14, padding: 14 }}>
                <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", color: moduleInfo.dark, margin: "0 0 12px" }}>Détails</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  {fields.map((field) => (
                    <DetailField key={field.k} field={field} value={attrs[field.k] ?? ""} onChange={(key, value) => setAttrs((current) => ({ ...current, [key]: value }))} />
                  ))}
                </div>
              </section>
            )}

            <section className="panel" style={{ padding: 14 }}>
              <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Photos ({listing.photos.length}/5)</h2>
              {listing.photos.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {listing.photos.map((photo, index) => (
                    <div key={photo.id} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoBase + photo.storage_key} alt={`Photo ${index + 1}`} style={{ width: 100, height: 76, objectFit: "cover", borderRadius: 8 }} />
                      <button type="button" aria-label={`Supprimer la photo ${index + 1}`} disabled={removingPhoto === photo.id} onClick={() => removePhoto(photo)}
                        style={{ position: "absolute", top: 4, right: 4, width: 30, height: 30, borderRadius: 99, border: 0, background: "rgba(20,30,29,.82)", color: "white", cursor: "pointer", fontSize: 18 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {maxNewPhotos > 0 && (
                <>
                  <label htmlFor="new-listing-photos" className="btn btn-outline-gold" style={{ display: "inline-flex", cursor: "pointer", fontSize: 13 }}>
                    Ajouter {maxNewPhotos === 1 ? "une photo" : "des photos"}
                  </label>
                  <input id="new-listing-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }}
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, maxNewPhotos))} />
                </>
              )}
              {files.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {files.map((file, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${file.name}-${file.lastModified}`} src={previews[index]} alt={`Nouvelle photo ${index + 1}`} style={{ width: 100, height: 76, objectFit: "cover", borderRadius: 8 }} />
                  ))}
                </div>
              )}
            </section>

            {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
            {notice && <p role="status" style={{ color: "var(--green)", fontSize: 13, fontWeight: 700, margin: 0 }}>{notice}</p>}
            <button type="button" className="btn btn-block" disabled={saving || title.trim().length < 3} onClick={save} style={{ background: moduleInfo.color, padding: "15px 0" }}>
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <Link href={`/annonce/${listing.id}`} className="link-quiet">Voir l’annonce</Link>
          <Link href="/mon-espace" className="link-quiet">Retour à mon espace</Link>
        </div>
      </main>
    </div>
  );
}
