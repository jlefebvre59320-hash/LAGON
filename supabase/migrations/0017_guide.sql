-- ============================================================
-- 0017 — St Barth Guide : l'annuaire de l'île.
--
-- Plages, points de vue, incontournables, lieux publics,
-- associations, bons plans. Lecture publique, écriture admin.
-- Le pré-remplissage couvre les lieux publics notoires de l'île ;
-- les positions sont indicatives (à affiner fiche par fiche).
-- Ré-exécutable sans doublon (index unique + on conflict).
-- ============================================================

do $$ begin
  create type place_category as enum
    ('plage', 'point_de_vue', 'incontournable', 'lieu_public', 'association', 'bon_plan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_status as enum ('active', 'hidden');
exception when duplicate_object then null; end $$;

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  category    place_category not null,
  name        text not null check (char_length(name) between 2 and 90),
  quartier    text not null,
  description text not null default '' check (char_length(description) <= 2000),
  tip         text,
  address     text not null default '',
  phone       text,
  website     text,
  lat         double precision,
  lng         double precision,
  status      place_status not null default 'active',
  created_at  timestamptz not null default now()
);

create unique index if not exists uq_places_name_quartier on public.places (name, quartier);
create index if not exists idx_places_browse on public.places (status, category, name);

alter table public.places enable row level security;

drop policy if exists "places_select" on public.places;
create policy "places_select" on public.places
  for select using (status = 'active' or public.is_admin());

drop policy if exists "places_insert_admin" on public.places;
create policy "places_insert_admin" on public.places
  for insert with check (public.is_admin());

drop policy if exists "places_update_admin" on public.places;
create policy "places_update_admin" on public.places
  for update using (public.is_admin());

drop policy if exists "places_delete_admin" on public.places;
create policy "places_delete_admin" on public.places
  for delete using (public.is_admin());

-- ---------- Pré-remplissage ----------
insert into public.places (category, name, quartier, description, tip, lat, lng) values

-- Plages
('plage', 'Plage de Saline', 'Saline',
 'La grande plage sauvage de l''île, sable blanc à perte de vue, sans aucune construction. Accès à pied depuis le parking, derrière la dune.',
 'Aucune ombre ni commerce : eau, chapeau et crème solaire obligatoires.', 17.8880, -62.8290),
('plage', 'Plage du Gouverneur', 'Gouverneur',
 'Anse magnifique et préservée sous le morne de Lurin, souvent citée parmi les plus belles des Antilles.',
 'La descente est raide ; mer parfois forte, prudence avec les enfants.', 17.8815, -62.8360),
('plage', 'Anse de Colombier', 'Colombier',
 'Accessible uniquement à pied ou en bateau : une crique turquoise au bout de l''île, au cœur de la réserve naturelle.',
 'Sentier depuis le belvédère de Colombier (~25 min) ou depuis Flamands. Prévoir de l''eau et des chaussures fermées.', 17.9210, -62.8745),
('plage', 'Plage de Flamands', 'Flamands',
 'Longue plage de sable blanc bordée de lataniers, une des plus larges de l''île.',
 'Houle possible en hiver — surveillez la mer.', 17.9185, -62.8600),
('plage', 'Baie de Saint-Jean', 'St-Jean',
 'La plage animée de l''île : hôtels, restaurants pieds dans l''eau, eaux calmes, et les avions qui frôlent la colline.',
 'Idéale en famille, lagon protégé par le récif.', 17.9040, -62.8330),
('plage', 'Plage de Lorient', 'Lorient',
 'Plage familiale et village authentique ; côté houle, un des spots de surf historiques de l''île.',
 'Baignade côté ouest, surf côté est.', 17.9070, -62.8210),
('plage', 'Grand Cul-de-Sac', 'Grand Cul-de-Sac',
 'Grand lagon peu profond protégé par le récif : kitesurf, paddle, et tortues dans l''herbier.',
 'Meilleur snorkeling tôt le matin, quand le plan d''eau est calme.', 17.9110, -62.7950),
('plage', 'Petit Cul-de-Sac', 'Petit Cul-de-Sac',
 'Petit lagon tranquille et abrité, entouré de villas, souvent oublié des visiteurs.',
 'Accès discret en contrebas de la route.', 17.9060, -62.7890),
('plage', 'Anse de Toiny', 'Toiny',
 'La côte sauvage : houle du large, paysage brut, spot de surf réputé.',
 'Baignade fortement déconseillée (courants). On vient pour le paysage et les surfeurs.', 17.8950, -62.7900),
('plage', 'Shell Beach', 'Gustavia',
 'La plage de coquillages à cinq minutes à pied du port de Gustavia, encadrée de falaises.',
 'Superbe au coucher du soleil ; les coquillages restent sur place.', 17.8930, -62.8520),
('plage', 'Plage de Corossol', 'Corossol',
 'La plage du village de pêcheurs : barques colorées, ambiance d''antan.',
 'Allez-y en fin de journée quand les pêcheurs rentrent.', 17.9090, -62.8570),
('plage', 'Plage de Public', 'Public',
 'Petite plage face au soleil couchant, prisée des habitants après le travail.',
 'Un des meilleurs couchers de soleil de l''île.', 17.9040, -62.8580),
('plage', 'Anse des Cayes', 'Anse des Cayes',
 'Anse tranquille entre Flamands et Public, spot de surf quand la houle rentre.',
 'Peu de monde même en haute saison.', 17.9150, -62.8480),
('plage', 'Plage de Marigot', 'Marigot',
 'Petite anse calme au nord-est, dans le périmètre de la réserve naturelle : beau snorkeling près des rochers.',
 'Masque et tuba indispensables ; respectez la réserve (rien ne se ramasse).', 17.9110, -62.8040),
('plage', 'Anse de Grand Fond', 'Grand Fond',
 'Côte rocheuse battue par la houle, paysage de bout du monde et piscines naturelles.',
 'Baignade en mer dangereuse ; les piscines naturelles seulement par mer très calme.', 17.8930, -62.8080),

-- Points de vue
('point_de_vue', 'Belvédère de Colombier', 'Colombier',
 'Au bout de la route de Colombier : vue plongeante sur l''anse, les îlets et Saint-Martin à l''horizon.',
 'Départ du sentier vers l''anse de Colombier. Sublime en fin d''après-midi.', 17.9180, -62.8680),
('point_de_vue', 'Point de vue de Lurin', 'Lurin',
 'Depuis les hauteurs de Lurin, panorama sur la baie du Gouverneur et la côte sud.',
 'Arrêt rapide sur la route du Gouverneur.', 17.8890, -62.8440),
('point_de_vue', 'Morne du Vitet', 'Vitet',
 'Le sommet de l''île (286 m) : les deux côtes d''un seul regard, des murets de pierres sèches et un air de campagne.',
 'Montée en voiture puis quelques minutes à pied ; brume possible le matin.', 17.9010, -62.8060),
('point_de_vue', 'Pointe Milou', 'Pointe Milou',
 'Promontoire face au large : les vagues sur les rochers, et le coucher de soleil le plus théâtral de l''île.',
 'Venez 30 minutes avant le coucher du soleil.', 17.9150, -62.8140),
('point_de_vue', 'Fort Gustave et le phare', 'Gustavia',
 'Les vestiges du fort suédois et le phare dominent la rade : vue complète sur le port et les mouillages.',
 'Table d''orientation sur place, accès libre.', 17.8990, -62.8510),

-- Incontournables
('incontournable', 'Gustavia et son port', 'Gustavia',
 'La capitale : ruelles au passé suédois, toits rouges, yachts, boutiques et cafés autour de la rade.',
 'Flânerie idéale en fin de journée, quand la lumière tombe sur le port.', 17.8960, -62.8500),
('incontournable', 'Fort Karl', 'Gustavia',
 'Vestiges du petit fort au-dessus de Shell Beach ; montée courte et vue superbe sur la baie.',
 '10 minutes de marche depuis Shell Beach.', 17.8935, -62.8515),
('incontournable', 'Musée territorial — Wall House', 'Gustavia',
 'L''histoire de l''île, de la période suédoise à aujourd''hui, dans un ancien entrepôt de pierre restauré à La Pointe.',
 'Vérifiez les horaires d''ouverture avant d''y aller.', 17.8975, -62.8495),
('incontournable', 'Musée du coquillage — Inter Oceans Museum', 'Corossol',
 'À Corossol, une collection de coquillages parmi les plus riches au monde, rassemblée par une famille de l''île.',
 'Petit musée attachant, parfait avec des enfants.', 17.9090, -62.8565),
('incontournable', 'Église anglicane St-Bartholomew', 'Gustavia',
 'L''église de pierre de 1855 face au port, témoin de l''histoire cosmopolite de l''île.',
 'Souvent ouverte en journée, concerts ponctuels.', 17.8955, -62.8505),
('incontournable', 'Église de Lorient', 'Lorient',
 'L''une des plus anciennes paroisses de l''île, son clocher et son cimetière marin face à la baie.',
 'Respectez les offices et le calme des lieux.', 17.9055, -62.8235),
('incontournable', 'Le spot des avions — col de la Tourmente', 'St-Jean',
 'Les atterrissages spectaculaires sur l''une des pistes les plus courtes du monde, vus du col au-dessus de l''aéroport.',
 'Ne vous placez jamais dans l''axe de la piste ni sur la route : c''est dangereux et interdit. Restez sur les zones dégagées.', 17.9035, -62.8440),
('incontournable', 'Village de Corossol', 'Corossol',
 'Le village de pêcheurs : barques, filets, tresses de latanier — le Saint-Barth d''avant, toujours vivant.',
 'Tôt le matin pour le retour de pêche.', 17.9085, -62.8555),

-- Lieux publics
('lieu_public', 'Hôtel de la Collectivité', 'Gustavia',
 'Le siège de la Collectivité de Saint-Barthélemy : état civil, services administratifs, séances du Conseil territorial.',
 null, 17.8965, -62.8500),
('lieu_public', 'Bibliothèque territoriale', 'Gustavia',
 'La bibliothèque publique de l''île : prêt, presse, animations et un fonds Caraïbe.',
 'Accès libre, inscriptions sur place.', 17.8960, -62.8495),
('lieu_public', 'Hôpital Irénée de Bruyn', 'Gustavia',
 'L''établissement de santé de l''île : urgences, consultations, maternité de proximité.',
 'En cas d''urgence vitale, composez le 15.', 17.8985, -62.8490),
('lieu_public', 'Bureau de poste de Gustavia', 'Gustavia',
 'La poste principale de l''île, rue du Centenaire.',
 'Horaires réduits le samedi.', 17.8965, -62.8505),
('lieu_public', 'Capitainerie du port de Gustavia', 'Gustavia',
 'L''accueil des plaisanciers : mouillages, formalités, météo marine.',
 null, 17.8960, -62.8515),
('lieu_public', 'Aéroport Rémy de Haenen', 'St-Jean',
 'L''aéroport de l''île, entre le col de la Tourmente et la baie de Saint-Jean.',
 null, 17.9025, -62.8440),
('lieu_public', 'Stade et plateau sportif de Saint-Jean', 'St-Jean',
 'Le complexe sportif de l''île : stade, terrains, courses et tournois du week-end.',
 null, 17.9010, -62.8320),
('lieu_public', 'Piscine territoriale', 'St-Jean',
 'La piscine publique de l''île, à côté du stade : créneaux publics, clubs et cours.',
 'Consultez les créneaux d''ouverture au public.', 17.9015, -62.8315),
('lieu_public', 'Office de tourisme', 'Gustavia',
 'Le Comité du tourisme de Saint-Barthélemy : informations, agenda, conseils pratiques.',
 'Premier arrêt utile pour un visiteur.', 17.8962, -62.8508),

-- Associations (liste de départ, à compléter — proposez la vôtre via « Une idée ? »)
('association', 'Agence Territoriale de l''Environnement — Réserve naturelle', 'Gustavia',
 'Gère la réserve naturelle marine et la protection de l''environnement : mouillages, tortues, sensibilisation.',
 'Renseignez-vous sur les règles de la réserve avant plongée ou mouillage.', 17.8975, -62.8500),
('association', 'Saint-Barth Essentiel', 'Gustavia',
 'Association de sauvegarde du patrimoine naturel et culturel de l''île : inventaires, expositions, publications.',
 null, null, null),
('association', 'AJOE — Association des Jeunes de l''Orient', 'Lorient',
 'L''association historique de Lorient : animations, sports, et le cinéma de plein air sur son plateau.',
 'Les soirées cinéma en plein air valent le détour.', 17.9050, -62.8230),
('association', 'Saint-Barth Yacht Club', 'Public',
 'L''école de voile et le club nautique de l''île : optimist, dériveurs, régates locales.',
 'Stages enfants pendant les vacances scolaires.', 17.9035, -62.8570),
('association', 'ASCCO — Association Sportive et Culturelle de Colombier', 'Colombier',
 'Vie de quartier, sport et culture à Colombier.',
 null, 17.9145, -62.8655),

-- Bons plans
('bon_plan', 'Coucher de soleil à Public', 'Public',
 'Le rendez-vous du soir des habitants : le soleil tombe pile dans l''axe de la baie.',
 'Arrivez 20 minutes avant, repartez après le rayon vert.', 17.9040, -62.8580),
('bon_plan', 'Tortues au lagon de Grand Cul-de-Sac', 'Grand Cul-de-Sac',
 'L''herbier du lagon nourrit les tortues vertes : observation quasi garantie en palmes-masque-tuba.',
 'Tôt le matin, mer d''huile. On observe, on ne touche jamais.', 17.9110, -62.7950),
('bon_plan', 'Sentier de Colombier au soleil couchant', 'Colombier',
 'La descente vers l''anse dans la lumière dorée, quand les bateaux sont partis.',
 'Lampe frontale pour le retour, sans exception.', 17.9195, -62.8710),
('bon_plan', 'Piscines naturelles de Grand Fond', 'Grand Fond',
 'Des vasques creusées dans la roche volcanique, face au large.',
 'Uniquement par mer très calme : par houle, les vagues balayent les dalles. Jamais seul.', 17.8925, -62.8095),
('bon_plan', 'Shell Beach au petit matin', 'Gustavia',
 'La plage rien qu''à vous, la lumière rasante sur les falaises et le tapis de coquillages intact.',
 'Avant 8 h, avec un café à emporter du port.', 17.8930, -62.8520)

on conflict (name, quartier) do nothing;
