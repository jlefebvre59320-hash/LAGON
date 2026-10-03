"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { APPAREIL_LABEL, SOURCE_LABEL, entier } from "@/lib/dashboard";
import { BarList, EtatVide } from "@/components/admin/Charts";
import { duree, heure, ilYA, nomPage, type TempsReel as Donnees } from "@/lib/tempsReel";

/* Temps réel : qui est sur le site, maintenant.
 *
 * Quatre chiffres en haut, une courbe des 24 dernières heures, la liste de
 * ceux qui sont là. Tout le reste est replié dans « Plus de détails ».
 *
 * Une requête toutes les dix secondes tant que l'onglet est visible, et
 * une relance immédiate dès qu'une vue arrive par la réplication. Les
 * administrateurs ne comptent dans aucun chiffre : leurs comptes sont
 * exclus et leurs pages vues ne sont pas enregistrées. */

const INTERVALLE_MS = 10_000;

export default function TempsReel() {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recu, setRecu] = useState<number | null>(null);
  const [tic, setTic] = useState(0);
  const [enDirect, setEnDirect] = useState(false);
  const enCours = useRef(false);

  const charger = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    const { data, error } = await supabase().rpc("admin_temps_reel");
    enCours.current = false;
    if (error || !data || !(data as Donnees).essentiel) {
      setErreur(error?.message?.includes("does not exist") || error?.code === "PGRST202" || (data && !(data as Donnees).essentiel)
        ? "La migration 0038_stats_visibles.sql n’est pas encore passée dans Supabase."
        : `Le temps réel n’a pas pu être chargé : ${error?.message ?? "réponse vide"}`);
      return;
    }
    setErreur(null);
    setD(data as Donnees);
    setRecu(Date.now());
  }, []);

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

  useEffect(() => {
    setTic(Date.now());
    const t = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (erreur && !d) return <EtatVide texte="Temps réel indisponible" aide={erreur} />;
  if (!d) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement du temps réel…</p>;

  const e = d.essentiel, h = d.h24;
  const decalage = recu && tic ? Math.max(0, tic - new Date(d.a).getTime()) : 0;
  const maxHeure = Math.max(1, ...d.par_heure.map((x) => x.n));

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
            mis à jour {recu ? ilYA(new Date(recu).toISOString(), tic) : "…"} · sans les administrateurs
          </p>
        </div>
        <button type="button" className="btn btn-outline-gold" style={{ color: "var(--gold-deep)", minHeight: 36, padding: "7px 14px", fontSize: 12.5 }} onClick={charger}>
          Actualiser
        </button>
      </header>
      {erreur && <p className="dash-note" style={{ color: "var(--danger)" }}>{erreur}</p>}

      {/* Les quatre chiffres. */}
      <div className="tr-essentiel">
        <Grand titre="Visiteurs maintenant" valeur={e.visiteurs_5min} aide="actifs ces 5 dernières minutes" fort />
        <Grand titre="Visiteurs uniques · 24 h" valeur={e.visiteurs_24h} aide={`${entier(h.pages)} pages vues · ${entier(h.visiteurs_7j)} sur 7 jours`} />
        <Grand titre="Comptes créés · 24 h" valeur={e.comptes_crees_24h} aide={`${entier(h.comptes_crees_7j)} sur 7 jours · ${entier(h.comptes_total)} au total`} />
        <Grand titre="Reconnexions · 24 h" valeur={e.reconnexions_24h} aide={`membres déjà inscrits revenus se connecter · ${entier(h.connexions)} connexion${h.connexions > 1 ? "s" : ""} en tout`} />
      </div>

      {/* Le second rang, en une ligne. */}
      <div className="tr-ligne">
        <Petit v={entier(h.visiteurs_revenus)} k="visiteurs revenus" aide="déjà venus avant ces 24 h" />
        <Petit v={entier(h.sessions)} k="sessions" />
        <Petit v={duree(h.duree_moyenne_s)} k="durée moyenne" />
        <Petit v={String(h.pages_par_session).replace(".", ",")} k="pages / session" />
        <Petit v={entier(h.annonces)} k="annonces déposées" />
        <Petit v={entier(h.messages)} k="messages" />
        <Petit v={entier(d.moderation.en_attente)} k="à modérer" alerte={d.moderation.en_attente > 0} />
      </div>

      {/* 24 heures, heure par heure. */}
      <div className="dash-carte">
        <h3>Les 24 dernières heures</h3>
        <p className="dash-note">Barre : pages vues. Partie pleine : visiteurs distincts. Heure de Saint-Barthélemy.</p>
        <div className="tr-heures">
          {d.par_heure.map((x, i) => (
            <div key={x.t} className="tr-heure" title={`${x.h} · ${x.n} vue${x.n > 1 ? "s" : ""} · ${x.v} visiteur${x.v > 1 ? "s" : ""}`}>
              <span className="tr-heure-barre" style={{ height: `${Math.max(x.n > 0 ? 4 : 1, (x.n / maxHeure) * 100)}%`, opacity: i === d.par_heure.length - 1 ? 1 : 0.85 }}>
                <i style={{ height: `${x.n > 0 ? (x.v / x.n) * 100 : 0}%` }} />
              </span>
              <small>{x.h}</small>
            </div>
          ))}
        </div>
      </div>

      {/* Qui est là. */}
      <div className="dash-carte">
        <h3>En ce moment · {d.sessions_actives.length} visiteur{d.sessions_actives.length > 1 ? "s" : ""}</h3>
        <p className="dash-note">Les navigateurs actifs ces cinq dernières minutes : depuis quand, combien de pages, où ils en sont. Anonymes : la clé identifie un navigateur, pas une personne.</p>
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

      {/* Tout le reste, replié. */}
      <details className="tr-details">
        <summary>Plus de détails · appareils, provenance, pages, connexions, flux</summary>
        <div className="dash-grille" style={{ marginTop: 12 }}>
          <div className="dash-carte">
            <h3>Dernières connexions</h3>
            <p className="dash-note">Les douze derniers membres à s’être connectés. « Nouveau » : inscrit depuis moins de 24 h.</p>
            {d.dernieres_connexions.length === 0 ? <EtatVide texte="Aucune connexion enregistrée" /> : (
              <ul className="tr-liste">
                {d.dernieres_connexions.map((u) => (
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
          <div className="dash-carte">
            <h3>Pages les plus vues · 24 h</h3>
            <p className="dash-note">Vues, et visiteurs distincts entre parenthèses.</p>
            <BarList couleur="var(--green-600)" items={d.pages_top.map((p) => ({
              cle: p.path, label: nomPage(p.path, p.titre), valeur: p.n, detail: `(${p.visiteurs})`,
            }))} />
          </div>
          <div className="dash-carte">
            <h3>Appareils · 24 h</h3>
            <Parts data={d.appareils_24h} labels={APPAREIL_LABEL} couleur="var(--green)" />
          </div>
          <div className="dash-carte">
            <h3>Provenance · 24 h</h3>
            <Parts data={d.sources_24h} labels={SOURCE_LABEL} couleur="var(--gold-deep)" />
          </div>
        </div>
        <div className="dash-carte" style={{ marginTop: 12 }}>
          <h3>Flux des pages vues</h3>
          <p className="dash-note">Les trente dernières vues, les plus récentes en haut.</p>
          {d.flux.length === 0 ? <EtatVide texte="Aucune vue pour l’instant" /> : (
            <div className="tr-flux">
              {d.flux.map((f, i) => (
                <div key={`${f.t}-${i}`} className="tr-flux-ligne">
                  <span className="tr-flux-heure">{heure(f.t)}</span>
                  <span className="tr-cle">{f.cle}</span>
                  <span className="tr-flux-page">
                    {f.path.startsWith("/annonce/") && f.titre ? <Link href={f.path}>{f.titre}</Link> : nomPage(f.path, f.titre)}
                  </span>
                  <span className="tr-flux-meta">
                    {f.device ? APPAREIL_LABEL[f.device] ?? f.device : "—"} · {f.source ? SOURCE_LABEL[f.source] ?? f.source : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function Grand({ titre, valeur, aide, fort }: { titre: string; valeur: number; aide: string; fort?: boolean }) {
  return (
    <div className={`dash-kpi${fort ? " tr-kpi-fort" : ""}`}>
      <span className="dash-kpi-titre">{titre}</span>
      <span className="dash-kpi-valeur">{entier(valeur)}</span>
      <span className="dash-kpi-delta neutre">{aide}</span>
    </div>
  );
}

function Petit({ v, k, aide, alerte }: { v: string; k: string; aide?: string; alerte?: boolean }) {
  return (
    <div className="tr-chiffre" title={aide}>
      <strong style={alerte ? { color: "var(--danger)" } : undefined}>{v}</strong>
      <span>{k}</span>
    </div>
  );
}

function Parts({ data, labels, couleur }: { data: Record<string, number>; labels: Record<string, string>; couleur: string }) {
  const cles = Object.keys(data).sort((x, y) => (data[y] ?? 0) - (data[x] ?? 0));
  const total = Object.values(data).reduce((s, n) => s + n, 0);
  if (cles.length === 0 || total === 0) return <EtatVide />;
  return (
    <BarList couleur={couleur} items={cles.map((k) => ({
      cle: k, label: labels[k] ?? (k === "inconnu" ? "Non renseigné" : k), valeur: data[k], detail: `(${Math.round((data[k] / total) * 100)} %)`,
    }))} />
  );
}
