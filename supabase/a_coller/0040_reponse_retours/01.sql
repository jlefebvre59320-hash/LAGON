-- ============================================================
-- 0040 — Répondre aux retours, et ranger le jardin.
--
-- 1) Les annonces d'outillage et de jardin publiées sous « Achats &
--    Ventes » rejoignent le nouvel univers (0039 doit être passée seule
--    avant).
--
-- 2) Un retour (idée, problème, avis) déposé depuis /retours recevait
--    au mieux un « Marquer lu ». L'administration peut maintenant y
--    répondre : la réponse arrive dans la messagerie de la personne
--    (pastille en direct, notification push et email envoyés par la
--    route serveur), ou par email seul si elle n'a pas de compte mais
--    a laissé une adresse.
--
--    Une conversation de support est une conversation sans annonce :
--    listing_id devient nullable, et il n'y a qu'un fil de support par
--    personne, quel que soit le nombre de retours — c'est plus lisible
--    qu'un fil par idée. Le premier administrateur qui répond en devient
--    l'interlocuteur ; un second peut y écrire via la fonction, le fil
--    reste dans la boîte du premier.
-- ============================================================

-- ---------- 1. Déménagement des annonces de jardin ----------

update public.listings
   set module = 'garden',
       subcategory = case subcategory
                       when 'Outillage' then 'Outillage à main'
                       else 'Autre jardin & outillage'
                     end
 where module = 'goods'
   and subcategory in ('Outillage', 'Bricolage & Jardin');

-- Et « Emploi » redevient l'emploi seul : les services entre particuliers
-- rejoignent l'univers Services, créé en 0030.
update public.listings
   set module = 'service', subcategory = 'Autre service'
 where module = 'job' and subcategory = 'Services entre particuliers';

-- ---------- 2. La réponse, mémorisée sur le retour ----------

alter table public.feedback
  add column if not exists reply      text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references auth.users(id) on delete set null;

-- ---------- 3. Conversations sans annonce ----------

alter table public.conversations alter column listing_id drop not null;

-- Un seul fil de support par personne. L'index partiel sert aussi de
-- cible au « on conflict » de la fonction de réponse.
create unique index if not exists uq_conversations_support
  on public.conversations (buyer_id) where listing_id is null;

-- ---------- 4. Répondre à un retour ----------

-- Renvoie comment la réponse est partie :
--   {mode:'message', conversation_id, user_id}  → dans la messagerie ;
--   {mode:'email', contact, message, kind}      → email seul, à envoyer
--                                                 par la route serveur ;
