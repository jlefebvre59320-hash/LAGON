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



-- ---------- Temps réel ----------
set app.uid = '11111111-1111-1111-1111-111111111111';
update auth.users set last_sign_in_at = now() - interval '2 minutes' where id = '33333333-3333-3333-3333-333333333333';
insert into public.page_views (path, listing_id, viewer_key, device, source, created_at) values
  ('/', null, 'visiteur-A-0123456789', 'mobile', 'direct', now() - interval '4 minutes'),
  ('/annonce/aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'visiteur-A-0123456789', 'mobile', 'direct', now() - interval '1 minute'),
  ('/', null, 'visiteur-B-0123456789', 'ordinateur', 'google', now() - interval '30 hours'),
  ('/', null, 'visiteur-B-0123456789', 'ordinateur', 'google', now() - interval '50 minutes');
do $$
declare t jsonb := public.admin_temps_reel();
begin
  assert (t->'essentiel'->>'visiteurs_5min')::int = 1, 'un visiteur actif';
  assert jsonb_array_length(t->'sessions_actives') = 1, 'une session active';
  assert (t->'sessions_actives'->0->>'pages')::int = 2 and (t->'sessions_actives'->0->>'duree_s')::int between 170 and 190, 'session : 2 pages, ~3 min';
  assert t->'sessions_actives'->0->>'titre' = 'Bitte d''amarrage inox', 'la page courante porte le titre de l''annonce';
  assert (t->'h24'->>'sessions')::int >= 2, 'B a deux sessions (écart de deux heures) + A';
  assert (t->'appareils_24h'->>'mobile')::int = 2, 'deux vues mobile sur 24 h';
  assert jsonb_array_length(t->'flux') = 4, 'quatre vues dans le flux';
  assert (t->'flux'->0->>'cle') <> 'visiteur-A-0123456789', 'la clé du flux est anonymisée';
end $$;
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  begin
    perform public.admin_temps_reel();
    raise exception 'admin_temps_reel aurait dû refuser un non-admin';
  exception when others then
    if sqlerrm <> 'Réservé aux administrateurs.' then raise; end if;
  end;
end $$;

-- ---------- Statistiques : ce qui se voit, sans les administrateurs (0038) ----------
set app.uid = '11111111-1111-1111-1111-111111111111';
-- Un administrateur qui navigue n'est pas compté.
select public.record_page_view('/', null, 'admin-navigue-0123456789', 'ordinateur', 'direct');
do $$
declare st jsonb := public.site_stats(); db jsonb := public.admin_dashboard(7); tr jsonb := public.admin_temps_reel();
begin
  assert not exists (select 1 from public.page_views where viewer_key = 'admin-navigue-0123456789'), 'la vue d''un admin n''est pas enregistrée';
  assert (st->>'listings_active')::int = 2, 'site_stats : la retenue ne compte pas';
  assert (st->'by_module'->>'goods')::int = 2 and st->'by_module'->>'service' is null, 'by_module sans la retenue';
  assert (st->>'users_total')::int = 2, 'site_stats : les comptes hors admin';
  assert (db->'kpi'->'annonces_actives'->>'actuel')::int = 2, 'admin_dashboard : annonces actives visibles';
  assert (tr->'essentiel'->>'visiteurs_24h')::int = 2, 'temps réel : deux visiteurs uniques sur 24 h';
  assert (tr->'essentiel'->>'comptes_crees_24h')::int = 0, 'temps réel : comptes créés hors admin (Paul et Marie ont 30 jours)';
  assert (tr->'essentiel'->>'reconnexions_24h')::int = 1, 'temps réel : Marie s''est reconnectée';
  assert (tr->'h24'->>'comptes_total')::int = 2, 'temps réel : total hors admin';
  assert jsonb_array_length(tr->'par_heure') = 24, 'temps réel : 24 heures';
  assert (tr->'h24'->>'visiteurs_revenus')::int = 1, 'temps réel : B est revenu (vu il y a 3 h et il y a 50 min)';
end $$;

-- ---------- Jardin & Outillage (0039, 0040) ----------
do $$ begin
  assert 'garden' = any (enum_range(null::listing_module)::text[]), 'la valeur garden existe';
end $$;
insert into public.listings (id, user_id, module, subcategory, title, description, price_cents, location) values
  ('aaaaaaaa-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 'garden', 'Tondeuses & Motoculture', 'Tondeuse Honda thermique', 'Révisée', 25000, 'Lorient');
do $$ begin
  assert (select review_state from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000009') = 'published', 'une annonce de jardin se publie comme les autres';
end $$;

-- ---------- Réponse aux retours (0040) ----------
insert into public.feedback (id, kind, message, contact, user_id, created_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'idee', 'Une rubrique jardin et outillage, ce serait bien pour tout le monde ici.', null, '33333333-3333-3333-3333-333333333333', now() - interval '3 days'),
  ('ffffffff-0000-0000-0000-000000000002', 'probleme', 'Le bouton ne marche pas', 'visiteur@test.local', null, now()),
  ('ffffffff-0000-0000-0000-000000000003', 'avis', 'Bravo pour le site', '0690 00 00 00', null, now()),
  ('ffffffff-0000-0000-0000-000000000004', 'probleme', 'Et une photo qui ne charge pas', null, '33333333-3333-3333-3333-333333333333', now());

-- Un non-administrateur est refusé.
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  begin
    perform public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000001', 'Merci');
    raise exception 'admin_repondre_retour aurait dû refuser un non-admin';
  exception when others then
    if sqlerrm <> 'Réservé aux administrateurs.' then raise; end if;
  end;
end $$;

set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare r jsonb; c uuid; corps text;
begin
  r := public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000001', 'Merci Marie, c''est en ligne !');
  assert r->>'mode' = 'message', 'une personne avec compte : réponse dans la messagerie';
  c := (r->>'conversation_id')::uuid;
  assert (select listing_id is null and buyer_id = '33333333-3333-3333-3333-333333333333' and seller_id = '11111111-1111-1111-1111-111111111111'
            from public.conversations where id = c), 'fil de support : sans annonce, la personne en intéressée, l''admin en vendeur';
  select body into corps from public.messages where conversation_id = c;
  assert corps like 'En réponse à votre idée du %', 'le message rappelle le retour';
  assert corps like '%Merci Marie, c''est en ligne !', 'et contient la réponse';
  assert (select handled and reply = 'Merci Marie, c''est en ligne !' and replied_by = '11111111-1111-1111-1111-111111111111'
            from public.feedback where id = 'ffffffff-0000-0000-0000-000000000001'), 'le retour est traité et garde la réponse';

  -- Un second retour de la même personne : même fil.
  r := public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000004', 'Corrigé ce matin.');
  assert (r->>'conversation_id')::uuid = c, 'un seul fil de support par personne';
  assert (select count(*) from public.messages where conversation_id = c) = 2, 'deux messages dans le fil';

  -- Déjà répondu : refusé.
  begin
    perform public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000001', 'encore');
    raise exception 'aurait dû refuser une seconde réponse';
  exception when others then
    if sqlerrm <> 'Ce retour a déjà reçu une réponse.' then raise; end if;
  end;

  -- Sans compte, avec un email : la route serveur enverra l'email.
  r := public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000002', 'Corrigé, merci du signalement.');
  assert r->>'mode' = 'email' and r->>'contact' = 'visiteur@test.local', 'sans compte : par email';
  assert (select handled from public.feedback where id = 'ffffffff-0000-0000-0000-000000000002'), 'traité aussi';

  -- Sans compte ni email : enregistrée, mais aucun canal.
  r := public.admin_repondre_retour('ffffffff-0000-0000-0000-000000000003', 'Merci !');
  assert r->>'mode' = 'aucun', 'un numéro de téléphone n''est pas un canal';
end $$;

-- Marie voit le fil comme une conversation avec l'équipe, sans fiche ni blocage.
set app.uid = '33333333-3333-3333-3333-333333333333';
do $$
declare x jsonb;
begin
  select v into x from jsonb_array_elements(public.mes_conversations()) v where (v->>'support')::boolean;
  assert x is not null, 'le fil de support est dans la boîte de Marie';
  assert x->>'autre_nom' = 'Équipe Ti Kanal', 'l''interlocuteur est l''équipe';
  assert x->>'listing_title' = 'Votre retour à l''équipe', 'le titre dit de quoi il s''agit';
  assert x->'autre_id' = 'null'::jsonb, 'pas de fiche à voir';
  assert (x->>'non_lus')::int = 2, 'deux non-lus';
end $$;
-- Et côté administrateur, le fil porte le nom de la personne.
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare x jsonb; d record;
begin
  select v into x from jsonb_array_elements(public.mes_conversations()) v where (v->>'support')::boolean;
  assert x->>'autre_nom' = 'Marie' and x->>'listing_title' = 'Réponse à un retour', 'côté admin : Marie, réponse à un retour';
  -- Qui prévenir : Marie, par « L'équipe Ti Kanal », à propos de son retour.
  select * into d from public.destinataire_a_prevenir((x->>'id')::uuid);
  assert d.user_id = '33333333-3333-3333-3333-333333333333' and d.support and d.autre_nom = 'L''équipe Ti Kanal' and d.listing_title = 'votre retour',
    'destinataire_a_prevenir : le fil de support prévient la personne au nom de l''équipe';
  -- Même si elle a coupé les emails de messagerie : c'est une réponse à sa demande.
  update public.profiles set notify_email = false where id = '33333333-3333-3333-3333-333333333333';
  select * into d from public.destinataire_a_prevenir((x->>'id')::uuid);
  assert d.user_id is not null, 'la réponse de l''équipe part malgré notify_email = false';
end $$;

\echo Toutes les règles passent.
