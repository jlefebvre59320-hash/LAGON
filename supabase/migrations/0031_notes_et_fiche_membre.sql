-- ============================================================
-- 0031 — Noter un membre, et sa fiche publique.
--
-- Un système de notes est facile à écrire et facile à détourner : un
-- compte jetable suffit pour descendre un concurrent ou se gonfler
-- soi-même. La seule parade qui tienne est d'exiger une relation
-- réelle : on ne note que quelqu'un avec qui on a échangé sur le site,
-- et qui a répondu. La conversation est la preuve, et la clé.
--
--   • une note par conversation et par auteur — pas dix comptes, dix
--     notes : dix conversations, avec quelqu'un qui a répondu à chacune ;
--   • la personne notée doit avoir écrit au moins une fois : envoyer un
--     message puis noter dans la minute ne compte pas ;
--   • pas de note entre deux personnes dont l'une a bloqué l'autre ;
--   • la note se corrige : c'est un avis, pas une sentence. Re-noter la
--     même conversation remplace la note précédente ;
--   • rien d'anonyme. La personne notée sait de toute façon avec qui
--     elle a parlé ; l'anonymat n'ajouterait que de l'impunité.
--
-- La moyenne est tenue sur le profil par trigger : la fiche d'annonce
-- l'obtient par la jointure qu'elle fait déjà, sans requête de plus.
-- ============================================================

-- ---------- Le profil s'enrichit ----------

alter table public.profiles
  add column if not exists quartier      text,
  add column if not exists rating_avg    numeric(3,2),
  add column if not exists rating_count  integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_quartier_length;
alter table public.profiles
  add constraint profiles_quartier_length
  check (quartier is null or char_length(quartier) between 2 and 60) not valid;

-- Rappel : privilèges colonne par colonne depuis 0005/0019. Une colonne
-- absente de ces listes est invisible et non modifiable.
grant select (quartier, rating_avg, rating_count) on public.profiles to anon, authenticated;
grant update (quartier) on public.profiles to authenticated;

-- ---------- Les notes ----------

create table if not exists public.ratings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  rater_id        uuid not null references auth.users(id) on delete cascade,
  rated_id        uuid not null references auth.users(id) on delete cascade,
  stars           smallint not null check (stars between 1 and 5),
  comment         text check (comment is null or char_length(comment) <= 300),
  -- Retirée par un administrateur : la note disparaît des moyennes et de
  -- la fiche, mais reste lisible par son auteur et par l'administration.
  hidden          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ratings_pas_soi_meme check (rater_id <> rated_id),
  constraint ratings_une_par_conversation unique (conversation_id, rater_id)
);

create index if not exists idx_ratings_rated on public.ratings (rated_id, hidden, created_at desc);

alter table public.ratings enable row level security;

drop policy if exists "ratings_select" on public.ratings;
create policy "ratings_select" on public.ratings
  for select using (not hidden or auth.uid() = rater_id or public.is_admin());

-- Aucune écriture directe : la fonction noter() porte toutes les règles.
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to anon, authenticated;

-- ---------- La moyenne, tenue à jour ----------

create or replace function public.recalculer_note(p_user_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.profiles p
     set rating_avg   = s.moyenne,
         rating_count = s.total
    from (
      select round(avg(stars)::numeric, 2) as moyenne, count(*)::int as total
        from public.ratings
       where rated_id = p_user_id and not hidden
    ) s
   where p.id = p_user_id;
$$;

create or replace function public.ratings_maj_profil()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculer_note(old.rated_id);
  else
    perform public.recalculer_note(new.rated_id);
    -- Un changement de destinataire est impossible par noter(), mais un
    -- update administratif pourrait le faire : on recalcule les deux.
    if tg_op = 'UPDATE' and old.rated_id <> new.rated_id then
      perform public.recalculer_note(old.rated_id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists ratings_maj_profil on public.ratings;
create trigger ratings_maj_profil
  after insert or update or delete on public.ratings
  for each row execute function public.ratings_maj_profil();

-- ---------- Noter ----------

create or replace function public.noter(
  p_conversation_id uuid,
  p_stars           int,
  p_comment         text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_moi    uuid := auth.uid();
  v_conv   public.conversations;
  v_autre  uuid;
  v_texte  text := nullif(btrim(coalesce(p_comment, '')), '');
  v_id     uuid;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour laisser une note.';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'La note va de 1 à 5 étoiles.';
  end if;
  if v_texte is not null and char_length(v_texte) > 300 then
    raise exception 'Le commentaire ne peut pas dépasser 300 caractères.';
  end if;
  if public.current_user_is_banned() then
    raise exception 'Votre compte ne peut plus laisser de note.';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null or (v_conv.buyer_id <> v_moi and v_conv.seller_id <> v_moi) then
    raise exception 'Conversation introuvable.';
  end if;
  v_autre := case when v_conv.buyer_id = v_moi then v_conv.seller_id else v_conv.buyer_id end;

  if public.blocage_entre(v_moi, v_autre) then
    raise exception 'Impossible de noter cette personne.';
  end if;

  -- La preuve d'échange : la personne notée a écrit au moins une fois.
  if not exists (
    select 1 from public.messages m
     where m.conversation_id = p_conversation_id and m.sender_id = v_autre
  ) then
    raise exception 'Vous pourrez noter cette personne quand elle vous aura répondu.';
  end if;

  insert into public.ratings (conversation_id, rater_id, rated_id, stars, comment)
  values (p_conversation_id, v_moi, v_autre, p_stars, v_texte)
  on conflict (conversation_id, rater_id) do update
    set stars = excluded.stars,
        comment = excluded.comment,
        hidden = false,
        updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

-- L'administration peut retirer une note manifestement abusive. Elle ne
-- l'efface pas : l'auteur la voit encore, marquée comme retirée.
create or replace function public.admin_masquer_note(p_rating_id uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  update public.ratings set hidden = p_hidden, updated_at = now() where id = p_rating_id;
end $$;

-- ---------- La fiche publique d'un membre ----------

-- Une seule requête pour la page : identité, chiffres, répartition des
-- notes, derniers avis, et — pour le visiteur connecté — la conversation
-- depuis laquelle il peut noter, s'il en a une.
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
    -- Le quartier déclaré, sinon celui qui revient le plus dans ses annonces.
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

    'annonces_total',   (select count(*) from public.listings where user_id = p.id),
    'annonces_actives', (select count(*) from public.listings where user_id = p.id and status = 'active'),
    'annonces_vendues', (select count(*) from public.listings where user_id = p.id and status = 'sold'),

    -- Taux de réponse : parmi les conversations reçues sur ses annonces,
    -- combien ont obtenu au moins une réponse de sa part. Affiché seulement
    -- à partir de trois conversations, sinon le chiffre ne veut rien dire.
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

    -- Pour le visiteur : peut-il noter, et l'a-t-il déjà fait ?
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

-- ---------- Droits ----------

revoke all on function public.noter(uuid, int, text)              from public;
revoke all on function public.admin_masquer_note(uuid, boolean)   from public;
revoke all on function public.fiche_membre(uuid)                  from public;
revoke all on function public.recalculer_note(uuid)               from public, anon, authenticated;

grant execute on function public.noter(uuid, int, text)            to authenticated;
grant execute on function public.admin_masquer_note(uuid, boolean) to authenticated;
grant execute on function public.fiche_membre(uuid)                to anon, authenticated;

-- Vérification : doit renvoyer la fiche d'un membre existant, sans note.
-- select fiche_membre((select id from profiles limit 1)) -> 'nb_notes';
