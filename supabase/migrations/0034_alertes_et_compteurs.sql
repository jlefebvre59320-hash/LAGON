-- ============================================================
-- 0034 — Alertes de recherche et compteurs par univers.
--
-- · Une alerte, c'est une recherche mémorisée : univers, sous-catégorie,
--   sens, mots, fourchette de prix, quartier. Quand une annonce qui lui
--   correspond paraît, la personne est prévenue (push et/ou email) par la
--   route serveur /api/alertes, qui interroge alertes_correspondantes().
--   Chaque couple alerte × annonce n'est notifié qu'une fois (alert_hits).
-- · annonces_par_univers() donne à l'accueil le nombre d'annonces en ligne
--   par univers, pour l'afficher dans les onglets.
-- ============================================================

create table if not exists public.search_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  module       public.listing_module,
  subcategory  text,
  intent       text check (intent is null or intent in ('offer', 'wanted')),
  query        text check (query is null or char_length(query) <= 80),
  min_cents    integer check (min_cents is null or min_cents >= 0),
  max_cents    integer check (max_cents is null or max_cents >= 0),
  quartier     text check (quartier is null or char_length(quartier) <= 40),
  created_at   timestamptz not null default now(),
  last_hit_at  timestamptz
);
create index if not exists idx_alerts_user on public.search_alerts (user_id, created_at desc);

alter table public.search_alerts enable row level security;
drop policy if exists "alerts_own_select" on public.search_alerts;
drop policy if exists "alerts_own_insert" on public.search_alerts;
drop policy if exists "alerts_own_delete" on public.search_alerts;
create policy "alerts_own_select" on public.search_alerts for select using (auth.uid() = user_id);
create policy "alerts_own_insert" on public.search_alerts for insert with check (auth.uid() = user_id);
create policy "alerts_own_delete" on public.search_alerts for delete using (auth.uid() = user_id);
revoke all on public.search_alerts from anon, authenticated;
grant select, delete on public.search_alerts to authenticated;
grant insert (user_id, module, subcategory, intent, query, min_cents, max_cents, quartier) on public.search_alerts to authenticated;

-- Dix alertes par compte : au-delà, ce n'est plus une veille, c'est un
-- moissonnage. Et une alerte sans aucun critère n'en est pas une.
create or replace function public.trg_alerte_bornes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.module is null and nullif(btrim(coalesce(new.query, '')), '') is null and new.quartier is null then
    raise exception 'Une alerte a besoin d''au moins un univers, un mot ou un quartier.';
  end if;
  if (select count(*) from public.search_alerts where user_id = new.user_id) >= 10 then
    raise exception 'Vous avez déjà dix alertes : supprimez-en une pour en créer une autre.';
  end if;
  new.query := nullif(btrim(coalesce(new.query, '')), '');
  new.subcategory := nullif(btrim(coalesce(new.subcategory, '')), '');
  new.quartier := nullif(btrim(coalesce(new.quartier, '')), '');
  return new;
end $$;
drop trigger if exists alerte_bornes on public.search_alerts;
create trigger alerte_bornes before insert on public.search_alerts
  for each row execute function public.trg_alerte_bornes();

-- Ce qui a déjà été envoyé : une alerte ne sonne qu'une fois par annonce.
create table if not exists public.alert_hits (
  alert_id   uuid not null references public.search_alerts(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  primary key (alert_id, listing_id)
);
alter table public.alert_hits enable row level security;
revoke all on public.alert_hits from anon, authenticated;

-- Les alertes que cette annonce réveille. Réservée à la clé de service :
-- elle rend des adresses email.
create or replace function public.alertes_correspondantes(p_listing_id uuid)
returns table (alert_id uuid, user_id uuid, email text, notify_email boolean, notify_push boolean, resume text)
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing_id;
  if l.id is null or l.status <> 'active' or l.review_state not in ('published', 'watch') then return; end if;
  return query
    select a.id, a.user_id, u.email::text,
           coalesce(p.notify_email, true), coalesce(p.notify_push, true),
           concat_ws(' · ',
             case when a.module is not null then a.module::text end,
             a.subcategory, a.query, a.quartier)
      from public.search_alerts a
      join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id
     where a.user_id <> l.user_id
       and (a.module is null or a.module = l.module)
       and (a.subcategory is null or a.subcategory = l.subcategory)
       and (a.intent is null or a.intent = l.intent)
       and (a.min_cents is null or (l.price_cents is not null and l.price_cents >= a.min_cents))
       and (a.max_cents is null or (l.price_cents is not null and l.price_cents <= a.max_cents))
       and (a.quartier is null or l.location ilike '%' || a.quartier || '%')
       and (a.query is null or l.search_tsv @@ websearch_to_tsquery('french', a.query))
       and not exists (select 1 from public.alert_hits h where h.alert_id = a.id and h.listing_id = l.id)
       and coalesce(p.is_banned, false) = false;
end $$;

-- Mémorise l'envoi. Clé de service.
create or replace function public.marquer_alertes_envoyees(p_listing_id uuid, p_alert_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.alert_hits (alert_id, listing_id)
  select unnest(p_alert_ids), p_listing_id
  on conflict do nothing;
  update public.search_alerts set last_hit_at = now() where id = any(p_alert_ids);
end $$;

-- Les annonces parues récemment, pour la passe quotidienne de rattrapage
-- (celles publiées après une vérification humaine, sans passage par le
-- navigateur du déposant).
create or replace function public.annonces_recentes_pour_alertes(p_heures int default 36)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.listings
   where status = 'active' and review_state in ('published', 'watch')
     and created_at > now() - make_interval(hours => greatest(1, p_heures))
   order by created_at desc limit 200;
$$;

revoke all on function public.alertes_correspondantes(uuid)            from public, anon, authenticated;
revoke all on function public.marquer_alertes_envoyees(uuid, uuid[])   from public, anon, authenticated;
revoke all on function public.annonces_recentes_pour_alertes(int)      from public, anon, authenticated;
grant execute on function public.alertes_correspondantes(uuid)          to service_role;
grant execute on function public.marquer_alertes_envoyees(uuid, uuid[]) to service_role;
grant execute on function public.annonces_recentes_pour_alertes(int)    to service_role;

-- ---------- Compteurs par univers ----------

-- Le nombre d'annonces en ligne par univers, pour les onglets de l'accueil.
-- Public : ce sont des annonces publiques qu'on compte.
create or replace function public.annonces_par_univers()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(module, n), '{}'::jsonb)
    from (select module::text as module, count(*) as n
            from public.listings
           where status = 'active' and review_state in ('published', 'watch')
           group by module) t;
$$;
revoke all on function public.annonces_par_univers() from public;
grant execute on function public.annonces_par_univers() to anon, authenticated;

-- Vérification : select public.annonces_par_univers();
