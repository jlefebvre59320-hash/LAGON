"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_ORDER, INTENT_FILTER, type Intent, type ModuleKey } from "@/lib/taxonomy";
import { SiteHeader } from "@/components/Brand";

type Daily = { day: string; visits: number };
type Top = { id: string; title: string; module: ModuleKey; views: number };

type Claim = {
  id: string;
  restaurant_id: string;
  kind: "claim" | "correction" | "removal";
  message: string;
  contact: string;
  user_id: string | null;
  created_at: string;
  restaurant: { name: string } | null;
};

type Report = {
  id: string; listing_id: string; reason: string; created_at: string;
  listing: { title: string; status: string } | null;
};
type Feedback = {
  id: string; kind: "idee" | "probleme" | "avis"; message: string;
  contact: string | null; created_at: string;
};
type PendingEvent = {
  id: string; title: string; category: string; venue: string; quartier: string;
  starts_at: string; price: string; description: string; link: string | null;
  organizer: string; contact: string; created_at: string;
};
type AdminUser = {
  id: string; email: string; display_name: string; created_at: string;
  last_sign_in: string | null; is_banned: boolean; listings: number;
};
const FEEDBACK_KIND: Record<Feedback["kind"], string> = {
  idee: "Idée", probleme: "Problème", avis: "Avis",
};

const CLAIM_KIND: Record<Claim["kind"], string> = {
  claim: "Revendication",
  correction: "Correction",
  removal: "Demande de retrait",
};

type SiteStats = {
  listings_total: number; listings_active: number; listings_30d: number; listings_7d: number;
  users_total: number; users_30d: number;
  views_total: number; views_7d: number;
  visits_7d: number; visitors_7d: number;
  favorites_total: number;
  by_module: Partial<Record<ModuleKey, number>>;
  by_intent: Partial<Record<Intent, number>>;
  daily: Daily[];
  top_listings: Top[];
};

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export default function Stats() {
  const router = useRouter();
  const [s, setS] = useState<SiteStats | null>(null);
  const [denied, setDenied] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);

  const loadClaims = async () => {
    const { data } = await supabase()
      .from("restaurant_claims")
      .select("*, restaurant:restaurants(name)")
      .eq("handled", false)
      .order("created_at", { ascending: true });
    setClaims((data as Claim[]) ?? []);
    const { data: reps } = await supabase()
      .from("reports")
      .select("id, listing_id, reason, created_at, listing:listings(title, status)")
      .eq("handled", false).order("created_at", { ascending: true });
    setReports((reps as unknown as Report[]) ?? []);
    const { data: fb } = await supabase()
      .from("feedback").select("*").eq("handled", false).order("created_at", { ascending: true });
    setFeedback((fb as Feedback[]) ?? []);
    const { data: us } = await supabase().rpc("admin_users");
    setUsers((us as AdminUser[]) ?? []);
    /* La table events n'existe qu'après la migration 0018 : un échec ici ne
       doit pas faire tomber le reste du tableau de bord. */
    const { data: evs, error: evErr } = await supabase()
      .from("events").select("*").eq("status", "pending").order("starts_at");
    setPendingEvents(evErr ? [] : ((evs as PendingEvent[]) ?? []));
  };

  async function resolveEvent(e: PendingEvent, status: "approved" | "rejected") {
    setBusyClaim(e.id);
    await supabase().from("events").update({ status }).eq("id", e.id);
    setBusyClaim(null);
    loadClaims();
  }

  async function toggleBan(u: AdminUser) {
    if (!confirm(u.is_banned ? `Rétablir ${u.email} ?` : `Bannir ${u.email} ? Il ne pourra plus publier.`)) return;
    setBusyClaim(u.id);
    await supabase().from("profiles").update({ is_banned: !u.is_banned }).eq("id", u.id);
    setBusyClaim(null);
    loadClaims();
  }

  /* Signalement : retirer l'annonce (elle disparaît du site, l'auteur la voit
     « retirée ») ou classer sans suite. Dans les deux cas le signalement est
     traité et sort de la liste. */
  async function resolveReport(rep: Report, action: "remove" | "dismiss") {
    setBusyClaim(rep.id);
    const sb = supabase();
    if (action === "remove") {
      await sb.from("listings").update({ status: "removed", removed_reason: rep.reason.slice(0, 200) }).eq("id", rep.listing_id);
    }
    await sb.from("reports").update({ handled: true }).eq("id", rep.id);
    setBusyClaim(null);
    loadClaims();
  }

  async function resolveFeedback(f: Feedback) {
    setBusyClaim(f.id);
    await supabase().from("feedback").update({ handled: true }).eq("id", f.id);
    setBusyClaim(null);
    loadClaims();
  }

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase().auth.getSession();
      if (!session.session) { router.replace("/connexion"); return; }
      const { data, error } = await supabase().rpc("site_stats");
      if (error || !data) { setDenied(true); return; }
      setS(data as SiteStats);
      loadClaims();
    })();
  }, [router]);

  /* Traitement d'une demande. Donner la main = un vrai transfert de droits :
     à ne faire qu'après avoir vérifié le contact, jamais sur la seule foi du
     formulaire. */
  async function resolveClaim(c: Claim, action: "grant" | "hide" | "done") {
    setBusyClaim(c.id);
    const sb = supabase();
    if (action === "grant" && c.user_id) {
      await sb.from("restaurants").update({ owner_id: c.user_id }).eq("id", c.restaurant_id);
    }
    if (action === "hide") {
      await sb.from("restaurants").update({ status: "hidden" }).eq("id", c.restaurant_id);
    }
    await sb.from("restaurant_claims").update({ handled: true }).eq("id", c.id);
    setBusyClaim(null);
    loadClaims();
  }

  if (denied) return (
    <>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 56 }}>
        <div className="panel gold-frame" style={{ padding: "26px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>Réservé à l&apos;administration</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Ce tableau de bord n&apos;est visible que par les comptes administrateurs.
          </p>
          <Link href="/mon-espace" className="btn" style={{ marginTop: 8 }}>Retour à mon espace</Link>
        </div>
      </main>
    </>
  );

  if (!s) return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "40px 16px", color: "var(--text-muted)" }}>Chargement…</div>
    </>
  );

  const maxVisits = Math.max(1, ...s.daily.map((d) => d.visits));
  const maxModule = Math.max(1, ...MODULE_ORDER.map((k) => s.by_module[k] ?? 0));

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main className="container" style={{ paddingTop: 24, paddingBottom: 56, flex: 1, maxWidth: 940 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Statistiques du site</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
          Fréquentation mesurée sur le site lui-même, visiteurs non connectés compris.
        </p>

        {pendingEvents.length > 0 && (
          <Section titre={`Événements à valider (${pendingEvents.length})`}
            sousTitre="Proposés par leurs organisateurs — rien ne paraît sans votre accord">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingEvents.map((e) => (
                <div key={e.id} className="panel" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                      color: "var(--gold-deep)", background: "var(--cream-dark)", padding: "4px 10px", borderRadius: 99 }}>
                      {e.category}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{e.title}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(e.starts_at).toLocaleString("fr-FR", { timeZone: "America/St_Barthelemy", dateStyle: "medium", timeStyle: "short" })}
                      {e.venue ? ` · ${e.venue}` : ""}{e.quartier ? ` · ${e.quartier}` : ""}{e.price ? ` · ${e.price}` : ""}
                    </span>
                  </div>
                  {e.description && <p style={{ fontSize: 13.5, margin: "8px 0 4px", whiteSpace: "pre-wrap" }}>{e.description}</p>}
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
                    Par <strong style={{ color: "var(--text)" }}>{e.organizer}</strong> · contact :{" "}
                    <strong style={{ color: "var(--text)" }}>{e.contact}</strong>
                    {e.link && <> · <a href={e.link} target="_blank" rel="noopener noreferrer">lien ↗</a></>}
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn" disabled={busyClaim === e.id}
                      onClick={() => resolveEvent(e, "approved")}
                      style={{ fontSize: 12.5, padding: "9px 14px", minHeight: 36 }}>
                      Publier dans l&apos;agenda
                    </button>
                    <button className="link-quiet" disabled={busyClaim === e.id}
                      onClick={() => { if (confirm("Refuser cet événement ? Il ne paraîtra pas.")) resolveEvent(e, "rejected"); }}
                      style={{ color: "var(--danger)" }}>
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {claims.length > 0 && (
          <Section titre={`Demandes des établissements (${claims.length})`}
            sousTitre="Revendications, corrections et retraits envoyés depuis les fiches St Barth Food">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {claims.map((c) => (
                <div key={c.id} className="panel" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                      color: c.kind === "removal" ? "#fff" : "var(--gold-deep)",
                      background: c.kind === "removal" ? "var(--danger)" : "var(--cream-dark)",
                      padding: "4px 10px", borderRadius: 99,
                    }}>
                      {CLAIM_KIND[c.kind]}
                    </span>
                    <Link href={`/food/resto/${c.restaurant_id}`} style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {c.restaurant?.name ?? "Fiche supprimée"}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, margin: "8px 0 4px", whiteSpace: "pre-wrap" }}>{c.message}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
                    Contact : <strong style={{ color: "var(--text)" }}>{c.contact}</strong>
                    {c.kind === "claim" && !c.user_id && " · envoyé sans compte — la main ne peut pas être donnée automatiquement"}
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {c.kind === "claim" && c.user_id && (
                      <button className="btn" disabled={busyClaim === c.id}
                        onClick={() => { if (confirm("Donner la gestion de cette fiche à ce compte ? À faire après avoir vérifié le contact.")) resolveClaim(c, "grant"); }}
                        style={{ fontSize: 12.5, padding: "9px 14px", minHeight: 36 }}>
                        Donner la main à ce compte
                      </button>
                    )}
                    {c.kind === "removal" && (
                      <button className="btn" disabled={busyClaim === c.id}
                        onClick={() => { if (confirm("Masquer cette fiche du site ?")) resolveClaim(c, "hide"); }}
                        style={{ background: "var(--danger)", fontSize: 12.5, padding: "9px 14px", minHeight: 36 }}>
                        Masquer la fiche
                      </button>
                    )}
                    <button className="link-quiet" disabled={busyClaim === c.id} onClick={() => resolveClaim(c, "done")}>
                      Marquer traité sans action
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {reports.length > 0 && (
          <Section titre={`Signalements d'annonces (${reports.length})`}
            sousTitre="Envoyés par les utilisateurs via « Signaler cette annonce »">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reports.map((rep) => (
                <div key={rep.id} className="panel" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <Link href={`/annonce/${rep.listing_id}`} style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {rep.listing?.title ?? "Annonce supprimée"}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(rep.created_at).toLocaleDateString("fr-FR")}
                      {rep.listing?.status === "removed" ? " · déjà retirée" : ""}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, margin: "8px 0 10px", whiteSpace: "pre-wrap" }}>{rep.reason}</p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn" disabled={busyClaim === rep.id}
                      onClick={() => { if (confirm("Retirer cette annonce du site ?")) resolveReport(rep, "remove"); }}
                      style={{ background: "var(--danger)", fontSize: 12.5, padding: "9px 14px", minHeight: 36 }}>
                      Retirer l&apos;annonce
                    </button>
                    <button className="link-quiet" disabled={busyClaim === rep.id} onClick={() => resolveReport(rep, "dismiss")}>
                      Classer sans suite
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {feedback.length > 0 && (
          <Section titre={`Retours des utilisateurs (${feedback.length})`}
            sousTitre="Idées, problèmes et avis envoyés depuis « Votre avis compte »">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {feedback.map((f) => (
                <div key={f.id} className="panel" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                      color: "var(--gold-deep)", background: "var(--cream-dark)", padding: "4px 10px", borderRadius: 99,
                    }}>
                      {FEEDBACK_KIND[f.kind]}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(f.created_at).toLocaleDateString("fr-FR")}
                      {f.contact ? ` · contact : ${f.contact}` : " · sans contact"}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, margin: "8px 0 10px", whiteSpace: "pre-wrap" }}>{f.message}</p>
                  <button className="link-quiet" disabled={busyClaim === f.id} onClick={() => resolveFeedback(f)}>
                    Marquer lu
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section titre="Vue d'ensemble">
          <Tiles items={[
            { k: "Annonces en ligne", v: s.listings_active, sub: `${s.listings_total} au total` },
            { k: "Déposées sur 30 j", v: s.listings_30d, sub: `${s.listings_7d} sur 7 j` },
            { k: "Comptes", v: s.users_total, sub: `${s.users_30d} sur 30 j` },
            { k: "Vues d'annonces", v: s.views_total, sub: `${s.views_7d} sur 7 j` },
            { k: "Visiteurs (7 j)", v: s.visitors_7d, sub: `${s.visits_7d} pages vues` },
            { k: "Mises en favori", v: s.favorites_total, sub: "toutes annonces" },
          ]} />
        </Section>

        <Section titre="Fréquentation des 14 derniers jours" sousTitre="Pages vues par jour, toutes pages confondues">
          <div className="panel" style={{ padding: "18px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 132 }}>
              {s.daily.map((d) => {
                const h = Math.round((d.visits / maxVisits) * 100);
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
                    title={`${jour(d.day)} · ${d.visits} page${d.visits > 1 ? "s" : ""} vue${d.visits > 1 ? "s" : ""}`}>
                    {d.visits === maxVisits && d.visits > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 4 }}>
                        {d.visits}
                      </span>
                    )}
                    {/* Un jour sans visite garde un trait : sinon un zéro se lit
                        comme une donnée manquante. */}
                    <div style={{
                      height: `${Math.max(h, 2)}%`, minHeight: 3,
                      background: d.visits === 0 ? "var(--cream-dark)" : "var(--green)",
                      borderRadius: "4px 4px 0 0",
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2, fontSize: 11.5, color: "var(--text-muted)" }}>
              <span>{s.daily.length > 0 ? jour(s.daily[0].day) : ""}</span>
              <span>{s.daily.length > 0 ? jour(s.daily[s.daily.length - 1].day) : ""}</span>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}>Voir les chiffres</summary>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 0", color: "var(--text-muted)", fontWeight: 600 }}>Jour</th>
                    <th style={{ textAlign: "right", padding: "6px 0", color: "var(--text-muted)", fontWeight: 600 }}>Pages vues</th>
                  </tr>
                </thead>
                <tbody>
                  {s.daily.map((d) => (
                    <tr key={d.day} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 0" }}>{jour(d.day)}</td>
                      <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 600 }}>{d.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </Section>

        <Section titre="Annonces en ligne par univers">
          <div className="panel" style={{ padding: "16px" }}>
            {MODULE_ORDER.map((k) => {
              const n = s.by_module[k] ?? 0;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
                  <span style={{ flex: "0 0 42%", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {MODULES[k].label}
                  </span>
                  <span style={{ flex: 1, height: 10, background: "var(--cream-dark)", borderRadius: 999, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.round((n / maxModule) * 100)}%`, height: "100%", background: "var(--green)", borderRadius: 999 }} />
                  </span>
                  <strong style={{ flex: "0 0 auto", fontSize: 13, minWidth: 28, textAlign: "right" }}>{n}</strong>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", gap: 18, fontSize: 13, color: "var(--text-muted)" }}>
              {(["offer", "wanted"] as Intent[]).map((i) => (
                <span key={i}>
                  {INTENT_FILTER[i]} : <strong style={{ color: "var(--text)" }}>{s.by_intent[i] ?? 0}</strong>
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section titre={`Comptes (${users.length})`} sousTitre="Email, inscription, dernière connexion — visibles de vous seul">
          <div className="panel" style={{ padding: "6px 14px 10px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 8px 8px 0" }}>
                      <strong>{u.email}</strong>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {u.display_name} · inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                        {u.last_sign_in ? ` · vu le ${new Date(u.last_sign_in).toLocaleDateString("fr-FR")}` : ""}
                        {" · "}{u.listings} annonce{u.listings > 1 ? "s" : ""}
                        {u.is_banned ? " · BANNI" : ""}
                      </div>
                    </td>
                    <td style={{ padding: "8px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="link-quiet" disabled={busyClaim === u.id} onClick={() => toggleBan(u)}
                        style={u.is_banned ? undefined : { color: "var(--danger)" }}>
                        {u.is_banned ? "Rétablir" : "Bannir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section titre="Annonces les plus consultées">
          <div className="panel" style={{ padding: "6px 16px 10px" }}>
            {s.top_listings.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Pas encore de consultation enregistrée.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <tbody>
                  {s.top_listings.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 0" }}>
                        <Link href={`/annonce/${t.id}`} style={{ fontWeight: 600 }}>{t.title}</Link>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{MODULES[t.module]?.label}</div>
                      </td>
                      <td style={{ padding: "9px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                        <strong>{t.views}</strong>{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>vue{t.views > 1 ? "s" : ""}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Section>

        <p style={{ marginTop: 24 }}>
          <Link href="/mon-espace" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour à mon espace</Link>
        </p>
      </main>
    </div>
  );
}

function Section({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>{titre}</h2>
      {sousTitre && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>{sousTitre}</p>}
      {!sousTitre && <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

function Tiles({ items }: { items: { k: string; v: number; sub: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map((t) => (
        <div key={t.k} className="panel" style={{ padding: "14px 16px" }}>
          <div className="price" style={{ fontSize: 26, lineHeight: 1.1 }}>{t.v.toLocaleString("fr-FR")}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{t.k}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
