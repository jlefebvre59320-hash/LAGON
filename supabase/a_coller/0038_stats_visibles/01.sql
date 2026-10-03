-- ============================================================
-- 0038 — Statistiques : ce qui se voit, sans les administrateurs,
--        et le temps réel.
--
-- · Depuis la modération (0032), une annonce « active » peut être en
--   attente ou retenue, donc invisible : les statistiques ne comptent plus
--   que les annonces publiées ou surveillées.
-- · Les administrateurs sortent de toutes les statistiques : leurs pages
--   vues ne sont plus enregistrées, leurs comptes ne sont plus comptés.
-- · admin_temps_reel() : visiteurs maintenant, visiteurs uniques et
--   comptes créés sur 24 h, reconnexions, sessions, 24 heures heure par
--   heure, visiteurs présents, détails.
--
-- Chaque fonction tient en moins de 4 500 octets : le fichier se colle
-- morceau par morceau dans un éditeur SQL qui tronque les longs textes
-- (voir supabase/a_coller/). Les fonctions « aides » (site_stats_audience,
-- admin_dash_*, tr_*) ne sont appelables que par les fonctions
-- principales, qui vérifient le rôle administrateur.
-- ============================================================

-- ---------- 1. Les administrateurs ne laissent pas de trace ----------

create or replace function public.record_page_view(
  p_path text, p_listing_id uuid default null, p_viewer_key text default null,
  p_device text default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or char_length(p_path) not between 1 and 300 or left(p_path, 1) <> '/' then
    raise exception 'Chemin invalide.';
  end if;
  if p_path not in ('/', '/food', '/event', '/guide', '/soutenir')
     and p_path !~ '^/(annonce|food/resto|guide/lieu)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Page non mesurée.';
  end if;
  if p_viewer_key is null then return; end if;
  -- Un administrateur qui vérifie le site n'est pas un visiteur.
  if auth.uid() is not null and public.is_admin() then return; end if;
  if char_length(p_viewer_key) not between 16 and 100 then
    raise exception 'Identifiant visiteur invalide.';
  end if;
  if p_listing_id is not null and p_path <> '/annonce/' || p_listing_id::text then
    raise exception 'Annonce et chemin incohérents.';
  end if;
  if not exists (select 1 from public.page_views v
                  where v.path = p_path and v.viewer_key = p_viewer_key
                    and v.created_at > now() - interval '30 minutes') then
    insert into public.page_views (path, listing_id, viewer_key, device, source)
    values (p_path, p_listing_id, p_viewer_key,
      case when p_device in ('mobile', 'ordinateur', 'tablette') then p_device end,
      case when p_source in ('direct', 'google', 'bing', 'facebook', 'instagram', 'whatsapp', 'autre') then p_source end);
  end if;
end $$;
