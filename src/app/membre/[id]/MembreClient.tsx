"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader, Mark } from "@/components/Brand";
import ListingCard from "@/components/ListingCard";
import { EtoilesLecture } from "@/components/Etoiles";
import NoterPanel from "@/components/NoterPanel";
import { FavoritesProvider } from "@/lib/favorites";
import { connexionUrl } from "@/lib/urls";
import { ancienneteMembre, libelleNote, noteCourte, type FicheMembre } from "@/lib/membre";
import type { Listing } from "@/lib/types";

/* La fiche publique d'un membre. Elle répond à la question qu'on se pose
   avant d'appeler ou de se déplacer : « à qui ai-je affaire ? » — depuis
   quand cette personne est là, ce qu'elle a vendu, comment les autres
   l'ont trouvée, et si elle répond. Rien de plus : pas d'email, pas de
   téléphone, aucune donnée que la personne n'a pas déjà rendue publique
   en publiant une annonce. */
export default function MembreClient() {
  return (
    <FavoritesProvider>
      <Membre />
    </FavoritesProvider>
  );
}

function Membre() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [f, setF] = useState<FicheMembre | null>(null);
  const [annonces, setAnnonces] = useState<Listing[]>([]);
  const [introuvable, setIntrouvable] = useState(false);
  const [moi, setMoi] = useState<string | null>(null);
  const [noter, setNoter] = useState(false);

  const charger = useCallback(async () => {
    const sb = supabase();
    const [{ data: session }, { data, error }] = await Promise.all([
      sb.auth.getSession(),
      sb.rpc("fiche_membre", { p_user_id: id }),
    ]);
    setMoi(session.session?.user.id ?? null);
    if (error || !data) { setIntrouvable(true); return; }
    setF(data as FicheMembre);
    const { data: liste } = await sb
      .from("listings")
      .select("*, photos:listing_photos(storage_key, position)")
      .eq("user_id", id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(24);
    // Une réponse inattendue (erreur PostgREST rendue en objet) ne doit pas
    // faire tomber toute la fiche : on affiche simplement zéro annonce.
    setAnnonces(Array.isArray(liste) ? (liste as Listing[]) : []);
  }, [id]);

  useEffect(() => { charger(); }, [charger]);

  if (introuvable) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>Ce membre n&apos;existe pas ou plus.</p>
        <Link href="/">← Retour aux annonces</Link>
      </div>
    </>
  );
  if (!f) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const cestMoi = moi === f.id;
  const initiale = f.display_name.trim().charAt(0).toUpperCase() || "?";
  const maxRep = Math.max(1, ...Object.values(f.repartition ?? {}));

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main className="container" style={{ paddingTop: 18, paddingBottom: 60, maxWidth: 820, flex: 1 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Toutes les annonces</Link>

        {/* En-tête : qui, depuis quand, d'où, et la note en un regard. */}
        <section className="membre-tete">
          <span className="membre-avatar" aria-hidden="true">{initiale}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="membre-nom">
              {f.display_name}
              {f.is_pro && <span className="membre-pro">Pro</span>}
            </h1>
            <p className="membre-meta">
              {ancienneteMembre(f.membre_depuis)}
              {f.quartier && <> · {f.quartier}</>}
            </p>
            <div className="membre-note">
              <EtoilesLecture note={f.note_moyenne} taille={17} />
              <span>{libelleNote(f.note_moyenne, f.nb_notes)}</span>
            </div>
          </div>
        </section>

        {/* Chiffres : quatre au plus. Le taux de réponse n'apparaît qu'à
            partir de trois conversations — avant, il ne veut rien dire. */}
        <div className="membre-chiffres">
          <Chiffre v={f.annonces_actives} k="en ligne" />
          <Chiffre v={f.annonces_total} k="annonce{s} publiée{s}" />
          <Chiffre v={f.annonces_vendues} k="vendue{s}" />
          {f.taux_reponse != null && <Chiffre v={`${f.taux_reponse} %`} k="de réponse" />}
        </div>

        {/* Noter : seulement si on a échangé et que la personne a répondu.
            Sinon on explique pourquoi le bouton n'est pas là, plutôt que de
            le cacher en silence. */}
        {!cestMoi && (
          <section className="panel" style={{ padding: "14px 16px", marginTop: 14 }}>
            {noter && f.conversation_notable ? (
              <NoterPanel
                conversationId={f.ma_note?.conversation_id ?? f.conversation_notable}
                nom={f.display_name}
                existante={f.ma_note}
                onFait={() => { setNoter(false); charger(); }}
                onAnnuler={() => setNoter(false)}
              />
            ) : f.ma_note ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>
                  Vous avez noté {f.display_name} <EtoilesLecture note={f.ma_note.stars} taille={14} className="inline" />
                </span>
                <button className="link-quiet" onClick={() => setNoter(true)} style={{ marginLeft: "auto" }}>Modifier</button>
              </div>
            ) : f.conversation_notable ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>Vous avez échangé avec {f.display_name} — votre avis compte.</span>
                <button className="btn btn-gold" onClick={() => setNoter(true)} style={{ marginLeft: "auto" }}>
                  Laisser une note
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                {moi
                  ? "Pour laisser une note, il faut avoir échangé avec cette personne sur le site et qu’elle vous ait répondu."
                  : <>Connectez-vous et échangez avec {f.display_name} depuis une annonce pour pouvoir laisser une note.</>}
                {!moi && (
                  <> <button className="link-quiet" onClick={() => router.push(connexionUrl(`/membre/${f.id}`))}>Se connecter</button></>
                )}
              </p>
            )}
          </section>
        )}

        {/* Avis. La répartition est là pour lire une moyenne : 4,2 avec dix
            cinq-étoiles et deux une-étoile n'est pas 4,2 avec douze quatre. */}
        {f.nb_notes > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 className="membre-h2">Avis <span>· {f.nb_notes}</span></h2>
            <div className="membre-avis-grille">
              <div className="panel membre-repartition">
                <div className="membre-grande-note">
                  <strong>{noteCourte(f.note_moyenne)}</strong>
                  <span>sur 5</span>
                </div>
                {([5, 4, 3, 2, 1] as const).map((s) => {
                  const n = f.repartition?.[String(s) as "1"] ?? 0;
                  return (
                    <div key={s} className="membre-rep-ligne">
                      <span>{s}</span>
                      <span className="membre-rep-piste">
                        <span style={{ width: `${(n / maxRep) * 100}%` }} />
                      </span>
                      <span className="membre-rep-n">{n}</span>
                    </div>
                  );
                })}
              </div>
              <ul className="membre-avis-liste">
                {f.avis.map((a) => (
                  <li key={a.id} className="panel">
                    <div className="membre-avis-tete">
                      <EtoilesLecture note={a.stars} taille={14} />
                      <Link href={`/membre/${a.auteur_id}`} className="membre-avis-auteur">{a.auteur_nom}</Link>
                      <time className="membre-avis-date">
                        {new Date(a.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </time>
                    </div>
                    {a.comment && <p className="membre-avis-texte">{a.comment}</p>}
                    {a.annonce && <p className="membre-avis-annonce">À propos de « {a.annonce} »</p>}
                    {/* Un avis se signale comme une annonce : discret, réservé
                        aux membres connectés, jamais sur son propre avis. */}
                    {moi && moi !== a.auteur_id && (
                      <SignalerAvis id={a.id} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section style={{ marginTop: 26 }}>
          <h2 className="membre-h2">
            {cestMoi ? "Mes annonces en ligne" : `Les annonces de ${f.display_name}`}
            <span> · {annonces.length}</span>
          </h2>
          {annonces.length === 0 ? (
            <div className="panel gold-frame" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <Mark size={56} color="var(--gold-deep)" />
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>Aucune annonce en ligne pour le moment.</p>
            </div>
          ) : (
            <div className="grid">
              {annonces.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
          )}
        </section>

        {cestMoi && (
          <p style={{ marginTop: 22, fontSize: 13, color: "var(--text-muted)" }}>
            C&apos;est votre fiche publique, telle que les autres la voient.{" "}
            <Link href="/mon-espace" style={{ color: "var(--gold-deep)" }}>Modifier mon profil</Link>
          </p>
        )}
      </main>
    </div>
  );
}

function SignalerAvis({ id }: { id: string }) {
  const [etat, setEtat] = useState<"idle" | "busy" | "fait" | "err">("idle");
  async function signaler() {
    if (!confirm("Signaler cet avis à la modération ?")) return;
    setEtat("busy");
    const { error } = await supabase().rpc("signaler_avis", { p_rating_id: id, p_motif: "signalé depuis la fiche" });
    setEtat(error ? "err" : "fait");
  }
  if (etat === "fait") return <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>✓ Avis signalé, merci.</p>;
  return (
    <p style={{ margin: "6px 0 0" }}>
      <button type="button" className="link-quiet" style={{ fontSize: 11.5 }} disabled={etat === "busy"} onClick={signaler}>
        Signaler cet avis
      </button>
      {etat === "err" && <span style={{ fontSize: 11.5, color: "var(--danger)", marginLeft: 8 }}>Le signalement n’a pas abouti.</span>}
    </p>
  );
}

function Chiffre({ v, k }: { v: number | string; k: string }) {
  const n = typeof v === "number" ? v : NaN;
  const libelle = k.replace(/\{s\}/g, n > 1 ? "s" : "");
  return (
    <div className="membre-chiffre">
      <strong>{typeof v === "number" ? v.toLocaleString("fr-FR") : v}</strong>
      <span>{libelle}</span>
    </div>
  );
}
