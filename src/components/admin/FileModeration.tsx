"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, eur, type ModuleKey } from "@/lib/taxonomy";
import { photoUrl } from "@/components/ListingCard";
import { thumbKey } from "@/lib/images";
import {
  DECISIONS, MOTIF_LABEL, POIDS_LABEL, RAISON_LABEL, ETAT_LABEL, CATEGORIE_LABEL, REGLES_LABEL, IMAGES_LABEL,
  NIVEAU_LABEL, CATEGORIES_LEXIQUE, niveauRisque,
  type Decision, type DossierModeration, type SousSurveillance, type Reglages, type RaisonRisque,
  type DetailModeration, type LigneLexique, type MessageSignale, type DecisionMessage,
} from "@/lib/moderation";
import styles from "@/app/stats/admin.module.css";

/* La file de modération : ce que la machine a retenu, ce que les gens ont
   signalé, et les boutons pour trancher. Chaque dossier montre le score,
   ses raisons une à une, les termes exacts que le filtre a relevés (que
   l'auteur, lui, ne voit jamais), l'auteur et son historique, les photos,
   les signalements — tout ce qu'il faut pour décider sans ouvrir dix onglets.

   Tant que la migration 0032 n'est pas passée, la fonction n'existe pas :
   on le dit, et la page continue de montrer l'ancienne liste de
   signalements à la place. Le lexique, les messages et les interrupteurs
   arrivent avec 0033 ; chacun s'affiche s'il répond. */

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const depuis = (iso: string) => {
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return j < 1 ? "aujourd’hui" : j === 1 ? "hier" : j < 31 ? `il y a ${j} jours` : j < 365 ? `il y a ${Math.floor(j / 30)} mois` : `il y a ${Math.floor(j / 365)} an${j >= 730 ? "s" : ""}`;
};

/* Un titre de section repliable. */
function Pli({ ouvert, onClick, children }: { ouvert: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="link-quiet" style={{ font: "inherit", color: "inherit" }} onClick={onClick}>
      {ouvert ? "▾" : "▸"} {children}
    </button>
  );
}

/* Les familles touchées, pour la pastille à côté du score. */
function categories(raisons: RaisonRisque[]): string[] {
  return Array.from(new Set(raisons.filter((r) => r.points > 0 && CATEGORIE_LABEL[r.code]).map((r) => CATEGORIE_LABEL[r.code])));
}

export default function FileModeration({ onEtat }: { onEtat: (dispo: boolean, nb: number) => void }) {
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [dossiers, setDossiers] = useState<DossierModeration[]>([]);
  const [messages, setMessages] = useState<MessageSignale[]>([]);
  const [messagesDispo, setMessagesDispo] = useState(false);
  const [surveillance, setSurveillance] = useState<SousSurveillance[]>([]);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [lexique, setLexique] = useState<LigneLexique[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [voirReglages, setVoirReglages] = useState(false);
  const [voirLexique, setVoirLexique] = useState(false);
  const [voirSurveillance, setVoirSurveillance] = useState(false);

  const charger = useCallback(async () => {
    const sb = supabase();
    const [f, s, r, m, lx] = await Promise.all([
      sb.rpc("admin_file_moderation"),
      sb.rpc("admin_sous_surveillance"),
      sb.from("moderation_settings").select("key, value"),
      sb.rpc("admin_messages_signales"),
      sb.from("moderation_lexique").select("*").order("categorie").order("niveau").order("terme"),
    ]);
    if (f.error) { setDispo(false); onEtat(false, 0); return; }
    const liste = Array.isArray(f.data) ? (f.data as DossierModeration[]) : [];
    const msgs = !m.error && Array.isArray(m.data) ? (m.data as MessageSignale[]) : [];
    setDossiers(liste);
    setMessages(msgs);
    setMessagesDispo(!m.error);
    setSurveillance(Array.isArray(s.data) ? (s.data as SousSurveillance[]) : []);
    if (Array.isArray(r.data)) {
      const obj = Object.fromEntries((r.data as { key: string; value: unknown }[]).map((x) => [x.key, x.value]));
      setReglages(obj as unknown as Reglages);
    }
    setLexique(!lx.error && Array.isArray(lx.data) ? (lx.data as LigneLexique[]) : null);
    setDispo(true);
    onEtat(true, liste.length + msgs.length);
  }, [onEtat]);

  useEffect(() => { charger(); }, [charger]);

  async function decider(d: DossierModeration, decision: Decision, note: string, jours: number) {
    const def = DECISIONS.find((x) => x.code === decision);
    if (def?.confirmer && !confirm(def.confirmer)) return;
    if (decision === "demander_modification" && note.trim().length < 3) {
      setErreur("Pour demander une correction, écrivez à l’auteur ce qu’il doit changer.");
      return;
    }
    setBusy(d.case_id);
    setErreur(null);
    const { error } = await supabase().rpc("admin_decider", {
      p_case_id: d.case_id, p_decision: decision, p_note: note.trim() || null, p_jours: jours,
    });
    setBusy(null);
    if (error) { setErreur(`Décision non enregistrée : ${error.message}`); return; }
    await charger();
  }

  async function deciderMessage(m: MessageSignale, decision: DecisionMessage, jours: number) {
    const confirmation: Partial<Record<DecisionMessage, string>> = {
      supprimer: "Supprimer ce message de la conversation ?",
      suspendre: "Supprimer le message et suspendre ce compte ?",
      bannir: "Bannir ce compte ? Ses annonces seront retirées et il ne pourra plus écrire.",
    };
    if (confirmation[decision] && !confirm(confirmation[decision])) return;
    setBusy(m.id);
    setErreur(null);
    const { error } = await supabase().rpc("admin_decider_message", { p_id: m.id, p_decision: decision, p_jours: jours });
    setBusy(null);
    if (error) { setErreur(`Décision non enregistrée : ${error.message}`); return; }
    await charger();
  }

  async function reevaluer() {
    if (!confirm("Réévaluer toutes les annonces en ligne avec les réglages et le lexique actuels ? Les annonces déjà tranchées par un modérateur gardent leur état.")) return;
    setBusy("reeval");
    setErreur(null);
    const { data, error } = await supabase().rpc("admin_reevaluer");
    setBusy(null);
    if (error) { setErreur(`Réévaluation impossible : ${error.message}`); return; }
    const r = data as { evaluees: number; en_attente: number; retenues: number };
    setInfo(`${r.evaluees} annonce${r.evaluees > 1 ? "s" : ""} réévaluée${r.evaluees > 1 ? "s" : ""} : ${r.en_attente} en attente, ${r.retenues} retenue${r.retenues > 1 ? "s" : ""}.`);
    await charger();
  }

  if (dispo === null) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement de la file…</p>;
  if (dispo === false) return (
    <div className={styles.empty}>
      <strong>File de modération à activer</strong>
      <p>Exécutez la migration <code>0032_moderation.sql</code> puis <code>0033_moderation_contenu.sql</code> dans Supabase : score de risque, dossiers, décisions et réglages apparaîtront ici.</p>
    </div>
  );

  return (
    <>
      {erreur && <p className={styles.error} role="alert">{erreur}</p>}
      {info && <p className={styles.extra} role="status">{info}</p>}

      <section className={styles.section}>
        <h3>File de modération ({dossiers.length})</h3>
        <p>Les annonces qui attendent un regard humain : en attente, retenues, ou signalées. Un seul signal faible n’amène jamais une annonce ici — regardez l’ensemble avant de trancher.</p>
        <div>
          {dossiers.length === 0
            ? <div className={styles.empty}><strong>Rien à vérifier</strong><p>Aucune annonce n’attend de décision. Les nouvelles apparaîtront ici automatiquement.</p></div>
            : dossiers.map((d) => <Dossier key={d.case_id} d={d} busy={busy === d.case_id} decider={decider} />)}
        </div>
      </section>

      {messagesDispo && (
        <section className={styles.section}>
          <h3>Messages signalés par le filtre ({messages.length})</h3>
          <p>Envoyés malgré un contenu douteux. Les messages certains sont refusés avant l’envoi et n’apparaissent pas ici.</p>
          <div>
            {messages.length === 0
              ? <div className={styles.empty}><strong>Aucun message à regarder</strong><p>Le filtre n’a rien relevé dans la messagerie.</p></div>
              : messages.map((m) => <Message key={m.id} m={m} busy={busy === m.id} decider={deciderMessage} />)}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h3><Pli ouvert={voirSurveillance} onClick={() => setVoirSurveillance(!voirSurveillance)}>Sous surveillance ({surveillance.length})</Pli></h3>
        <p>Publiées, mais avec un score intermédiaire. Rien à faire : un coup d’œil de temps en temps suffit.</p>
        {voirSurveillance && (
          <div>
            {surveillance.length === 0
              ? <div className={styles.empty}><strong>Aucune annonce surveillée</strong><p>Tout ce qui est en ligne a un score faible.</p></div>
              : <div className={styles.rows}>
                  {surveillance.map((s) => {
                    const n = niveauRisque(s.risk_score);
                    return (
                      <div key={s.id} className={styles.row}>
                        <div className={styles.main}>
                          <span className={`risque-pastille risque-${n.cle}`}>{s.risk_score}</span>
                          <div>
                            <Link href={`/annonce/${s.id}`}>{s.title}</Link>
                            <p>{s.auteur} · {depuis(s.created_at)} · {s.risk_reasons.filter((r) => r.points > 0).map((r) => RAISON_LABEL[r.code] ?? r.code).join(", ")}</p>
                          </div>
                        </div>
                        <div className={styles.rowButtons}>
                          <button className="link-quiet" onClick={async () => {
                            const { error } = await supabase().rpc("admin_ouvrir_dossier", { p_listing_id: s.id });
                            if (error) setErreur(error.message); else charger();
                          }}>Ouvrir un dossier</button>
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </div>
        )}
      </section>

      {lexique && (
        <section className={styles.section}>
          <h3><Pli ouvert={voirLexique} onClick={() => setVoirLexique(!voirLexique)}>Lexique ({lexique.filter((l) => l.actif).length} termes actifs)</Pli></h3>
          <p>Les mots et expressions que le filtre reconnaît, après normalisation : accents, chiffres à la place de lettres, lettres espacées ou répétées ne le trompent pas. Un terme faible pèse sans jamais bloquer ; un fort met en attente ; un certain bloque seul ; une exception retire une tournure innocente avant l’analyse.</p>
          {voirLexique && <Lexique lignes={lexique} onChange={charger} setErreur={setErreur} />}
        </section>
      )}

      <section className={styles.section}>
        <h3><Pli ouvert={voirReglages} onClick={() => setVoirReglages(!voirReglages)}>Réglages du score</Pli></h3>
        <p>Seuils, interrupteurs, poids et listes. Les changements s’appliquent aux prochaines évaluations ; « Réévaluer » les applique à ce qui est déjà en ligne.</p>
        {voirReglages && reglages && <ReglagesForm initial={reglages} onSauve={charger} reevaluer={reevaluer} busy={busy === "reeval"} />}
        {voirReglages && !reglages && <div className={styles.empty}><strong>Réglages introuvables</strong><p>La table moderation_settings est vide ou inaccessible.</p></div>}
      </section>
    </>
  );
}

/* ---------- Ce que le filtre a relevé, mot pour mot ---------- */

function Details({ details }: { details?: DetailModeration[] }) {
  /* Seules les familles qui ont relevé des termes méritent une ligne : le
     reste est déjà dit dans les raisons. */
  const utiles = (details ?? []).filter((d) => d.termes && d.termes.length > 0);
  if (utiles.length === 0) return null;
  return (
    <ul className="risque-raisons" style={{ marginTop: 8, padding: "8px 10px", background: "var(--cream-dark)", borderRadius: 8 }}>
      {utiles.map((d, i) => (
        <li key={i}>
          <b style={{ color: d.niveau === "certain" ? "var(--danger)" : d.niveau === "fort" ? "#9a4527" : "var(--text-muted)" }}>{d.niveau}</b>
          <span><strong>{CATEGORIE_LABEL[d.code] ?? RAISON_LABEL[d.code] ?? d.code}</strong> — {d.termes.map((t) => `« ${t} »`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function Raisons({ raisons }: { raisons: RaisonRisque[] }) {
  if (raisons.length === 0) return <p className={styles.extra} style={{ marginTop: 8 }}>Aucun signal automatique.</p>;
  return (
    <ul className="risque-raisons" style={{ marginTop: 8 }}>
      {raisons.map((r, i) => (
        <li key={i}>
          <b>{r.points > 0 ? `+${r.points}` : "·"}</b>
          <span><strong>{RAISON_LABEL[r.code] ?? r.code}</strong> — {r.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Un dossier ---------- */

function Dossier({ d, busy, decider }: {
  d: DossierModeration; busy: boolean;
  decider: (d: DossierModeration, decision: Decision, note: string, jours: number) => void;
}) {
  const [note, setNote] = useState("");
  const [jours, setJours] = useState(7);
  const [texteOuvert, setTexteOuvert] = useState(false);
  const l = d.listing, a = d.auteur;
  const n = niveauRisque(l.risk_score);
  const mod = MODULES[l.module as ModuleKey];
  const prix = eur(l.price_cents);
  const raisons = (l.risk_reasons ?? []) as RaisonRisque[];
  const familles = categories(raisons);
  const source = d.source === "signalement" ? "Signalée" : d.source === "admin" ? "Ouvert par un admin" : "Détection automatique";
  const enLigne = l.status === "active" && (l.review_state === "published" || l.review_state === "watch");

  return (
    <article className={styles.card} aria-busy={busy}>
      <div className={styles.cardTop}>
        <span className={`risque-pastille risque-${n.cle}`} title="Score de risque, sur 100">{l.risk_score} · {n.label}</span>
        <div style={{ flex: 1 }}>
          <Link href={`/annonce/${l.id}`}>{l.title}</Link>
          <small>
            {mod?.label ?? l.module} · {l.subcategory} · {prix ?? "sans prix"} · déposée {depuis(l.created_at)} · {source}
            {" · "}{enLigne ? <span className={styles.visible}>en ligne</span> : <span className={styles.hidden}>{l.status === "active" ? ETAT_LABEL[l.review_state] : "hors ligne"}</span>}
            {familles.length > 0 && <> · {familles.map((f) => <b key={f} className={styles.banned} style={{ marginRight: 4 }}>{f}</b>)}</>}
            {d.certitude && d.certitude !== "aucun" && <> · certitude <strong>{d.certitude}</strong></>}
          </small>
        </div>
      </div>

      {l.photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
          {l.photos.slice(0, 8).map((k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={k} src={photoUrl(thumbKey(k))} alt=""
              onError={(e) => { const i = e.currentTarget, f = photoUrl(k); if (i.src !== f) i.src = f; }}
              style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} />
          ))}
        </div>
      )}

      <p className={styles.body} style={texteOuvert ? undefined : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {l.description || <em style={{ color: "var(--text-muted)" }}>Sans description.</em>}
      </p>
      {l.description && l.description.length > 280 && (
        <button type="button" className="link-quiet" style={{ fontSize: 12 }} onClick={() => setTexteOuvert(!texteOuvert)}>
          {texteOuvert ? "Réduire" : "Lire tout"}
        </button>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 12 }}>
        <div>
          <b className={styles.kind}>Pourquoi ici</b>
          <Raisons raisons={raisons} />
          <Details details={d.details} />
          {d.signalements.length > 0 && (
            <ul className="risque-raisons" style={{ marginTop: 10 }}>
              {d.signalements.map((s) => {
                const label = s.motif ? MOTIF_LABEL[s.motif] ?? s.motif : "Signalement";
                const detail = s.reason?.startsWith(label) ? s.reason.slice(label.length).replace(/^\s*—\s*/, "") : s.reason;
                return (
                  <li key={s.id}>
                    <b>⚑</b>
                    <span>
                      <strong>{label}</strong>
                      {detail && <> — {detail}</>}
                      <span style={{ color: "var(--text-muted)" }}> · {s.par ?? "membre"}, {quand(s.created_at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <b className={styles.kind}>Auteur</b>
          <p className={styles.extra} style={{ marginTop: 8, lineHeight: 1.6 }}>
            <Link href={`/membre/${a.id}`} style={{ color: "var(--text)", fontWeight: 700 }}>{a.display_name}</Link>
            {a.is_banned && <> · <b className={styles.banned}>Banni</b></>}
            {a.suspended_until && new Date(a.suspended_until) > new Date() && <> · <b className={styles.hidden}>Suspendu jusqu’au {quand(a.suspended_until)}</b></>}
            <br />{a.email ?? "email inconnu"}
            <br />Compte créé {depuis(a.created_at)} · {a.nb_annonces} annonce{a.nb_annonces > 1 ? "s" : ""}
            {a.nb_retirees > 0 && <> · {a.nb_retirees} retirée{a.nb_retirees > 1 ? "s" : ""}</>}
            {a.nb_signalements > 0 && <> · {a.nb_signalements} signalement{a.nb_signalements > 1 ? "s" : ""} reçu{a.nb_signalements > 1 ? "s" : ""}</>}
            {a.nb_decisions_contre > 0 && <> · <strong style={{ color: "var(--danger)" }}>{a.nb_decisions_contre} décision{a.nb_decisions_contre > 1 ? "s" : ""} défavorable{a.nb_decisions_contre > 1 ? "s" : ""}</strong></>}
          </p>
        </div>
      </div>

      <footer style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="Note (montrée à l’auteur si vous demandez une correction ; gardée dans l’historique sinon)"
          aria-label="Note de modération" style={{ fontSize: 14 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {DECISIONS.filter((x) => x.code !== "maintenir").map((x) => (
            <button key={x.code} type="button" disabled={busy} title={x.aide}
              className={x.code === "publier" ? "btn" : x.grave ? `btn ${styles.danger}` : "btn btn-outline-gold"}
              style={x.code === "publier" || x.grave ? undefined : { color: "var(--gold-deep)" }}
              onClick={() => decider(d, x.code, note, jours)}>
              {x.label}{x.code === "suspendre" ? ` ${jours} j` : ""}
            </button>
          ))}
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
            Suspension
            <select className="input" value={jours} onChange={(e) => setJours(Number(e.target.value))}
              style={{ width: "auto", padding: "6px 8px", fontSize: 13, minHeight: 0 }}>
              {[3, 7, 15, 30].map((j) => <option key={j} value={j}>{j} jours</option>)}
            </select>
          </label>
        </div>
      </footer>
    </article>
  );
}

/* ---------- Un message signalé ---------- */

function Message({ m, busy, decider }: { m: MessageSignale; busy: boolean; decider: (m: MessageSignale, d: DecisionMessage, jours: number) => void }) {
  const [jours, setJours] = useState(7);
  const n = niveauRisque(m.score);
  const e = m.expediteur;
  return (
    <article className={styles.card} aria-busy={busy}>
      <div className={styles.cardTop}>
        <span className={`risque-pastille risque-${n.cle}`}>{m.score} · {n.label}</span>
        <div style={{ flex: 1 }}>
          <strong>{e.display_name ?? "Membre"} → {m.destinataire ?? "?"}</strong>
          <small>
            {m.listing_title ? <>Sur <Link href={`/annonce/${m.listing_id}`} style={{ display: "inline", fontSize: "inherit", fontWeight: 700 }}>{m.listing_title}</Link> · </> : null}
            {quand(m.created_at)}
            {e.nb_signales > 1 && <> · <strong style={{ color: "var(--danger)" }}>{e.nb_signales} messages signalés pour ce compte</strong></>}
            {e.is_banned && <> · <b className={styles.banned}>Banni</b></>}
          </small>
        </div>
      </div>
      <p className={styles.body} style={{ borderLeft: "3px solid var(--border-input)", paddingLeft: 10 }}>{m.body}</p>
      <Raisons raisons={m.reasons} />
      <Details details={m.details} />
      <p className={styles.extra} style={{ marginTop: 8 }}>{e.email ?? "email inconnu"} · <Link href={`/membre/${e.id}`}>fiche</Link> · <Link href={`/messages?c=${m.conversation_id}`}>conversation</Link></p>
      <footer style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => decider(m, "ignorer", jours)} title="Rien à redire : le message reste.">Rien à signaler</button>
        <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)" }} disabled={busy} onClick={() => decider(m, "erreur", jours)} title="Le filtre s’est trompé ; noté pour corriger le lexique.">Erreur de détection</button>
        <button type="button" className={`btn ${styles.danger}`} disabled={busy} onClick={() => decider(m, "supprimer", jours)}>Supprimer le message</button>
        <button type="button" className={`btn ${styles.danger}`} disabled={busy} onClick={() => decider(m, "suspendre", jours)}>Suspendre {jours} j</button>
        <button type="button" className={`btn ${styles.danger}`} disabled={busy} onClick={() => decider(m, "bannir", jours)}>Bannir</button>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
          Suspension
          <select className="input" value={jours} onChange={(ev) => setJours(Number(ev.target.value))} style={{ width: "auto", padding: "6px 8px", fontSize: 13, minHeight: 0 }}>
            {[3, 7, 15, 30].map((j) => <option key={j} value={j}>{j} jours</option>)}
          </select>
        </label>
      </footer>
    </article>
  );
}

/* ---------- Le lexique ---------- */

function Lexique({ lignes, onChange, setErreur }: { lignes: LigneLexique[]; onChange: () => void; setErreur: (s: string | null) => void }) {
  const [filtre, setFiltre] = useState("");
  const [cat, setCat] = useState<string>("toutes");
  const [terme, setTerme] = useState("");
  const [categorie, setCategorie] = useState<string>("sexuel");
  const [niveau, setNiveau] = useState<LigneLexique["niveau"]>("fort");
  const [test, setTest] = useState("");
  const [resultat, setResultat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const poidsParDefaut: Record<string, number> = { certain: 60, fort: 25, faible: 6, exception: 0 };
  const q = filtre.trim().toLowerCase();
  const visibles = lignes.filter((l) => (cat === "toutes" || l.categorie === cat) && (!q || l.terme.includes(q)));

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    const t = terme.trim().toLowerCase();
    if (t.length < 2) return;
    setBusy(true); setErreur(null);
    const c = niveau === "exception" ? "exception" : categorie;
    const { error } = await supabase().from("moderation_lexique").insert({ terme: t, categorie: c, niveau, poids: poidsParDefaut[niveau] });
    setBusy(false);
    if (error) { setErreur(`Terme non ajouté : ${error.message}`); return; }
    setTerme("");
    onChange();
  }
  async function basculer(l: LigneLexique) {
    const { error } = await supabase().from("moderation_lexique").update({ actif: !l.actif }).eq("id", l.id);
    if (error) setErreur(error.message); else onChange();
  }
  async function changerNiveau(l: LigneLexique, n: LigneLexique["niveau"]) {
    const { error } = await supabase().from("moderation_lexique").update({ niveau: n, poids: poidsParDefaut[n], categorie: n === "exception" ? "exception" : (l.categorie === "exception" ? "sexuel" : l.categorie) }).eq("id", l.id);
    if (error) setErreur(error.message); else onChange();
  }
  async function supprimer(l: LigneLexique) {
    if (!confirm(`Retirer « ${l.terme} » du lexique ?`)) return;
    const { error } = await supabase().from("moderation_lexique").delete().eq("id", l.id);
    if (error) setErreur(error.message); else onChange();
  }
  async function tester(e: React.FormEvent) {
    e.preventDefault();
    if (!test.trim()) return;
    const { data, error } = await supabase().rpc("admin_tester_texte", { p_texte: test });
    if (error) { setResultat(`Erreur : ${error.message}`); return; }
    const r = data as { score: number; bloque: boolean; certitude: string; normalise: string; details: DetailModeration[] };
    setResultat(`Lu comme « ${r.normalise} » → score ${r.score}, certitude ${r.certitude}, ${r.bloque ? "BLOQUÉ" : "non bloqué"}${r.details.length ? " · " + r.details.map((d) => `${CATEGORIE_LABEL[d.code] ?? d.code} : ${d.termes.join(", ")}`).join(" · ") : " · rien relevé"}`);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <form onSubmit={tester} className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>Tester une phrase</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" value={test} onChange={(e) => setTest(e.target.value)} placeholder="Collez un titre ou une description…" style={{ flex: 1, minWidth: 220, fontSize: 14 }} />
          <button className="btn" disabled={!test.trim()}>Analyser</button>
        </div>
        {resultat && <p className={styles.extra} role="status">{resultat}</p>}
      </form>

      <form onSubmit={ajouter} className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>Ajouter un terme</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="terme ou expression" style={{ flex: 1, minWidth: 180, fontSize: 14 }} />
          <select className="input" value={niveau} onChange={(e) => setNiveau(e.target.value as LigneLexique["niveau"])} style={{ width: "auto", fontSize: 14 }}>
            {(Object.keys(NIVEAU_LABEL) as LigneLexique["niveau"][]).map((n) => <option key={n} value={n}>{NIVEAU_LABEL[n]}</option>)}
          </select>
          {niveau !== "exception" && (
            <select className="input" value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ width: "auto", fontSize: 14 }}>
              {CATEGORIES_LEXIQUE.filter((c) => c !== "exception").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button className="btn" disabled={busy || terme.trim().length < 2}>Ajouter</button>
        </div>
      </form>

      <div className={styles.toolbar}>
        <input className="input" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un terme…" />
        <div>
          {["toutes", ...CATEGORIES_LEXIQUE].map((c) => <button key={c} type="button" className={cat === c ? styles.selected : ""} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>
      <div className={styles.rows}>
        {visibles.slice(0, 200).map((l) => (
          <div key={l.id} className={styles.row} style={{ minHeight: 52, padding: "8px 15px", opacity: l.actif ? 1 : 0.5 }}>
            <div className={styles.main}>
              <b className={styles.kind}>{l.categorie}</b>
              <div><strong>{l.terme}</strong>{l.note && <p>{l.note}</p>}</div>
            </div>
            <div className={styles.rowButtons}>
              <select className="input" value={l.niveau} onChange={(e) => changerNiveau(l, e.target.value as LigneLexique["niveau"])} style={{ width: "auto", padding: "4px 8px", fontSize: 12, minHeight: 0 }}>
                {(Object.keys(NIVEAU_LABEL) as LigneLexique["niveau"][]).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" className="link-quiet" onClick={() => basculer(l)}>{l.actif ? "Désactiver" : "Activer"}</button>
              <button type="button" className="link-quiet" style={{ color: "var(--danger)" }} onClick={() => supprimer(l)}>Retirer</button>
            </div>
          </div>
        ))}
        {visibles.length === 0 && <div className={styles.empty}><strong>Aucun terme</strong><p>Rien ne correspond à ce filtre.</p></div>}
      </div>
      {visibles.length > 200 && <p className={styles.extra}>Les 200 premiers sont affichés ; affinez la recherche.</p>}
    </div>
  );
}

/* ---------- Réglages ---------- */

function ReglagesForm({ initial, onSauve, reevaluer, busy }: { initial: Reglages; onSauve: () => void; reevaluer: () => void; busy: boolean }) {
  const [r, setR] = useState<Reglages>(initial);
  const [termes, setTermes] = useState((initial.termes_interdits ?? []).join("\n"));
  const [motifs, setMotifs] = useState((initial.motifs_contact ?? []).join("\n"));
  const [etat, setEtat] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const num = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const lignes = (t: string) => Array.from(new Set(t.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean)));
  const blocage = r.seuils.blocage ?? 81;

  async function sauver(e: React.FormEvent) {
    e.preventDefault();
    if (r.seuils.surveillance >= r.seuils.verification || r.seuils.verification >= blocage) {
      setEtat("Les seuils doivent être croissants : surveillance < vérification < blocage.");
      return;
    }
    setEnvoi(true); setEtat(null);
    const lignesAEcrire = [
      { key: "seuils", value: { ...r.seuils, blocage } },
      { key: "poids", value: r.poids },
      { key: "prix", value: r.prix },
      { key: "rafale", value: r.rafale },
      { key: "termes_interdits", value: lignes(termes) },
      { key: "motifs_contact", value: lignes(motifs) },
      ...(r.regles ? [{ key: "regles", value: r.regles }] : []),
      ...(r.images ? [{ key: "images", value: r.images }] : []),
    ].map((x) => ({ ...x, updated_at: new Date().toISOString() }));
    const { error } = await supabase().from("moderation_settings").upsert(lignesAEcrire, { onConflict: "key" });
    setEnvoi(false);
    if (error) { setEtat(`Réglages non enregistrés : ${error.message}`); return; }
    setEtat("Réglages enregistrés. Ils s’appliquent aux prochaines évaluations.");
    onSauve();
  }

  const champ = (label: string, valeur: number, set: (n: number) => void, pas = 1) => (
    <label key={label} style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
      {label}
      <input className="input" inputMode="decimal" step={pas} type="number" value={valeur}
        onChange={(e) => set(num(e.target.value))} style={{ fontSize: 14, padding: "8px 10px" }} />
    </label>
  );

  return (
    <form onSubmit={sauver} style={{ display: "grid", gap: 18 }}>
      {r.regles && (
        <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
          <strong style={{ fontSize: 13.5 }}>Interrupteurs</strong>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {Object.keys(REGLES_LABEL).map((k) => (
              <label key={k} className="contact-case" style={{ fontSize: 13.5 }}>
                <input type="checkbox" checked={r.regles?.[k] !== false}
                  onChange={(e) => setR({ ...r, regles: { ...r.regles, [k]: e.target.checked } })} />
                <span><strong style={{ fontSize: 13.5 }}>{REGLES_LABEL[k]}</strong></span>
              </label>
            ))}
          </div>
          <p className={styles.extra}>Couper une famille retire ses points des prochaines évaluations. Utile pour isoler un faux positif récurrent le temps d’ajuster le lexique.</p>
        </div>
      )}

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Seuils du score (sur 100)</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Surveillance à partir de", r.seuils.surveillance, (n) => setR({ ...r, seuils: { ...r.seuils, surveillance: n } }))}
          {champ("Vérification humaine à partir de", r.seuils.verification, (n) => setR({ ...r, seuils: { ...r.seuils, verification: n } }))}
          {champ("Très élevé à partir de", blocage, (n) => setR({ ...r, seuils: { ...r.seuils, blocage: n } }))}
        </div>
        <p className={styles.extra}>En dessous du premier seuil, l’annonce paraît. Entre le premier et le deuxième, elle paraît sous surveillance. Au-delà du deuxième, elle attend un modérateur. Au-delà du troisième sans certitude, elle attend aussi, marquée « incertain » : le blocage automatique n’existe que pour un contenu certain.</p>
      </div>

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Prix</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Comparables minimum", r.prix.min_comparables, (n) => setR({ ...r, prix: { ...r.prix, min_comparables: n } }))}
          {champ("Prix bas si < médiane ×", r.prix.ratio_bas, (n) => setR({ ...r, prix: { ...r.prix, ratio_bas: n } }), 0.05)}
          {champ("Très bas si < médiane ×", r.prix.ratio_tres_bas, (n) => setR({ ...r, prix: { ...r.prix, ratio_tres_bas: n } }), 0.05)}
        </div>
        <p className={styles.extra}>Sous le nombre minimum d’annonces comparables (même catégorie, même sens), le prix n’est pas jugé : « données insuffisantes ». Un prix bas seul ne retire jamais une annonce.</p>
      </div>

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Rafale (annonces créées en une heure par un même compte)</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Modérée à partir de", r.rafale.moderee, (n) => setR({ ...r, rafale: { ...r.rafale, moderee: n } }))}
          {champ("Forte à partir de", r.rafale.forte, (n) => setR({ ...r, rafale: { ...r.rafale, forte: n } }))}
          {champ("Blocage à partir de", r.rafale.blocage, (n) => setR({ ...r, rafale: { ...r.rafale, blocage: n } }))}
        </div>
      </div>

      {r.images && (
        <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
          <strong style={{ fontSize: 13.5 }}>Analyse des photos (probabilités de 0 à 1)</strong>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {Object.keys(r.images).map((k) => champ(IMAGES_LABEL[k] ?? k, r.images![k], (n) => setR({ ...r, images: { ...r.images, [k]: n } }), 0.05))}
          </div>
          <p className={styles.extra}>Une personne habillée sur une photo de produit, de voiture ou de maison ne déclenche rien : seuls la nudité explicite bloque, et l’érotisme, les armes, la drogue, la violence ou un symbole haineux appellent un regard.</p>
        </div>
      )}

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Poids de chaque signal</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {Object.keys(r.poids).map((k) => champ(POIDS_LABEL[k] ?? k, r.poids[k], (n) => setR({ ...r, poids: { ...r.poids, [k]: n } })))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <label className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>Liste de blocage sec — un par ligne</strong>
          <span className={styles.extra}>Bloque avant publication, sans nuance. Le lexique ci-dessus est plus fin : préférez-le, gardez cette liste très courte.</span>
          <textarea className="input" rows={6} value={termes} onChange={(e) => setTermes(e.target.value)} style={{ fontSize: 13.5 }} />
        </label>
        <label className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>Contact hors site — un par ligne</strong>
          <span className={styles.extra}>Ajoutent des points, ne bloquent pas : liens, réseaux, « écrivez-moi en dehors du site »…</span>
          <textarea className="input" rows={6} value={motifs} onChange={(e) => setMotifs(e.target.value)} style={{ fontSize: 13.5 }} />
        </label>
      </div>

      {etat && <p className={etat.startsWith("Réglages enregistrés") ? styles.extra : styles.error} role="status">{etat}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer les réglages"}</button>
        <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)" }} disabled={busy} onClick={reevaluer}>
          {busy ? "Réévaluation…" : "Réévaluer les annonces en ligne"}
        </button>
      </div>
    </form>
  );
}
