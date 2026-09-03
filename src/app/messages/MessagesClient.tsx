"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader, Mark } from "@/components/Brand";
import { photoUrl } from "@/components/ListingCard";
import { thumbKey } from "@/lib/images";
import { connexionUrl } from "@/lib/urls";
import { notifierParEmail } from "@/lib/notifierMessage";
import {
  MESSAGE_MAX, heureMessage, messageErreur,
  type Conversation, type Message,
} from "@/lib/messages";
import NoterPanel from "@/components/NoterPanel";

export default function MessagesClient() {
  const router = useRouter();
  const params = useSearchParams();
  const ouvrir = params.get("c");

  const [userId, setUserId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [actif, setActif] = useState<string | null>(ouvrir);
  const [fil, setFil] = useState<Message[]>([]);
  const [texte, setTexte] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [blocageBusy, setBlocageBusy] = useState(false);
  const [noter, setNoter] = useState(false);
  const basDuFil = useRef<HTMLDivElement>(null);

  const chargerConversations = useCallback(async () => {
    const { data, error } = await supabase().rpc("mes_conversations");
    if (error) {
      setErreur(messageErreur(error, "Vos messages n’ont pas pu être chargés."));
      return;
    }
    setConvs((data as Conversation[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase().auth.getSession();
      if (!session.session) { router.replace(connexionUrl("/messages")); return; }
      setUserId(session.session.user.id);
      await chargerConversations();
      setChargement(false);
    })();
  }, [router, chargerConversations]);

  /* Ouvrir un fil : charger les messages, puis marquer comme lu. Dans cet
     ordre — l'inverse ferait disparaître la pastille avant que le contenu
     soit à l'écran, et on ne saurait plus ce qui était nouveau. */
  useEffect(() => {
    if (!actif) { setFil([]); return; }
    let annule = false;
    (async () => {
      const { data, error } = await supabase()
        .from("messages").select("*")
        .eq("conversation_id", actif)
        .order("created_at");
      if (annule) return;
      if (error) { setErreur(messageErreur(error, "Ce fil n’a pas pu être ouvert.")); return; }
      setFil((data as Message[]) ?? []);
      await supabase().rpc("marquer_conversation_lue", { p_conversation_id: actif });
      if (!annule) chargerConversations();
    })();
    return () => { annule = true; };
  }, [actif, chargerConversations]);

  useEffect(() => {
    basDuFil.current?.scrollIntoView({ block: "end" });
  }, [fil]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const corps = texte.trim();
    if (!corps || !actif) return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase().rpc("repondre_message", {
      p_conversation_id: actif,
      p_body: corps,
    });
    setEnvoi(false);
    if (error) {
      setErreur(messageErreur(error, "Le message n’est pas parti. Réessayez."));
      return;
    }
    setTexte("");
    void notifierParEmail(actif);
    // Relecture plutôt qu'ajout optimiste : l'horodatage vient du serveur,
    // et un message affiché qui n'existe pas en base est pire qu'une demi-seconde.
    const { data } = await supabase()
      .from("messages").select("*").eq("conversation_id", actif).order("created_at");
    setFil((data as Message[]) ?? []);
    chargerConversations();
  }

  /* Bloquer, c'est une action qu'on regrette rarement mais qu'on déclenche
     parfois par accident : la confirmation dit exactement ce qui va se
     passer, dans les deux sens, avant de la poser. */
  async function basculerBlocage(conv: Conversation) {
    if (!conv.autre_id) return;
    const bloquer = !conv.jai_bloque;
    if (bloquer && !confirm(
      `Bloquer ${conv.autre_nom} ?\n\n`
      + "Cette personne ne pourra plus vous écrire, sur aucune de vos annonces, "
      + "et vous ne pourrez plus lui écrire non plus.\n"
      + "La conversation reste lisible, et vous pouvez la débloquer à tout moment."
    )) return;

    setBlocageBusy(true);
    setErreur(null);
    const { error } = await supabase().rpc(
      bloquer ? "bloquer_personne" : "debloquer_personne",
      { p_user_id: conv.autre_id },
    );
    setBlocageBusy(false);
    if (error) {
      setErreur(messageErreur(error, "L’opération n’a pas abouti."));
      return;
    }
    await chargerConversations();
  }

  const conv = convs.find((c) => c.id === actif) ?? null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ paddingTop: 18, paddingBottom: 60, maxWidth: 820, flex: 1 }}>
        {conv ? (
          <button className="link-quiet" onClick={() => setActif(null)} style={{ marginBottom: 12 }}>
            ← Toutes mes conversations
          </button>
        ) : (
          <h1 className="section-title" style={{ marginBottom: 14 }}>Mes messages</h1>
        )}

        {erreur && (
          <p className="panel" style={{ padding: "10px 14px", color: "var(--danger)", fontWeight: 600, fontSize: 13.5 }}>
            {erreur}
          </p>
        )}

        {chargement ? (
          <p style={{ color: "var(--text-muted)" }}>Chargement…</p>
        ) : conv ? (
          <Fil conv={conv} fil={fil} userId={userId} basDuFil={basDuFil}
            texte={texte} setTexte={setTexte} envoi={envoi} envoyer={envoyer}
            blocageBusy={blocageBusy} basculerBlocage={basculerBlocage}
            noter={noter} setNoter={setNoter} />
        ) : convs.length === 0 ? (
          <div className="panel gold-frame" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={60} color="var(--gold-deep)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--green)", margin: "0 0 4px" }}>Aucun message pour l&apos;instant.</p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
              Les conversations démarrées depuis une annonce apparaîtront ici.
            </p>
            <Link href="/" className="btn btn-gold">Parcourir les annonces</Link>
          </div>
        ) : (
          <div className="conv-liste">
            {convs.map((c) => (
              <button key={c.id} className="panel conv-row" onClick={() => setActif(c.id)}>
                <span className="conv-vignette">
                  {c.photo_key ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(thumbKey(c.photo_key))} alt=""
                      onError={(e) => { e.currentTarget.src = photoUrl(c.photo_key!); }} />
                  ) : (
                    <Mark size={26} color="var(--gold-deep)" />
                  )}
                </span>
                <span className="conv-corps">
                  <span className="conv-haut">
                    <strong>{c.autre_nom}</strong>
                    <span className="conv-heure">{heureMessage(c.last_message_at)}</span>
                  </span>
                  <span className="conv-annonce">
                    {c.je_suis_auteur ? "Sur votre annonce" : "Votre demande"} · {c.listing_title}
                  </span>
                  {c.dernier && <span className="conv-extrait">{c.dernier}</span>}
                </span>
                {c.non_lus > 0 && <span className="conv-pastille">{c.non_lus}</span>}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Fil({
  conv, fil, userId, basDuFil, texte, setTexte, envoi, envoyer,
  blocageBusy, basculerBlocage, noter, setNoter,
}: {
  conv: Conversation; fil: Message[]; userId: string | null;
  basDuFil: React.RefObject<HTMLDivElement | null>;
  texte: string; setTexte: (v: string) => void;
  envoi: boolean; envoyer: (e: React.FormEvent) => void;
  blocageBusy: boolean; basculerBlocage: (c: Conversation) => void;
  noter: boolean; setNoter: (v: boolean) => void;
}) {
  const retiree = conv.listing_status !== "active";
  const bloque = conv.bloque === true;
  /* On ne propose de noter que si l'autre a écrit au moins une fois : c'est
     la règle de la base, autant ne pas afficher un bouton qui échouera. */
  const autreARepondu = userId != null && fil.some((m) => m.sender_id !== userId);
  return (
    <>
      <Link href={`/annonce/${conv.listing_id}`} className="panel conv-entete">
        <span className="conv-vignette">
          {conv.photo_key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(thumbKey(conv.photo_key))} alt=""
              onError={(e) => { e.currentTarget.src = photoUrl(conv.photo_key!); }} />
          ) : (
            <Mark size={26} color="var(--gold-deep)" />
          )}
        </span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15 }}>{conv.autre_nom}</strong>
          <span className="conv-annonce">{conv.listing_title}</span>
        </span>
        <span style={{ marginLeft: "auto", color: "var(--gold-deep)", fontSize: 18 }} aria-hidden="true">→</span>
      </Link>

      {/* Le blocage vit hors du lien vers l'annonce : un bouton imbriqué dans
          un lien se déclenche au mauvais endroit une fois sur deux. */}
      {conv.autre_id && (
        <div className="fil-actions" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", gap: 14 }}>
            <Link href={`/membre/${conv.autre_id}`} className="link-quiet" style={{ fontSize: 12.5 }}>
              Voir la fiche
            </Link>
            {autreARepondu && !bloque && (
              <button type="button" className="link-quiet" style={{ fontSize: 12.5, color: "var(--gold-deep)" }}
                onClick={() => setNoter(!noter)}>
                {noter ? "Fermer" : `Noter ${conv.autre_nom}`}
              </button>
            )}
          </span>
          <button type="button" className="link-quiet" disabled={blocageBusy}
            onClick={() => basculerBlocage(conv)}>
            {conv.jai_bloque ? `Débloquer ${conv.autre_nom}` : `Bloquer ${conv.autre_nom}`}
          </button>
        </div>
      )}

      {noter && (
        <div className="panel" style={{ padding: "14px 16px", marginBottom: 12 }}>
          <NoterPanel
            conversationId={conv.id}
            nom={conv.autre_nom}
            onFait={() => setNoter(false)}
            onAnnuler={() => setNoter(false)}
          />
        </div>
      )}

      <div className="fil">
        {fil.map((m) => (
          <div key={m.id} className={`bulle${m.sender_id === userId ? " bulle-moi" : ""}`}>
            <p>{m.body}</p>
            <span>{heureMessage(m.created_at)}</span>
          </div>
        ))}
        <div ref={basDuFil} />
      </div>

      {bloque ? (
        /* Deux formulations, parce que ce ne sont pas deux situations
           identiques : celui qui a bloqué peut revenir en arrière, celui
           qui l'est ne le peut pas et doit le comprendre sans ambiguïté. */
        <p className="panel" style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          {conv.jai_bloque
            /* Un tiret plutôt qu'un point : beaucoup de noms affichés se
                terminent déjà par une initiale ponctuée (« Marie L. »). */
            ? `Vous avez bloqué ${conv.autre_nom} — personne ne peut plus écrire dans cette conversation, et l’historique reste consultable.`
            : "Vous ne pouvez plus écrire dans cette conversation."}
        </p>
      ) : retiree ? (
        <p className="panel" style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          Cette annonce n&apos;est plus en ligne. La conversation reste consultable, mais on ne peut plus y répondre.
        </p>
      ) : (
        <form onSubmit={envoyer} className="fil-envoi">
          <textarea
            className="input"
            value={texte}
            onChange={(e) => setTexte(e.target.value.slice(0, MESSAGE_MAX))}
            placeholder="Votre message…"
            rows={2}
            aria-label="Votre message"
          />
          <button className="btn btn-gold" disabled={envoi || texte.trim().length === 0}>
            {envoi ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      )}
    </>
  );
}
