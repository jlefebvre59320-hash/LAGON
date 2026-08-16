-- ============================================================
-- 0014 — Les annonces vendues restent visibles 7 jours.
--
-- Une annonce marquée « vendu » disparaissait immédiatement pour tout le
-- monde : brutal pour un acheteur en pleine discussion, et le site perdait
-- sa meilleure preuve sociale (« des choses s'y vendent »). Désormais elle
-- reste affichée une semaine avec son bandeau, puis sort naturellement.
-- Au passage, l'admin peut ouvrir n'importe quelle fiche (y compris
-- retirée) : nécessaire pour juger un signalement avant de supprimer.
-- ============================================================

alter table public.listings add column if not exists sold_at timestamptz;

-- La date de vente se pose toute seule au changement de statut : aucun
-- client ne peut l'oublier ni l'antidater.
create or replace function public.stamp_sold()
returns trigger language plpgsql as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    new.sold_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp_sold on public.listings;
create trigger trg_stamp_sold
  before update on public.listings
  for each row execute function public.stamp_sold();

drop policy if exists "listings_select_active" on public.listings;
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public" on public.listings
  for select using (
    status = 'active'
    or (status = 'sold' and sold_at > now() - interval '7 days')
    or auth.uid() = user_id
    or public.is_admin()
  );
