
-- ---------- 5. La boîte connaît les fils de support ----------

create or replace function public.mes_conversations()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_moi uuid := auth.uid(); v_result jsonb;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir vos messages.';
  end if;

  select coalesce(jsonb_agg(x order by (x->>'last_message_at') desc), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'id',              c.id,
      'listing_id',      c.listing_id,
      'support',         c.listing_id is null,
      'listing_title',   case
                           when c.listing_id is null and c.seller_id = v_moi then 'Réponse à un retour'
                           when c.listing_id is null then 'Votre retour à l''équipe'
                           else coalesce(l.title, 'Annonce supprimée')
                         end,
      'listing_status',  l.status::text,
      'photo_key',       (select lp.storage_key from public.listing_photos lp
                           where lp.listing_id = c.listing_id
                           order by lp.position limit 1),
      'je_suis_auteur',  c.seller_id = v_moi,
      -- Du côté de la personne, l'interlocuteur est l'équipe, pas un
      -- administrateur nommé : pas de fiche à voir ni de blocage.
      'autre_id',        case when c.listing_id is null and c.seller_id <> v_moi then null else autre.id end,
      'autre_nom',       case when c.listing_id is null and c.seller_id <> v_moi then 'Équipe Ti Kanal'
                              else coalesce(autre.display_name, 'Utilisateur') end,
      'jai_bloque',      exists (select 1 from public.blocked_users b
                                  where b.blocker_id = v_moi and b.blocked_id = autre.id),
      'bloque',          public.blocage_entre(v_moi, autre.id),
      'last_message_at', c.last_message_at,
      'dernier',         (select m.body from public.messages m
                           where m.conversation_id = c.id
                           order by m.created_at desc limit 1),
      'non_lus',         (select count(*) from public.messages m
                           where m.conversation_id = c.id
                             and m.sender_id <> v_moi
                             and m.created_at > coalesce(
                                   case when c.seller_id = v_moi then c.seller_read_at
                                        else c.buyer_read_at end,
                                   'epoch'::timestamptz))
    ) as x
    from public.conversations c
    left join public.listings l on l.id = c.listing_id
    left join public.profiles autre
      on autre.id = case when c.seller_id = v_moi then c.buyer_id else c.seller_id end
    where c.buyer_id = v_moi or c.seller_id = v_moi
  ) s;

  return v_result;
end $$;

-- ---------- 6. Qui prévenir, fil de support compris ----------

-- Le type de retour change (une colonne « support » de plus) : on
-- supprime avant de recréer, « create or replace » ne le permet pas.
-- Seule la route serveur (clé de service) appelle cette fonction.
drop function if exists public.destinataire_a_prevenir(uuid);
