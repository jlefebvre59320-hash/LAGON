"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CUISINES, QUARTIERS, type HoursMap, type Restaurant } from "@/lib/food";
import { SiteHeader } from "@/components/Brand";
import HoursEditor from "@/components/food/HoursEditor";

/* Édition d'une fiche par son propriétaire (fiche revendiquée) ou par
   l'administration. La garde d'écran est doublée par le RLS : même en forçant
   l'URL, un update non autorisé est refusé par la base. */
export default function ModifierResto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [r, setR] = useState<Restaurant | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) { router.replace("/connexion"); return; }
      const [{ data }, { data: admin }] = await Promise.all([
        sb.from("restaurants").select("*").eq("id", id).single(),
        sb.rpc("is_admin"),
      ]);
      if (!data) { setAllowed(false); return; }
      const resto = data as Restaurant;
      setR(resto);
      setAllowed(resto.owner_id === session.session.user.id || admin === true);
    })();
  }, [id, router]);

  const set = <K extends keyof Restaurant>(k: K, v: Restaurant[K]) =>
    setR((prev) => (prev ? { ...prev, [k]: v } : prev));

  async function save() {
    if (!r || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    // On ne garde que les créneaux complets : un créneau à moitié rempli est
    // une saisie en cours, pas un horaire.
    const hours: HoursMap = {};
    for (const [d, slots] of Object.entries(r.hours ?? {})) {
      const full = (slots ?? []).filter(([a, b]) => a && b);
      if (full.length) hours[d as keyof HoursMap] = full as [string, string][];
    }

    const { error } = await supabase()
      .from("restaurants")
      .update({
        name: r.name.trim(),
        cuisine: r.cuisine,
        quartier: r.quartier,
        address: r.address.trim(),
        phone: r.phone?.trim() || null,
        whatsapp: r.whatsapp?.trim() || null,
        instagram: r.instagram?.trim().replace(/^@/, "") || null,
        facebook: r.facebook?.trim() || null,
        website: r.website?.trim() || null,
        snapchat: r.snapchat?.trim().replace(/^@/, "") || null,
        tiktok: r.tiktok?.trim().replace(/^@/, "") || null,
        email: r.email?.trim() || null,
        description: r.description.trim(),
        price_range: r.price_range,
        avg_price_eur: r.avg_price_eur ?? null,
        takeaway: r.takeaway,
        status: r.status,
        hours,
      })
      .eq("id", r.id);

    setSaving(false);
    if (error) setError("Enregistrement impossible. Vérifiez les champs et réessayez.");
    else setSaved(true);
  }

  if (allowed === null || (allowed && !r)) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  if (!allowed) return (
    <>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 56 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>Fiche non modifiable</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Seul le propriétaire de l&apos;établissement peut modifier cette fiche.
            Si c&apos;est le vôtre, utilisez « C&apos;est votre établissement ? » en bas de la fiche.
          </p>
          <Link href={`/food/resto/${id}`} className="btn" style={{ marginTop: 8 }}>Voir la fiche</Link>
        </div>
      </main>
    </>
  );

  const rr = r!;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ maxWidth: 640, paddingTop: 24, paddingBottom: 56, flex: 1 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Modifier la fiche</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 18px" }}>
          <Link href={`/food/resto/${rr.id}`} style={{ color: "inherit" }}>← Voir la fiche publique</Link>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nom de l'établissement">
            <input className="input" value={rr.name} maxLength={80}
              onChange={(e) => set("name", e.target.value)} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <Field label="Cuisine">
              <select className="input" value={rr.cuisine} onChange={(e) => set("cuisine", e.target.value)}>
                {CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Quartier">
              <select className="input" value={rr.quartier} onChange={(e) => set("quartier", e.target.value)}>
                {QUARTIERS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Adresse">
            <input className="input" value={rr.address} onChange={(e) => set("address", e.target.value)}
              placeholder="ex : Rue de la République" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <Field label="Téléphone">
              <input className="input" value={rr.phone ?? ""} inputMode="tel"
                onChange={(e) => set("phone", e.target.value)} placeholder="+590590XXXXXX" />
            </Field>
            <Field label="WhatsApp">
              <input className="input" value={rr.whatsapp ?? ""} inputMode="tel"
                onChange={(e) => set("whatsapp", e.target.value)} placeholder="+590690XXXXXX" />
            </Field>
            <Field label="Instagram (sans @)">
              <input className="input" value={rr.instagram ?? ""}
                onChange={(e) => set("instagram", e.target.value)} placeholder="votrecompte" />
            </Field>
            <Field label="Facebook (adresse de la page)">
              <input className="input" value={rr.facebook ?? ""} inputMode="url"
                onChange={(e) => set("facebook", e.target.value)} placeholder="https://facebook.com/…" />
            </Field>
            <Field label="Site web">
              <input className="input" value={rr.website ?? ""} inputMode="url"
                onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Snapchat (sans @)">
              <input className="input" value={rr.snapchat ?? ""}
                onChange={(e) => set("snapchat", e.target.value)} placeholder="votrecompte" />
            </Field>
            <Field label="TikTok (sans @)">
              <input className="input" value={rr.tiktok ?? ""}
                onChange={(e) => set("tiktok", e.target.value)} placeholder="votrecompte" />
            </Field>
            <Field label="Email de contact">
              <input className="input" value={rr.email ?? ""} inputMode="email"
                onChange={(e) => set("email", e.target.value)} placeholder="contact@…" />
            </Field>
          </div>

          <Field label="Présentation">
            <textarea className="input" rows={4} value={rr.description} maxLength={2000}
              onChange={(e) => set("description", e.target.value)} style={{ resize: "vertical" }} />
          </Field>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <Field label="Gamme de prix">
              <div style={{ display: "flex", gap: 4 }}>
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} type="button" className="chip"
                    onClick={() => set("price_range", n)}
                    style={rr.price_range === n ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}>
                    {"€".repeat(n)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Prix moyen / personne (€)">
              <input className="input" value={rr.avg_price_eur ?? ""} inputMode="numeric"
                onChange={(e) => set("avg_price_eur", e.target.value ? parseInt(e.target.value.replace(/\D/g, ""), 10) || null : null)}
                placeholder="ex : 35" style={{ width: 120 }} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", marginTop: 14 }}>
              <input type="checkbox" checked={rr.takeaway} onChange={(e) => set("takeaway", e.target.checked)} />
              Vente à emporter
            </label>
          </div>

          <Field label="Horaires">
            <HoursEditor value={rr.hours ?? {}} onChange={(h) => set("hours", h)} />
          </Field>

          <Field label="Visibilité">
            <select className="input" value={rr.status}
              onChange={(e) => set("status", e.target.value as Restaurant["status"])}>
              <option value="active">En ligne</option>
              <option value="hidden">Masquée (fermeture, congés…)</option>
            </select>
          </Field>

          {error && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
          {saved && (
            <p style={{ color: "var(--green)", fontSize: 13, margin: 0, background: "var(--green-100)", padding: "10px 12px", borderRadius: 10 }}>
              ✓ Fiche enregistrée. <Link href={`/food/resto/${rr.id}`}>Voir le résultat</Link>
            </p>
          )}

          <button className="btn btn-block" onClick={save} disabled={saving || rr.name.trim().length < 2}
            style={{ padding: "15px 0", fontSize: 15.5 }}>
            {saving ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#4a5654" }}>
      {label}
      {children}
    </label>
  );
}
