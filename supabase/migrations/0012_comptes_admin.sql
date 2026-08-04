-- ============================================================
-- Liste des comptes pour l'administration + bannissement
-- Les emails vivent dans auth.users, invisible côté client :
-- seule cette fonction, réservée à l'admin, les expose.
-- ============================================================

create or replace function public.admin_users()
returns table (id uuid, email text, display_name text, created_at timestamptz,
               last_sign_in timestamptz, is_banned boolean, listings bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at,
           p.is_banned, (select count(*) from listings l where l.user_id = u.id)
    from auth.users u
    join profiles p on p.id = u.id
    order by u.created_at desc
    limit 500;
end $$;

-- L'admin peut bannir / rétablir un compte (colonne is_banned : un banni ne
-- peut plus publier, ses annonces restent gérées par l'admin).
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());
