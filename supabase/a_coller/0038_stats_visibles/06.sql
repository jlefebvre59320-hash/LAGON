
-- ---------- 9. Temps réel : les comptes (hors administrateurs) ----------

create or replace function public.tr_comptes(h24 timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with membres as (
    select u.id, u.email, u.created_at, u.last_sign_in_at from auth.users u
     where not coalesce((select is_admin from public.profiles p where p.id = u.id), false))
  select jsonb_build_object(
    'comptes_crees_24h', (select count(*) from membres where created_at > h24),
    -- Reconnexion : un compte qui existait déjà hier et qui s'est reconnecté.
    'reconnexions_24h',  (select count(*) from membres where last_sign_in_at > h24 and created_at <= h24),
    'connexions',        (select count(*) from membres where last_sign_in_at > h24),
    'comptes_total',     (select count(*) from membres),
    'comptes_crees_7j',  (select count(*) from membres where created_at > now() - interval '7 days'),
    'dernieres_connexions', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nom', coalesce(p.display_name, 'Membre'), 'email', u.email,
                                          'quand', u.last_sign_in_at, 'nouveau', u.created_at > h24) order by u.last_sign_in_at desc)
        from (select * from membres where last_sign_in_at is not null order by last_sign_in_at desc limit 12) u
        left join public.profiles p on p.id = u.id), '[]'));
$$;
