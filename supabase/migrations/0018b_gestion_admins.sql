-- ============================================================
-- 0019 — Nommer et révoquer des administrateurs depuis le site.
--
-- Jusqu'ici, donner les droits d'administration demandait une requête
-- SQL manuelle. Cette migration ajoute une fonction réservée aux
-- administrateurs, et expose l'état « admin » dans la liste des comptes
-- pour que l'espace d'administration puisse l'afficher et le basculer.
-- ============================================================

-- La liste des comptes gagne la colonne is_admin (l'appel reste réservé
-- aux administrateurs : la fonction refuse tout autre appelant).
--
-- Le DROP est indispensable : PostgreSQL refuse qu'un « create or replace »
-- change le type de retour d'une fonction table (« cannot change return type
-- of existing function »). On la supprime donc avant de la recréer.
drop function if exists public.admin_users();

create or replace function public.admin_users()
returns table (id uuid, email text, display_name text, created_at timestamptz,
               last_sign_in timestamptz, is_banned boolean, is_admin boolean,
               listings bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at,
           p.is_banned, p.is_admin, (select count(*) from listings l where l.user_id = u.id)
    from auth.users u
    join profiles p on p.id = u.id
    order by u.created_at desc
    limit 500;
end $$;

-- Nommer ou révoquer un administrateur.
-- Deux garde-fous : seul un administrateur peut appeler la fonction, et
-- personne ne peut se retirer ses propres droits — sans quoi un clic
-- malheureux fermerait la porte de l'intérieur, et il faudrait revenir
-- au SQL manuel pour rentrer.
create or replace function public.set_admin(target_id uuid, value boolean)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if target_id = auth.uid() and value = false then
    raise exception 'Vous ne pouvez pas retirer vos propres droits d''administration.';
  end if;
  update public.profiles set is_admin = value where id = target_id;
end $$;

revoke all on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;
