--   {mode:'aucun'}                              → enregistrée, mais aucun
--                                                 canal (contact téléphone).
create or replace function public.admin_repondre_retour(p_feedback_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_moi   uuid := auth.uid();
  f       public.feedback;
  v_texte text := btrim(coalesce(p_body, ''));
  v_corps text;
  v_conv  uuid;
  v_nature text;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if char_length(v_texte) < 1 or char_length(v_texte) > 1500 then
    raise exception 'La réponse doit faire entre 1 et 1500 caractères.';
  end if;

  select * into f from public.feedback where id = p_feedback_id for update;
  if f.id is null then
    raise exception 'Retour introuvable.';
  end if;
  if f.reply is not null then
    raise exception 'Ce retour a déjà reçu une réponse.';
  end if;

  update public.feedback
     set handled = true, reply = v_texte, replied_at = now(), replied_by = v_moi
   where id = f.id;

  -- Dans la messagerie, si la personne a un compte (et n'est pas
  -- l'administrateur lui-même : une conversation a deux personnes).
  if f.user_id is not null and f.user_id <> v_moi
     and exists (select 1 from auth.users u where u.id = f.user_id) then

    -- Le message rappelle de quoi on parle : le retour date parfois de
    -- plusieurs jours, et la personne en a peut-être envoyé plusieurs.
    v_nature := case f.kind when 'idee' then 'idée' when 'probleme' then 'signalement' else 'avis' end;
    v_corps  := 'En réponse à votre ' || v_nature || ' du '
             || to_char(f.created_at at time zone 'America/St_Barthelemy', 'DD/MM/YYYY')
             || ' : « ' || left(regexp_replace(f.message, '\s+', ' ', 'g'), 160)
             || case when char_length(f.message) > 160 then '…' else '' end || ' »'
             || E'\n\n' || v_texte;

    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (null, f.user_id, v_moi)
    on conflict (buyer_id) where listing_id is null
      do update set last_message_at = now()
    returning id into v_conv;

    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v_moi, v_corps);

    return jsonb_build_object('mode', 'message', 'conversation_id', v_conv, 'user_id', f.user_id);
  end if;

  -- Sans compte : par email, si le contact en est un.
  if f.contact ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('mode', 'email', 'contact', btrim(f.contact),
                              'message', f.message, 'kind', f.kind, 'created_at', f.created_at);
  end if;

  return jsonb_build_object('mode', 'aucun', 'contact', f.contact);
end $$;

revoke all on function public.admin_repondre_retour(uuid, text) from public;
grant execute on function public.admin_repondre_retour(uuid, text) to authenticated;
