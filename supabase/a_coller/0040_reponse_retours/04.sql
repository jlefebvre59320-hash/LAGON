
create function public.destinataire_a_prevenir(p_conversation_id uuid)
returns table (user_id uuid, autre_nom text, listing_title text, listing_id uuid, support boolean)
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  v_dernier timestamptz;
  v_auteur  uuid;
  v_cible   uuid;
  v_lu      timestamptz;
  v_prevenu timestamptz;
  v_support boolean;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then return; end if;
  v_support := c.listing_id is null;

  select m.created_at, m.sender_id into v_dernier, v_auteur
    from public.messages m
   where m.conversation_id = p_conversation_id
   order by m.created_at desc limit 1;
  if v_dernier is null then return; end if;

  if v_auteur = c.buyer_id then
    v_cible := c.seller_id; v_lu := c.seller_read_at; v_prevenu := c.seller_notified_at;
  else
    v_cible := c.buyer_id;  v_lu := c.buyer_read_at;  v_prevenu := c.buyer_notified_at;
  end if;

  if public.blocage_entre(v_auteur, v_cible) then return; end if;
  if v_lu is not null and v_lu >= v_dernier then return; end if;
  if v_prevenu is not null and v_prevenu > now() - interval '15 minutes' then return; end if;
  -- La réponse de l'équipe à un retour que la personne a elle-même
  -- envoyé n'est pas une sollicitation : elle part même si les emails
  -- de messagerie sont coupés. Le reste respecte le réglage.
  if not v_support and not coalesce((select p.notify_email from public.profiles p where p.id = v_cible), true) then return; end if;

  return query
    select v_cible,
           case when v_support and v_auteur <> c.buyer_id then 'L''équipe Ti Kanal'
                else coalesce((select p.display_name from public.profiles p where p.id = v_auteur), 'Un utilisateur') end,
           case when v_support then 'votre retour'
                else coalesce((select l.title from public.listings l where l.id = c.listing_id), 'votre annonce') end,
           c.listing_id,
           v_support;
end $$;

revoke all on function public.destinataire_a_prevenir(uuid) from public, anon, authenticated;

-- Vérification : doit renvoyer une ligne 'garden' si des annonces ont déménagé,
-- et la fonction de réponse doit exister.
-- select module, count(*) from public.listings group by module;
-- select proname from pg_proc where proname = 'admin_repondre_retour';
