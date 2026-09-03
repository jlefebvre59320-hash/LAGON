"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, eur, type ModuleKey } from "@/lib/taxonomy";
import { photoUrl } from "@/components/ListingCard";
import { thumbKey } from "@/lib/images";
import {
  DECISIONS, MOTIF_LABEL, POIDS_LABEL, RAISON_LABEL, ETAT_LABEL, niveauRisque,
  type Decision, type DossierModeration, type SousSurveillance, type Reglages, type RaisonRisque,
} from "@/lib/moderation";
import styles from "@/app/stats/admin.module.css";

/* La file de modération : ce que la machine a retenu, ce que les gens ont
   signalé, et les boutons pour trancher. Chaque dossier montre le score,
   ses raisons une à une, l'auteur et son historique, les photos, les
   signalements — tout ce qu'il faut pour décider sans ouvrir dix onglets.

   Tant que la migration 0032 n'est pas passée, la fonction n'existe pas :
   on le dit, et la page continue de montrer l'ancienne liste de
   signalements à la place. */

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const depuis = (iso: string) => {
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return j < 1 ? "aujourd’hui" : j === 1 ? "hier" : j < 31 ? `il y a ${j} jours` : j < 365 ? `il y a ${Math.floor(j / 30)} mois` : `il y a ${Math.floor(j / 365)} an${j >= 730 ? "s" : ""}`;
};

export default function FileModeration({ onEtat }: { onEtat: (dispo: boolean, nb: number) => void }) {
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [dossiers, setDossiers] = useState<DossierModeration[]>([]);
  const [surveillance, setSurveillance] = useState<SousSurveillance[]>([]);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirReglages, setVoirReglages] = useState(false);
  const [voirSurveillance, setVoirSurveillance] = useState(false);

  const charger = useCallback(async () => {
    const sb = supabase();
    const [f, s, r] = await Promise.all([
      sb.rpc("admin_file_moderation"),
      sb.rpc("admin_sous_surveillance"),
      sb.from("moderation_settings").select("key, value"),
    ]);
    if (f.error) { setDispo(false); onEtat(false, 0); return; }
    const liste = Array.isArray(f.data) ? (f.data as DossierModeration[]) : [];
    setDossiers(liste);
    setSurveillance(Array.isArray(s.data) ? (s.data as SousSurveillance[]) : []);
    if (Array.isArray(r.data)) {
      const obj = Object.fromEntries((r.data as { key: string; value: unknown }[]).map((x) => [x.key, x.value]));
      setReglages(obj as unknown as Reglages);
    }
    setDispo(true);
    onEtat(true, liste.length);
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

  if (dispo === null) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement de la file…</p>;
  if (dispo === false) return (
    <div className={styles.empty}>
      <strong>File de modération à activer</strong>
      <p>Exécutez la migration <code>0032_moderation.sql</code> dans Supabase : score de risque, dossiers, décisions et réglages apparaîtront ici.</p>
    </div>
  );

  return (
    <>
      {erreur && <p className={styles.error} role="alert">{erreur}</p>}

      <section className={styles.section}>
        <h3>File de modération ({dossiers.length})</h3>
        <p>Les annonces qui attendent un regard humain : en attente, retenues, ou signalées. Un seul signal faible n’amène jamais une annonce ici — regardez l’ensemble avant de trancher.</p>
        <div>
          {dossiers.length === 0
            ? <div className={styles.empty}><strong>Rien à vérifier</strong><p>Aucune annonce n’attend de décision. Les nouvelles apparaîtront ici automatiquement.</p></div>
            : dossiers.map((d) => <Dossier key={d.case_id} d={d} busy={busy === d.case_id} decider={decider} />)}
        </div>
      </section>

      <section className={styles.section}>
        <h3>
          <button type="button" className="link-quiet" style={{ font: "inherit", color: "inherit" }} onClick={() => setVoirSurveillance(!voirSurveillance)}>
            {voirSurveillance ? "▾" : "▸"} Sous surveillance ({surveillance.length})
          </button>
        </h3>
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

      <section className={styles.section}>
        <h3>
          <button type="button" className="link-quiet" style={{ font: "inherit", color: "inherit" }} onClick={() => setVoirReglages(!voirReglages)}>
            {voirReglages ? "▾" : "▸"} Réglages du score
          </button>
        </h3>
        <p>Seuils, poids et listes de termes. Les changements s’appliquent aux prochaines évaluations, sans redéploiement.</p>
        {voirReglages && reglages && <ReglagesForm initial={reglages} onSauve={charger} />}
        {voirReglages && !reglages && <div className={styles.empty}><strong>Réglages introuvables</strong><p>La table moderation_settings est vide ou inaccessible.</p></div>}
      </section>
    </>
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
          {raisons.length === 0
            ? <p className={styles.extra} style={{ marginTop: 8 }}>Aucun signal automatique.</p>
            : <ul className="risque-raisons" style={{ marginTop: 8 }}>
                {raisons.map((r, i) => (
                  <li key={i}>
                    <b>{r.points > 0 ? `+${r.points}` : "·"}</b>
                    <span><strong>{RAISON_LABEL[r.code] ?? r.code}</strong> — {r.detail}</span>
                  </li>
                ))}
              </ul>}
          {d.signalements.length > 0 && (
            <ul className="risque-raisons" style={{ marginTop: 10 }}>
              {d.signalements.map((s) => {
                const label = s.motif ? MOTIF_LABEL[s.motif] ?? s.motif : "Signalement";
                /* reason commence déjà par le libellé du motif (c'est ainsi
                   que le panneau l'écrit) : on ne le répète pas. */
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

/* ---------- Réglages ---------- */

function ReglagesForm({ initial, onSauve }: { initial: Reglages; onSauve: () => void }) {
  const [r, setR] = useState<Reglages>(initial);
  const [termes, setTermes] = useState((initial.termes_interdits ?? []).join("\n"));
  const [motifs, setMotifs] = useState((initial.motifs_contact ?? []).join("\n"));
  const [etat, setEtat] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const num = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const lignes = (t: string) => Array.from(new Set(t.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean)));

  async function sauver(e: React.FormEvent) {
    e.preventDefault();
    if (r.seuils.surveillance >= r.seuils.verification) { setEtat("Le seuil de surveillance doit être inférieur au seuil de vérification."); return; }
    setEnvoi(true); setEtat(null);
    const lignesAEcrire = [
      { key: "seuils", value: r.seuils },
      { key: "poids", value: r.poids },
      { key: "prix", value: r.prix },
      { key: "rafale", value: r.rafale },
      { key: "termes_interdits", value: lignes(termes) },
      { key: "motifs_contact", value: lignes(motifs) },
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
      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Seuils du score (sur 100)</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Surveillance à partir de", r.seuils.surveillance, (n) => setR({ ...r, seuils: { ...r.seuils, surveillance: n } }))}
          {champ("Vérification humaine à partir de", r.seuils.verification, (n) => setR({ ...r, seuils: { ...r.seuils, verification: n } }))}
        </div>
        <p className={styles.extra}>En dessous du premier seuil, l’annonce paraît sans autre forme de procès. Entre les deux, elle paraît et reste sous surveillance. Au-delà, elle attend un modérateur.</p>
      </div>

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Prix</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Comparables minimum", r.prix.min_comparables, (n) => setR({ ...r, prix: { ...r.prix, min_comparables: n } }))}
          {champ("Prix bas si < médiane ×", r.prix.ratio_bas, (n) => setR({ ...r, prix: { ...r.prix, ratio_bas: n } }), 0.05)}
          {champ("Très bas si < médiane ×", r.prix.ratio_tres_bas, (n) => setR({ ...r, prix: { ...r.prix, ratio_tres_bas: n } }), 0.05)}
        </div>
        <p className={styles.extra}>Sous le nombre minimum d’annonces comparables (même catégorie, même sens), le prix n’est pas jugé : « données insuffisantes ».</p>
      </div>

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Rafale (annonces créées en une heure par un même compte)</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {champ("Modérée à partir de", r.rafale.moderee, (n) => setR({ ...r, rafale: { ...r.rafale, moderee: n } }))}
          {champ("Forte à partir de", r.rafale.forte, (n) => setR({ ...r, rafale: { ...r.rafale, forte: n } }))}
          {champ("Blocage à partir de", r.rafale.blocage, (n) => setR({ ...r, rafale: { ...r.rafale, blocage: n } }))}
        </div>
      </div>

      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 13.5 }}>Poids de chaque signal</strong>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {Object.keys(r.poids).map((k) => champ(POIDS_LABEL[k] ?? k, r.poids[k], (n) => setR({ ...r, poids: { ...r.poids, [k]: n } })))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <label className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>Termes interdits — un par ligne</strong>
          <span className={styles.extra}>Bloquant avant publication. Gardez la liste courte et sans ambiguïté.</span>
          <textarea className="input" rows={8} value={termes} onChange={(e) => setTermes(e.target.value)} style={{ fontSize: 13.5 }} />
        </label>
        <label className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>Motifs de contact suspects — un par ligne</strong>
          <span className={styles.extra}>Ajoutent des points, ne bloquent pas : paiement à distance, lien externe…</span>
          <textarea className="input" rows={8} value={motifs} onChange={(e) => setMotifs(e.target.value)} style={{ fontSize: 13.5 }} />
        </label>
      </div>

      {etat && <p className={etat.startsWith("Réglages enregistrés") ? styles.extra : styles.error} role="status">{etat}</p>}
      <div><button className="btn" disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer les réglages"}</button></div>
    </form>
  );
}
