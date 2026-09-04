"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, intentBadge, eur, priceSuffix, prixAbsent } from "@/lib/taxonomy";
import type { Listing } from "@/lib/types";
import { photoUrl } from "@/components/ListingCard";
import { SiteHeader, Mark } from "@/components/Brand";
import FavoriteButton from "@/components/FavoriteButton";
import { FavoritesProvider } from "@/lib/favorites";
import { recordView } from "@/lib/analytics";
import { SITE_URL } from "@/lib/siteUrl";
import ShareButton from "@/components/ShareButton";
import { connexionUrl } from "@/lib/urls";
import { serializeJsonLd } from "@/lib/jsonLd";
import { thumbKey } from "@/lib/images";
import { MESSAGE_MAX, messageErreur } from "@/lib/messages";
import { EtoilesLecture } from "@/components/Etoiles";
import { noteCourte } from "@/lib/membre";
import { notifierParEmail } from "@/lib/notifierMessage";
import SignalerPanel from "@/components/SignalerPanel";
import AvertissementPaiement from "@/components/AvertissementPaiement";
import { RAISON_LABEL, MESSAGE_CONTENU_REFUSE, niveauRisque } from "@/lib/moderation";
import { noterRecent } from "@/lib/recents";

export default function AnnoncePage({ initialListing = null }: { initialListing?: Listing | null }) {
  return (
    <FavoritesProvider>
      <Annonce initialListing={initialListing} />
    </FavoritesProvider>
  );
}

function Annonce({ initialListing }: { initialListing: Listing | null }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [l, setL] = useState<Listing | null>(initialListing);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [signaler, setSignaler] = useState(false);
  const [reported, setReported] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dossierOuvert, setDossierOuvert] = useState<string | null>(null);
  const [moi, setMoi] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [messageTexte, setMessageTexte] = useState("");
  const [envoiMessage, setEnvoiMessage] = useState(false);
  const [messageErr, setMessageErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase().auth.getSession();
      if (!s.session) return;
      setMoi(s.session.user.id);
      // is_admin() ne répond que pour l'appelant : sans droits, false, point.
      const { data } = await supabase().rpc("is_admin");
      if (data === true) setIsAdmin(true);
    })();
  }, []);

  useEffect(() => {
    /* Mémorisée localement pour la rangée « Vues récemment » de Mon espace :
       on note la visite, pas le contenu. */
    noterRecent(id);
    if (initialListing) {
      recordView(`/annonce/${id}`, id);
      return;
    }
    (async () => {
      /* profiles est nommé par sa clé étrangère : depuis que la table favorites
         relie listings et profiles, il existe deux chemins entre les deux
         (le lien direct et le passage par les favoris) et PostgREST refuse de
         choisir. Sans !listings_user_id_fkey, la requête échoue. */
      const { data, error } = await supabase()
        .from("listings")
        .select(
          "*, photos:listing_photos(storage_key, position), profile:profiles!listings_user_id_fkey(display_name, phone_wa, allow_messages, rating_avg, rating_count)"
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
  }, [id, initialListing]);

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
  const sold = l.status === "sold";
  const attrs = Object.entries(l.attrs ?? {}).filter(([, v]) => v !== "" && v != null);
  const wanted = l.intent === "wanted";
  const badge = intentBadge(l.module, l.subcategory, l.intent ?? "offer");
  const wa = l.profile?.phone_wa
    ? `https://wa.me/${l.profile.phone_wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour, je vous contacte au sujet de votre annonce "${l.title}" sur Ti Kanal.`)}`
    : null;
  const monAnnonce = moi != null && moi === l.user_id;
  /* allow_messages n'existe qu'à partir de la migration 0025. Tant qu'elle
     n'est pas passée, la colonne est absente et la messagerie doit rester
     proposée : c'est le comportement par défaut voulu. */
  const messagerieOuverte = l.profile?.allow_messages !== false;
  /* Une annonce en attente ou retenue n'est visible que de son auteur et de
     l'administration (la RLS s'en charge) : si on la voit, c'est qu'on est
     l'un des deux, et il faut dire clairement dans quel état elle est. */
  const enVerification = l.review_state === "pending";
  const retenue = l.review_state === "blocked";
  const niveau = niveauRisque(l.risk_score ?? 0);

  /* Ouvrir le composeur — ou renvoyer vers la connexion. On ne laisse pas
     quelqu'un rédiger un message pour découvrir ensuite qu'il faut un compte :
     le détour se fait avant d'écrire, pas après. */
  async function ouvrirComposeur() {
    const { data: session } = await supabase().auth.getSession();
    if (!session.session) {
      router.push(connexionUrl(`/annonce/${l!.id}`));
      return;
    }
    setMessageErr(null);
    setComposer(true);
  }

  async function envoyerMessage(e: React.FormEvent) {
    e.preventDefault();
    const corps = messageTexte.trim();
    if (!corps || !l) return;
    setEnvoiMessage(true);
    setMessageErr(null);
    const { data, error } = await supabase().rpc("envoyer_message", {
      p_listing_id: l.id,
      p_body: corps,
    });
    setEnvoiMessage(false);
    if (error) {
      setMessageErr(messageErreur(error, "Le message n’est pas parti. Réessayez."));
      return;
    }
    void notifierParEmail(data as string);
    router.push(`/messages?c=${data as string}`);
  }

  /* Signaler demande un compte : le détour par la connexion se fait avant
     d'ouvrir le panneau, pas après avoir choisi un motif. */
  async function ouvrirSignalement() {
    const { data: session } = await supabase().auth.getSession();
    if (!session.session) {
      router.push(connexionUrl(`/annonce/${l!.id}`));
      return;
    }
    setMoi(session.session.user.id);
    setSignaler(true);
  }

  async function ouvrirDossier() {
    if (!l) return;
    const { error } = await supabase().rpc("admin_ouvrir_dossier", { p_listing_id: l.id });
    setDossierOuvert(error ? `Impossible d’ouvrir le dossier : ${error.message}` : "Dossier ouvert — retrouvez-le dans Administration › Modération.");
  }

  async function adminDelete() {
    if (!l) return;
    if (!confirm(`Supprimer définitivement « ${l.title} » ?\nPhotos, favoris et signalements partent avec. Irréversible.`)) return;
    setDeleting(true);
    const keys = (l.photos ?? []).flatMap((p) => [p.storage_key, thumbKey(p.storage_key)]);
    /* .select("id") force PostgREST à renvoyer les lignes supprimées : sans
       ça, une suppression refusée par la RLS (0 ligne touchée) passe pour
       un succès et l'annonce « toujours là » devient inexplicable. */
    const { data, error } = await supabase().from("listings").delete().eq("id", l.id).select("id");
    if (error || !data || data.length === 0) {
      setDeleting(false);
      alert(error
        ? `Suppression impossible : ${error.message}`
        : "La base a refusé la suppression. Vérifiez que la migration 0013 (droits de suppression admin) a bien été exécutée dans le SQL Editor.");
      return;
    }
    // Les fichiers du bucket ne suivent pas la cascade SQL : on les retire
    // ici. Un échec laisse au pire des fichiers orphelins, jamais une
    // annonce fantôme — l'inverse serait pire.
    if (keys.length > 0) {
      const { error: storageError } = await supabase().storage.from("photos").remove(keys);
      if (storageError) alert("L’annonce est supprimée, mais certaines photos nécessitent un nettoyage manuel.");
    }
    router.push("/");
  }

  const jsonLd = l.price_cents != null && l.intent !== "wanted" ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description?.slice(0, 300) || undefined,
    offers: { "@type": "Offer", price: (l.price_cents / 100).toFixed(2), priceCurrency: "EUR",
      availability: sold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${SITE_URL}/annonce/${l.id}` },
  } : null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
      <SiteHeader accent={m.color} />

      <main className="container" style={{ paddingTop: 16, paddingBottom: 110, maxWidth: 740, flex: 1 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Toutes les annonces</Link>

        {(enVerification || retenue) && (
          <div className={`verif-bandeau${retenue ? " retenue" : ""}`} role="status">
            <strong>
              {retenue ? MESSAGE_CONTENU_REFUSE : "Votre annonce est en cours de vérification."}
            </strong>
            <span>
              {l.moderation_note
                ? l.moderation_note
                : retenue
                  ? "Elle n’est pas visible du public et a été transmise à la modération. Si vous pensez à une erreur, écrivez-nous depuis « Donner un avis »."
                  : "Quelques éléments demandent un regard humain — c’est rapide, en général quelques heures. Elle paraîtra dès qu’un modérateur l’aura validée, sans que vous ayez rien à faire."}
            </span>
            {monAnnonce && !retenue && (
              <Link href={`/annonce/${l.id}/modifier`} className="link-quiet" style={{ fontSize: 12.5, color: "inherit", textDecoration: "underline" }}>
                Modifier l&apos;annonce
              </Link>
            )}
          </div>
        )}

        {sold && (
          <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, background: "var(--green)",
            color: "var(--gold-light)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase",
              background: "var(--gold)", color: "var(--green)", padding: "3px 10px", borderRadius: 99 }}>
              Vendu
            </span>
            Cette annonce a trouvé preneur.
          </div>
        )}

        <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", background: m.soft, border: "1px solid var(--border)" }}>
          {photos.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(photos[photoIdx].storage_key)} alt={l.title}
                style={{ width: "100%", aspectRatio: "4 / 3", maxHeight: 460, objectFit: "cover", display: "block" }} />
              {photos.length > 1 && (
                <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: 8, background: "var(--surface)", overflowX: "auto" }}>
                  {photos.map((p, i) => (
                    <button key={p.storage_key} type="button" onClick={() => setPhotoIdx(i)}
                      aria-label={`Afficher la photo ${i + 1}`}
                      aria-pressed={i === photoIdx}
                      style={{ width: 68, height: 52, flex: "0 0 auto", padding: 0, border: 0,
                        borderRadius: 8, cursor: "pointer", overflow: "hidden", background: m.soft,
                        outline: i === photoIdx ? `2px solid ${m.color}` : "none", outlineOffset: -2 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(thumbKey(p.storage_key))} alt=""
                        onError={(event) => {
                          const image = event.currentTarget;
                          const original = photoUrl(p.storage_key);
                          if (image.src !== original) image.src = original;
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
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

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0 8px", alignItems: "center" }}>
          {/* Sur la fiche, la pastille de sens passe devant la catégorie :
              savoir si l'annonce vend ou cherche change tout ce qu'on lit
              ensuite, à commencer par le prix. */}
          <span className={`intent-badge intent-${badge.sens} intent-grand`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {badge.sens === "wanted"
                ? <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5" /></>
                : <><path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5 12.5 20z" /><path d="M7.5 7.5h.01" /></>}
            </svg>
            {badge.texte}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
            color: m.dark, background: m.soft, padding: "5px 12px", borderRadius: 99 }}>
            {m.label} · {l.subcategory}
          </span>
        </div>
        <h1 style={{ margin: "2px 0 8px", fontSize: 24, lineHeight: 1.2 }}>{l.title}</h1>
        <div className="price price-hero" style={{ color: m.color }}>
          {price == null
            ? prixAbsent(l.module, l.intent ?? "offer")
            : (wanted ? "Budget " : "") + price + priceSuffix(l.module, l.subcategory)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "6px 0 18px" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {l.location} · publié le {new Date(l.created_at).toLocaleDateString("fr-FR")}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <ShareButton
              title={l.title}
              text={`${l.title}${price ? ` — ${price}` : ""} sur Ti Kanal`}
              url={`${SITE_URL}/annonce/${l.id}`}
            />
            <FavoriteButton targetId={l.id} variant="plain" label />
          </span>
        </div>

        {/* Qui vend : le nom mène à la fiche publique — ancienneté, annonces,
            avis — pour savoir à qui on a affaire avant d'écrire ou de se
            déplacer. Les étoiles n'apparaissent qu'avec au moins une note :
            « 0 étoile » n'est pas une information, c'est une accusation. */}
        {l.profile?.display_name && (
          <Link href={`/membre/${l.user_id}`} className="vendeur-lien" style={{ marginBottom: 16 }}>
            <span className="vendeur-avatar" aria-hidden="true">
              {l.profile.display_name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="vendeur-nom">{l.profile.display_name}</span>
            {(l.profile.rating_count ?? 0) > 0 && l.profile.rating_avg != null ? (
              <span className="vendeur-note">
                <EtoilesLecture note={l.profile.rating_avg} taille={13} />
                <b>{noteCourte(l.profile.rating_avg)}</b>
                <span>({l.profile.rating_count})</span>
              </span>
            ) : (
              <span className="vendeur-note">Voir la fiche →</span>
            )}
          </Link>
        )}

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

        {!monAnnonce && !sold && <AvertissementPaiement style={{ marginTop: 18 }} />}

        <div style={{ marginTop: 18 }}>
          {reported ? (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              ✓ Merci, votre signalement est transmis à la modération.
            </span>
          ) : signaler && moi ? (
            <SignalerPanel
              listingId={l.id}
              reporterId={moi}
              onFait={() => { setSignaler(false); setReported(true); }}
              onAnnuler={() => setSignaler(false)}
            />
          ) : !monAnnonce ? (
            <button onClick={ouvrirSignalement} className="link-quiet" style={{ fontSize: 12 }}>
              Signaler cette annonce
            </button>
          ) : null}
        </div>

        {isAdmin && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12,
            border: "1px dashed var(--danger)", background: "rgba(176,58,46,.05)", display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--danger)" }}>
                Modération
                {l.risk_score != null && (
                  <span className={`risque-pastille risque-${niveau.cle}`} style={{ marginLeft: 10 }}>
                    Risque {niveau.label.toLowerCase()} · {l.risk_score}/100
                  </span>
                )}
              </span>
              <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {l.review_state && l.review_state !== "pending" && l.review_state !== "blocked" && (
                  <button onClick={ouvrirDossier} className="link-quiet" style={{ fontSize: 12.5 }}>
                    Ouvrir un dossier
                  </button>
                )}
                <button onClick={adminDelete} disabled={deleting}
                  style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 99,
                    padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? "Suppression…" : "Supprimer cette annonce"}
                </button>
              </span>
            </div>
            {/* Les raisons du score, telles que la base les a écrites : la
                machine explique, l'humain tranche. */}
            {(l.risk_reasons?.length ?? 0) > 0 && (
              <ul className="risque-raisons">
                {l.risk_reasons!.map((r, i) => (
                  <li key={i}>
                    <b>{r.points > 0 ? `+${r.points}` : "·"}</b>
                    <span><strong>{RAISON_LABEL[r.code] ?? r.code}</strong> — {r.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {dossierOuvert && <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>{dossierOuvert}</p>}
          </div>
        )}
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
          {sold ? (
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
              Vendu — le vendeur n&apos;attend plus de contact pour cette annonce.
            </p>
          ) : monAnnonce ? (
            <Link href="/messages" className="btn btn-block" style={{ fontSize: 15, padding: "13px 0" }}>
              Voir les messages reçus
            </Link>
          ) : composer ? (
            <form onSubmit={envoyerMessage} style={{ display: "grid", gap: 8 }}>
              <textarea
                className="input" rows={3} autoFocus
                value={messageTexte}
                onChange={(e) => setMessageTexte(e.target.value.slice(0, MESSAGE_MAX))}
                placeholder={`Bonjour, je vous contacte au sujet de « ${l.title} »…`}
                aria-label="Votre message"
              />
              {messageErr && (
                <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>{messageErr}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-outline-gold" style={{ flex: "0 0 auto", color: "var(--gold-deep)" }}
                  onClick={() => setComposer(false)}>
                  Annuler
                </button>
                <button className="btn btn-gold" style={{ flex: 1 }}
                  disabled={envoiMessage || messageTexte.trim().length === 0}>
                  {envoiMessage ? "Envoi…" : "Envoyer le message"}
                </button>
              </div>
            </form>
          ) : (
            /* Les deux voies côte à côte : WhatsApp quand il est renseigné,
               la messagerie toujours. Une annonce sans aucun contact possible
               n'existe plus — c'était le cul-de-sac d'avant. */
            <div style={{ display: "flex", gap: 8 }}>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn"
                  style={{ flex: 1, background: "var(--wa)", fontSize: 15, padding: "13px 0" }}>
                  WhatsApp
                </a>
              )}
              {messagerieOuverte && (
                <button onClick={ouvrirComposeur} className={wa ? "btn btn-outline-gold" : "btn btn-gold"}
                  style={{ flex: 1, fontSize: 15, padding: "13px 0", ...(wa ? { color: "var(--gold-deep)" } : {}) }}>
                  Envoyer un message
                </button>
              )}
              {!wa && !messagerieOuverte && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0, flex: 1 }}>
                  Cette personne n&apos;a laissé aucun moyen de contact.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
