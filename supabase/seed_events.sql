-- ============================================================
-- Agenda St Barth Event — pré-remplissage avec les rendez-vous
-- confirmés du calendrier de l'île (recherche web du 2026-08-16,
-- sources : organisateurs et presse locale). Heures en heure de
-- l'île (UTC-4). Statut « approved » : c'est l'admin qui les pose.
-- Ré-exécutable sans doublon (garde sur titre + date).
-- À passer APRÈS la migration 0018.
-- ============================================================

insert into public.events (title, category, venue, quartier, starts_at, price, description, link, organizer)
select * from (values
  ('Fête de la Saint-Barthélemy', 'Culture & Expo', 'Quai Général de Gaulle', 'Gustavia',
   '2026-08-24T08:30:00-04:00'::timestamptz, 'Gratuit',
   'La fête patronale de l''île : messe des marins le matin, dépôt de gerbes, jeux et animations l''après-midi, concerts en soirée et feu d''artifice à 20 h sur la rade. Programme détaillé annoncé par la Collectivité.',
   null, 'Collectivité de Saint-Barthélemy'),

  ('Saint-Barth Gourmet Festival — 13e édition', 'Gastronomie', 'Restaurants participants', 'Gustavia',
   '2026-11-09T19:00:00-04:00'::timestamptz, 'Menus selon restaurants',
   'Du 9 au 15 novembre : des chefs invités s''installent dans les cuisines des restaurants de l''île — dîners signatures, masterclasses et village gastronomique. Réservations directement auprès des restaurants participants.',
   null, 'Comité du Tourisme de Saint-Barthélemy'),

  ('Saint-Barth Cata-Cup — 17e édition', 'Régate & Nautisme', 'Plage de Saint-Jean', 'St-Jean',
   '2026-11-16T09:00:00-04:00'::timestamptz, 'Gratuit pour le public',
   'La semaine des catamarans F18 du 16 au 23 novembre : courses au large de la baie de Saint-Jean, village de la régate sur la plage. Un des plus beaux spectacles nautiques de l''année, visible depuis la plage.',
   'https://stbarthcatacup.com', 'Saint-Barth Multihulls'),

  ('Régate du Nouvel An et réveillon sur la rade', 'Régate & Nautisme', 'Port de Gustavia', 'Gustavia',
   '2026-12-31T10:00:00-04:00'::timestamptz, 'Gratuit pour le public',
   'Le 31 décembre : la New Year''s Eve Regatta fait le tour de l''île (briefing des skippers la veille), la rade se remplit de voiliers et de yachts, et la nuit se termine par les feux d''artifice de minuit sur le port.',
   null, 'Saint-Barth Yacht Club'),

  ('Carnaval — grande parade du Mardi Gras', 'Famille', 'Rues de Gustavia', 'Gustavia',
   '2027-02-09T14:00:00-04:00'::timestamptz, 'Gratuit',
   'Le défilé costumé du Mardi Gras dans les rues de Gustavia : chars, musique et déguisements. Le lendemain, Mercredi des Cendres, Vaval est brûlé à Shell Beach au coucher du soleil.',
   null, 'Associations carnavalesques de l''île'),

  ('St Barths Bucket Regatta', 'Régate & Nautisme', 'Rade de Gustavia', 'Gustavia',
   '2027-03-18T10:00:00-04:00'::timestamptz, 'Gratuit pour le public',
   'Du 18 au 21 mars : les plus grands voiliers du monde régatent autour de l''île — quatre jours de courses, un spectacle unique depuis les points hauts de Gustavia (Fort Gustave, Shell Beach).',
   'https://bucketregatta.com', 'Bucket Regatta')
) as v(title, category, venue, quartier, starts_at, price, description, link, organizer)
where not exists (
  select 1 from public.events e
  where e.title = v.title and e.starts_at = v.starts_at
);

-- (la colonne status reçoit 'approved' via l'UPDATE ci-dessous : les six
--  entrées viennent d'être posées en 'pending' par défaut)
update public.events set status = 'approved'
where status = 'pending' and organizer in (
  'Collectivité de Saint-Barthélemy', 'Comité du Tourisme de Saint-Barthélemy',
  'Saint-Barth Multihulls', 'Saint-Barth Yacht Club',
  'Associations carnavalesques de l''île', 'Bucket Regatta'
) and submitted_by is null;
