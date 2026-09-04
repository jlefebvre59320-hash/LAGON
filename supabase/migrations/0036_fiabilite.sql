-- ============================================================
-- 0036 — Fiabilité : avis modérés, compteurs justes, alertes complètes.
--
-- · Les commentaires d'évaluation passent par le même filtre de texte que
--   les annonces et les messages : refusés s'ils sont certains, signalés à
--   l'administration s'ils sont forts. Un avis peut aussi être signalé par
--   n'importe quel membre connecté.
-- · La fiche publique d'un membre ne compte que ce qui est réellement
--   visible : une annonce en attente ou retenue n'est pas « en ligne ».
-- · Les alertes mémorisent les critères des services (zone, tarif,
--   disponibilité), et la réservation des envois est atomique : deux
--   passes simultanées ne préviennent jamais deux fois.
-- ============================================================

-- ---------- Avis : le filtre, et le signalement ----------

alter table public.moderation_messages
  add column if not exists rating_id uuid references public.ratings(id) on delete cascade,
  add column if not exists kind text not null default 'message' check (kind in ('message', 'avis')),
  add column if not exists source text not null default 'auto' check (source in ('auto', 'signalement'));

-- Refuser avant d'écrire : un commentaire certain ne rentre pas en base.
create or replace function public.trg_moderer_avis_avant()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  regles jsonb := public.mod_setting('regles', '{}');
  ana    jsonb;
begin
  if new.comment is null or btrim(new.comment) = '' then return new; end if;
  if tg_op = 'UPDATE' and old.comment is not distinct from new.comment then return new; end if;
  if coalesce((regles->>'messages')::boolean, true) then
    ana := public.mod_analyser_texte(null, new.comment);
    if (ana->>'bloque')::boolean then
      raise exception 'Ce commentaire ne peut pas être publié : son contenu ne respecte pas les règles de Ti Kanal.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists moderer_avis_avant on public.ratings;
create trigger moderer_avis_avant
  before insert or update of comment on public.ratings
  for each row execute function public.trg_moderer_avis_avant();

-- Signaler à l'administration ce qui est fort sans être certain.
create or replace function public.trg_moderer_avis_apres()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  regles jsonb := public.mod_setting('regles', '{}');
  seuils jsonb := public.mod_setting('seuils', '{"verification":61}');
  ana    jsonb;
begin
  if new.comment is null or btrim(new.comment) = '' then return null; end if;
  if tg_op = 'UPDATE' and old.comment is not distinct from new.comment then return null; end if;
  if not coalesce((regles->>'messages')::boolean, true) then return null; end if;
  ana := public.mod_analyser_texte(null, new.comment);
  if (ana->>'certitude') = 'fort' or (ana->>'score')::int >= (seuils->>'verification')::int then
    insert into public.moderation_messages (rating_id, kind, conversation_id, sender_id, body, score, reasons, details)
    values (new.id, 'avis', new.conversation_id, new.rater_id, new.comment, (ana->>'score')::int, ana->'raisons', ana->'details');
  end if;
  return null;
end $$;
drop trigger if exists moderer_avis_apres on public.ratings;
create trigger moderer_avis_apres
  after insert or update of comment on public.ratings
  for each row execute function public.trg_moderer_avis_apres();

-- Un membre signale un avis : un dossier « avis » s'ouvre, une seule fois
-- par avis tant qu'il n'est pas traité.
create or replace function public.signaler_avis(p_rating_id uuid, p_motif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.ratings;
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour signaler un avis.'; end if;
  select * into r from public.ratings where id = p_rating_id and not hidden;
  if r.id is null then raise exception 'Cet avis n''existe plus.'; end if;
  if r.rater_id = auth.uid() then raise exception 'Vous ne pouvez pas signaler votre propre avis.'; end if;
  -- Déjà dans la file (détecté ou signalé) : on note qu'un membre le signale
  -- aussi, sans ouvrir un second dossier.
  if exists (select 1 from public.moderation_messages where rating_id = r.id and status = 'open') then
    update public.moderation_messages set source = 'signalement' where rating_id = r.id and status = 'open';
    return;
  end if;
  insert into public.moderation_messages (rating_id, kind, source, conversation_id, sender_id, body, score, reasons, details)
  values (r.id, 'avis', 'signalement', r.conversation_id, r.rater_id, coalesce(r.comment, format('%s étoile(s), sans commentaire', r.stars)),
          0, jsonb_build_array(jsonb_build_object('code', 'signalements', 'detail', coalesce(nullif(btrim(p_motif), ''), 'signalé par un membre'), 'points', 0)), '[]');
end $$;
revoke all on function public.signaler_avis(uuid, text) from public;
grant execute on function public.signaler_avis(uuid, text) to authenticated;

-- La liste admin dit maintenant de quoi il s'agit : message ou avis, détecté ou signalé.
create or replace function public.admin_messages_signales()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'message_id', m.message_id, 'rating_id', m.rating_id, 'kind', m.kind, 'source', m.source,
      'body', m.body, 'score', m.score,
      'reasons', m.reasons, 'details', m.details, 'created_at', m.created_at,
      'conversation_id', m.conversation_id,
      'listing_id', cv.listing_id,
      'listing_title', (select title from public.listings where id = cv.listing_id),
      'expediteur', jsonb_build_object(
        'id', m.sender_id,
        'display_name', (select display_name from public.profiles where id = m.sender_id),
        'email', (select email from auth.users where id = m.sender_id),
        'is_banned', (select is_banned from public.profiles where id = m.sender_id),
        'suspended_until', (select suspended_until from public.profiles where id = m.sender_id),
        'nb_signales', (select count(*) from public.moderation_messages x where x.sender_id = m.sender_id)),
      'destinataire', (select display_name from public.profiles
                        where id = case when cv.buyer_id = m.sender_id then cv.seller_id else cv.buyer_id end)
    ) order by m.score desc, m.created_at desc)
    from public.moderation_messages m
    left join public.conversations cv on cv.id = m.conversation_id
    where m.status = 'open'
  ), '[]'::jsonb);
end $$;

-- Décider sur un avis : « supprimer » retire le commentaire et garde la
-- note ; suspendre ou bannir masquent l'avis entier.
create or replace function public.admin_decider_message(
  p_id       uuid,
  p_decision text,
  p_jours    int default 7
) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.moderation_messages;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select * into m from public.moderation_messages where id = p_id and status = 'open';
  if m.id is null then raise exception 'Message introuvable ou déjà traité.'; end if;

  case p_decision
    when 'ignorer', 'erreur' then null;
    when 'supprimer' then
      if m.rating_id is not null then
        update public.ratings set comment = null where id = m.rating_id;
      else
        delete from public.messages where id = m.message_id;
      end if;
    when 'suspendre' then
      if m.rating_id is not null then update public.ratings set hidden = true where id = m.rating_id;
      else delete from public.messages where id = m.message_id; end if;
      update public.profiles set suspended_until = now() + make_interval(days => greatest(1, coalesce(p_jours, 7)))
       where id = m.sender_id;
    when 'bannir' then
      if m.rating_id is not null then update public.ratings set hidden = true where id = m.rating_id;
      else delete from public.messages where id = m.message_id; end if;
      update public.profiles set is_banned = true where id = m.sender_id;
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now()
       where user_id = m.sender_id and status = 'active';
    else
      raise exception 'Décision inconnue.';
  end case;

  update public.moderation_messages
     set status = 'resolved', decision = p_decision, decided_by = auth.uid(), resolved_at = now()
   where id = m.id;

  if to_regclass('public.admin_audit_log') is not null then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'moderation_' || m.kind || '_' || p_decision, m.kind, coalesce(m.message_id, m.rating_id),
            jsonb_build_object('score', m.score, 'expediteur', m.sender_id, 'source', m.source));
  end if;
end $$;

-- ---------- Fiche membre : compter ce qui se voit ----------

create or replace function public.fiche_membre(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moi uuid := auth.uid();
  result jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return null;
  end if;

  select jsonb_build_object(
    'id',            p.id,
    'display_name',  p.display_name,
    'is_pro',        p.is_pro,
    'membre_depuis', p.created_at,
    'quartier',      coalesce(p.quartier, (
                       select l.location from public.listings l
                        where l.user_id = p.id and l.location <> 'Saint-Barthélemy'
                        group by l.location order by count(*) desc, max(l.created_at) desc limit 1)),
    'a_whatsapp',    p.phone_wa is not null,
    'messagerie',    coalesce(p.allow_messages, true),

    'note_moyenne',  p.rating_avg,
    'nb_notes',      p.rating_count,
    'repartition',   (select jsonb_object_agg(s::text, n) from (
                        select gs as s, count(r.id) as n
                          from generate_series(1, 5) gs
                          left join public.ratings r
                            on r.stars = gs and r.rated_id = p.id and not r.hidden
                         group by gs) d),

    -- Ce que le public voit vraiment : une annonce en attente ou retenue
    -- n'est ni « en ligne » ni « publiée ». Les retirées ne comptent pas.
    'annonces_total',   (select count(*) from public.listings
                          where user_id = p.id and status in ('active', 'sold', 'expired')
                            and review_state in ('published', 'watch')),
    'annonces_actives', (select count(*) from public.listings
                          where user_id = p.id and status = 'active'
                            and review_state in ('published', 'watch')),
    'annonces_vendues', (select count(*) from public.listings where user_id = p.id and status = 'sold'),

    'conversations_recues', (select count(*) from public.conversations c where c.seller_id = p.id),
    'taux_reponse', (
      select case when count(*) >= 3
                  then round(100.0 * count(*) filter (where exists (
                         select 1 from public.messages m
                          where m.conversation_id = c.id and m.sender_id = p.id)) / count(*))
                  end
        from public.conversations c where c.seller_id = p.id),

    'avis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'stars', r.stars,
               'comment', r.comment,
               'created_at', r.created_at,
               'auteur_id', r.rater_id,
               'auteur_nom', coalesce(a.display_name, 'Utilisateur'),
               'annonce', l.title
             ) order by r.created_at desc)
      from (select * from public.ratings
             where rated_id = p.id and not hidden
             order by created_at desc limit 20) r
      left join public.profiles a on a.id = r.rater_id
      left join public.conversations c on c.id = r.conversation_id
      left join public.listings l on l.id = c.listing_id
    ), '[]'::jsonb),

    'conversation_notable', case when v_moi is null or v_moi = p.id then null else (
      select c.id from public.conversations c
       where ((c.buyer_id = v_moi and c.seller_id = p.id)
           or (c.seller_id = v_moi and c.buyer_id = p.id))
         and exists (select 1 from public.messages m
                      where m.conversation_id = c.id and m.sender_id = p.id)
       order by c.last_message_at desc limit 1) end,
    'ma_note', case when v_moi is null then null else (
      select jsonb_build_object('stars', r.stars, 'comment', r.comment, 'conversation_id', r.conversation_id)
        from public.ratings r
       where r.rater_id = v_moi and r.rated_id = p.id
       order by r.updated_at desc limit 1) end
  ) into result
  from public.profiles p
  where p.id = p_user_id;

  return result;
end $$;

-- ---------- Alertes : critères des services, réservation atomique ----------

alter table public.search_alerts add column if not exists attrs jsonb;
grant insert (attrs) on public.search_alerts to authenticated;

-- Rend les alertes que cette annonce réveille ET les réserve dans le même
-- ordre SQL : deux appels simultanés se partagent les cibles, aucune n'est
-- rendue deux fois. Le prix d'une réservation sans envoi (clé absente) est
-- une notification manquée, jamais un doublon.
create or replace function public.alertes_correspondantes(p_listing_id uuid)
returns table (alert_id uuid, user_id uuid, email text, notify_email boolean, notify_push boolean, resume text)
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing_id;
  if l.id is null or l.status <> 'active' or l.review_state not in ('published', 'watch') then return; end if;
  return query
    with cibles as (
      select a.id, a.user_id,
             concat_ws(' · ', case when a.module is not null then a.module::text end, a.subcategory, a.query, a.quartier,
                       (select string_agg(v, ' · ') from jsonb_each_text(coalesce(a.attrs, '{}'::jsonb)) x(k, v))) as resume
        from public.search_alerts a
        left join public.profiles p on p.id = a.user_id
       where a.user_id <> l.user_id
         and (a.module is null or a.module = l.module)
         and (a.subcategory is null or a.subcategory = l.subcategory)
         and (a.intent is null or a.intent = l.intent)
         and (a.min_cents is null or (l.price_cents is not null and l.price_cents >= a.min_cents))
         and (a.max_cents is null or (l.price_cents is not null and l.price_cents <= a.max_cents))
         and (a.quartier is null or l.location ilike '%' || a.quartier || '%')
         and (a.attrs is null or a.attrs = '{}'::jsonb or coalesce(l.attrs, '{}'::jsonb) @> a.attrs)
         and (a.query is null or l.search_tsv @@ websearch_to_tsquery('french', a.query))
         and coalesce(p.is_banned, false) = false
    ),
    reservees as (
      insert into public.alert_hits (alert_id, listing_id)
      select c.id, l.id from cibles c
      on conflict do nothing
      returning alert_hits.alert_id
    )
    select c.id, c.user_id, u.email::text,
           coalesce(p.notify_email, true), coalesce(p.notify_push, true), c.resume
      from cibles c
      join reservees r on r.alert_id = c.id
      join auth.users u on u.id = c.user_id
      left join public.profiles p on p.id = c.user_id;
end $$;

-- N'a plus qu'à dater : la réservation est déjà faite.
create or replace function public.marquer_alertes_envoyees(p_listing_id uuid, p_alert_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.search_alerts set last_hit_at = now() where id = any(p_alert_ids);
end $$;

-- Vérification : select public.fiche_membre((select id from public.profiles limit 1))->'annonces_actives';
