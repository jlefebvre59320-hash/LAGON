-- ============================================================
-- 0019 — Durcissement sécurité, confidentialité et modération
--
-- Cette migration ferme les élévations de privilèges possibles depuis le
-- client, limite les transitions de statut et expose les données privées
-- uniquement par des fonctions administratives contrôlées.
-- ============================================================

-- ---------- État du compte courant ----------
-- Les policies n'ont plus besoin d'exposer profiles.is_banned au client.
create or replace function public.current_user_is_banned()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_banned from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_user_is_banned() from public;
grant execute on function public.current_user_is_banned() to authenticated;

-- ---------- Profils : colonnes réellement modifiables ----------
-- Une policy de ligne ne protège pas les colonnes : sans ces GRANT, chacun
-- pouvait modifier is_admin, is_banned ou is_pro sur son propre profil.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, phone_wa) on public.profiles to authenticated;

alter table public.profiles
  drop constraint if exists profiles_display_name_length,
  drop constraint if exists profiles_phone_e164;
alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 80) not valid;
alter table public.profiles
  add constraint profiles_phone_e164
  check (phone_wa is null or phone_wa ~ '^\+[1-9][0-9]{7,14}$') not valid;

-- Les métadonnées d'inscription sont fournies par le navigateur : elles sont
-- bornées avant d'entrer dans le profil créé automatiquement.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utilisateur'
    ), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Le numéro public n'est visible que pour le propriétaire du profil, un
-- administrateur, ou le vendeur d'une annonce encore visible publiquement.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    auth.uid() = id
    or public.is_admin()
    or exists (
      select 1
      from public.listings l
      where l.user_id = profiles.id
        and (
          l.status = 'active'
          or (l.status = 'sold' and l.sold_at > now() - interval '7 days')
        )
    )
  );

revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, phone_wa, is_pro)
  on public.profiles to anon, authenticated;

-- ---------- Annonces : transitions autorisées et bannissement ----------
-- Les valeurs techniques (auteur, dates, motif de modération) restent sous le
-- contrôle de la base, même si le client forge directement une requête REST.
revoke insert, update on public.listings from anon, authenticated;
grant insert (
  user_id, module, subcategory, intent, title, description,
  price_cents, location, attrs
) on public.listings to authenticated;
grant update (
  title, description, price_cents, location, attrs, intent, status
) on public.listings to authenticated;

alter table public.listings
  drop constraint if exists listings_location_length,
  drop constraint if exists listings_attrs_object;
alter table public.listings
  add constraint listings_location_length
  check (char_length(location) between 1 and 120) not valid;
alter table public.listings
  add constraint listings_attrs_object
  check (jsonb_typeof(attrs) = 'object' and octet_length(attrs::text) <= 10000) not valid;

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own" on public.listings
  for insert with check (
    auth.uid() = user_id
    and status = 'active'
    and not public.current_user_is_banned()
  );

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own" on public.listings
  for update
  using (
    auth.uid() = user_id
    and status <> 'removed'
    and not public.current_user_is_banned()
  )
  with check (
    auth.uid() = user_id
    and status in ('active', 'sold', 'expired')
    and not public.current_user_is_banned()
  );

-- La limite de dix annonces actives s'applique aussi à une réactivation.
create or replace function public.check_listing_quota()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'active' then
      return new;
    end if;
  end if;

  -- Sérialise deux publications simultanées du même compte : sans verrou,
  -- deux requêtes pourraient toutes deux voir neuf annonces et dépasser dix.
  perform pg_advisory_xact_lock(hashtextextended('listing:' || new.user_id::text, 0));

  if (select count(*) from public.listings
      where user_id = new.user_id and status = 'active') >= 10 then
    raise exception 'Quota atteint : 10 annonces actives maximum.';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_quota on public.listings;
create trigger listings_quota
  before insert or update of status on public.listings
  for each row execute function public.check_listing_quota();

-- Une remise en ligne repart pour 60 jours. sold_at est également remis à
-- zéro pour qu'une ancienne date de vente ne rende pas la fiche incohérente.
create or replace function public.stamp_sold()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    new.sold_at := now();
  elsif new.status = 'active' and old.status is distinct from 'active' then
    new.sold_at := null;
    new.expires_at := now() + interval '60 days';
  end if;
  return new;
end;
$$;

-- ---------- Restaurants : création modérée et valeurs sûres ----------
-- Les propriétaires passent par la revendication d'une fiche existante ; une
-- nouvelle fiche publique est créée par l'administration après vérification.
-- 0010 a parfois été omise sur les premières installations : ce rattrapage
-- rend la migration autonome et ne modifie rien si la colonne existe déjà.
alter table public.restaurants
  add column if not exists avg_price_eur smallint
  check (avg_price_eur is null or avg_price_eur between 1 and 500);

drop policy if exists "restaurants_insert" on public.restaurants;
create policy "restaurants_insert" on public.restaurants
  for insert with check (public.is_admin());

drop policy if exists "restaurants_update" on public.restaurants;
create policy "restaurants_update" on public.restaurants
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

revoke update on public.restaurants from anon, authenticated;
grant update (
  name, cuisine, quartier, address, phone, whatsapp, instagram, facebook,
  website, snapchat, tiktok, email, description, price_range, takeaway, hours,
  status
) on public.restaurants to authenticated;

-- SQL dynamique : le SQL Editor Supabase peut analyser un GRANT de colonne
-- avant d'avoir exécuté l'ALTER TABLE situé plus haut dans le même script.
do $$
begin
  execute 'grant update (avg_price_eur) on public.restaurants to authenticated';
end;
$$;

-- NOT VALID évite de bloquer le déploiement sur d'anciennes données, tout en
-- protégeant immédiatement les nouvelles écritures.
alter table public.restaurants
  drop constraint if exists restaurants_website_http,
  drop constraint if exists restaurants_facebook_http,
  drop constraint if exists restaurants_email_format,
  drop constraint if exists restaurants_phone_e164,
  drop constraint if exists restaurants_text_lengths,
  drop constraint if exists restaurants_social_handles;
alter table public.restaurants
  add constraint restaurants_website_http
  check (website is null or website ~* '^https?://[^[:space:]]+$') not valid;
alter table public.restaurants
  add constraint restaurants_facebook_http
  check (facebook is null or facebook ~* '^https?://[^[:space:]]+$') not valid;
alter table public.restaurants
  add constraint restaurants_email_format
  check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;
alter table public.restaurants
  add constraint restaurants_phone_e164
  check (
    (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
    and (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$')
  ) not valid;
alter table public.restaurants
  add constraint restaurants_text_lengths
  check (
    char_length(cuisine) between 1 and 100
    and char_length(quartier) between 1 and 80
    and char_length(address) <= 300
    and (phone is null or char_length(phone) <= 40)
    and (whatsapp is null or char_length(whatsapp) <= 40)
    and (website is null or char_length(website) <= 500)
    and (facebook is null or char_length(facebook) <= 500)
    and (email is null or char_length(email) <= 254)
  ) not valid;
alter table public.restaurants
  add constraint restaurants_social_handles
  check (
    (instagram is null or instagram ~ '^[A-Za-z0-9._-]{1,64}$')
    and (snapchat is null or snapchat ~ '^[A-Za-z0-9._-]{1,64}$')
    and (tiktok is null or tiktok ~ '^[A-Za-z0-9._-]{1,64}$')
  ) not valid;
alter table public.events
  drop constraint if exists events_link_http,
  drop constraint if exists events_field_lengths,
  drop constraint if exists events_dates_ordered;
alter table public.events
  add constraint events_link_http
  check (link is null or link ~* '^https?://[^[:space:]]+$') not valid;
alter table public.events
  add constraint events_field_lengths
  check (
    char_length(category) between 1 and 80
    and char_length(venue) <= 200
    and char_length(quartier) <= 80
    and char_length(price) <= 100
    and (link is null or char_length(link) <= 500)
    and char_length(organizer) between 1 and 120
    and char_length(contact) between 3 and 200
  ) not valid;
alter table public.events
  add constraint events_dates_ordered
  check (ends_at is null or ends_at >= starts_at) not valid;
alter table public.places
  drop constraint if exists places_website_http;
alter table public.places
  add constraint places_website_http
  check (website is null or website ~* '^https?://[^[:space:]]+$') not valid;

-- ---------- Intégrité des auteurs de formulaires ----------
drop policy if exists "reports_insert_auth" on public.reports;
revoke insert on public.reports from anon, authenticated;
grant insert (listing_id, reporter_id, reason) on public.reports to authenticated;
create policy "reports_insert_auth" on public.reports
  for insert with check (
    auth.uid() is not null
    and reporter_id = auth.uid()
  );

drop policy if exists "claims_insert_all" on public.restaurant_claims;
revoke insert on public.restaurant_claims from anon, authenticated;
grant insert (restaurant_id, kind, message, contact, user_id)
  on public.restaurant_claims to anon, authenticated;
create policy "claims_insert_all" on public.restaurant_claims
  for insert with check (user_id is not distinct from auth.uid());

drop policy if exists "feedback_insert_all" on public.feedback;
revoke insert on public.feedback from anon, authenticated;
grant insert (kind, message, contact, user_id)
  on public.feedback to anon, authenticated;
create policy "feedback_insert_all" on public.feedback
  for insert with check (user_id is not distinct from auth.uid());

-- Évite les doublons de signalement et de revendication encore en attente.
create or replace function public.prevent_duplicate_submission()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_table_name = 'reports' then
    perform pg_advisory_xact_lock(hashtextextended(
      'report:' || new.listing_id::text || ':' || new.reporter_id::text, 0
    ));
    if exists (
      select 1 from public.reports r
      where r.listing_id = new.listing_id
        and r.reporter_id = new.reporter_id
        and not r.handled
    ) then
      raise exception 'Cette annonce a déjà été signalée.';
    end if;
  elsif tg_table_name = 'restaurant_claims' then
    perform pg_advisory_xact_lock(hashtextextended(
      'claim:' || new.restaurant_id::text || ':' || new.kind::text || ':' || lower(new.contact), 0
    ));
    if exists (
      select 1 from public.restaurant_claims c
      where c.restaurant_id = new.restaurant_id
        and c.kind = new.kind
        and lower(c.contact) = lower(new.contact)
        and not c.handled
    ) then
      raise exception 'Une demande identique est déjà en attente.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_no_duplicate on public.reports;
create trigger reports_no_duplicate
  before insert on public.reports
  for each row execute function public.prevent_duplicate_submission();

drop trigger if exists claims_no_duplicate on public.restaurant_claims;
create trigger claims_no_duplicate
  before insert on public.restaurant_claims
  for each row execute function public.prevent_duplicate_submission();

-- Cinq événements en attente et dix soumissions par jour maximum par compte.
create or replace function public.check_event_submission_quota()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.submitted_by is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('event:' || new.submitted_by::text, 0));
  if (select count(*) from public.events
      where submitted_by = new.submitted_by and status = 'pending') >= 5 then
    raise exception 'Vous avez déjà 5 événements en attente.';
  end if;
  if (select count(*) from public.events
      where submitted_by = new.submitted_by
        and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Trop de soumissions récentes. Réessayez demain.';
  end if;
  return new;
end;
$$;

drop trigger if exists events_submission_quota on public.events;
create trigger events_submission_quota
  before insert on public.events
  for each row execute function public.check_event_submission_quota();

drop policy if exists "events_insert" on public.events;
revoke insert on public.events from anon, authenticated;
grant insert (
  title, category, venue, quartier, starts_at, ends_at, price,
  description, link, organizer, contact, submitted_by
) on public.events to authenticated;
create policy "events_insert" on public.events
  for insert with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and not public.current_user_is_banned()
  );

-- ---------- Confidentialité des événements ----------
-- Le contact ne fait plus partie des colonnes lisibles via l'API publique.
revoke select on public.events from anon, authenticated;
grant select (
  id, title, category, venue, quartier, starts_at, ends_at, price,
  description, link, organizer, status
) on public.events to anon, authenticated;

create or replace function public.admin_pending_events()
returns table (
  id uuid, title text, category text, venue text, quartier text,
  starts_at timestamptz, ends_at timestamptz, price text, description text,
  link text, organizer text, contact text, created_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select e.id, e.title, e.category, e.venue, e.quartier,
           e.starts_at, e.ends_at, e.price, e.description,
           e.link, e.organizer, e.contact, e.created_at
    from public.events e
    where e.status = 'pending'
    order by e.starts_at;
end;
$$;

-- ---------- Actions administratives atomiques ----------
create or replace function public.admin_set_user_banned(
  p_user_id uuid,
  p_is_banned boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_user_id = auth.uid() and p_is_banned then
    raise exception 'Un administrateur ne peut pas se bannir lui-même.';
  end if;
  update public.profiles set is_banned = p_is_banned where id = p_user_id;
  if not found then raise exception 'Compte introuvable.'; end if;
end;
$$;

create or replace function public.admin_set_event_status(
  p_event_id uuid,
  p_status event_status
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Statut invalide.';
  end if;
  update public.events set status = p_status where id = p_event_id and status = 'pending';
  if not found then raise exception 'Événement introuvable ou déjà traité.'; end if;
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_remove_listing boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  select r.listing_id, r.reason into v_listing_id, v_reason
  from public.reports r
  where r.id = p_report_id and not r.handled
  for update;
  if not found then raise exception 'Signalement introuvable ou déjà traité.'; end if;

  if p_remove_listing then
    update public.listings
      set status = 'removed', removed_reason = left(v_reason, 200)
      where id = v_listing_id;
    if not found then raise exception 'Annonce introuvable.'; end if;
  end if;
  update public.reports set handled = true where id = p_report_id;
end;
$$;

create or replace function public.admin_resolve_feedback(p_feedback_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  update public.feedback set handled = true
  where id = p_feedback_id and not handled;
  if not found then raise exception 'Retour introuvable ou déjà traité.'; end if;
end;
$$;

create or replace function public.admin_resolve_claim(
  p_claim_id uuid,
  p_action text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_action not in ('grant', 'hide', 'done') then
    raise exception 'Action invalide.';
  end if;

  select c.restaurant_id, c.user_id into v_restaurant_id, v_user_id
  from public.restaurant_claims c
  where c.id = p_claim_id and not c.handled
  for update;
  if not found then raise exception 'Demande introuvable ou déjà traitée.'; end if;

  if p_action = 'grant' then
    if v_user_id is null then raise exception 'La demande n''est liée à aucun compte.'; end if;
    update public.restaurants set owner_id = v_user_id where id = v_restaurant_id;
  elsif p_action = 'hide' then
    update public.restaurants set status = 'hidden' where id = v_restaurant_id;
  end if;
  update public.restaurant_claims set handled = true where id = p_claim_id;
end;
$$;

-- ---------- Statistiques : insertion dédupliquée par fonction ----------
create or replace function public.record_page_view(
  p_path text,
  p_listing_id uuid default null,
  p_viewer_key text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_path is null or char_length(p_path) not between 1 and 300
     or left(p_path, 1) <> '/' then
    raise exception 'Chemin invalide.';
  end if;
  if p_path not in ('/', '/food', '/event', '/guide', '/soutenir')
     and p_path !~ '^/(annonce|food/resto|guide/lieu)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Page non mesurée.';
  end if;
  -- Sans identifiant aléatoire local, aucune déduplication fiable n'est
  -- possible : mieux vaut perdre une vue que permettre du remplissage massif.
  if p_viewer_key is null then
    return;
  end if;
  if char_length(p_viewer_key) not between 16 and 100 then
    raise exception 'Identifiant visiteur invalide.';
  end if;
  if p_listing_id is not null
     and p_path <> '/annonce/' || p_listing_id::text then
    raise exception 'Annonce et chemin incohérents.';
  end if;

  if not exists (
    select 1 from public.page_views v
    where v.path = p_path
      and v.viewer_key = p_viewer_key
      and v.created_at > now() - interval '30 minutes'
  ) then
    insert into public.page_views (path, listing_id, viewer_key)
    values (p_path, p_listing_id, p_viewer_key);
  end if;
end;
$$;

revoke insert on public.page_views from anon, authenticated;
drop policy if exists "page_views_insert_all" on public.page_views;

-- ---------- Stockage : uniquement les photos d'une annonce possédée ----------
create or replace function public.can_upload_listing_photo(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, storage
as $$
declare
  v_parts text[];
  v_listing_id uuid;
begin
  if auth.uid() is null then return false; end if;
  v_parts := string_to_array(p_name, '/');
  if array_length(v_parts, 1) <> 3 or v_parts[1] <> auth.uid()::text then
    return false;
  end if;
  if v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_listing_id := v_parts[2]::uuid;

  return exists (
    select 1 from public.listings l
    where l.id = v_listing_id
      and l.user_id = auth.uid()
      and l.status <> 'removed'
      and not public.current_user_is_banned()
  ) and (
    exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = p_name)
    or (select count(*) from storage.objects o
        where o.bucket_id = 'photos'
          and o.name like auth.uid()::text || '/' || v_listing_id::text || '/%') < 5
  ) and (
    select count(*) from storage.objects o
    where o.bucket_id = 'photos' and o.name like auth.uid()::text || '/%'
  ) < 60;
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.can_upload_listing_photo(text) from public;
grant execute on function public.can_upload_listing_photo(text) to authenticated;

drop policy if exists "photos_bucket_insert" on storage.objects;
create policy "photos_bucket_insert" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and public.can_upload_listing_photo(name)
  );

drop policy if exists "photos_insert_own" on public.listing_photos;
create policy "photos_insert_own" on public.listing_photos
  for insert with check (
    not public.current_user_is_banned()
    and storage_key like auth.uid()::text || '/' || listing_id::text || '/%'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.user_id = auth.uid()
        and l.status <> 'removed'
    )
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'photos' and o.name = storage_key
    )
  );

-- ---------- Privilèges des fonctions sensibles ----------
revoke all on function public.admin_pending_events() from public;
revoke all on function public.admin_set_user_banned(uuid, boolean) from public;
revoke all on function public.admin_set_event_status(uuid, event_status) from public;
revoke all on function public.admin_resolve_report(uuid, boolean) from public;
revoke all on function public.admin_resolve_feedback(uuid) from public;
revoke all on function public.admin_resolve_claim(uuid, text) from public;
revoke all on function public.admin_users() from public;
revoke all on function public.site_stats() from public;
revoke all on function public.my_listings_stats() from public;

grant execute on function public.admin_pending_events() to authenticated;
grant execute on function public.admin_set_user_banned(uuid, boolean) to authenticated;
grant execute on function public.admin_set_event_status(uuid, event_status) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean) to authenticated;
grant execute on function public.admin_resolve_feedback(uuid) to authenticated;
grant execute on function public.admin_resolve_claim(uuid, text) to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.site_stats() to authenticated;
grant execute on function public.my_listings_stats() to authenticated;

revoke all on function public.record_page_view(text, uuid, text) from public;
grant execute on function public.record_page_view(text, uuid, text) to anon, authenticated;

-- Ces fonctions ne sont destinées qu'aux triggers ou aux policies.
revoke all on function public.check_listing_quota() from public;
revoke all on function public.stamp_sold() from public;
revoke all on function public.prevent_duplicate_submission() from public;
revoke all on function public.check_event_submission_quota() from public;

-- ---------- Durées de conservation ----------
create or replace function public.purge_expired_operational_data()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.page_views
    where created_at < now() - interval '13 months';
  delete from public.feedback
    where handled and created_at < now() - interval '24 months';
  delete from public.restaurant_claims
    where handled and created_at < now() - interval '24 months';
  delete from public.reports
    where handled and created_at < now() - interval '24 months';
  delete from public.events
    where coalesce(ends_at, starts_at) < now() - interval '24 months';
end;
$$;

revoke all on function public.purge_expired_operational_data() from public;

-- Supabase propose généralement pg_cron. Si l'extension n'est pas disponible,
-- la fonction reste exécutable manuellement sans faire échouer la migration.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'tikanal-purge-expired-data',
      '17 3 * * *',
      'select public.purge_expired_operational_data()'
    );
  end if;
exception when others then
  raise notice 'Planification de la purge à activer manuellement : %', sqlerrm;
end;
$$;
