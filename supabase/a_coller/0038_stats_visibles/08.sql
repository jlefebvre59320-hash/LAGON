
-- ---------- 11. Droits ----------

-- Les aides ne se lancent pas à la main : seules les fonctions principales,
-- qui vérifient le rôle administrateur, y ont accès.
revoke all on function public.site_stats_audience(timestamptz, timestamptz, text)       from public, anon, authenticated;
revoke all on function public.admin_dash_kpi(timestamptz, timestamptz, timestamptz)      from public, anon, authenticated;
revoke all on function public.admin_dash_series(timestamptz, timestamptz, interval)      from public, anon, authenticated;
revoke all on function public.admin_dash_listes(timestamptz, timestamptz)                from public, anon, authenticated;
revoke all on function public.tr_sessions(timestamptz)                                   from public, anon, authenticated;
revoke all on function public.tr_comptes(timestamptz)                                    from public, anon, authenticated;
revoke all on function public.admin_temps_reel() from public;
grant execute on function public.admin_temps_reel() to authenticated;
-- site_stats, admin_dashboard et record_page_view gardent les droits posés
-- par 0024, 0029 et 0020 (create or replace les conserve).
