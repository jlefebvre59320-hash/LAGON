-- ============================================================
-- 0032 — Modération et anti-arnaque, version permissive.
--
-- Principe : en cas de doute, on publie et on surveille. Le score qui
-- suit mesure une suspicion, jamais une certitude. Un seul signal
-- faible ne retient rien ; il faut plusieurs signaux indépendants pour
-- qu'une annonce attende un regard humain. Le blocage automatique est
-- réservé à deux cas objectifs : un terme manifestement interdit, ou
-- une création en rafale qui ne peut pas être humaine.
--
-- Ti Kanal ne gère aucun paiement : rien ici ne suppose une
-- transaction. On regarde l'annonce, le compte, le comportement.
--
-- Tout est réglable dans moderation_settings — poids, seuils, termes —
-- sans redéployer. Les décisions humaines sont conservées avec le score
-- du moment, pour ajuster plus tard avec de vraies données de l'île.
-- ============================================================

-- ---------- Réglages : un seul endroit, modifiable par l'admin ----------

create table if not exists public.moderation_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.moderation_settings enable row level security;
drop policy if exists "modsettings_admin" on public.moderation_settings;
create policy "modsettings_admin" on public.moderation_settings
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.moderation_settings from anon, authenticated;
grant select, insert, update on public.moderation_settings to authenticated;

insert into public.moderation_settings (key, value) values
  -- Les seuils du score. 0–30 publié · 31–60 surveillé (publié) ·
  -- 61+ en attente d'un humain. Le blocage n'est pas un seuil : il ne
  -- vient que des deux règles objectives ci-dessous.
  ('seuils', '{"surveillance": 31, "verification": 61}'),
  -- Poids de chaque signal. Le prix pèse peu, volontairement.
  ('poids', '{
     "prix_bas": 6, "prix_tres_bas": 10,
     "compte_jour": 8, "compte_semaine": 4,
     "rafale_moderee": 10, "rafale_forte": 25,
     "texte_copie_autre": 20, "texte_copie_soi": 8,
     "photo_reutilisee_autre": 30, "photo_reutilisee_soi": 10,
     "contact_suspect": 15,
     "signalement": 15, "signalements_max": 45
   }'),
  -- En dessous de ce nombre d'annonces comparables, on ne juge pas le prix.
  ('prix', '{"min_comparables": 5, "ratio_bas": 0.5, "ratio_tres_bas": 0.3}'),
  -- Rafale : au-delà de « blocage » annonces dans l'heure, ce n'est plus une
  -- personne — c'est un script. Seul cas de blocage automatique avec les termes.
  ('rafale', '{"moderee": 4, "forte": 7, "blocage": 12}'),
  -- Termes interdits : courts, objectifs, sans ambiguïté. Un mot présent
  -- dans un titre ou une description bloque avant publication. Liste
  -- volontairement minimale — l'élargir se fait ici, pas dans le code.
  ('termes_interdits', '["arme à feu","armes à feu","pistolet","fusil d''assaut","munitions",
     "cocaïne","héroïne","méthamphétamine","cannabis à vendre","ecstasy",
     "faux billets","fausse monnaie","contrefaçon","fausse carte","faux passeport",
     "carte d''identité à vendre","permis de conduire à vendre","carte grise vierge",
     "médicaments sur ordonnance","viagra","xanax","tramadol"]'),
  -- Motifs de contact suspects dans une description : tout ce qui déplace
  -- l'échange hors du site ou évoque un paiement à distance.
  ('motifs_contact', '["western union","moneygram","mandat cash","paysafecard","coupon pcs",
     "transcash","code de validation","code sms","virement avant","acompte par virement",
     "paypal famille","paypal entre proches","livraison par transporteur","je suis à l''étranger",
     "actuellement en métropole","http://","https://","www.","bit.ly","wa.me"]')
on conflict (key) do nothing;

-- ---------- Ce que porte une annonce ----------

alter table public.listings
  add column if not exists review_state    text not null default 'published',
  add column if not exists risk_score      integer not null default 0,
  add column if not exists risk_reasons    jsonb not null default '[]',
  add column if not exists moderation_note text,
  add column if not exists reviewed_at     timestamptz;

alter table public.listings
  drop constraint if exists listings_review_state_connu;
alter table public.listings
  add constraint listings_review_state_connu
  check (review_state in ('published', 'watch', 'pending', 'blocked')) not valid;

create index if not exists idx_listings_review on public.listings (review_state, risk_score desc)
  where review_state <> 'published';

-- Ces colonnes ne sont JAMAIS écrites par un compte : pas de GRANT insert /
-- update dessus. Seules les fonctions ci-dessous les modifient.

-- Le public ne voit pas une annonce en attente ou bloquée ; son auteur et
-- l'administration, si. Une annonce « surveillée » reste publique : c'est
-- tout le sens de la version permissive.
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public" on public.listings
  for select using (
    (
      review_state in ('published', 'watch')
      and (status = 'active' or (status = 'sold' and sold_at > now() - interval '7 days'))
    )
    or auth.uid() = user_id
    or public.is_admin()
  );

-- ---------- Empreinte des photos ----------

-- Calculée côté navigateur (SHA-256 du fichier compressé) et rangée ici :
-- deux annonces qui portent la même empreinte partagent la même photo.
alter table public.listing_photos
  add column if not exists content_hash text;
create index if not exists idx_photos_hash on public.listing_photos (content_hash)
  where content_hash is not null;
grant insert (content_hash) on public.listing_photos to authenticated;

-- ---------- Suspension temporaire d'un compte ----------

alter table public.profiles
  add column if not exists suspended_until timestamptz;
grant select (suspended_until) on public.profiles to anon, authenticated;

-- ---------- Signalements : un motif fermé ----------

alter table public.reports
  add column if not exists motif text;
alter table public.reports
  drop constraint if exists reports_motif_connu;
alter table public.reports
  add constraint reports_motif_connu
  check (motif is null or motif in (
    'arnaque', 'interdit', 'fausse', 'prix_trompeur',
    'photo_suspecte', 'spam', 'inapproprie', 'autre')) not valid;
grant insert (motif) on public.reports to authenticated;

-- ---------- Dossiers de modération et décisions ----------

create table if not exists public.moderation_cases (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  source      text not null check (source in ('auto', 'signalement', 'admin')),
  score       integer not null,
  reasons     jsonb not null default '[]',
  status      text not null default 'open' check (status in ('open', 'resolved')),
  opened_at   timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists uq_case_open on public.moderation_cases (listing_id)
  where status = 'open';
create index if not exists idx_cases_open on public.moderation_cases (status, score desc, opened_at);

-- Chaque décision humaine est gardée avec le score que la machine donnait
-- à ce moment-là : c'est la matière première pour recaler les poids quand
-- il y aura assez de cas — dans les deux sens (faux positifs et faux négatifs).
create table if not exists public.moderation_decisions (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references public.moderation_cases(id) on delete set null,
  listing_id  uuid,
  decided_by  uuid references auth.users(id) on delete set null,
  decision    text not null check (decision in (
                'publier', 'maintenir', 'masquer', 'supprimer',
                'demander_modification', 'suspendre', 'bannir')),
  score_avant integer not null,
  reasons     jsonb not null default '[]',
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.moderation_cases     enable row level security;
alter table public.moderation_decisions enable row level security;
drop policy if exists "cases_admin" on public.moderation_cases;
create policy "cases_admin" on public.moderation_cases for select using (public.is_admin());
drop policy if exists "decisions_admin" on public.moderation_decisions;
create policy "decisions_admin" on public.moderation_decisions for select using (public.is_admin());
revoke all on public.moderation_cases     from anon, authenticated;
revoke all on public.moderation_decisions from anon, authenticated;
grant select on public.moderation_cases     to authenticated;
grant select on public.moderation_decisions to authenticated;

-- ---------- Le score ----------

-- Lit un réglage, avec une valeur de repli si la ligne manque.
create or replace function public.mod_setting(p_key text, p_defaut jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.moderation_settings where key = p_key), p_defaut);
$$;

-- Évalue une annonce et pose son état. Appelée par trigger à la création,
-- à chaque photo ajoutée, et à chaque signalement. Idempotente : on peut
-- la relancer autant qu'on veut.
create or replace function public.evaluer_annonce(p_listing_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  l          public.listings;
  p          public.profiles;
  poids      jsonb := public.mod_setting('poids', '{}');
  seuils     jsonb := public.mod_setting('seuils', '{"surveillance":31,"verification":61}');
  prix_cfg   jsonb := public.mod_setting('prix', '{"min_comparables":5,"ratio_bas":0.5,"ratio_tres_bas":0.3}');
  rafale_cfg jsonb := public.mod_setting('rafale', '{"moderee":4,"forte":7,"blocage":12}');
  termes     jsonb := public.mod_setting('termes_interdits', '[]');
  motifs     jsonb := public.mod_setting('motifs_contact', '[]');
  score      int := 0;
  raisons    jsonb := '[]';
  bloque     boolean := false;
  texte      text;
  terme      text;
  n_comp     int;
  mediane    numeric;
  n_heure    int;
  n_signal   int;
  etat       text;
  v_pts      int;
begin
  select * into l from public.listings where id = p_listing_id;
  if l.id is null then return; end if;
  select * into p from public.profiles where id = l.user_id;

  texte := lower(coalesce(l.title, '') || ' ' || coalesce(l.description, ''));

  -- 1. Termes interdits : objectif, bloquant. Le seul cas avec la rafale.
  for terme in select lower(x) from jsonb_array_elements_text(termes) x loop
    if position(terme in texte) > 0 then
      bloque := true;
      raisons := raisons || jsonb_build_object('code', 'terme_interdit', 'detail', terme, 'points', 100);
      exit;
    end if;
  end loop;

  -- 2. Prix : un signal léger, jamais une preuve. Silence si trop peu de
  --    comparables — on n'invente pas un prix de référence.
  if l.price_cents is not null and l.price_cents > 0 then
    select count(*), percentile_cont(0.5) within group (order by price_cents)
      into n_comp, mediane
      from public.listings
     where module = l.module and subcategory = l.subcategory
       and status = 'active' and review_state in ('published', 'watch')
       and price_cents is not null and price_cents > 0
       and id <> l.id and intent = l.intent;
    if n_comp >= (prix_cfg->>'min_comparables')::int and mediane > 0 then
      if l.price_cents < mediane * (prix_cfg->>'ratio_tres_bas')::numeric then
        v_pts := (poids->>'prix_tres_bas')::int;
        score := score + v_pts;
        raisons := raisons || jsonb_build_object('code', 'prix_tres_bas',
          'detail', format('%s € pour une médiane de %s € sur %s annonces', l.price_cents/100, round(mediane/100), n_comp), 'points', v_pts);
      elsif l.price_cents < mediane * (prix_cfg->>'ratio_bas')::numeric then
        v_pts := (poids->>'prix_bas')::int;
        score := score + v_pts;
        raisons := raisons || jsonb_build_object('code', 'prix_bas',
          'detail', format('%s € pour une médiane de %s € sur %s annonces', l.price_cents/100, round(mediane/100), n_comp), 'points', v_pts);
      end if;
    else
      raisons := raisons || jsonb_build_object('code', 'prix_non_evalue',
        'detail', format('données insuffisantes (%s comparable%s)', n_comp, case when n_comp > 1 then 's' else '' end), 'points', 0);
    end if;
  end if;

  -- 3. Ancienneté du compte : un signal parmi d'autres, jamais seul.
  if p.created_at > now() - interval '24 hours' then
    v_pts := (poids->>'compte_jour')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'compte_recent', 'detail', 'compte créé il y a moins de 24 h', 'points', v_pts);
  elsif p.created_at > now() - interval '7 days' then
    v_pts := (poids->>'compte_semaine')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'compte_recent', 'detail', 'compte créé il y a moins de 7 jours', 'points', v_pts);
  end if;

  -- 4. Rafale : combien d'annonces ce compte a créées dans l'heure.
  select count(*) into n_heure from public.listings
   where user_id = l.user_id and created_at > now() - interval '1 hour';
  if n_heure >= (rafale_cfg->>'blocage')::int then
    bloque := true;
    raisons := raisons || jsonb_build_object('code', 'rafale_automatisee', 'detail', format('%s annonces en une heure', n_heure), 'points', 100);
  elsif n_heure >= (rafale_cfg->>'forte')::int then
    v_pts := (poids->>'rafale_forte')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'rafale', 'detail', format('%s annonces en une heure', n_heure), 'points', v_pts);
  elsif n_heure >= (rafale_cfg->>'moderee')::int then
    v_pts := (poids->>'rafale_moderee')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'rafale', 'detail', format('%s annonces en une heure', n_heure), 'points', v_pts);
  end if;

  -- 5. Texte copié : même titre et même description qu'une autre annonce.
  if exists (select 1 from public.listings o
              where o.id <> l.id and o.user_id <> l.user_id
                and lower(o.title) = lower(l.title)
                and lower(o.description) = lower(l.description)
                and char_length(l.description) > 40) then
    v_pts := (poids->>'texte_copie_autre')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'texte_copie', 'detail', 'titre et description identiques à une annonce d''un autre compte', 'points', v_pts);
  elsif exists (select 1 from public.listings o
                 where o.id <> l.id and o.user_id = l.user_id and o.status = 'active'
                   and lower(o.title) = lower(l.title)
                   and lower(o.description) = lower(l.description)) then
    v_pts := (poids->>'texte_copie_soi')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'doublon', 'detail', 'annonce identique déjà en ligne sur ce compte', 'points', v_pts);
  end if;

  -- 6. Photo réutilisée : même empreinte qu'une photo d'une autre annonce.
  if exists (select 1 from public.listing_photos a
              join public.listing_photos b on b.content_hash = a.content_hash and b.listing_id <> a.listing_id
              join public.listings lb on lb.id = b.listing_id
             where a.listing_id = l.id and a.content_hash is not null and lb.user_id <> l.user_id) then
    v_pts := (poids->>'photo_reutilisee_autre')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'photo_reutilisee', 'detail', 'photo déjà utilisée par un autre compte', 'points', v_pts);
  elsif exists (select 1 from public.listing_photos a
                 join public.listing_photos b on b.content_hash = a.content_hash and b.listing_id <> a.listing_id
                 join public.listings lb on lb.id = b.listing_id
                where a.listing_id = l.id and a.content_hash is not null and lb.user_id = l.user_id and lb.status = 'active') then
    v_pts := (poids->>'photo_reutilisee_soi')::int; score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'photo_reutilisee', 'detail', 'photo déjà utilisée sur une autre de ses annonces', 'points', v_pts);
  end if;

  -- 7. Contact ou paiement hors site dans le texte.
  for terme in select lower(x) from jsonb_array_elements_text(motifs) x loop
    if position(terme in texte) > 0 then
      v_pts := (poids->>'contact_suspect')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'contact_suspect', 'detail', format('mention de « %s »', terme), 'points', v_pts);
      exit;
    end if;
  end loop;

  -- 8. Signalements ouverts : chacun pèse, avec un plafond.
  select count(*) into n_signal from public.reports where listing_id = l.id and not handled;
  if n_signal > 0 then
    v_pts := least(n_signal * (poids->>'signalement')::int, (poids->>'signalements_max')::int);
    score := score + v_pts;
    raisons := raisons || jsonb_build_object('code', 'signalements', 'detail', format('%s signalement%s en attente', n_signal, case when n_signal > 1 then 's' else '' end), 'points', v_pts);
  end if;

  score := least(score, 100);

  -- L'état découle du score — sauf décision humaine déjà prise, qu'on ne
  -- renverse pas automatiquement : une annonce publiée par un modérateur
  -- reste publiée même si un nouveau signalement la fait remonter (elle
  -- rouvre un dossier, sans repasser en attente).
  if bloque then
    etat := 'blocked';
  elsif l.reviewed_at is not null and l.review_state in ('published', 'watch') then
    etat := l.review_state;
  elsif score >= (seuils->>'verification')::int then
    etat := 'pending';
  elsif score >= (seuils->>'surveillance')::int then
    etat := 'watch';
  else
    etat := 'published';
  end if;

  update public.listings
     set risk_score = score, risk_reasons = raisons, review_state = etat
   where id = l.id;

  -- Un dossier s'ouvre dès qu'un humain devrait regarder : attente,
  -- blocage, ou signalement en cours. La surveillance seule n'en ouvre pas.
  if etat in ('pending', 'blocked') or n_signal > 0 then
    insert into public.moderation_cases (listing_id, source, score, reasons)
    values (l.id, case when n_signal > 0 then 'signalement' else 'auto' end, score, raisons)
    on conflict (listing_id) where status = 'open'
    do update set score = excluded.score, reasons = excluded.reasons,
                  source = case when excluded.source = 'signalement' then 'signalement' else moderation_cases.source end;
  end if;
end $$;

-- ---------- Déclencheurs ----------

create or replace function public.trg_evaluer_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Un compte suspendu ne publie pas : le message dit jusqu'à quand.
  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles
                where id = new.user_id and suspended_until > now()) then
      raise exception 'Votre compte est suspendu jusqu''au %.',
        to_char((select suspended_until from public.profiles where id = new.user_id) at time zone 'America/Port_of_Spain', 'DD/MM/YYYY à HH24"h"MI');
    end if;
  end if;
  perform public.evaluer_annonce(new.id);
  return null;
end $$;

drop trigger if exists evaluer_listing_insert on public.listings;
create trigger evaluer_listing_insert
  after insert on public.listings
  for each row execute function public.trg_evaluer_listing();

-- Après édition du texte ou du prix, on réévalue aussi.
drop trigger if exists evaluer_listing_update on public.listings;
create trigger evaluer_listing_update
  after update of title, description, price_cents on public.listings
  for each row
  when (old.title is distinct from new.title or old.description is distinct from new.description
        or old.price_cents is distinct from new.price_cents)
  execute function public.trg_evaluer_listing();

create or replace function public.trg_evaluer_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content_hash is not null then perform public.evaluer_annonce(new.listing_id); end if;
  return null;
end $$;
drop trigger if exists evaluer_photo_insert on public.listing_photos;
create trigger evaluer_photo_insert
  after insert on public.listing_photos
  for each row execute function public.trg_evaluer_photo();

create or replace function public.trg_evaluer_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.evaluer_annonce(new.listing_id);
  return null;
end $$;
drop trigger if exists evaluer_report_insert on public.reports;
create trigger evaluer_report_insert
  after insert on public.reports
  for each row execute function public.trg_evaluer_report();

-- Le trigger de suspension doit passer AVANT le quota : celui-ci s'exécute
-- en BEFORE, le nôtre en AFTER — l'ordre est donc naturel.

-- ---------- La file, vue par l'administration ----------

create or replace function public.admin_file_moderation()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_id',      c.id,
      'source',       c.source,
      'opened_at',    c.opened_at,
      'listing', jsonb_build_object(
        'id', l.id, 'title', l.title, 'description', l.description,
        'module', l.module::text, 'subcategory', l.subcategory,
        'price_cents', l.price_cents, 'status', l.status::text,
        'review_state', l.review_state, 'risk_score', l.risk_score,
        'risk_reasons', l.risk_reasons, 'created_at', l.created_at,
        'photos', coalesce((select jsonb_agg(ph.storage_key order by ph.position)
                              from public.listing_photos ph where ph.listing_id = l.id), '[]')),
      'auteur', jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'created_at', p.created_at,
        'is_banned', p.is_banned, 'suspended_until', p.suspended_until,
        'email', (select u.email from auth.users u where u.id = p.id),
        'nb_annonces', (select count(*) from public.listings x where x.user_id = p.id),
        'nb_signalements', (select count(*) from public.reports r
                              join public.listings x on x.id = r.listing_id where x.user_id = p.id),
        'nb_retirees', (select count(*) from public.listings x where x.user_id = p.id and x.status = 'removed'),
        'nb_decisions_contre', (select count(*) from public.moderation_decisions d
                                  join public.listings x on x.id = d.listing_id
                                 where x.user_id = p.id and d.decision in ('masquer','supprimer','suspendre','bannir'))),
      'signalements', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'motif', r.motif, 'reason', r.reason,
                 'created_at', r.created_at,
                 'par', (select display_name from public.profiles where id = r.reporter_id))
               order by r.created_at desc)
          from public.reports r where r.listing_id = l.id and not r.handled), '[]')
    ) order by l.risk_score desc, c.opened_at)
    from public.moderation_cases c
    join public.listings l on l.id = c.listing_id
    join public.profiles p on p.id = l.user_id
    where c.status = 'open'
  ), '[]'::jsonb);
end $$;

-- Les annonces surveillées : publiées, mais qu'un œil peut parcourir.
create or replace function public.admin_sous_surveillance()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'risk_score', l.risk_score, 'risk_reasons', l.risk_reasons,
      'created_at', l.created_at, 'auteur', p.display_name) order by l.risk_score desc)
    from public.listings l join public.profiles p on p.id = l.user_id
    where l.review_state = 'watch' and l.status = 'active'
      and not exists (select 1 from public.moderation_cases c where c.listing_id = l.id and c.status = 'open')
  ), '[]'::jsonb);
end $$;

-- ---------- Décider ----------

create or replace function public.admin_decider(
  p_case_id   uuid,
  p_decision  text,
  p_note      text default null,
  p_jours     int  default 7
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.moderation_cases;
  l public.listings;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select * into c from public.moderation_cases where id = p_case_id and status = 'open';
  if c.id is null then raise exception 'Dossier introuvable ou déjà traité.'; end if;
  select * into l from public.listings where id = c.listing_id;

  -- La décision est mémorisée avec le score de la machine à cet instant :
  -- c'est ce qui permettra de juger si elle avait raison.
  insert into public.moderation_decisions (case_id, listing_id, decided_by, decision, score_avant, reasons, note)
  values (c.id, c.listing_id, auth.uid(), p_decision, c.score, c.reasons, nullif(btrim(coalesce(p_note, '')), ''));

  case p_decision
    when 'publier', 'maintenir' then
      update public.listings set review_state = 'published', moderation_note = null, reviewed_at = now()
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'masquer' then
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now(),
             moderation_note = coalesce(nullif(btrim(p_note), ''), 'Annonce retirée par la modération.')
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'supprimer' then
      delete from public.listings where id = c.listing_id;
    when 'demander_modification' then
      -- L'annonce reste hors ligne tant que l'auteur ne l'a pas modifiée ;
      -- la modification déclenche une réévaluation, et un nouveau dossier
      -- si besoin. La note lui est montrée dans son espace.
      update public.listings set review_state = 'pending', reviewed_at = null,
             moderation_note = coalesce(nullif(btrim(p_note), ''), 'Merci de compléter ou corriger votre annonce.')
       where id = c.listing_id;
    when 'suspendre' then
      update public.profiles set suspended_until = now() + make_interval(days => greatest(1, coalesce(p_jours, 7)))
       where id = l.user_id;
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now(),
             moderation_note = 'Annonce retirée par la modération.'
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'bannir' then
      update public.profiles set is_banned = true where id = l.user_id;
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now()
       where user_id = l.user_id and status = 'active';
      update public.reports set handled = true where listing_id in (select id from public.listings where user_id = l.user_id) and not handled;
    else
      raise exception 'Décision inconnue.';
  end case;

  update public.moderation_cases set status = 'resolved', resolved_at = now() where id = c.id;

  -- Le journal d'administration existe depuis 0030 (autre session) : on y
  -- écrit si la table est là, sans en dépendre.
  if to_regclass('public.admin_audit_log') is not null then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'moderation_' || p_decision, 'listing', c.listing_id,
            jsonb_build_object('score', c.score, 'note', p_note, 'auteur', l.user_id));
  end if;
end $$;

-- Rouvrir un regard sur une annonce publiée : l'admin la met lui-même en file.
create or replace function public.admin_ouvrir_dossier(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  insert into public.moderation_cases (listing_id, source, score, reasons)
  select id, 'admin', risk_score, risk_reasons from public.listings where id = p_listing_id
  on conflict (listing_id) where status = 'open' do nothing;
end $$;

-- ---------- Droits ----------

revoke all on function public.mod_setting(text, jsonb)                from public, anon, authenticated;
revoke all on function public.evaluer_annonce(uuid)                    from public, anon, authenticated;
revoke all on function public.admin_file_moderation()                  from public;
revoke all on function public.admin_sous_surveillance()                from public;
revoke all on function public.admin_decider(uuid, text, text, int)     from public;
revoke all on function public.admin_ouvrir_dossier(uuid)               from public;
grant execute on function public.admin_file_moderation()               to authenticated;
grant execute on function public.admin_sous_surveillance()             to authenticated;
grant execute on function public.admin_decider(uuid, text, text, int)  to authenticated;
grant execute on function public.admin_ouvrir_dossier(uuid)            to authenticated;

-- Vérification : les réglages sont là, la file est vide.
-- select key from public.moderation_settings; select public.admin_file_moderation();
