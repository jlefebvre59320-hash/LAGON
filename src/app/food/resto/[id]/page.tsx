"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  DAY_LABEL, DAY_ORDER, MIN_RATINGS, formatDay, hasHours, isOpenNow, islandNow,
  mapsUrl, priceLabel, type RatingSummary, type Restaurant,
} from "@/lib/food";
import { StarInput, StarRow } from "@/components/food/Stars";
import { SiteHeader, Mark } from "@/components/Brand";
import CuisineIcon from "@/components/food/CuisineIcon";
import { recordView } from "@/lib/analytics";
import { useSession } from "@/lib/session";
import { FavoritesProvider } from "@/lib/favorites";
import FavoriteButton from "@/components/FavoriteButton";
import { SITE_URL } from "@/lib/siteUrl";

type ClaimKind = "claim" | "correction" | "removal";

const CLAIM_LABEL: Record<ClaimKind, string> = {
  claim: "C'est mon établissement, je veux gérer cette fiche",
  correction: "Une information est fausse ou dépassée",
  removal: "Je demande le retrait de cette fiche",
};

export default function RestoPage() {
  return (
    <FavoritesProvider kind="restaurant">
      <Resto />
    </FavoritesProvider>
  );
}

function Resto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const [r, setR] = useState<Restaurant | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [rateBusy, setRateBusy] = useState(false);

  const [claimOpen, setClaimOpen] = useState(false);
  const [kind, setKind] = useState<ClaimKind>("claim");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase()
        .from("restaurants").select("*").eq("id", id).single();
      if (data) {
        setR(data as Restaurant);
        recordView(`/food/resto/${id}`);
        loadRatings();
        return;
      }
      if (error && error.code !== "PGRST116") setLoadError(error.message);
      else setNotFound(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadRatings() {
    const sb = supabase();
    const [{ data: sums }, { data: mine }] = await Promise.all([
      sb.rpc("ratings_summary"),
      // RLS : cette lecture ne rend que la note de l'appelant, ou rien.
      sb.from("restaurant_ratings").select("rating").eq("restaurant_id", id).maybeSingle(),
    ]);
    const row = ((sums as ({ restaurant_id: string } & RatingSummary)[]) ?? [])
      .find((s) => s.restaurant_id === id);
    setSummary(row ? { avg_rating: Number(row.avg_rating), votes: Number(row.votes) } : null);
    setMyRating((mine as { rating: number } | null)?.rating ?? null);
  }

  async function rate(n: number) {
    if (rateBusy) return;
    const { data: session } = await supabase().auth.getSession();
    if (!session.session) { router.push("/connexion"); return; }
    setRateBusy(true);
    const prev = myRating;
    setMyRating(n);
    const { error } = await supabase().from("restaurant_ratings").upsert({
      restaurant_id: id,
      user_id: session.session.user.id,
      rating: n,
      updated_at: new Date().toISOString(),
    });
    if (error) setMyRating(prev);
    else loadRatings();
    setRateBusy(false);
  }

  async function sendClaim() {
    if (message.trim().length < 3 || contact.trim().length < 3 || sending) return;
    setSending(true);
    setClaimError(null);
    const { data: session } = await supabase().auth.getSession();
    const { error } = await supabase().from("restaurant_claims").insert({
      restaurant_id: id,
      kind,
      message: message.trim().slice(0, 1000),
      contact: contact.trim().slice(0, 200),
      user_id: session.session?.user.id ?? null,
    });
    setSending(false);
    if (error) setClaimError("Envoi impossible. Réessayez dans un instant.");
    else setSent(true);
  }

  if (notFound) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>Cette adresse n&apos;est plus référencée.</p>
        <Link href="/food">← Tous les restaurants</Link>
      </div>
    </>
  );
  if (loadError) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center", maxWidth: 480 }}>
        <p style={{ fontWeight: 700, color: "var(--danger)" }}>Impossible d&apos;afficher cette fiche.</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{loadError}</p>
        <Link href="/food">← Tous les restaurants</Link>
      </div>
    </>
  );
  if (!r) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const known = hasHours(r.hours);
  const open = known && isOpenNow(r.hours);
  const today = islandNow().day;
  const wa = r.whatsapp
    ? `https://wa.me/${r.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour, je vous contacte via St Barth Food.`)}`
    : null;

  /* Données structurées : Google comprend la fiche (nom, cuisine, téléphone,
     note) et peut l'afficher enrichie dans ses résultats. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    servesCuisine: r.cuisine,
    priceRange: "€".repeat(r.price_range),
    telephone: r.phone ?? undefined,
    url: `${SITE_URL}/food/resto/${r.id}`,
    address: { "@type": "PostalAddress", streetAddress: r.address || r.quartier, addressLocality: "Saint-Barthélemy", postalCode: "97133", addressCountry: "FR" },
    ...(summary && summary.votes >= MIN_RATINGS
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: summary.avg_rating, ratingCount: summary.votes, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="container" style={{ paddingTop: 16, paddingBottom: 110, maxWidth: 740, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <Link href="/food" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Tous les restaurants</Link>
          <span style={{ marginLeft: "auto" }}><FavoriteButton targetId={r.id} variant="plain" label /></span>
          {userId && r.owner_id === userId && (
            <Link href={`/food/resto/${r.id}/modifier`} className="btn btn-outline-gold"
              style={{ color: "var(--gold-deep)", borderColor: "var(--border-input)", fontSize: 12.5, padding: "8px 14px", minHeight: 36 }}>
              Modifier ma fiche
            </Link>
          )}
        </div>

        <div className="panel gold-frame" style={{ marginTop: 12, padding: "22px 18px", textAlign: "center",
          background: "linear-gradient(150deg, var(--surface), var(--cream))" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <CuisineIcon cuisine={r.cuisine} size={84} />
          </div>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 36px)", margin: "0 0 6px" }}>{r.name}</h1>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            <Badge>{r.cuisine}</Badge>
            <Badge>{r.quartier}</Badge>
            <Badge>{priceLabel(r.price_range)}{r.avg_price_eur ? ` · ~${r.avg_price_eur}\u00A0€/pers.` : ""}</Badge>
            {r.takeaway && <Badge>À emporter</Badge>}
          </div>
          {summary && summary.votes >= MIN_RATINGS && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 10 }}>
              <StarRow value={summary.avg_rating} size={17} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{summary.avg_rating.toLocaleString("fr-FR")}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>({summary.votes} avis)</span>
            </div>
          )}
          {known && (
            <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700, color: open ? "#1f7a4d" : "var(--text-muted)" }}>
              {open ? "Ouvert en ce moment" : "Fermé en ce moment"}
              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                {" "}· aujourd&apos;hui : {formatDay(r.hours[today])}
              </span>
            </div>
          )}
        </div>

        {/* Noter : un geste, modifiable, réservé aux comptes connectés. */}
        <div className="panel" style={{ marginTop: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {myRating ? "Votre note" : "Notez cet établissement"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {userId
                ? myRating ? "Appuyez pour la modifier." : "Une note par compte, modifiable à tout moment."
                : "Connectez-vous pour noter."}
              {summary && summary.votes > 0 && summary.votes < MIN_RATINGS &&
                ` La moyenne s'affichera à partir de ${MIN_RATINGS} avis.`}
            </div>
          </div>
          <StarInput value={myRating} onRate={rate} disabled={rateBusy} />
        </div>

        {r.description && (
          <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text)", marginTop: 18 }}>
            {r.description}
          </p>
        )}

        {known && (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Horaires</h2>
            <div className="panel" style={{ overflow: "hidden" }}>
              {DAY_ORDER.map((d, i) => (
                <div key={d} style={{
                  display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 14px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 13.5,
                  background: d === today ? "var(--cream)" : "transparent",
                  fontWeight: d === today ? 700 : 400,
                }}>
                  <span style={{ color: d === today ? "var(--text)" : "var(--text-muted)" }}>{DAY_LABEL[d]}</span>
                  <span style={{ textAlign: "right" }}>{formatDay(r.hours[d])}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Adresse</h2>
          <div className="panel" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5 }}>{r.address || r.quartier} · Saint-Barthélemy</span>
            <a href={mapsUrl(r)} target="_blank" rel="noopener noreferrer" className="btn btn-outline-gold"
              style={{ color: "var(--gold-deep)", borderColor: "var(--border-input)", fontSize: 13, padding: "9px 14px", minHeight: 38 }}>
              Itinéraire
            </a>
          </div>
        </section>

        {(r.instagram || r.facebook || r.website) && (
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap", fontSize: 13 }}>
            {r.instagram && (
              <a href={`https://instagram.com/${r.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--gold-deep)", fontWeight: 600 }}>
                Instagram ↗
              </a>
            )}
            {r.facebook && (
              <a href={r.facebook} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-deep)", fontWeight: 600 }}>
                Facebook ↗
              </a>
            )}
            {r.website && (
              <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-deep)", fontWeight: 600 }}>
                Site web ↗
              </a>
            )}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 22, lineHeight: 1.5 }}>
          Informations rassemblées par St Barth Food, à vérifier auprès de l&apos;établissement.
          Réservation et commande directement auprès du restaurant.
        </p>

        {/* Revendication / correction / retrait — discret mais trouvable :
            c'est ce qui rend l'annuaire défendable. */}
        <div style={{ marginTop: 10 }}>
          {sent ? (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              ✓ Demande envoyée, nous revenons vers vous rapidement.
            </span>
          ) : !claimOpen ? (
            <button className="link-quiet" onClick={() => setClaimOpen(true)} style={{ fontSize: 12 }}>
              C&apos;est votre établissement ?
            </button>
          ) : (
            <div className="panel" style={{ padding: "14px 14px 16px", marginTop: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Votre établissement</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {(Object.keys(CLAIM_LABEL) as ClaimKind[]).map((k) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name="claim-kind" checked={kind === k} onChange={() => setKind(k)} style={{ marginTop: 2 }} />
                    {CLAIM_LABEL[k]}
                  </label>
                ))}
              </div>
              <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Précisez votre demande" maxLength={1000} style={{ resize: "vertical", marginBottom: 8 }} />
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)}
                placeholder="Comment vous joindre (téléphone ou email)" maxLength={200} style={{ marginBottom: 10 }} />
              {claimError && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{claimError}</p>}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button className="btn" onClick={sendClaim}
                  disabled={sending || message.trim().length < 3 || contact.trim().length < 3}
                  style={{ fontSize: 13.5, padding: "11px 18px" }}>
                  {sending ? "Envoi…" : "Envoyer la demande"}
                </button>
                <button className="link-quiet" onClick={() => setClaimOpen(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mise en relation : appeler ou écrire, à portée de pouce. */}
      {(r.phone || wa) && (
        <div
          style={{
            position: "sticky", bottom: 0, zIndex: 30,
            background: "color-mix(in srgb, var(--cream) 94%, transparent)", backdropFilter: "blur(8px)",
            borderTop: "1px solid var(--border)",
            padding: `10px 0 calc(10px + env(safe-area-inset-bottom))`,
          }}
        >
          <div className="container" style={{ maxWidth: 740, display: "flex", gap: 10 }}>
            {r.phone && (
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="btn"
                style={{ flex: 1, fontSize: 15, padding: "14px 0" }}>
                Appeler
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn"
                style={{ flex: 1, background: "var(--wa)", fontSize: 15, padding: "14px 0" }}>
                WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
      color: "var(--gold-deep)", background: "var(--cream-dark)", padding: "5px 12px", borderRadius: 99,
    }}>
      {children}
    </span>
  );
}
