-- Les règles de modération, d'alertes et de mise en avant, vérifiées par
-- des assertions : la moindre qui échoue arrête tout avec son message.
\set ON_ERROR_STOP on

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', now()),
  ('22222222-2222-2222-2222-222222222222', 'paul@test.local', now() - interval '30 days'),
  ('33333333-3333-3333-3333-333333333333', 'marie@test.local', now() - interval '30 days');
insert into public.profiles (id, display_name, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', true),
  ('22222222-2222-2222-2222-222222222222', 'Paul', false),
  ('33333333-3333-3333-3333-333333333333', 'Marie', false);

-- ---------- Normalisation et analyse de texte ----------
do $$
declare a jsonb;
begin
  assert public.mod_normaliser('M4ss4ge  s.e.n.s.u.e.l') = 'massage sensuel', 'normalisation chiffres et lettres espacées';
  assert public.mod_normaliser('sexxxe') = 'sexe', 'répétitions';

  a := public.mod_analyser_texte('Massage sensuel', 'discret, dispo ce soir');
  assert (a->>'bloque')::boolean, 'massage sensuel doit bloquer';
  assert a->>'certitude' = 'certain', 'certitude certain';

  a := public.mod_analyser_texte('Bitte d''amarrage inox', 'Pour bateau 8m');
  assert (a->>'score')::int = 0, 'bitte d''amarrage : aucun point';

  a := public.mod_analyser_texte('Chatte à donner', 'Stérilisée, sexe femelle');
  assert (a->>'score')::int = 0, 'chatte à donner : aucun point';

  a := public.mod_analyser_texte('iPhone 15 Pro 500 €', 'Très bon état');
  assert (a->>'score')::int = 0, 'iPhone : aucun point';

  a := public.mod_analyser_texte('s e x e contre argent', '');
  assert (a->>'bloque')::boolean and (a->>'contournement')::boolean, 's e x e contre : bloqué et contournement';

  a := public.mod_analyser_texte('Vends vibromasseur neuf', 'jamais ouvert');
  assert not (a->>'bloque')::boolean and a->>'certitude' = 'fort', 'un terme fort seul ne bloque pas';

  a := public.mod_analyser_texte('gode et vibromasseur', '');
  assert (a->>'bloque')::boolean, 'deux forts de la même famille bloquent';

  a := public.mod_analyser_texte('Pistolet à eau enfant', '');
  assert (a->>'score')::int = 0, 'pistolet à eau : exception';
end $$;

-- ---------- Évaluation d'une annonce ----------
insert into public.listings (id, user_id, module, subcategory, title, description, price_cents, location) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'service', 'Massage', 'Massage sensuel à domicile', 'discret', 8000, 'Gustavia'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'goods', 'Bateau', 'Bitte d''amarrage inox', 'Pour bateau 8m', 50, 'Lorient'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'goods', 'Divers', 'Vends vibromasseur neuf', 'jamais ouvert', 30, 'Saint-Jean');
do $$ begin
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'blocked', 'annonce certaine retenue';
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'published', 'annonce saine publiée';
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'pending', 'terme fort : en attente';
  assert (select count(*) from public.moderation_cases where status = 'open') = 2, 'deux dossiers ouverts';
  assert (select count(*) from public.moderation_details where listing_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'détails admin écrits';
end $$;

-- Le public ne voit pas les termes : risk_reasons reste générique.
do $$ begin
  assert not exists (select 1 from public.listings, jsonb_array_elements(risk_reasons) r
                      where id = 'aaaaaaaa-0000-0000-0000-000000000001' and r->>'detail' ilike '%massage%'),
    'les termes détectés ne doivent pas figurer dans risk_reasons';
end $$;

-- ---------- Messages et avis ----------
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');
insert into public.messages (conversation_id, sender_id, body) values
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Bonjour, toujours dispo ?'),
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 't es une salope');
do $$ begin
  assert (select count(*) from public.moderation_messages where kind = 'message') = 1, 'message fort signalé';
  begin
    insert into public.messages (conversation_id, sender_id, body) values ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'plan cul ce soir ?');
    raise exception 'un message certain aurait dû être refusé';
  exception when others then
    if sqlerrm not like 'Ce message ne peut pas être envoyé%' then raise; end if;
  end;
end $$;

-- Avis : même filtre, plus le signalement par un membre.
insert into public.ratings (conversation_id, rater_id, rated_id, stars, comment) values
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 2, 'vendeur correct mais salope au téléphone');
do $$ begin
  assert (select count(*) from public.moderation_messages where kind = 'avis' and source = 'auto') = 1, 'avis fort signalé';
  begin
    update public.ratings set comment = 'plan cul ?' where rater_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'un commentaire certain aurait dû être refusé';
  exception when others then
    if sqlerrm not like 'Ce commentaire ne peut pas être publié%' then raise; end if;
  end;
end $$;
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform public.signaler_avis((select id from public.ratings limit 1), 'test');
  perform public.signaler_avis((select id from public.ratings limit 1), 'test');
  assert (select count(*) from public.moderation_messages where kind = 'avis' and status = 'open') = 1, 'un seul dossier ouvert par avis';
  assert (select source from public.moderation_messages where kind = 'avis' and status = 'open') = 'signalement', 'le dossier porte le signalement';
end $$;

-- ---------- Décisions admin ----------
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare c uuid; m uuid;
begin
  assert jsonb_array_length(public.admin_file_moderation()) = 2, 'file : deux dossiers';
  select id into c from public.moderation_cases where listing_id = 'aaaaaaaa-0000-0000-0000-000000000003' and status = 'open';
  perform public.admin_decider(c, 'erreur', 'faux positif', 7);
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'published', 'erreur → publiée';
  assert (select faux_positif from public.moderation_decisions where case_id = c), 'faux positif noté';
  -- Une décision humaine n'est pas renversée par une réévaluation.
  perform public.admin_reevaluer();
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'published', 'réévaluation respecte la décision';

  select id into m from public.moderation_messages where kind = 'avis' and status = 'open';
  perform public.admin_decider_message(m, 'supprimer', 7);
  assert (select comment from public.ratings limit 1) is null, 'commentaire retiré, note conservée';
  assert (select count(*) from public.ratings) = 1, 'la note reste';
end $$;

-- Sans droits admin : refus.
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  begin
    perform public.admin_file_moderation();
    raise exception 'admin_file_moderation aurait dû refuser un non-admin';
  exception when others then
    if sqlerrm <> 'Réservé aux administrateurs.' then raise; end if;
  end;
end $$;

-- ---------- Fiche membre : compter ce qui se voit ----------
do $$ begin
  assert (public.fiche_membre('22222222-2222-2222-2222-222222222222')->>'annonces_actives')::int = 2, 'fiche : la retenue ne compte pas';
end $$;

-- ---------- Alertes ----------
set app.uid = '33333333-3333-3333-3333-333333333333';
insert into public.search_alerts (user_id, module, query) values ('33333333-3333-3333-3333-333333333333', 'goods', 'amarrage');
insert into public.search_alerts (user_id, quartier) values ('33333333-3333-3333-3333-333333333333', 'Lorient');
insert into public.search_alerts (user_id, module, attrs) values ('33333333-3333-3333-3333-333333333333', 'service', '{"Zone d''intervention": "Toute l''île"}');
do $$ begin
  begin
    insert into public.search_alerts (user_id) values ('33333333-3333-3333-3333-333333333333');
    raise exception 'une alerte sans critère aurait dû être refusée';
  exception when others then
    if sqlerrm not like 'Une alerte a besoin%' then raise; end if;
  end;
  -- Deux alertes de Marie répondent à la bitte d'amarrage (goods + Lorient), pas celle des services.
  assert (select count(*) from public.alertes_correspondantes('aaaaaaaa-0000-0000-0000-000000000002')) = 2, 'deux alertes correspondent';
  -- Réservation atomique : une seconde passe ne rend plus rien.
  assert (select count(*) from public.alertes_correspondantes('aaaaaaaa-0000-0000-0000-000000000002')) = 0, 'pas de doublon';
  -- Une annonce retenue ne réveille personne.
  assert (select count(*) from public.alertes_correspondantes('aaaaaaaa-0000-0000-0000-000000000001')) = 0, 'annonce retenue : aucune alerte';
  assert (public.annonces_par_univers()->>'goods')::int = 2, 'compteur goods';
end $$;

-- ---------- Une seule mise en avant ----------
do $$ begin
  update public.listings set featured_until = now() + interval '10 days' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  begin
    update public.listings set featured_until = now() + interval '10 days' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
    raise exception 'la seconde mise en avant aurait dû être refusée';
  exception when others then
    if sqlerrm not like 'Pendant la phase de test%' then raise; end if;
  end;
  update public.listings set featured_until = null where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  update public.listings set featured_until = now() + interval '10 days' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  assert (select count(*) from public.listings where featured_until > now()) = 1, 'bascule acceptée';
end $$;

\echo Toutes les règles passent.
