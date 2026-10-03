"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { APPAREIL_LABEL, SOURCE_LABEL, entier } from "@/lib/dashboard";
import { BarList, EtatVide } from "@/components/admin/Charts";
import { duree, heure, ilYA, nomPage, type TempsReel as Donnees } from "@/lib/tempsReel";

/* Temps réel : qui est sur le site, maintenant.
 *
 * Une requête toutes les dix secondes tant que l'onglet est visible, et
 * une relance immédiate dès qu'une vue arrive par la réplication : le
 * tableau bouge quand le site bouge. Les durées affichées (« depuis
 * 3 min ») avancent seules entre deux requêtes grâce à une horloge locale.
 *
 * La mesure reste anonyme : un visiteur est une clé de six caractères
 * dérivée de l'identifiant aléatoire de son navigateur, jamais un compte. */

const INTERVALLE_MS = 10_000;

export default function TempsReel() {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recu, setRecu] = useState<number | null>(null);
  /* L'horloge locale, mise en route après le premier rendu : elle fait
     avancer « il y a 12 s » et les durées des sessions entre deux requêtes. */
  const [tic, setTic] = useState(0);
  const [enDirect, setEnDirect] = useState(false);
  const enCours = useRef(false);

  const charger = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    const { data, error } = await supabase().rpc("admin_temps_reel");
    enCours.current = false;
    if (error || !data) {
      setErreur(error?.message?.includes("does not exist") || error?.code === "PGRST202"
        ? "La migration 0037_temps_reel.sql n’est pas encore passée dans Supabase."
        : `Le temps réel n’a pas pu être chargé : ${error?.message ?? "réponse vide"}`);
      return;
    }
    setErreur(null);
    setD(data as Donnees);
    setRecu(Date.now());
  }, []);

  /* Rythme : toutes les dix secondes, seulement quand l'onglet est visible.
     Un tableau de bord oublié dans un onglet n'a pas à interroger la base
     toute la nuit. */
  useEffect(() => {
    charger();
    let timer: ReturnType<typeof setInterval> | null = null;
    const demarrer = () => { if (!timer) timer = setInterval(charger, INTERVALLE_MS); };
    const arreter = () => { if (timer) { clearInterval(timer); timer = null; } };
    const visibilite = () => { if (document.visibilityState === "visible") { charger(); demarrer(); } else arreter(); };
    demarrer();
    document.addEventListener("visibilitychange", visibilite);
    return () => { arreter(); document.removeEventListener("visibilitychange", visibilite); };
  }, [charger]);

  /* La réplication : une vue arrive, on recharge dans la seconde. Si la
     table n'est pas publiée, on reste sur le rythme des dix secondes. */
  useEffect(() => {
    let attente: ReturnType<typeof setTimeout> | null = null;
    const canal = supabase()
      .channel(`temps-reel-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "page_views" }, () => {
        if (attente) clearTimeout(attente);
        attente = setTimeout(charger, 800);
      })
      .subscribe((etat) => setEnDirect(etat === "SUBSCRIBED"));
    return () => { if (attente) clearTimeout(attente); supabase().removeChannel(canal); };
  }, [charger]);

  /* L'horloge locale fait avancer « il y a 12 s » et les durées des
     sessions entre deux requêtes. */
  useEffect(() => {
    setTic(Date.now());
    const t = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const parMinute = useMemo(() => (d?.par_minute ?? []).map((p) => p.n), [d]);
  const maxMinute = Math.max(1, ...parMinute);

  if (erreur && !d) return <EtatVide texte="Temps réel indisponible" aide={erreur} />;
  if (!d) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement du temps réel…</p>;

  const m = d.maintenant, c = d.comptes, a = d.activite_jour, sj = d.sessions_jour;
  const decalage = recu && tic ? Math.max(0, tic - new Date(d.a).getTime()) : 0;

  return (
    <section className="dash tr">
      <header className="dash-tete">
        <div>
          <h2 className="dash-titre">
            <span className={`tr-point${enDirect ? " vivant" : ""}`} aria-hidden="true" />
            Temps réel
          </h2>
          <p className="dash-sous">
            {enDirect ? "En direct · " : "Toutes les 10 s · "}
            mis à jour {recu ? ilYA(new Date(recu).toISOString(), tic) : "…"} · heure de Saint-Barthélemy
          </p>
        </div>
        <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)", minHeight: 36, padding: "7px 14px", fontSize: 12.5 }} onClick={charger}>
          Actualiser
        </button>
      </header>
      {erreur && <p className="dash-note" style={{ color: "var(--danger)" }}>{erreur}</p>}

      {/* La ligne qui compte : combien de personnes, là, tout de suite. */}
      <div className="dash-kpis">
        <Kpi titre="Visiteurs maintenant" valeur={m.visiteurs_5min} note="actifs ces 5 dernières minutes" fort />
        <Kpi titre="Pages vues · 5 min" valeur={m.pages_5min} note={`${entier(m.pages_60min)} sur l’heure`} />
        <Kpi titre="Visiteurs · 1 h" valeur={m.visiteurs_60min} note={`${entier(m.visiteurs_jour)} aujourd’hui`} />
        <Kpi titre="Connexions · 30 min" valeur={c.connectes_30min} note={`${entier(c.connectes_2h ?? c.connectes_24h)} sur ${c.connectes_2h != null ? "2 h" : "24 h"} · ${entier(c.total)} comptes`} />
        <Kpi titre="Connexions aujourd’hui" valeur={c.connexions_jour} note={`${entier(c.nouveaux_jour)} nouveau${c.nouveaux_jour > 1 ? "x" : ""} compte${c.nouveaux_jour > 1 ? "s" : ""} · ${entier(c.connectes_24h)} sur 24 h`} />
        <Kpi titre="Pages vues aujourd’hui" valeur={m.pages_jour} note={d.pic_jour ? `pic ${entier(d.pic_jour)} à ${d.heure_pic ?? "?"} · ${entier(sj.nb)} session${sj.nb > 1 ? "s" : ""}` : `${entier(sj.nb)} session${sj.nb > 1 ? "s" : ""}`} />
      </div>

      {/* Soixante minutes, une barre par minute. */}
      <div className="dash-carte">
        <h3>Pages vues, minute par minute</h3>
        <p className="dash-note">L’heure écoulée. Pic : {entier(maxMinute)} vue{maxMinute > 1 ? "s" : ""} en une minute.</p>
        <div className="tr-minutes" role="img" aria-label={`Pages vues par minute sur l’heure écoulée, pic de ${maxMinute}`}>
          {parMinute.map((n, i) => (
            <span key={i} className="tr-minute" title={`${d.par_minute?.[i] ? heure(d.par_minute[i].t).slice(0, 5) : ""} · ${n} vue${n > 1 ? "s" : ""}`}
              style={{ height: `${Math.max(n > 0 ? 6 : 2, (n / maxMinute) * 100)}%`, opacity: i === parMinute.length - 1 ? 1 : 0.55 + 0.45 * (i / parMinute.length) }} />
          ))}
        </div>
        <div className="tr-minutes-axe"><span>il y a 60 min</span><span>il y a 30 min</span><span>maintenant</span></div>
      </div>

      {/* La journée, heure par heure : pages vues et visiteurs distincts. */}
      {(d.par_heure_jour?.length ?? 0) > 0 && (
        <div className="dash-carte">
          <h3>La journée, heure par heure</h3>
          <p className="dash-note">Depuis minuit, heure de l’île. Barre pleine : pages vues ; trait : visiteurs distincts.</p>
          <div className="tr-heures">
            {d.par_heure_jour!.map((h) => {
              const maxH = Math.max(1, ...d.par_heure_jour!.map((x) => x.n));
              return (
                <div key={h.h} className="tr-heure" title={`${h.h} · ${h.n} vue${h.n > 1 ? "s" : ""} · ${h.v} visiteur${h.v > 1 ? "s" : ""}`}>
                  <span className="tr-heure-barre" style={{ height: `${Math.max(h.n > 0 ? 4 : 1, (h.n / maxH) * 100)}%` }}>
                    <i style={{ height: `${h.n > 0 ? (h.v / h.n) * 100 : 0}%` }} />
                  </span>
                  <small>{h.h}</small>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dash-grille">
        {/* Qui est là, session par session. */}
        <div className="dash-carte">
          <h3>En ce moment · {d.sessions_actives.length} session{d.sessions_actives.length > 1 ? "s" : ""}</h3>
          <p className="dash-note">Les navigateurs actifs ces cinq dernières minutes : depuis quand, combien de pages, où ils en sont.</p>
          {d.sessions_actives.length === 0 ? <EtatVide texte="Personne en ce moment" aide="Les visiteurs apparaîtront ici dès leur première page." /> : (
            <ul className="tr-liste">
              {d.sessions_actives.map((s) => (
                <li key={s.cle} className="tr-session">
                  <span className="tr-cle" title="Identifiant anonyme du navigateur">{s.cle}</span>
                  <span className="tr-corps">
                    <strong>{nomPage(s.derniere, s.titre)}</strong>
                    <small>
                      {s.device ? APPAREIL_LABEL[s.device] ?? s.device : "appareil inconnu"}
                      {" · "}{s.source ? SOURCE_LABEL[s.source] ?? s.source : "provenance inconnue"}
                      {" · "}{s.pages} page{s.pages > 1 ? "s" : ""}
                    </small>
                  </span>
                  <span className="tr-duree">
                    <strong>{duree(s.duree_s + decalage / 1000)}</strong>
                    <small>{ilYA(s.fin, tic)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Les sessions du jour, en durées. */}
        <div className="dash-carte">
          <h3>Sessions aujourd’hui</h3>
          <p className="dash-note">Une session s’arrête après trente minutes sans page vue. Les durées ne comptent que les sessions de deux pages ou plus : une seule page n’a pas de durée mesurable.</p>
          <div className="tr-grille-chiffres">
            <Chiffre v={entier(sj.nb)} k="sessions" />
            <Chiffre v={duree(sj.duree_moyenne_s)} k="durée moyenne" />
            <Chiffre v={duree(sj.duree_mediane_s)} k="durée médiane" />
            <Chiffre v={duree(sj.duree_max_s)} k="la plus longue" />
            <Chiffre v={String(sj.pages_moyennes).replace(".", ",")} k="pages par session" />
            <Chiffre v={`${sj.rebond_pct} %`} k="une seule page" />
            <Chiffre v={entier(sj.visiteurs_revenus)} k="revenus dans la journée" />
            <Chiffre v={entier(m.visiteurs_jour)} k="visiteurs distincts" />
          </div>
        </div>

        <div className="dash-carte">
          <h3>Appareils</h3>
          <p className="dash-note">Sur l’heure écoulée, puis sur la journée.</p>
          <Repartition heure={d.appareils_60min} jour={d.appareils_jour} labels={APPAREIL_LABEL} couleur="var(--green)" />
        </div>

        <div className="dash-carte">
          <h3>Provenance</h3>
          <p className="dash-note">D’où viennent les visites : accès direct, moteur, réseau social.</p>
          <Repartition heure={d.sources_60min} jour={d.sources_jour} labels={SOURCE_LABEL} couleur="var(--gold-deep)" />
        </div>

        <div className="dash-carte">
          <h3>Pages les plus vues · 1 h</h3>
          <p className="dash-note">Vues, et visiteurs distincts entre parenthèses.</p>
          <BarList couleur="var(--green-600)" items={d.pages_top.map((p) => ({
            cle: p.path, label: nomPage(p.path, p.titre), valeur: p.n, detail: `(${p.visiteurs})`,
          }))} />
        </div>

        <div className="dash-carte">
          <h3>Activité aujourd’hui</h3>
          <p className="dash-note">Ce que le site a produit depuis minuit.</p>
          <div className="tr-grille-chiffres">
            <Chiffre v={entier(a.annonces)} k={`annonce${a.annonces > 1 ? "s" : ""} déposée${a.annonces > 1 ? "s" : ""}`} note={a.annonces_60min ? `${a.annonces_60min} dans l’heure` : undefined} />
            <Chiffre v={entier(a.messages)} k={`message${a.messages > 1 ? "s" : ""}`} note={a.messages_60min ? `${a.messages_60min} dans l’heure` : undefined} />
            <Chiffre v={entier(a.conversations)} k="conversations actives" />
            <Chiffre v={entier(c.nouveaux_jour)} k="inscriptions" note={`${entier(c.nouveaux_7j)} sur 7 jours`} />
            <Chiffre v={entier(a.favoris)} k="favoris ajoutés" />
            <Chiffre v={entier(a.alertes)} k="alertes créées" />
            <Chiffre v={entier(a.signalements)} k="signalements" />
            <Chiffre v={entier(a.en_attente)} k="dossiers à modérer" alerte={a.en_attente > 0} />
            <Chiffre v={entier(a.en_ligne)} k="annonces en ligne" />
          </div>
        </div>

        <div className="dash-carte">
          <h3>Dernières connexions</h3>
          <p className="dash-note">Les quinze derniers comptes à s’être connectés. « Nouveau » : inscrit depuis moins de 24 h.</p>
          {c.dernieres.length === 0 ? <EtatVide texte="Aucune connexion enregistrée" /> : (
            <ul className="tr-liste">
              {c.dernieres.map((u) => (
                <li key={u.id} className="tr-session">
                  <span className="tr-avatar" aria-hidden="true">{u.nom.trim().charAt(0).toUpperCase() || "?"}</span>
                  <span className="tr-corps">
                    <strong><Link href={`/membre/${u.id}`}>{u.nom}</Link>{u.nouveau && <em className="tr-nouveau">Nouveau</em>}</strong>
                    <small>{u.email ?? "email inconnu"}</small>
                  </span>
                  <span className="tr-duree"><strong>{ilYA(u.quand, tic)}</strong><small>{heure(u.quand).slice(0, 5)}</small></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Le flux : chaque vue, dans l'ordre, comme un journal qui défile. */}
      <div className="dash-carte">
        <h3>Flux des pages vues</h3>
        <p className="dash-note">Les quarante dernières vues, les plus récentes en haut. La clé est l’identifiant anonyme du navigateur : la même clé, c’est la même personne qui continue sa visite.</p>
        {d.flux.length === 0 ? <EtatVide texte="Aucune vue pour l’instant" /> : (
          <div className="tr-flux">
            {d.flux.map((f, i) => (
              <div key={`${f.t}-${i}`} className="tr-flux-ligne">
                <span className="tr-flux-heure">{heure(f.t)}</span>
                <span className="tr-cle">{f.cle}</span>
                <span className="tr-flux-page">
                  {f.path.startsWith("/annonce/") && f.titre
                    ? <Link href={f.path}>{f.titre}</Link>
                    : nomPage(f.path, f.titre)}
                </span>
                <span className="tr-flux-meta">
                  {f.device ? APPAREIL_LABEL[f.device] ?? f.device : "—"} · {f.source ? SOURCE_LABEL[f.source] ?? f.source : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({ titre, valeur, note, fort }: { titre: string; valeur: number; note?: string; fort?: boolean }) {
  return (
    <div className={`dash-kpi${fort ? " tr-kpi-fort" : ""}`}>
      <span className="dash-kpi-titre">{titre}</span>
      <span className="dash-kpi-valeur">{entier(valeur)}</span>
      {note && <span className="dash-kpi-delta neutre">{note}</span>}
    </div>
  );
}

function Chiffre({ v, k, note, alerte }: { v: string; k: string; note?: string; alerte?: boolean }) {
  return (
    <div className="tr-chiffre">
      <strong style={alerte ? { color: "var(--danger)" } : undefined}>{v}</strong>
      <span>{k}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

/* Deux colonnes : l'heure écoulée et la journée, sur les mêmes lignes. */
function Repartition({ heure: h, jour, labels, couleur }: {
  heure: Record<string, number>; jour: Record<string, number>; labels: Record<string, string>; couleur: string;
}) {
  const cles = Array.from(new Set([...Object.keys(jour), ...Object.keys(h)]))
    .sort((x, y) => (jour[y] ?? 0) - (jour[x] ?? 0));
  if (cles.length === 0) return <EtatVide />;
  const totalH = Object.values(h).reduce((s, n) => s + n, 0) || 1;
  const totalJ = Object.values(jour).reduce((s, n) => s + n, 0) || 1;
  return (
    <table className="tr-table">
      <thead><tr><th></th><th>1 h</th><th>Aujourd’hui</th></tr></thead>
      <tbody>
        {cles.map((k) => (
          <tr key={k}>
            <td>{labels[k] ?? (k === "inconnu" ? "Non renseigné" : k)}</td>
            <td><Part n={h[k] ?? 0} total={totalH} couleur={couleur} /></td>
            <td><Part n={jour[k] ?? 0} total={totalJ} couleur={couleur} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Part({ n, total, couleur }: { n: number; total: number; couleur: string }) {
  const pct = Math.round((n / total) * 100);
  return (
    <span className="tr-part">
      <span className="tr-part-piste"><span style={{ width: `${pct}%`, background: couleur }} /></span>
      <span className="tr-part-txt">{entier(n)} <small>({pct} %)</small></span>
    </span>
  );
}
