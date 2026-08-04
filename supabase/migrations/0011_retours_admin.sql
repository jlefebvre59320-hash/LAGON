-- ============================================================
-- Boîte à idées + outils d'administration
-- Idempotent.
-- ============================================================

-- ---------- Retours des utilisateurs (idée, problème, avis) ----------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('idee', 'probleme', 'avis')),
  message    text not null check (char_length(message) between 3 and 2000),
  contact    text,                    -- optionnel : pour pouvoir répondre
  user_id    uuid references public.profiles(id) on delete set null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_pending on public.feedback (handled, created_at desc);

alter table public.feedback enable row level security;

-- Écriture ouverte, même sans compte : une idée ne doit pas exiger une
-- inscription. Lecture et traitement : administration seulement.
drop policy if exists "feedback_insert_all" on public.feedback;
create policy "feedback_insert_all" on public.feedback for insert with check (true);
drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin" on public.feedback for select using (public.is_admin());
drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_update_admin" on public.feedback for update using (public.is_admin());

-- ---------- Les signalements deviennent visibles par l'administration ----------
-- La table reports existe depuis la première migration mais n'était lisible
-- par personne : les signalements partaient dans le vide.
drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin" on public.reports for select using (public.is_admin());
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin" on public.reports for update using (public.is_admin());

-- ---------- L'administration peut retirer une annonce ----------
drop policy if exists "listings_update_admin" on public.listings;
create policy "listings_update_admin" on public.listings for update using (public.is_admin());
