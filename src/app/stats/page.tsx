"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/Brand";
import { supabase } from "@/lib/supabase";
import { connexionUrl, safeExternalUrl } from "@/lib/urls";
import { MODULES, type Intent, type ModuleKey } from "@/lib/taxonomy";
import { SITES, type SiteKey } from "@/lib/sites";
import Dashboard from "@/components/admin/Dashboard";
import FileModeration from "@/components/admin/FileModeration";
import styles from "./admin.module.css";

type View = "overview" | "moderation" | "content" | "users" | "analytics" | "activity";
type Kind = "listing" | "restaurant" | "place" | "event";
type Claim = { id:string; restaurant_id:string; kind:"claim"|"correction"|"removal"; message:string; contact:string; user_id:string|null; created_at:string; restaurant:{name:string}|null };
type Report = { id:string; listing_id:string; reason:string; created_at:string; listing:{title:string;status:string}|null };
type Feedback = { id:string; kind:"idee"|"probleme"|"avis"; message:string; contact:string|null; created_at:string };
type PendingEvent = { id:string; title:string; category:string; venue:string; quartier:string; starts_at:string; price:string; description:string; link:string|null; organizer:string; contact:string; created_at:string };
type AdminUser = { id:string; email:string; display_name:string; created_at:string; last_sign_in:string|null; is_banned:boolean; is_admin:boolean; listings:number };
type Content = { id:string; kind:Kind; title:string; detail:string; status:string; date:string|null; href:string; review?:string|null };
type Audit = { id:number; actor_email:string|null; action:string; target_type:string; details:Record<string,string|null>; created_at:string };
type Stats = {
  listings_total:number; listings_active:number; listings_30d:number; listings_7d:number; users_total:number; users_30d:number;
  views_total:number; views_7d:number; visits_7d:number; visitors_7d:number; visits_30d?:number; visitors_30d?:number; visitors_total?:number;
  by_site?:Partial<Record<SiteKey,{visits_7d:number;visitors_7d:number;visits_today?:number;visitors_today?:number}>>;
  favorites_total:number; by_module:Partial<Record<ModuleKey,number>>; by_intent:Partial<Record<Intent,number>>;
  daily:{day:string;visits:number}[]; top_listings:{id:string;title:string;module:ModuleKey;views:number}[];
};

const VIEWS: {key:View;label:string}[] = [
  {key:"overview",label:"Vue d’ensemble"},{key:"moderation",label:"Modération"},{key:"content",label:"Contenus"},
  {key:"users",label:"Comptes"},{key:"analytics",label:"Statistiques"},{key:"activity",label:"Historique"},
];
const KIND:Record<Kind,string> = {listing:"Annonce",restaurant:"Restaurant",place:"Lieu",event:"Événement"};
const CLAIM:Record<Claim["kind"],string> = {claim:"Revendication",correction:"Correction",removal:"Demande de retrait"};
const FEEDBACK:Record<Feedback["kind"],string> = {idee:"Idée",probleme:"Problème",avis:"Avis"};
const shortDate = (iso:string) => new Date(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});

export default function AdminPage() {
  const router = useRouter();
  const [view,setView] = useState<View>("overview");
  const [stats,setStats] = useState<Stats|null>(null);
  const [denied,setDenied] = useState(false);
  const [claims,setClaims] = useState<Claim[]>([]);
  const [reports,setReports] = useState<Report[]>([]);
  const [feedback,setFeedbackItems] = useState<Feedback[]>([]);
  const [events,setEvents] = useState<PendingEvent[]>([]);
  const [users,setUsers] = useState<AdminUser[]>([]);
  const [content,setContent] = useState<Content[]>([]);
  const [audit,setAudit] = useState<Audit[]>([]);
  const [auditReady,setAuditReady] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [userSearch,setUserSearch] = useState("");
  const [userFilter,setUserFilter] = useState<"all"|"admin"|"banned">("all");
  const [contentSearch,setContentSearch] = useState("");
  const [contentFilter,setContentFilter] = useState<"all"|Kind>("all");
  /* La file de modération (0032) remplace la liste brute des signalements
     dès qu'elle existe : les signalements y ouvrent des dossiers. Tant
     qu'elle n'est pas là, l'ancienne liste reste affichée. */
  const [modDispo,setModDispo] = useState(false);
  const [modNb,setModNb] = useState(0);
  const onEtatMod = useCallback((dispo:boolean,nb:number)=>{setModDispo(dispo);setModNb(nb);},[]);

  const load = async () => {
    setError(null);
    const sb=supabase();
    const [c,r,f,u,e,l,rest,p,allE,a]=await Promise.all([
      sb.from("restaurant_claims").select("*, restaurant:restaurants(name)").eq("handled",false).order("created_at"),
      sb.from("reports").select("id,listing_id,reason,created_at,listing:listings(title,status)").eq("handled",false).order("created_at"),
      sb.from("feedback").select("*").eq("handled",false).order("created_at"),sb.rpc("admin_users"),sb.rpc("admin_pending_events"),
      sb.from("listings").select("id,title,status,module,created_at,review_state").order("created_at",{ascending:false}).limit(100),
      sb.from("restaurants").select("id,name,status,cuisine,quartier,created_at").order("created_at",{ascending:false}).limit(100),
      sb.from("places").select("id,name,status,category,quartier,created_at").order("created_at",{ascending:false}).limit(100),
      sb.from("events").select("id,title,status,category,quartier,starts_at").order("starts_at",{ascending:false}).limit(100),
      sb.rpc("admin_audit_recent",{p_limit:100}),
    ]);
    const failed=[c,r,f,u,e,l,rest,p,allE].find(x=>x.error)?.error;
    if(failed)setError(`Certaines données n’ont pas pu être chargées : ${failed.message}`);
    setClaims((c.data as Claim[])??[]); setReports((r.data as unknown as Report[])??[]); setFeedbackItems((f.data as Feedback[])??[]);
    setUsers((u.data as AdminUser[])??[]); setEvents((e.data as PendingEvent[])??[]);
    const items:Content[]=[];
    for(const x of (l.data??[]) as {id:string;title:string;status:string;module:ModuleKey;created_at:string;review_state?:string|null}[]) items.push({id:x.id,kind:"listing",title:x.title,detail:MODULES[x.module]?.label??x.module,status:x.status,date:x.created_at,href:`/annonce/${x.id}`,review:x.review_state??null});
    for(const x of (rest.data??[]) as {id:string;name:string;status:string;cuisine:string;quartier:string;created_at:string}[]) items.push({id:x.id,kind:"restaurant",title:x.name,detail:[x.cuisine,x.quartier].filter(Boolean).join(" · "),status:x.status,date:x.created_at,href:`/food/resto/${x.id}`});
    for(const x of (p.data??[]) as {id:string;name:string;status:string;category:string;quartier:string;created_at:string}[]) items.push({id:x.id,kind:"place",title:x.name,detail:[x.category.replaceAll("_"," "),x.quartier].filter(Boolean).join(" · "),status:x.status,date:x.created_at,href:`/guide/lieu/${x.id}`});
    for(const x of (allE.data??[]) as {id:string;title:string;status:string;category:string;quartier:string;starts_at:string}[]) items.push({id:x.id,kind:"event",title:x.title,detail:[x.category,x.quartier].filter(Boolean).join(" · "),status:x.status,date:x.starts_at,href:"/event"});
    setContent(items.sort((x,y)=>(y.date??"").localeCompare(x.date??"")));
    setAuditReady(!a.error); setAudit((a.data as Audit[])??[]);
  };

  useEffect(()=>{(async()=>{
    const {data:session}=await supabase().auth.getSession();
    if(!session.session){router.replace(connexionUrl("/stats"));return;}
    const {data,error}=await supabase().rpc("site_stats");
    if(error||!data){setDenied(true);return;} setStats(data as Stats); await load();
  })();},[router]);

  const aVerifier=modDispo?modNb:reports.length;
  const queue=events.length+claims.length+aVerifier+feedback.length;
  const shownUsers=useMemo(()=>{const q=userSearch.trim().toLowerCase();return users.filter(x=>(userFilter==="all"||(userFilter==="admin"&&x.is_admin)||(userFilter==="banned"&&x.is_banned))&&(!q||`${x.email} ${x.display_name}`.toLowerCase().includes(q)));},[users,userSearch,userFilter]);
  const shownContent=useMemo(()=>{const q=contentSearch.trim().toLowerCase();return content.filter(x=>(contentFilter==="all"||x.kind===contentFilter)&&(!q||`${x.title} ${x.detail}`.toLowerCase().includes(q)));},[content,contentSearch,contentFilter]);

  async function act(id:string,fn:()=>PromiseLike<{error:{message:string}|null}>,label:string){setBusy(id);setError(null);const {error}=await fn();setBusy(null);if(error)setError(`${label} : ${error.message}`);else await load();}
  const setEvent=(x:PendingEvent,status:"approved"|"rejected")=>act(x.id,()=>supabase().rpc("admin_set_event_status",{p_event_id:x.id,p_status:status}),"Événement non traité");
  const setClaim=(x:Claim,action:"grant"|"hide"|"done")=>act(x.id,()=>supabase().rpc("admin_resolve_claim",{p_claim_id:x.id,p_action:action}),"Demande non traitée");
  const setReport=(x:Report,remove:boolean)=>act(x.id,()=>supabase().rpc("admin_resolve_report",{p_report_id:x.id,p_remove_listing:remove}),"Signalement non traité");
  const resolveFeedback=(x:Feedback)=>act(x.id,()=>supabase().rpc("admin_resolve_feedback",{p_feedback_id:x.id}),"Retour non traité");
  const toggleAdmin=(x:AdminUser)=>{if(confirm(x.is_admin?`Retirer les droits d’administration à ${x.email} ?`:`Nommer ${x.email} administrateur ?`))return act(x.id,()=>supabase().rpc("set_admin",{target_id:x.id,value:!x.is_admin}),"Droits non modifiés");};
  const toggleBan=(x:AdminUser)=>{if(confirm(x.is_banned?`Rétablir ${x.email} ?`:`Bannir ${x.email} ? Il ne pourra plus publier.`))return act(x.id,()=>supabase().rpc("admin_set_user_banned",{p_user_id:x.id,p_is_banned:!x.is_banned}),"Compte non modifié");};
  const toggleContent=(x:Content)=>{const table={listing:"listings",restaurant:"restaurants",place:"places",event:"events"}[x.kind];const visible=x.kind==="listing"?x.status==="active":x.kind==="event"?x.status==="approved":x.status==="active";const status=x.kind==="listing"?(visible?"removed":"active"):x.kind==="event"?(visible?"rejected":"approved"):(visible?"hidden":"active");if(confirm(`${visible?"Masquer":"Publier"} « ${x.title} » ?`))return act(x.id,()=>supabase().from(table).update({status}).eq("id",x.id),"Contenu non modifié");};

  if(denied)return <><SiteHeader/><main className="container" style={{maxWidth:520,paddingTop:40}}><Empty title="Réservé à l’administration" text="Ce tableau de bord n’est visible que par les comptes administrateurs."/><p style={{textAlign:"center"}}><Link className="btn" href="/mon-espace">Retour à mon espace</Link></p></main></>;
  if(!stats)return <><SiteHeader/><div className="container" style={{padding:"40px 16px",color:"var(--text-muted)"}}>Chargement de l’administration…</div></>;

  return <div className={styles.page}><SiteHeader/><main className={`container ${styles.shell}`}>
    <header className={styles.heading}><div><span>Ti Kanal</span><h1>Administration</h1><p>Les urgences et les outils de pilotage au même endroit.</p></div><Link href="/mon-espace">Mon espace →</Link></header>
    <nav className={styles.nav} aria-label="Sections de l’administration">{VIEWS.map(x=><button key={x.key} onClick={()=>setView(x.key)} className={view===x.key?styles.active:""} aria-current={view===x.key?"page":undefined}>{x.label}{x.key==="moderation"&&queue>0&&<b>{queue}</b>}</button>)}</nav>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {view==="overview"&&<Overview stats={stats} queue={[events.length,aVerifier,claims.length,feedback.length]} users={users} go={setView}/>}
    {/* La file reste montée quel que soit l'onglet : c'est elle qui donne le
        compteur de la navigation, et on ne la recharge pas à chaque passage. */}
    <div hidden={view!=="moderation"}><div className={styles.stack}>
      <Head title="Modération" text={queue?"Les annonces à vérifier d’abord, puis les demandes classées par type.":"Rien n’attend votre intervention. La file, la surveillance et les réglages restent accessibles ci-dessous."}/>
      <FileModeration onEtat={onEtatMod}/>
    </div></div>
    {view==="moderation"&&<Moderation events={events} reports={modDispo?[]:reports} claims={claims} feedback={feedback} busy={busy} setEvent={setEvent} setReport={setReport} setClaim={setClaim} setFeedback={resolveFeedback}/>}
    {view==="content"&&<ContentPanel items={shownContent} total={content.length} search={contentSearch} setSearch={setContentSearch} filter={contentFilter} setFilter={setContentFilter} busy={busy} toggle={toggleContent} go={setView}/>}
    {view==="users"&&<UsersPanel users={shownUsers} total={users.length} search={userSearch} setSearch={setUserSearch} filter={userFilter} setFilter={setUserFilter} busy={busy} toggleAdmin={toggleAdmin} toggleBan={toggleBan}/>}
    {view==="analytics"&&<Analytics stats={stats}/>}
    {view==="activity"&&<Activity data={audit} ready={auditReady}/>}
  </main></div>;
}

function Overview({stats,queue,users,go}:{stats:Stats;queue:number[];users:AdminUser[];go:(v:View)=>void}){const labels=["Événements","Signalements","Établissements","Retours"];return <div className={styles.stack}><Head title="À traiter" text={queue.reduce((a,b)=>a+b,0)?"Les actions qui demandent votre attention.":"Tout est à jour."}/><div className={styles.actions}>{queue.map((n,i)=><button key={labels[i]} onClick={()=>go("moderation")} className={n?styles.attention:styles.ok}><span>{labels[i]}</span><strong>{n}</strong><small>{n?"en attente":"À jour"}</small></button>)}</div><Section title="Activité du site"><Tiles data={[["Annonces en ligne",stats.listings_active,`${stats.listings_7d} nouvelles sur 7 j`],["Visiteurs sur 7 j",stats.visitors_7d,`${stats.visits_7d} pages vues`],["Comptes",stats.users_total,`${stats.users_30d} nouveaux sur 30 j`],["Administrateurs",users.filter(x=>x.is_admin).length,`${users.filter(x=>x.is_banned).length} compte(s) banni(s)`]]}/></Section><div className={styles.quick}>{[["Gérer les contenus","Publier ou masquer une fiche","content"],["Rechercher un compte","Rôles et bannissement","users"],["Voir les statistiques","Fréquentation par univers","analytics"]].map(x=><button key={x[0]} onClick={()=>go(x[2] as View)}><strong>{x[0]}</strong><span>{x[1]} →</span></button>)}</div></div>}

function Moderation({events,reports,claims,feedback,busy,setEvent,setReport,setClaim,setFeedback}:{events:PendingEvent[];reports:Report[];claims:Claim[];feedback:Feedback[];busy:string|null;setEvent:(x:PendingEvent,s:"approved"|"rejected")=>void;setReport:(x:Report,r:boolean)=>void;setClaim:(x:Claim,a:"grant"|"hide"|"done")=>void;setFeedback:(x:Feedback)=>void}){if(!events.length&&!reports.length&&!claims.length&&!feedback.length)return null;return <div className={styles.stack} style={{marginTop:28}}>
  {!!events.length&&<Section title={`Événements à valider (${events.length})`} text="Rien ne paraît sans votre accord.">{events.map(x=><Card key={x.id} badge={x.category} title={x.title} meta={`${new Date(x.starts_at).toLocaleString("fr-FR",{timeZone:"America/St_Barthelemy",dateStyle:"medium",timeStyle:"short"})}${x.venue?` · ${x.venue}`:""}`} body={x.description} extra={<>Par <strong>{x.organizer}</strong> · {x.contact}{safeExternalUrl(x.link)&&<> · <a href={safeExternalUrl(x.link)!} target="_blank" rel="noopener noreferrer">lien ↗</a></>}</>} actions={<><button className="btn" disabled={busy===x.id} onClick={()=>setEvent(x,"approved")}>Publier</button><button className="link-quiet" disabled={busy===x.id} onClick={()=>confirm("Refuser cet événement ?")&&setEvent(x,"rejected")}>Refuser</button></>}/>)}</Section>}
  {!!reports.length&&<Section title={`Signalements (${reports.length})`} text="Vérifiez l’annonce avant de la retirer.">{reports.map(x=><Card key={x.id} badge="Signalement" title={x.listing?.title??"Annonce supprimée"} href={`/annonce/${x.listing_id}`} meta={shortDate(x.created_at)} body={x.reason} actions={<><button className={`btn ${styles.danger}`} disabled={busy===x.id} onClick={()=>confirm("Retirer cette annonce ?")&&setReport(x,true)}>Retirer</button><button className="link-quiet" disabled={busy===x.id} onClick={()=>setReport(x,false)}>Classer sans suite</button></>}/>)}</Section>}
  {!!claims.length&&<Section title={`Demandes des établissements (${claims.length})`} text="Vérifiez le contact avant un transfert de gestion.">{claims.map(x=><Card key={x.id} badge={CLAIM[x.kind]} danger={x.kind==="removal"} title={x.restaurant?.name??"Fiche supprimée"} href={`/food/resto/${x.restaurant_id}`} meta={shortDate(x.created_at)} body={x.message} extra={<>Contact : <strong>{x.contact}</strong>{x.kind==="claim"&&!x.user_id&&" · demande sans compte"}</>} actions={<>{x.kind==="claim"&&x.user_id&&<button className="btn" disabled={busy===x.id} onClick={()=>confirm("Donner la gestion de cette fiche ?")&&setClaim(x,"grant")}>Donner la main</button>}{x.kind==="removal"&&<button className={`btn ${styles.danger}`} disabled={busy===x.id} onClick={()=>confirm("Masquer cette fiche ?")&&setClaim(x,"hide")}>Masquer</button>}<button className="link-quiet" disabled={busy===x.id} onClick={()=>setClaim(x,"done")}>Traité sans action</button></>}/>)}</Section>}
  {!!feedback.length&&<Section title={`Retours (${feedback.length})`} text="Idées, problèmes et avis des utilisateurs.">{feedback.map(x=><Card key={x.id} badge={FEEDBACK[x.kind]} title={x.contact??"Sans contact"} meta={shortDate(x.created_at)} body={x.message} actions={<button className="link-quiet" disabled={busy===x.id} onClick={()=>setFeedback(x)}>Marquer lu</button>}/>)}</Section>}
  </div>}

function ContentPanel({items,total,search,setSearch,filter,setFilter,busy,toggle,go}:{items:Content[];total:number;search:string;setSearch:(s:string)=>void;filter:"all"|Kind;setFilter:(k:"all"|Kind)=>void;busy:string|null;toggle:(x:Content)=>void;go:(v:View)=>void}){return <div className={styles.stack}><Head title={`Contenus (${total})`} text="Les 100 éléments les plus récents de chaque univers."/><Toolbar search={search} setSearch={setSearch} placeholder="Rechercher un titre, un lieu…">{(["all","listing","restaurant","place","event"] as const).map(k=><button key={k} className={filter===k?styles.selected:""} onClick={()=>setFilter(k)}>{k==="all"?"Tous":KIND[k]}</button>)}</Toolbar>{!items.length?<Empty title="Aucun résultat" text="Essayez un autre mot ou un autre type de contenu."/>:<div className={styles.rows}>{items.map(x=>{
    /* Une annonce active mais en attente ou retenue n'est pas visible du
       public : l'admin doit le lire ici, et la décision se prend dans la
       file de modération, pas avec le bouton Masquer/Publier. */
    const enModeration=x.kind==="listing"&&x.status==="active"&&(x.review==="pending"||x.review==="blocked");
    const visible=x.kind==="listing"?x.status==="active"&&!enModeration:x.kind==="event"?x.status==="approved":x.status==="active";
    return <div className={styles.row} key={`${x.kind}-${x.id}`}><div className={styles.main}><b className={styles.kind}>{KIND[x.kind]}</b><div><Link href={x.href}>{x.title}</Link><p>{x.detail}{x.date?` · ${shortDate(x.date)}`:""}</p></div></div><div className={styles.rowButtons}><Status visible={visible} pending={x.status==="pending"||x.review==="pending"} label={enModeration?(x.review==="blocked"?"Retenue":"En vérification"):undefined}/>{enModeration?<button className="link-quiet" onClick={()=>go("moderation")}>Voir en modération</button>:<button className="link-quiet" disabled={busy===x.id} onClick={()=>toggle(x)}>{visible?"Masquer":"Publier"}</button>}</div></div>})}</div>}</div>}

function UsersPanel({users,total,search,setSearch,filter,setFilter,busy,toggleAdmin,toggleBan}:{users:AdminUser[];total:number;search:string;setSearch:(s:string)=>void;filter:"all"|"admin"|"banned";setFilter:(k:"all"|"admin"|"banned")=>void;busy:string|null;toggleAdmin:(x:AdminUser)=>void;toggleBan:(x:AdminUser)=>void}){return <div className={styles.stack}><Head title={`Comptes (${total})`} text="Recherche, droits d’administration et état du compte."/><Toolbar search={search} setSearch={setSearch} placeholder="Rechercher par nom ou email…">{(["all","admin","banned"] as const).map(k=><button key={k} className={filter===k?styles.selected:""} onClick={()=>setFilter(k)}>{k==="all"?"Tous":k==="admin"?"Administrateurs":"Bannis"}</button>)}</Toolbar>{!users.length?<Empty title="Aucun compte trouvé" text="Modifiez la recherche ou le filtre."/>:<div className={styles.rows}>{users.map(x=><div className={styles.row} key={x.id}><div className={styles.main}><div><strong>{x.display_name}</strong><p>{x.email} · inscrit le {shortDate(x.created_at)}{x.last_sign_in?` · vu le ${shortDate(x.last_sign_in)}`:""} · {x.listings} annonce{x.listings>1?"s":""}</p></div></div><div className={styles.rowButtons}>{x.is_admin&&<b className={styles.admin}>Admin</b>}{x.is_banned&&<b className={styles.banned}>Banni</b>}<button className="link-quiet" disabled={busy===x.id} onClick={()=>toggleAdmin(x)}>{x.is_admin?"Retirer l’admin":"Nommer admin"}</button><button className="link-quiet" disabled={busy===x.id} onClick={()=>toggleBan(x)}>{x.is_banned?"Rétablir":"Bannir"}</button></div></div>)}</div>}</div>}

function Analytics({stats}:{stats:Stats}){
  return <div className={styles.stack}>
    <Head title="Statistiques" text="Analyse détaillée de la fréquentation, avec comparaison par période."/>
    <Dashboard/>
    <Section title="Fréquentation par univers" text="Visiteurs uniques et pages vues, aujourd’hui et sur 7 jours.">
      <div className={styles.table}><table><thead><tr><th>Univers</th><th>Visiteurs auj.</th><th>Pages auj.</th><th>Visiteurs 7 j</th><th>Pages 7 j</th></tr></thead><tbody>
        {(Object.keys(SITES) as SiteKey[]).map(k=>{const d=stats.by_site?.[k],site=SITES[k];return <tr key={k}><td><i style={{background:site.dot}}/><strong>{site.name}</strong></td><td>{d?.visitors_today??0}</td><td>{d?.visits_today??0}</td><td>{d?.visitors_7d??0}</td><td>{d?.visits_7d??0}</td></tr>})}
      </tbody></table></div>
    </Section>
  </div>
}

function Activity({data,ready}:{data:Audit[];ready:boolean}){return <div className={styles.stack}><Head title="Historique" text="Une trace des actions sensibles réalisées dans l’administration."/>{!ready?<Empty title="Historique à activer" text="Exécutez la migration 0029b_admin_workspace.sql dans Supabase pour commencer à enregistrer les actions."/>:!data.length?<Empty title="Aucune action enregistrée" text="Les prochaines actions de modération apparaîtront ici."/>:<div className={styles.timeline}>{data.map(x=><div key={x.id}><i/><div><strong>{auditLabel(x)}</strong><p>{x.actor_email??"Administrateur"} · {new Date(x.created_at).toLocaleString("fr-FR")}</p>{x.details?.old_value!==undefined&&<small>{x.details.old_value||"—"} → {x.details.new_value||"—"}</small>}</div></div>)}</div>}</div>}
function auditLabel(x:Audit){const map:Record<string,string>={listings:"Statut d’une annonce modifié",restaurants:"Statut d’un restaurant modifié",places:"Statut d’un lieu modifié",events:"Statut d’un événement modifié",profiles:x.action.includes("is_admin")?"Droits administrateur modifiés":"État d’un compte modifié",reports:"Signalement traité",feedback:"Retour traité",restaurant_claims:"Demande d’établissement traitée"};return map[x.target_type]??x.action}
function Head({title,text}:{title:string;text:string}){return <header className={styles.sectionHead}><h2>{title}</h2><p>{text}</p></header>}
function Section({title,text,children}:{title:string;text?:string;children:React.ReactNode}){return <section className={styles.section}><h3>{title}</h3>{text&&<p>{text}</p>}<div>{children}</div></section>}
function Tiles({data}:{data:(string|number)[][]}){return <div className={styles.tiles}>{data.map(x=><div className="panel" key={x[0]}><strong>{Number(x[1]).toLocaleString("fr-FR")}</strong><span>{x[0]}</span><small>{x[2]}</small></div>)}</div>}
function Toolbar({search,setSearch,placeholder,children}:{search:string;setSearch:(s:string)=>void;placeholder:string;children:React.ReactNode}){return <div className={styles.toolbar}><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder={placeholder}/><div>{children}</div></div>}
function Status({visible,pending,label}:{visible:boolean;pending:boolean;label?:string}){return <span className={visible?styles.visible:styles.hidden}>{label??(visible?"Visible":pending?"En attente":"Masqué")}</span>}
function Empty({title,text}:{title:string;text:string}){return <div className={styles.empty}><strong>{title}</strong><p>{text}</p></div>}
function Card({badge,danger,title,href,meta,body,extra,actions}:{badge:string;danger?:boolean;title:string;href?:string;meta:string;body:string;extra?:React.ReactNode;actions:React.ReactNode}){return <article className={styles.card}><div className={styles.cardTop}><b className={danger?styles.banned:styles.kind}>{badge}</b><div>{href?<Link href={href}>{title}</Link>:<strong>{title}</strong>}<small>{meta}</small></div></div>{body&&<p className={styles.body}>{body}</p>}{extra&&<p className={styles.extra}>{extra}</p>}<footer>{actions}</footer></article>}
