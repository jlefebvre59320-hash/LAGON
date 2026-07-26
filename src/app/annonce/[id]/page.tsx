"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, INTENT_BADGE, eur, priceSuffix } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { photoUrl } from "@/components/ListingCard";
import { SiteHeader, Mark } from "@/components/Brand";
import FavoriteButton from "@/components/FavoriteButton";
import { FavoritesProvider } from "@/lib/favorites";
import { recordView } from "@/lib/analytics";

export default function AnnoncePage() {
  return (
    <FavoritesProvider>
      <Annonce />
    </FavoritesProvider>
  );
}

function Annonce() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [l, setL] = useState<Listing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    (async () => {
      /* profiles est nommé par sa clé étrangère : depuis que la table favorites
         relie listings et profiles, il existe deux chemins entre les deux
         (le lien direct et le passage par les favoris) et PostgREST refuse de
         choisir. Sans !listings_user_id_fkey, la requête échoue. */
      const { data, error } = await supabase()
        .from("listings")
        .select(
          "*, photos:listing_photos(storage_key, position), profile:profiles!listings_user_id_fkey(display_name, phone_wa)"
        )
        .eq("id", id)
        .single();

      if (data) {
        setL(data as Listing);
        recordView(`/annonce/${id}`, id);
        return;
      }
      // PGRST116 = aucune ligne : l'annonce n'existe vraiment plus. Toute autre
      // erreur est un problème technique et doit se dire comme tel, pas se
      // déguiser en annonce supprimée.
      if (error && error.code !== "PGRST116") {
        console.error("Chargement de l'annonce :", error);
        setLoadError(error.message);
      } else {
        setNotFound(true);
      }
    })();
  }, [id]);

  if (loadError) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center", maxWidth: 480 }}>
        <p style={{ fontWeight: 700, color: "var(--danger)" }}>Impossible d&apos;afficher cette annonce.</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{loadError}</p>
        <Link href="/">← Retour aux annonces</Link>
      </div>
    </>
  );

  if (notFound) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>Cette annonce n&apos;existe plus.</p>
        <Link href="/">← Retour aux annonces</Link>
      </div>
    </>
  );
  if (!l) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const m = MODULES[l.module];
  const photos = (l.photos ?? []).slice().sort((a, b) => a.position - b.position);
  const price = eur(l.price_cents);
  const attrs = Object.entries(l.attrs ?? {}).filter(([, v]) => v !== "" && v != null);
  const wanted = l.intent === "wanted";
  const badge = INTENT_BADGE[l.intent ?? "offer"];
  const wa = l.profile?.phone_wa
    ? `https://wa.me/${l.profile.phone_wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour, je vous contacte au sujet de votre annonce "${l.title}" sur Ti Kanal.`)}`
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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader accent={m.color} />

      <main className="container" style={{ paddingTop: 16, paddingBottom: 110, maxWidth: 740, flex: 1 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Toutes les annonces</Link>

        <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", background: m.soft, border: "1px solid var(--border)" }}>
          {photos.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(photos[photoIdx].storage_key)} alt={l.title}
                style={{ width: "100%", aspectRatio: "4 / 3", maxHeight: 460, objectFit: "cover", display: "block" }} />
              {photos.length > 1 && (
                <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: 8, background: "var(--surface)", overflowX: "auto" }}>
                  {photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.storage_key} src={photoUrl(p.storage_key)} alt=""
                      onClick={() => setPhotoIdx(i)}
                      style={{ width: 68, height: 52, flex: "0 0 auto", objectFit: "cover", borderRadius: 8, cursor: "pointer",
                        outline: i === photoIdx ? `2px solid ${m.color}` : "none", outlineOffset: -2 }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ aspectRatio: "16 / 9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mark size={150} color={m.color} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0 8px" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
            color: m.dark, background: m.soft, padding: "5px 12px", borderRadius: 99 }}>
            {m.label} · {l.subcategory}
          </span>
          {badge && (
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              color: "var(--gold-light)", background: "var(--green)", padding: "5px 12px", borderRadius: 99 }}>
              {badge}
            </span>
          )}
        </div>
        <h1 style={{ margin: "2px 0 8px", fontSize: 24, lineHeight: 1.2 }}>{l.title}</h1>
        <div className="price" style={{ fontSize: 27, color: m.color }}>
          {price == null
            ? wanted ? "Budget à discuter" : l.module === "job" ? "Selon profil" : "Prix à discuter"
            : (wanted ? "Budget " : "") + price + priceSuffix(l.module, l.subcategory)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "6px 0 18px" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {l.location} · publié le {new Date(l.created_at).toLocaleDateString("fr-FR")}
            {l.profile?.display_name ? ` · par ${l.profile.display_name}` : ""}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <FavoriteButton listingId={l.id} variant="plain" label />
          </span>
        </div>

        {attrs.length > 0 && (
          <div className="panel" style={{ marginBottom: 18, overflow: "hidden" }}>
            {attrs.map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 14px",
                borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
                <span style={{ color: "var(--text-muted)" }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {l.description && (
          <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#33403f" }}>{l.description}</p>
        )}

        <div style={{ marginTop: 18 }}>
          {reported ? (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>✓ Annonce signalée, merci.</span>
          ) : (
            <button onClick={report} disabled={reporting} className="link-quiet" style={{ fontSize: 12 }}>
              Signaler cette annonce
            </button>
          )}
        </div>
      </main>

      {/* Contact : barre collée en bas sur mobile, à portée de pouce */}
      <div
        style={{
          position: "sticky", bottom: 0, zIndex: 30,
          background: "rgba(246,242,233,.94)", backdropFilter: "blur(8px)",
          borderTop: "1px solid var(--border)",
          padding: `10px 0 calc(10px + env(safe-area-inset-bottom))`,
        }}
      >
        <div className="container" style={{ maxWidth: 740 }}>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-block"
              style={{ background: "var(--wa)", fontSize: 15.5, padding: "14px 0" }}>
              Contacter sur WhatsApp
            </a>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
              Le vendeur n&apos;a pas renseigné de numéro WhatsApp.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
