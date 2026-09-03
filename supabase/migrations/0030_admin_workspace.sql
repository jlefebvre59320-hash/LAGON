-- ============================================================
-- 0030 — Espace d'administration : journal d'activité sécurisé.
--
-- Le journal est écrit uniquement par des triggers SECURITY DEFINER et lu
-- uniquement par les administrateurs. Aucune donnée métier complète n'est
-- copiée : seules l'action et l'ancienne/nouvelle valeur sont conservées.
-- ============================================================

create table if not exists public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_select_admin" on public.admin_audit_log;
create policy "admin_audit_select_admin" on public.admin_audit_log
  for select using (public.is_admin());

revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function public.capture_admin_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_field text := tg_argv[0];
  v_old text;
  v_new text;
  v_target uuid;
begin
  -- Les changements ordinaires des utilisateurs ne doivent jamais entrer
  -- dans le journal réservé aux actions d'administration.
  if not public.is_admin() then
    return new;
  end if;

  v_old := to_jsonb(old) ->> v_field;
  v_new := to_jsonb(new) ->> v_field;
  if v_old is not distinct from v_new then
    return new;
  end if;

  v_target := nullif(to_jsonb(new) ->> 'id', '')::uuid;
  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(), tg_table_name || '.' || v_field, tg_table_name, v_target,
    jsonb_build_object('old_value', v_old, 'new_value', v_new)
  );
  return new;
end;
$$;

revoke all on function public.capture_admin_change() from public, anon, authenticated;

-- Recréés explicitement pour que la migration soit rejouable sans doublons.
drop trigger if exists audit_listings_status on public.listings;
create trigger audit_listings_status after update of status on public.listings
  for each row execute function public.capture_admin_change('status');

drop trigger if exists audit_restaurants_status on public.restaurants;
create trigger audit_restaurants_status after update of status on public.restaurants
  for each row execute function public.capture_admin_change('status');

drop trigger if exists audit_places_status on public.places;
create trigger audit_places_status after update of status on public.places
  for each row execute function public.capture_admin_change('status');

drop trigger if exists audit_events_status on public.events;
create trigger audit_events_status after update of status on public.events
  for each row execute function public.capture_admin_change('status');

drop trigger if exists audit_profiles_admin on public.profiles;
create trigger audit_profiles_admin after update of is_admin on public.profiles
  for each row execute function public.capture_admin_change('is_admin');

drop trigger if exists audit_profiles_banned on public.profiles;
create trigger audit_profiles_banned after update of is_banned on public.profiles
  for each row execute function public.capture_admin_change('is_banned');

drop trigger if exists audit_reports_handled on public.reports;
create trigger audit_reports_handled after update of handled on public.reports
  for each row execute function public.capture_admin_change('handled');

drop trigger if exists audit_feedback_handled on public.feedback;
create trigger audit_feedback_handled after update of handled on public.feedback
  for each row execute function public.capture_admin_change('handled');

drop trigger if exists audit_claims_handled on public.restaurant_claims;
create trigger audit_claims_handled after update of handled on public.restaurant_claims
  for each row execute function public.capture_admin_change('handled');

drop function if exists public.admin_audit_recent(integer);
create function public.admin_audit_recent(p_limit integer default 100)
returns table (
  id bigint,
  actor_id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;

  return query
    select log.id, log.actor_id, users.email::text, log.action,
           log.target_type, log.target_id, log.details, log.created_at
    from public.admin_audit_log log
    left join auth.users users on users.id = log.actor_id
    order by log.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_audit_recent(integer) from public, anon;
grant execute on function public.admin_audit_recent(integer) to authenticated;
