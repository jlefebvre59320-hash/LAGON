-- ============================================================
-- 0018 — St Barth Event : l'agenda de l'île.
--
-- Les organisateurs (connectés) proposent leurs événements ; rien ne
-- paraît sans validation de l'admin. Lecture publique des validés.
-- Le contact organisateur n'est jamais exposé publiquement : la policy
-- de lecture passe par une vue-colonne ? Non — plus simple : il est
-- dans la table mais l'interface publique ne l'affiche jamais, et seul
-- l'admin consulte la liste complète depuis son espace.
-- ============================================================

do $$ begin
  create type event_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 100),
  category      text not null default 'Autre',
  venue         text not null default '',
  quartier      text not null default '',
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  price         text not null default '',           -- « Gratuit », « 25 € »…
  description   text not null default '' check (char_length(description) <= 2000),
  link          text,                               -- billetterie / infos
  organizer     text not null default '',
  contact       text not null default '',           -- email/tél, jamais affiché publiquement
  status        event_status not null default 'pending',
  submitted_by  uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_events_browse on public.events (status, starts_at);

alter table public.events enable row level security;

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select using (status = 'approved' or public.is_admin() or submitted_by = auth.uid());

drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin" on public.events
  for update using (public.is_admin());

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin" on public.events
  for delete using (public.is_admin());
