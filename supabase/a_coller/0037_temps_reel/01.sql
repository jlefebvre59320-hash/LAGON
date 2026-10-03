-- ============================================================
-- 0037 — Temps réel : préparation.
--
-- L'index qui sert à reconstruire les sessions, et la table page_views
-- dans la publication temps réel (l'administration reçoit chaque vue à
-- l'instant ; la RLS n'en montre rien à personne d'autre). La fonction
-- admin_temps_reel() elle-même est dans 0038, avec les autres
-- statistiques, découpée en morceaux courts.
-- ============================================================

create index if not exists idx_page_views_viewer_recent
  on public.page_views (viewer_key, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'page_views') then
      alter publication supabase_realtime add table public.page_views;
    end if;
  else
    raise notice 'Publication supabase_realtime absente : activez Realtime sur page_views depuis le tableau de bord.';
  end if;
end $$;
