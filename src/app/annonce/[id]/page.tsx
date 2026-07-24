"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { photoUrl } from "@/components/ListingCard";

export default function AnnoncePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [l, setL] = useState<Listing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase()
        .from("listings")
        .select("*, photos:listing_photos(storage_key, position), profile:profiles(display_name, phone_wa)")
        .eq("id", id)
        .single();
      if (error || !data) setNotFound(true);
      else setL(data as Listing);
    })();
  }, [id]);

  if (notFound) return (
    <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
      <p style={{ fontWeight: 700 }}>Cette annonce n'existe plus.</p>
      <Link href="/">← Retour aux annonces</Link>
    </div>
  );
  if (!l) return <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>;

  const m = MODULES[l.module];
  const photos = (l.photos ?? []).slice().sort((a, b) => a.position - b.position);
  const price = eur(l.price_cents);
  const attrs = Object.entries(l.attrs ?? {}).filter(([, v]) => v !== "" && v != null);
  const wa = l.profile?.phone_wa
    ? `https://wa.me/${l.profile.phone_wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour, je vous contacte au sujet de votre annonce "${l.title}" sur LAGON.`)}`
    : null;

  async function report() {
    const reason = prompt("Pourquoi signaler cette annonce ?");
    if (!reason || reason.trim().length < 3) return;
    setReporting(true);
    const { data: session } = await supabase().auth.getSession();
    if (!session.session) {
      router.push("/connexion");
      return;
    }
    const { error } = await supabase().from("reports").insert({
      listing_id: l!.id,
      reporter_id: session.session.user.id,
      reason: reason.trim().slice(0, 500),
    });
    setReporting(false);
    if (!error) setReported(true);
  }

  return (
    <div>
      <header style={{ background: m.soft, borderBottom: `3px solid ${m.color}` }}>
        <div className="container" style={{ padding: "14px 16px" }}>
          <Link href="/" className="wordmark">LAGON</Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 20, paddingBottom: 48, maxWidth: 720 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Toutes les annonces</Link>

        <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", background: `linear-gradient(135deg, ${m.soft}, ${m.color}33)` }}>
          {photos.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(photos[photoIdx].storage_key)} alt={l.title}
                style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
              {photos.length > 1 && (
                <div style={{ display: "flex", gap: 6, padding: 8, background: "#fff" }}>
                  {photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.storage_key} src={photoUrl(p.storage_key)} alt=""
                      onClick={() => setPhotoIdx(i)}
                      style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6, cursor: "pointer",
                        outline: i === photoIdx ? `2px solid ${m.color}` : "none" }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
              {m.icon}
            </div>
          )}
        </div>

        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: m.dark, background: m.soft, padding: "3px 10px", borderRadius: 99, margin: "14px 0 6px" }}>
          {m.label} · {l.subcategory}
        </span>
        <h1 style={{ margin: "2px 0 6px", fontSize: 22, lineHeight: 1.25 }}>{l.title}</h1>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontVariationSettings: "'wght' 850", fontSize: 26, color: m.color }}>
          {price == null
            ? l.module === "job" ? "Selon profil" : "Prix à discuter"
            : price + priceSuffix(l.module, l.subcategory)}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 16px" }}>
          {l.location} · publié le {new Date(l.created_at).toLocaleDateString("fr-FR")}
          {l.profile?.display_name ? ` · par ${l.profile.display_name}` : ""}
        </div>

        {attrs.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 16, background: "#fff" }}>
            {attrs.map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px",
                borderTop: i === 0 ? "none" : "1px solid #f2f2f0", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {l.description && (
          <p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "#3a3a3a" }}>{l.description}</p>
        )}

        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn"
            style={{ display: "block", textAlign: "center", background: "var(--wa)", fontSize: 15, padding: "13px 0", textDecoration: "none", marginTop: 12 }}>
            Contacter sur WhatsApp
          </a>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
            Le vendeur n'a pas renseigné de numéro WhatsApp.
          </p>
        )}

        <div style={{ marginTop: 14 }}>
          {reported ? (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>✓ Annonce signalée, merci.</span>
          ) : (
            <button onClick={report} disabled={reporting}
              style={{ background: "none", border: "none", color: "#9a9a9a", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 0 }}>
              Signaler cette annonce
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
