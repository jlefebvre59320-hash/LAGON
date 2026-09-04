-- ============================================================
-- 0035 — Une seule annonce en avant par personne (phase de test).
--
-- La mise en avant est gratuite pendant le test : sans garde-fou, tout le
-- monde mettrait tout en avant et la une ne voudrait plus rien dire. La
-- limite vit dans moderation_settings (mise_en_avant.max_par_personne) :
-- quand la facturation arrivera, il suffira de la relever.
-- ============================================================

insert into public.moderation_settings (key, value)
values ('mise_en_avant', '{"max_par_personne": 1}')
on conflict (key) do nothing;

create or replace function public.trg_limite_mise_en_avant()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  maxi int := coalesce((public.mod_setting('mise_en_avant', '{"max_par_personne":1}')->>'max_par_personne')::int, 1);
  n    int;
begin
  -- Seule une mise en avant active compte ; la retirer passe toujours.
  if new.featured_until is null or new.featured_until <= now() then return new; end if;
  if tg_op = 'UPDATE' and old.featured_until is not distinct from new.featured_until then return new; end if;
  select count(*) into n from public.listings
   where user_id = new.user_id and id <> new.id and status = 'active' and featured_until > now();
  if n >= maxi then
    if maxi = 1 then
      raise exception 'Pendant la phase de test, une seule annonce en avant par personne. Retirez l''autre de la une pour changer.';
    else
      raise exception 'Vous avez déjà % annonces en avant : c''est le maximum.', maxi;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists limite_mise_en_avant on public.listings;
create trigger limite_mise_en_avant
  before insert or update of featured_until on public.listings
  for each row execute function public.trg_limite_mise_en_avant();
