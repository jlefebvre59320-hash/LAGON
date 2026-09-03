"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MODULES, type ModuleKey } from "@/lib/taxonomy";
import {
  PERIODES, SOURCE_LABEL, APPAREIL_LABEL,
  entier, evolution, libelleComparaison, libelleTemps,
  type Dashboard as Donnees, type Kpi,
} from "@/lib/dashboard";
import { BarList, EtatVide, LineChart, Sparkline } from "@/components/admin/Charts";

/* Tableau de bord : une période, une requête.
 *
 * Toutes les séries et tous les classements viennent du même appel SQL.
 * Un appel par graphique aurait multiplié les allers-retours et, surtout,
 * permis d'afficher côte à côte des chiffres calculés à des instants
 * différents — un tableau de bord qui se contredit lui-même.
 *
 * Les périodes déjà consultées sont gardées en mémoire : revenir sur
 * « 7 jours » après avoir regardé « 30 jours » est instantané et ne
 * redemande rien au serveur.
 */
export default function Dashboard() {
  const [jours, setJours] = useState(30);
  const [d, setD] = useState<Donnees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const cache = useRef<Map<number, Donnees>>(new Map());

  const charger = useCallback(async (p: number) => {
    const garde = cache.current.get(p);
    if (garde) { setD(garde); setChargement(false); return; }
    setChargement(true);
    setErreur(null);
    const { data, error } = await supabase().rpc("admin_dashboard", { p_jours: p });
    if (error || !data) {
      setErreur("Le tableau de bord n’a pas pu être chargé. La migration 0029 est-elle passée ?");
      setChargement(false);
      return;
    }
    cache.current.set(p, data as Donnees);
    setD(data as Donnees);
    setChargement(false);
  }, []);

  useEffect(() => { charger(jours); }, [jours, charger]);

  const g = d?.periode.granularite ?? "jour";
  const labels = useMemo(() => (d?.serie ?? []).map((p) => libelleTemps(p.t, g)), [d, g]);
  const labelsLongs = useMemo(() => (d?.serie ?? []).map((p) => libelleTemps(p.t, g, true)), [d, g]);

  return (
    <section className="dash">
      <header className="dash-tete">
        <div>
          <h2 className="dash-titre">Activité du site</h2>
          <p className="dash-sous">
            {chargement && !d ? "Chargement…" : libellePeriode(jours)} · heure de Saint-Barthélemy
          </p>
        </div>
        <div className="dash-periodes" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <button
              key={p.jours}
              type="button"
              className={`dash-periode${p.jours === jours ? " actif" : ""}`}
              aria-pressed={p.jours === jours}
              onClick={() => setJours(p.jours)}
            >
              <span className="only-desktop-inline">{p.label}</span>
              <span className="only-mobile-inline">{p.court}</span>
            </button>
          ))}
        </div>
      </header>

      {erreur && <p className="panel" style={{ padding: "12px 14px", color: "var(--danger)", fontWeight: 600 }}>{erreur}</p>}

      {d && (
        <>
          <div className="dash-kpis" aria-busy={chargement}>
            <Carte titre="Pages vues" k={d.kpi.vues} jours={jours}
              spark={d.serie.map((p) => p.vues)} couleur="var(--green)" />
            <Carte titre="Visiteurs uniques" k={d.kpi.visiteurs} jours={jours}
              spark={d.serie.map((p) => p.visiteurs)} couleur="var(--gold-deep)" />
            <Carte titre="Annonces déposées" k={d.kpi.annonces} jours={jours}
              spark={d.serie_annonces.map((p) => p.publiees)} couleur="var(--green-600)" />
            <Carte titre="Nouveaux comptes" k={d.kpi.comptes} jours={jours}
              spark={d.serie_comptes.map((p) => p.nouveaux)} couleur="var(--green-600)" />
            <Carte titre="Mises en favori" k={d.kpi.favoris} jours={jours} />
            <Carte titre="Annonces en ligne" k={d.kpi.annonces_actives} jours={jours}
              note="en ce moment" />
          </div>

          <div className="dash-carte dash-principal">
            <h3>Fréquentation</h3>
            <LineChart
              labels={labels}
              labelsLongs={labelsLongs}
              series={[
                { cle: "vues", label: "Pages vues", couleur: "var(--green)", valeurs: d.serie.map((p) => p.vues) },
                { cle: "visiteurs", label: "Visiteurs uniques", couleur: "var(--gold-deep)", valeurs: d.serie.map((p) => p.visiteurs) },
              ]}
            />
          </div>

          <div className="dash-grille">
            <div className="dash-carte">
              <h3>Vie des annonces</h3>
              <p className="dash-note">
                Les suppressions ne figurent pas ici : une annonce supprimée ne laisse aucune date à laquelle la rattacher.
              </p>
              <LineChart
                labels={labels}
                labelsLongs={labelsLongs}
                series={[
                  { cle: "publiees", label: "Publiées", couleur: "var(--green)", valeurs: d.serie_annonces.map((p) => p.publiees) },
                  { cle: "vendues", label: "Vendues", couleur: "var(--gold-deep)", valeurs: d.serie_annonces.map((p) => p.vendues) },
                ]}
              />
            </div>

            <div className="dash-carte">
              <h3>Nouveaux comptes</h3>
              <LineChart
                labels={labels}
                labelsLongs={labelsLongs}
                series={[
                  { cle: "nouveaux", label: "Inscriptions", couleur: "var(--green-600)", valeurs: d.serie_comptes.map((p) => p.nouveaux) },
                ]}
              />
            </div>

            <div className="dash-carte">
              <h3>Catégories</h3>
              <p className="dash-note">Classées par consultations d’annonces sur la période.</p>
              <BarList
                items={d.categories.map((c) => ({
                  cle: c.module,
                  label: MODULES[c.module as ModuleKey]?.short ?? c.module,
                  valeur: c.vues,
                  detail: `${entier(c.annonces)} en ligne`,
                }))}
                couleur="var(--green)"
              />
            </div>

            <div className="dash-carte">
              <h3>Pages les plus vues</h3>
              <BarList
                items={d.pages.map((p) => ({
                  cle: p.path,
                  label: p.titre,
                  valeur: p.vues,
                  detail: `${entier(p.visiteurs)} visiteur${p.visiteurs > 1 ? "s" : ""}`,
                }))}
                couleur="var(--green-600)"
              />
            </div>

            <div className="dash-carte">
              <h3>D’où viennent les visiteurs</h3>
              {d.sources.length === 0 ? (
                <EtatVide
                  texte="Pas encore assez de données"
                  aide="La provenance n’est mesurée que depuis la mise en place du tableau de bord : les visites antérieures n’en portent aucune."
                />
              ) : (
                <BarList
                  items={d.sources.map((s) => ({
                    cle: s.cle,
                    label: SOURCE_LABEL[s.cle] ?? s.cle,
                    valeur: s.vues,
                  }))}
                  couleur="var(--gold-deep)"
                />
              )}
            </div>

            <div className="dash-carte">
              <h3>Appareils</h3>
              {d.appareils.length === 0 ? (
                <EtatVide
                  texte="Pas encore assez de données"
                  aide="Le type d’appareil n’est mesuré que depuis la mise en place du tableau de bord."
                />
              ) : (
                <BarList
                  items={d.appareils.map((a) => ({
                    cle: a.cle,
                    label: APPAREIL_LABEL[a.cle] ?? a.cle,
                    valeur: a.vues,
                  }))}
                  couleur="var(--gold-deep)"
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Carte({
  titre, k, jours, spark, couleur, note,
}: {
  titre: string; k: Kpi; jours: number;
  spark?: number[]; couleur?: string; note?: string;
}) {
  const ev = evolution(k);
  return (
    <div className="dash-kpi">
      <span className="dash-kpi-titre">{titre}</span>
      <span className="dash-kpi-valeur">{entier(k.actuel)}</span>
      {/* Aucune évolution affichée quand elle n'a pas de sens : une période
          précédente à zéro ne produit pas un pourcentage, et un stock ne se
          compare pas à une période. */}
      {ev != null ? (
        <span className={`dash-kpi-delta${ev > 0 ? " hausse" : ev < 0 ? " baisse" : ""}`}>
          {ev > 0 ? "↑" : ev < 0 ? "↓" : "="} {Math.abs(ev)} % <small>{libelleComparaison(jours)}</small>
        </span>
      ) : (
        <span className="dash-kpi-delta neutre">
          {note ?? (k.precedent === 0 ? "aucune donnée avant" : "—")}
        </span>
      )}
      {spark && couleur && <Sparkline valeurs={spark} couleur={couleur} />}
    </div>
  );
}

function libellePeriode(jours: number): string {
  const p = PERIODES.find((x) => x.jours === jours);
  return jours === 1 ? "Aujourd’hui" : `Les ${p?.label ?? `${jours} jours`}`;
}
