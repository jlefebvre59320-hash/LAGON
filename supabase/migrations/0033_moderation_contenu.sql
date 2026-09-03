-- ============================================================
-- 0033 — Modération du contenu : texte, messages, images.
--
-- Prolonge 0032 sans rien lui retirer. Ce qui change :
--
--   · Le filtre texte cesse d'être une recherche exacte. Le texte est
--     normalisé (accents, chiffres-lettres, répétitions, espaces glissés
--     entre les lettres) avant comparaison à un lexique par catégorie
--     — sexuel, insulte, menace, haine, illégal, phishing — où chaque
--     terme porte un niveau : certain, fort, faible, ou exception.
--   · Un terme faible ne bloque jamais. Un terme fort met en attente.
--     Il faut un terme certain, ou deux termes forts de la même famille,
--     pour bloquer. Le doute s'écrit « incertain » et va vers un humain.
--   · L'auteur d'une annonce retenue lit un message générique ; les
--     termes détectés ne sont visibles que de l'administration, dans une
--     table séparée.
--   · Les messages passent par le même analyseur : refusés s'ils sont
--     certains, signalés à l'administration s'ils sont forts.
--   · Les photos portent le résultat d'une analyse externe (route
--     /api/moderer-photo) : nudité explicite bloquante, le reste pèse.
--   · Chaque famille de règle a un interrupteur, et un quatrième seuil
--     (blocage) rejoint surveillance et vérification.
-- ============================================================

create extension if not exists unaccent;

-- ---------- Réglages ----------

-- Le seuil de blocage : au-delà, une annonce sans certitude va tout de
-- même vers un humain (« incertain »), et une annonce certaine est retenue.
update public.moderation_settings
   set value = value || '{"blocage": 81}'::jsonb
 where key = 'seuils' and not (value ? 'blocage');

update public.moderation_settings
   set value = value || '{"contournement": 10, "titre": 8, "texte_categorie_max": 60, "image_suspecte": 25}'::jsonb
 where key = 'poids';

insert into public.moderation_settings (key, value) values
  -- Chaque famille se coupe ici, sans redéploiement.
  ('regles', '{"texte": true, "prix": true, "compte": true, "rafale": true, "doublons": true,
               "photos": true, "contact": true, "signalements": true, "messages": true, "images": true}'),
  -- Seuils de l'analyse d'image (probabilités 0–1 renvoyées par Sightengine).
  ('images', '{"sexuel_certain": 0.75, "sexuel_fort": 0.5, "arme": 0.7, "drogue": 0.7, "gore": 0.7, "offensant": 0.7}')
on conflict (key) do nothing;

-- Les termes d'argent à distance passent dans le lexique (phishing) : la
-- liste « contact hors site » ne garde que ce qui déplace l'échange.
update public.moderation_settings
   set value = '["http://","https://","www.","bit.ly","wa.me","t.me","telegram","snap ","snapchat","instagram","insta ","mon mail","mon email","envoyez moi votre numero","envoie moi ton numero","hors du site","en dehors du site","pas par le site"]'
 where key = 'motifs_contact';

-- ---------- Normalisation ----------

-- Ce que l'analyse lit à la place du texte : minuscules, sans accents,
-- chiffres et symboles rendus à leurs lettres (s3xe → sexe, $ → s),
-- ponctuation effacée, lettres répétées trois fois ramenées à une, et
-- lettres isolées recollées (s e x e → sexe). Le texte affiché, lui, ne
-- bouge jamais : seule la copie analysée passe par ici.
create or replace function public.mod_normaliser(p text)
returns text language plpgsql stable as $$
declare
  t text;
begin
  t := lower(public.unaccent(coalesce(p, '')));
  t := translate(t, '0134578@$€!|+', 'oieastbaseilt');
  t := regexp_replace(t, '[^a-z]+', ' ', 'g');
  t := regexp_replace(t, '(.)\1{2,}', '\1', 'g');
  -- Lettres isolées séparées par des espaces : chaque lettre seule suivie
  -- d'une autre lettre seule perd son espace. Une passe recolle « s e x e »,
  -- la seconde couvre les restes ; « à la » n'est pas touché.
  for i in 1..2 loop
    t := regexp_replace(t, '\m([a-z]) (?=[a-z]\M)', '\1', 'g');
  end loop;
  return btrim(regexp_replace(t, ' +', ' ', 'g'));
end $$;

-- Variante serrée : toutes les lettres doublées ramenées à une (sexxe →
-- sexe). Comparée à un terme serré de la même façon.
create or replace function public.mod_serrer(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '(.)\1+', '\1', 'g');
$$;

-- Le terme est-il dans le texte ? Les termes courts ne se cherchent
-- qu'entre frontières de mots : « bite » ne trouve pas « bitte
-- d'amarrage », « cul » ne trouve pas « culasse ». Les expressions
-- longues se cherchent aussi sans espaces.
create or replace function public.mod_contient(p_texte_n text, p_terme_n text)
returns boolean language plpgsql immutable as $$
declare
  t text := btrim(p_terme_n);
begin
  if t = '' then return false; end if;
  if char_length(replace(t, ' ', '')) <= 5 then
    return p_texte_n ~ ('\m' || t || '\M')
        or public.mod_serrer(p_texte_n) ~ ('\m' || public.mod_serrer(t) || '\M');
  end if;
  return position(t in p_texte_n) > 0
      or position(replace(t, ' ', '') in replace(p_texte_n, ' ', '')) > 0
      or position(public.mod_serrer(replace(t, ' ', '')) in public.mod_serrer(replace(p_texte_n, ' ', ''))) > 0;
end $$;

-- ---------- Lexique ----------

create table if not exists public.moderation_lexique (
  id         serial primary key,
  terme      text not null,
  categorie  text not null check (categorie in ('sexuel', 'insulte', 'menace', 'haine', 'illegal', 'phishing', 'exception')),
  niveau     text not null check (niveau in ('certain', 'fort', 'faible', 'exception')),
  poids      integer not null default 0,
  actif      boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),
  unique (terme, categorie)
);
alter table public.moderation_lexique enable row level security;
drop policy if exists "lexique_admin" on public.moderation_lexique;
create policy "lexique_admin" on public.moderation_lexique
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.moderation_lexique from anon, authenticated;
grant select, insert, update, delete on public.moderation_lexique to authenticated;
grant usage, select on sequence public.moderation_lexique_id_seq to authenticated;

-- Poids par défaut : certain 60 (bloque de toute façon), fort 25, faible 6.
-- Les termes sont écrits « à plat » : la normalisation s'applique aussi au
-- lexique, donc accents et ponctuation n'ont pas d'importance ici.
insert into public.moderation_lexique (terme, categorie, niveau, poids, note) values
  -- Sexuel · certain : une offre de service ou de contenu sexuel, sans lecture innocente possible.
  ('escort', 'sexuel', 'certain', 60, null), ('escorte', 'sexuel', 'certain', 60, null), ('escort girl', 'sexuel', 'certain', 60, null),
  ('massage erotique', 'sexuel', 'certain', 60, null), ('massage sensuel', 'sexuel', 'certain', 60, null), ('massage tantrique', 'sexuel', 'certain', 60, null),
  ('massage naturiste', 'sexuel', 'certain', 60, null), ('massage sexuel', 'sexuel', 'certain', 60, null), ('massage coquin', 'sexuel', 'certain', 60, null),
  ('plan cul', 'sexuel', 'certain', 60, null), ('plan q', 'sexuel', 'certain', 60, null), ('rencontre sexe', 'sexuel', 'certain', 60, null),
  ('rencontre coquine', 'sexuel', 'certain', 60, null), ('rencontres coquines', 'sexuel', 'certain', 60, null),
  ('fellation', 'sexuel', 'certain', 60, null), ('sodomie', 'sexuel', 'certain', 60, null), ('branlette', 'sexuel', 'certain', 60, null),
  ('services sexuels', 'sexuel', 'certain', 60, null), ('prestations sexuelles', 'sexuel', 'certain', 60, null), ('sexe tarife', 'sexuel', 'certain', 60, null),
  ('sexe contre', 'sexuel', 'certain', 60, null), ('contre du sexe', 'sexuel', 'certain', 60, null),
  ('porno', 'sexuel', 'certain', 60, null), ('pornographie', 'sexuel', 'certain', 60, null), ('pornographique', 'sexuel', 'certain', 60, null),
  ('video x', 'sexuel', 'certain', 60, null), ('videos x', 'sexuel', 'certain', 60, null), ('film x', 'sexuel', 'certain', 60, null), ('films x', 'sexuel', 'certain', 60, null),
  ('sextape', 'sexuel', 'certain', 60, null), ('sex tape', 'sexuel', 'certain', 60, null),
  ('onlyfans', 'sexuel', 'certain', 60, null), ('mym', 'sexuel', 'fort', 25, 'plateforme de contenu, souvent adulte'),
  ('sugar daddy', 'sexuel', 'certain', 60, null), ('sugar baby', 'sexuel', 'certain', 60, null),
  ('nudes', 'sexuel', 'certain', 60, null), ('photos nues', 'sexuel', 'certain', 60, null), ('photos intimes', 'sexuel', 'certain', 60, null),
  ('photos coquines', 'sexuel', 'certain', 60, null), ('videos coquines', 'sexuel', 'certain', 60, null),
  ('camgirl', 'sexuel', 'certain', 60, null), ('cam girl', 'sexuel', 'certain', 60, null), ('webcam sexe', 'sexuel', 'certain', 60, null), ('cam sexe', 'sexuel', 'certain', 60, null),
  ('gang bang', 'sexuel', 'certain', 60, null), ('gangbang', 'sexuel', 'certain', 60, null), ('partouze', 'sexuel', 'certain', 60, null),
  ('echangiste', 'sexuel', 'certain', 60, null), ('echangistes', 'sexuel', 'certain', 60, null),
  ('blowjob', 'sexuel', 'certain', 60, null), ('handjob', 'sexuel', 'certain', 60, null), ('escort service', 'sexuel', 'certain', 60, null),
  ('sex for money', 'sexuel', 'certain', 60, null), ('nude pics', 'sexuel', 'certain', 60, null), ('nude photos', 'sexuel', 'certain', 60, null),
  -- Sexuel · fort : explicite, mais une vente d'objets pour adultes ou une formulation maladroite reste possible → un humain regarde.
  ('baise', 'sexuel', 'fort', 25, null), ('baiser', 'sexuel', 'faible', 6, 'aussi un mot doux'),
  ('penis', 'sexuel', 'fort', 25, null), ('vagin', 'sexuel', 'fort', 25, null), ('orgasme', 'sexuel', 'fort', 25, null),
  ('sextoy', 'sexuel', 'fort', 25, 'vente possible'), ('sex toy', 'sexuel', 'fort', 25, 'vente possible'), ('sextoys', 'sexuel', 'fort', 25, null),
  ('godemichet', 'sexuel', 'fort', 25, null), ('gode', 'sexuel', 'fort', 25, null), ('vibromasseur', 'sexuel', 'fort', 25, 'vente possible'),
  ('libertin', 'sexuel', 'fort', 25, null), ('libertine', 'sexuel', 'fort', 25, null), ('xxx', 'sexuel', 'fort', 25, null),
  ('porn', 'sexuel', 'fort', 25, null), ('nue', 'sexuel', 'faible', 6, 'photo nue / mise à nue'), ('nu', 'sexuel', 'faible', 4, null),
  ('coquine', 'sexuel', 'faible', 8, null), ('coquin', 'sexuel', 'faible', 6, null), ('hot', 'sexuel', 'faible', 3, null),
  ('sexy', 'sexuel', 'faible', 5, null), ('sensuel', 'sexuel', 'faible', 6, null), ('sensuelle', 'sexuel', 'faible', 6, null),
  ('sexe', 'sexuel', 'faible', 6, 'aussi le sexe d''un animal'), ('sexuel', 'sexuel', 'faible', 6, null), ('sexuelle', 'sexuel', 'faible', 6, null),
  ('seins', 'sexuel', 'faible', 5, null), ('bite', 'sexuel', 'faible', 6, 'mot court : frontières de mots'), ('chatte', 'sexuel', 'faible', 3, 'le plus souvent un chat'),
  ('sucer', 'sexuel', 'faible', 6, null), ('hookup', 'sexuel', 'faible', 6, null), ('discret', 'sexuel', 'faible', 2, 'utile avec d''autres signaux seulement'),
  -- Insultes : rarement le sujet d'une annonce, mais présentes dans les messages.
  ('salope', 'insulte', 'fort', 25, null), ('encule', 'insulte', 'fort', 25, null), ('encules', 'insulte', 'fort', 25, null),
  ('fils de pute', 'insulte', 'fort', 25, null), ('nique ta mere', 'insulte', 'fort', 25, null), ('ntm', 'insulte', 'fort', 20, null),
  ('pute', 'insulte', 'faible', 6, 'aussi une interjection'), ('putain', 'insulte', 'faible', 3, 'interjection courante'),
  ('connard', 'insulte', 'faible', 8, null), ('connasse', 'insulte', 'faible', 8, null), ('con', 'insulte', 'faible', 2, null),
  ('batard', 'insulte', 'faible', 6, null), ('batards', 'insulte', 'faible', 6, null), ('abruti', 'insulte', 'faible', 4, null),
  ('whore', 'insulte', 'fort', 25, null), ('slut', 'insulte', 'fort', 25, null), ('bitch', 'insulte', 'faible', 6, null),
  ('fuck', 'insulte', 'faible', 4, null), ('fuck you', 'insulte', 'faible', 8, null), ('asshole', 'insulte', 'faible', 6, null),
  -- Menaces.
  ('je vais te tuer', 'menace', 'certain', 60, null), ('je vais te buter', 'menace', 'certain', 60, null), ('je vais te crever', 'menace', 'certain', 60, null),
  ('on va te tuer', 'menace', 'certain', 60, null), ('tu vas mourir', 'menace', 'fort', 25, null), ('tu vas crever', 'menace', 'fort', 25, null),
  ('te casser la gueule', 'menace', 'fort', 25, null), ('te peter la gueule', 'menace', 'fort', 25, null), ('te defoncer', 'menace', 'faible', 8, null),
  ('je te retrouverai', 'menace', 'faible', 8, null), ('je sais ou tu habites', 'menace', 'fort', 25, null),
  ('bruler ta maison', 'menace', 'fort', 25, null), ('bruler ta voiture', 'menace', 'fort', 25, null),
  ('te violer', 'menace', 'certain', 60, null), ('violer', 'menace', 'fort', 25, null), ('kill you', 'menace', 'certain', 60, null),
  -- Haine.
  ('sale arabe', 'haine', 'certain', 60, null), ('sale noir', 'haine', 'certain', 60, null), ('sale negre', 'haine', 'certain', 60, null),
  ('sale blanc', 'haine', 'certain', 60, null), ('sale juif', 'haine', 'certain', 60, null), ('sale pd', 'haine', 'certain', 60, null),
  ('bougnoule', 'haine', 'certain', 60, null), ('youpin', 'haine', 'certain', 60, null), ('negre', 'haine', 'fort', 25, null), ('negro', 'haine', 'fort', 25, null),
  ('pede', 'haine', 'fort', 25, null), ('tapette', 'haine', 'fort', 25, null), ('pd', 'haine', 'fort', 20, 'mot court'),
  ('heil hitler', 'haine', 'certain', 60, null), ('white power', 'haine', 'certain', 60, null), ('suprematie blanche', 'haine', 'fort', 25, null),
  ('mort aux', 'haine', 'fort', 25, null), ('nigger', 'haine', 'certain', 60, null), ('faggot', 'haine', 'fort', 25, null),
  -- Illégal : ce qui ne se vend pas, à Saint-Barthélemy comme ailleurs.
  ('arme a feu', 'illegal', 'certain', 60, null), ('armes a feu', 'illegal', 'certain', 60, null), ('pistolet', 'illegal', 'fort', 25, 'pistolet à eau, à peinture…'),
  ('revolver', 'illegal', 'fort', 25, null), ('fusil d assaut', 'illegal', 'certain', 60, null), ('kalachnikov', 'illegal', 'certain', 60, null),
  ('ak 47', 'illegal', 'certain', 60, null), ('glock', 'illegal', 'certain', 60, null), ('munitions', 'illegal', 'fort', 25, null),
  ('balles 9mm', 'illegal', 'certain', 60, null), ('taser', 'illegal', 'fort', 25, null), ('poing americain', 'illegal', 'fort', 25, null),
  ('cocaine', 'illegal', 'certain', 60, null), ('heroine', 'illegal', 'certain', 60, null), ('methamphetamine', 'illegal', 'certain', 60, null),
  ('ecstasy', 'illegal', 'certain', 60, null), ('mdma', 'illegal', 'certain', 60, null), ('lsd', 'illegal', 'fort', 25, null),
  ('champignons hallucinogenes', 'illegal', 'certain', 60, null), ('cannabis', 'illegal', 'fort', 25, 'CBD légal possible'), ('weed', 'illegal', 'fort', 25, null),
  ('beuh', 'illegal', 'fort', 25, null), ('ganja', 'illegal', 'fort', 25, null), ('resine de cannabis', 'illegal', 'certain', 60, null),
  ('faux billets', 'illegal', 'certain', 60, null), ('fausse monnaie', 'illegal', 'certain', 60, null), ('contrefacon', 'illegal', 'fort', 25, null),
  ('faux passeport', 'illegal', 'certain', 60, null), ('fausse carte d identite', 'illegal', 'certain', 60, null), ('carte d identite a vendre', 'illegal', 'certain', 60, null),
  ('carte grise vierge', 'illegal', 'certain', 60, null), ('permis de conduire a vendre', 'illegal', 'certain', 60, null), ('permis sans examen', 'illegal', 'certain', 60, null),
  ('viagra', 'illegal', 'fort', 25, null), ('xanax', 'illegal', 'fort', 25, null), ('tramadol', 'illegal', 'fort', 25, null),
  ('medicaments sur ordonnance', 'illegal', 'fort', 25, null), ('carapace de tortue', 'illegal', 'fort', 25, 'espèce protégée'), ('ecaille de tortue', 'illegal', 'fort', 25, null),
  ('ivoire', 'illegal', 'faible', 8, null), ('corail a vendre', 'illegal', 'faible', 8, null),
  -- Phishing et arnaque : ce qui déplace l'argent hors de l'île.
  ('western union', 'phishing', 'fort', 25, null), ('moneygram', 'phishing', 'fort', 25, null), ('mandat cash', 'phishing', 'fort', 25, null),
  ('paysafecard', 'phishing', 'certain', 60, null), ('coupon pcs', 'phishing', 'certain', 60, null), ('transcash', 'phishing', 'certain', 60, null),
  ('neosurf', 'phishing', 'certain', 60, null), ('code de validation', 'phishing', 'fort', 25, null), ('code sms', 'phishing', 'fort', 25, null),
  ('virement avant', 'phishing', 'fort', 25, null), ('acompte par virement', 'phishing', 'fort', 25, null), ('acompte obligatoire', 'phishing', 'fort', 20, null),
  ('paypal famille', 'phishing', 'fort', 25, null), ('paypal entre proches', 'phishing', 'fort', 25, null),
  ('livraison par transporteur', 'phishing', 'faible', 8, null), ('je suis a l etranger', 'phishing', 'faible', 8, null),
  ('actuellement en metropole', 'phishing', 'faible', 8, null), ('actuellement a l etranger', 'phishing', 'faible', 8, null),
  ('cliquez sur ce lien', 'phishing', 'fort', 25, null), ('verifiez votre compte', 'phishing', 'fort', 25, null),
  ('votre compte sera suspendu', 'phishing', 'certain', 60, null), ('mot de passe', 'phishing', 'faible', 6, null), ('identifiants', 'phishing', 'faible', 6, null),
  ('gagnez de l argent facilement', 'phishing', 'fort', 25, null), ('revenu passif garanti', 'phishing', 'fort', 25, null),
  ('trading garanti', 'phishing', 'fort', 25, null), ('investissement crypto', 'phishing', 'faible', 8, null), ('bitcoin', 'phishing', 'faible', 4, null),
  ('usdt', 'phishing', 'faible', 6, null), ('gift card', 'phishing', 'fort', 20, null), ('carte cadeau en paiement', 'phishing', 'fort', 25, null),
  -- Exceptions : des tournures innocentes retirées du texte avant analyse.
  ('sexe du chiot', 'exception', 'exception', 0, null), ('sexe du chaton', 'exception', 'exception', 0, null), ('sexe femelle', 'exception', 'exception', 0, null),
  ('sexe male', 'exception', 'exception', 0, null), ('sexe non determine', 'exception', 'exception', 0, null), ('unisexe', 'exception', 'exception', 0, null),
  ('bitte d amarrage', 'exception', 'exception', 0, null), ('bittes d amarrage', 'exception', 'exception', 0, null), ('culasse', 'exception', 'exception', 0, null),
  ('cul de sac', 'exception', 'exception', 0, null), ('cul de poule', 'exception', 'exception', 0, null), ('chatte sterilisee', 'exception', 'exception', 0, null),
  ('chatte vaccinee', 'exception', 'exception', 0, null), ('chatte a adopter', 'exception', 'exception', 0, null), ('chatte a donner', 'exception', 'exception', 0, null),
  ('petite chatte', 'exception', 'exception', 0, 'chaton'), ('pistolet a eau', 'exception', 'exception', 0, null), ('pistolet a peinture', 'exception', 'exception', 0, null),
  ('pistolet a colle', 'exception', 'exception', 0, null), ('pistolet de lavage', 'exception', 'exception', 0, null), ('pistolet a air comprime', 'exception', 'exception', 0, null),
  ('huile de cbd', 'exception', 'exception', 0, null), ('mot de passe wifi', 'exception', 'exception', 0, null), ('hot dog', 'exception', 'exception', 0, null),
  ('hot tub', 'exception', 'exception', 0, null), ('hot wheels', 'exception', 'exception', 0, null), ('sexy en soiree', 'exception', 'exception', 0, 'robe sexy'),
  ('robe sexy', 'exception', 'exception', 0, null), ('tenue sexy', 'exception', 'exception', 0, null), ('lingerie', 'exception', 'exception', 0, 'vente courante')
on conflict (terme, categorie) do nothing;

-- ---------- L'analyseur de texte ----------

-- Renvoie un jsonb : score, bloque, certitude (certain / fort / faible /
-- aucun), contournement, raisons (une par famille, formulation générique
-- montrable à l'auteur) et details (les termes eux-mêmes, pour
-- l'administration seulement).
create or replace function public.mod_analyser_texte(p_titre text, p_description text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  poids      jsonb := public.mod_setting('poids', '{}');
  cap        int  := coalesce((poids->>'texte_categorie_max')::int, 60);
  p_cont     int  := coalesce((poids->>'contournement')::int, 10);
  p_titre_b  int  := coalesce((poids->>'titre')::int, 8);
  -- Le texte « brut » : minuscules sans accents, ponctuation en espaces,
  -- mais sans chiffres-lettres ni recollage. Un terme trouvé dans la
  -- version normalisée et absent d'ici a été déguisé volontairement.
  brut       text := regexp_replace(regexp_replace(lower(public.unaccent(coalesce(p_titre, '') || ' ' || coalesce(p_description, ''))), '[^a-z]+', ' ', 'g'), ' +', ' ', 'g');
  texte_n    text := public.mod_normaliser(coalesce(p_titre, '') || ' ' || coalesce(p_description, ''));
  titre_n    text := public.mod_normaliser(coalesce(p_titre, ''));
  lx         record;
  terme_n    text;
  trouve     boolean;
  dans_titre boolean;
  contourne  boolean := false;
  bloque     boolean := false;
  certitude  text := 'aucun';
  -- Par famille : points, nombre de termes forts, libellés trouvés.
  fam        jsonb := '{}';
  f          jsonb;
  cle        text;
  score      int := 0;
  raisons    jsonb := '[]';
  details    jsonb := '[]';
  n_forts    int;
  n_total    int;
  pts        int;
begin
  if btrim(texte_n) = '' then
    return jsonb_build_object('score', 0, 'bloque', false, 'certitude', 'aucun', 'contournement', false,
                              'raisons', '[]'::jsonb, 'details', '[]'::jsonb);
  end if;

  -- 1. Les exceptions s'effacent d'abord : « bitte d'amarrage » ne doit
  --    laisser aucune trace de « bite » à l'étape suivante.
  for lx in select terme from public.moderation_lexique where actif and niveau = 'exception' loop
    terme_n := public.mod_normaliser(lx.terme);
    if terme_n <> '' then
      texte_n := regexp_replace(texte_n, terme_n, ' ', 'g');
      titre_n := regexp_replace(titre_n, terme_n, ' ', 'g');
      brut    := regexp_replace(brut, terme_n, ' ', 'g');
    end if;
  end loop;

  -- 2. Chaque terme, par famille.
  for lx in select mx.terme, mx.categorie, mx.niveau, mx.poids as p from public.moderation_lexique mx
             where actif and niveau <> 'exception' order by niveau, terme loop
    terme_n := public.mod_normaliser(lx.terme);
    if terme_n = '' then continue; end if;
    trouve := public.mod_contient(texte_n, terme_n);
    if not trouve then continue; end if;
    dans_titre := public.mod_contient(titre_n, terme_n);
    -- Trouvé après normalisation mais absent du texte brut : l'auteur a
    -- déguisé le mot. Ça compte contre lui, une fois.
    if position(btrim(regexp_replace(lower(public.unaccent(lx.terme)), '[^a-z]+', ' ', 'g')) in brut) = 0 then contourne := true; end if;

    f := coalesce(fam->lx.categorie, '{"points":0,"forts":0,"certain":false,"termes":[],"faibles":0}'::jsonb);
    pts := lx.p + case when dans_titre then p_titre_b else 0 end;
    f := jsonb_set(f, '{points}', to_jsonb((f->>'points')::int + pts));
    f := jsonb_set(f, '{termes}', (f->'termes') || to_jsonb(lx.terme || case when dans_titre then ' (titre)' else '' end));
    if lx.niveau = 'certain' then
      f := jsonb_set(f, '{certain}', 'true'::jsonb);
    elsif lx.niveau = 'fort' then
      f := jsonb_set(f, '{forts}', to_jsonb((f->>'forts')::int + 1));
    else
      f := jsonb_set(f, '{faibles}', to_jsonb((f->>'faibles')::int + 1));
    end if;
    fam := jsonb_set(fam, array[lx.categorie], f);
  end loop;

  -- 3. Décision par famille. Un certain bloque. Deux forts de la même
  --    famille bloquent. Un fort seul met en attente. Les faibles pèsent,
  --    plafonnés, et ne décident jamais rien seuls.
  for cle, f in select * from jsonb_each(fam) loop
    n_forts := (f->>'forts')::int;
    n_total := n_forts + (f->>'faibles')::int + case when (f->>'certain')::boolean then 1 else 0 end;
    pts := least((f->>'points')::int, cap);
    if (f->>'certain')::boolean or n_forts >= 2 then
      bloque := true; certitude := 'certain'; pts := greatest(pts, cap);
    elsif n_forts = 1 and certitude <> 'certain' then
      certitude := 'fort';
    elsif certitude = 'aucun' then
      certitude := 'faible';
    end if;
    score := score + pts;
    raisons := raisons || jsonb_build_object(
      'code', case cle when 'sexuel' then 'contenu_sexuel' else cle end,
      'detail', format('%s élément%s relevé%s par le filtre de texte', n_total, case when n_total > 1 then 's' else '' end, case when n_total > 1 then 's' else '' end),
      'points', pts);
    details := details || jsonb_build_object('code', case cle when 'sexuel' then 'contenu_sexuel' else cle end,
                                             'termes', f->'termes', 'niveau', case when (f->>'certain')::boolean then 'certain' when n_forts > 0 then 'fort' else 'faible' end);
  end loop;

  if contourne then
    score := score + p_cont;
    raisons := raisons || jsonb_build_object('code', 'contournement', 'detail', 'orthographe déguisée pour passer le filtre', 'points', p_cont);
  end if;

  return jsonb_build_object('score', least(score, 100), 'bloque', bloque, 'certitude', certitude,
                            'contournement', contourne, 'raisons', raisons, 'details', details);
end $$;

-- ---------- Ce que seule l'administration lit ----------

-- Les termes détectés, par annonce. Jamais lisibles par l'auteur : un
-- filtre dont on connaît la liste se contourne en dix minutes.
create table if not exists public.moderation_details (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  details    jsonb not null default '[]',
  certitude  text,
  updated_at timestamptz not null default now()
);
alter table public.moderation_details enable row level security;
drop policy if exists "details_admin" on public.moderation_details;
create policy "details_admin" on public.moderation_details for select using (public.is_admin());
revoke all on public.moderation_details from anon, authenticated;
grant select on public.moderation_details to authenticated;

-- ---------- Photos : le résultat de l'analyse externe ----------

-- Écrit par la route serveur /api/moderer-photo (clé de service), jamais
-- par un compte. niveau : certain (nudité explicite), fort (arme, drogue,
-- violence, symbole haineux, érotisme), faible, ou null (rien ou pas analysé).
alter table public.listing_photos
  add column if not exists moderation        jsonb,
  add column if not exists moderation_niveau text;

-- ---------- Signalements : trois motifs de plus ----------

alter table public.reports drop constraint if exists reports_motif_connu;
alter table public.reports add constraint reports_motif_connu
  check (motif is null or motif in (
    'arnaque', 'interdit', 'sexuel', 'fausse', 'prix_trompeur', 'photo_suspecte',
    'mauvaise_categorie', 'deja_vendue', 'spam', 'inapproprie', 'autre')) not valid;

-- ---------- Décisions : l'erreur de détection ----------

alter table public.moderation_decisions
  add column if not exists faux_positif boolean not null default false;
alter table public.moderation_decisions drop constraint if exists moderation_decisions_decision_check;
alter table public.moderation_decisions add constraint moderation_decisions_decision_check
  check (decision in ('publier', 'maintenir', 'masquer', 'supprimer', 'demander_modification', 'suspendre', 'bannir', 'erreur'));

-- ---------- L'évaluation, version 2 ----------

create or replace function public.evaluer_annonce(p_listing_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  l          public.listings;
  p          public.profiles;
  poids      jsonb := public.mod_setting('poids', '{}');
  seuils     jsonb := public.mod_setting('seuils', '{"surveillance":31,"verification":61,"blocage":81}');
  prix_cfg   jsonb := public.mod_setting('prix', '{"min_comparables":5,"ratio_bas":0.5,"ratio_tres_bas":0.3}');
  rafale_cfg jsonb := public.mod_setting('rafale', '{"moderee":4,"forte":7,"blocage":12}');
  termes     jsonb := public.mod_setting('termes_interdits', '[]');
  motifs     jsonb := public.mod_setting('motifs_contact', '[]');
  regles     jsonb := public.mod_setting('regles', '{}');
  score      int := 0;
  raisons    jsonb := '[]';
  details    jsonb := '[]';
  bloque     boolean := false;
  certitude  text := 'aucun';
  texte      text;
  texte_n    text;
  terme      text;
  ana jsonb;
  n_comp     int;
  mediane    numeric;
  n_heure    int;
  n_signal   int := 0;
  n_img_fort int;
  etat       text;
  v_pts      int;
  seuil_bloc int := coalesce((seuils->>'blocage')::int, 81);
begin
  select * into l from public.listings where id = p_listing_id;
  if l.id is null then return; end if;
  select * into p from public.profiles where id = l.user_id;

  texte   := lower(coalesce(l.title, '') || ' ' || coalesce(l.description, ''));
  texte_n := public.mod_normaliser(l.title || ' ' || coalesce(l.description, ''));

  -- 1. Texte : la liste sèche de blocage (réglage), puis le lexique.
  if coalesce((regles->>'texte')::boolean, true) then
    for terme in select x from jsonb_array_elements_text(termes) x loop
      if public.mod_contient(texte_n, public.mod_normaliser(terme)) then
        bloque := true; certitude := 'certain';
        raisons := raisons || jsonb_build_object('code', 'texte_interdit', 'detail', 'terme de la liste de blocage', 'points', 100);
        details := details || jsonb_build_object('code', 'texte_interdit', 'termes', jsonb_build_array(terme), 'niveau', 'certain');
        exit;
      end if;
    end loop;
    ana := public.mod_analyser_texte(l.title, l.description);
    score   := score + (ana->>'score')::int;
    raisons := raisons || (ana->'raisons');
    details := details || (ana->'details');
    if (ana->>'bloque')::boolean then bloque := true; end if;
    if certitude <> 'certain' then certitude := ana->>'certitude'; end if;
  end if;

  -- 2. Prix : un signal léger, jamais une preuve.
  if coalesce((regles->>'prix')::boolean, true) and l.price_cents is not null and l.price_cents > 0 then
    select count(*), percentile_cont(0.5) within group (order by price_cents)
      into n_comp, mediane
      from public.listings
     where module = l.module and subcategory = l.subcategory
       and status = 'active' and review_state in ('published', 'watch')
       and price_cents is not null and price_cents > 0
       and id <> l.id and intent = l.intent;
    if n_comp >= (prix_cfg->>'min_comparables')::int and mediane > 0 then
      if l.price_cents < mediane * (prix_cfg->>'ratio_tres_bas')::numeric then
        v_pts := (poids->>'prix_tres_bas')::int; score := score + v_pts;
        raisons := raisons || jsonb_build_object('code', 'prix_tres_bas',
          'detail', format('%s € pour une médiane de %s € sur %s annonces', l.price_cents/100, round(mediane/100), n_comp), 'points', v_pts);
      elsif l.price_cents < mediane * (prix_cfg->>'ratio_bas')::numeric then
        v_pts := (poids->>'prix_bas')::int; score := score + v_pts;
        raisons := raisons || jsonb_build_object('code', 'prix_bas',
          'detail', format('%s € pour une médiane de %s € sur %s annonces', l.price_cents/100, round(mediane/100), n_comp), 'points', v_pts);
      end if;
    else
      raisons := raisons || jsonb_build_object('code', 'prix_non_evalue',
        'detail', format('données insuffisantes (%s comparable%s)', n_comp, case when n_comp > 1 then 's' else '' end), 'points', 0);
    end if;
  end if;

  -- 3. Ancienneté du compte.
  if coalesce((regles->>'compte')::boolean, true) then
    if p.created_at > now() - interval '24 hours' then
      v_pts := (poids->>'compte_jour')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'compte_recent', 'detail', 'compte créé il y a moins de 24 h', 'points', v_pts);
    elsif p.created_at > now() - interval '7 days' then
      v_pts := (poids->>'compte_semaine')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'compte_recent', 'detail', 'compte créé il y a moins de 7 jours', 'points', v_pts);
    end if;
  end if;

  -- 4. Rafale.
  if coalesce((regles->>'rafale')::boolean, true) then
    select count(*) into n_heure from public.listings
     where user_id = l.user_id and created_at > now() - interval '1 hour';
    if n_heure >= (rafale_cfg->>'blocage')::int then
      bloque := true; certitude := 'certain';
      raisons := raisons || jsonb_build_object('code', 'rafale_automatisee', 'detail', format('%s annonces en une heure', n_heure), 'points', 100);
    elsif n_heure >= (rafale_cfg->>'forte')::int then
      v_pts := (poids->>'rafale_forte')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'rafale', 'detail', format('%s annonces en une heure', n_heure), 'points', v_pts);
    elsif n_heure >= (rafale_cfg->>'moderee')::int then
      v_pts := (poids->>'rafale_moderee')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'rafale', 'detail', format('%s annonces en une heure', n_heure), 'points', v_pts);
    end if;
  end if;

  -- 5. Texte copié.
  if coalesce((regles->>'doublons')::boolean, true) then
    if exists (select 1 from public.listings o
                where o.id <> l.id and o.user_id <> l.user_id
                  and lower(o.title) = lower(l.title)
                  and lower(o.description) = lower(l.description)
                  and char_length(l.description) > 40) then
      v_pts := (poids->>'texte_copie_autre')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'texte_copie', 'detail', 'titre et description identiques à une annonce d''un autre compte', 'points', v_pts);
    elsif exists (select 1 from public.listings o
                   where o.id <> l.id and o.user_id = l.user_id and o.status = 'active'
                     and lower(o.title) = lower(l.title)
                     and lower(o.description) = lower(l.description)) then
      v_pts := (poids->>'texte_copie_soi')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'doublon', 'detail', 'annonce identique déjà en ligne sur ce compte', 'points', v_pts);
    end if;
  end if;

  -- 6. Photo réutilisée.
  if coalesce((regles->>'photos')::boolean, true) then
    if exists (select 1 from public.listing_photos a
                join public.listing_photos b on b.content_hash = a.content_hash and b.listing_id <> a.listing_id
                join public.listings lb on lb.id = b.listing_id
               where a.listing_id = l.id and a.content_hash is not null and lb.user_id <> l.user_id) then
      v_pts := (poids->>'photo_reutilisee_autre')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'photo_reutilisee', 'detail', 'photo déjà utilisée par un autre compte', 'points', v_pts);
    elsif exists (select 1 from public.listing_photos a
                   join public.listing_photos b on b.content_hash = a.content_hash and b.listing_id <> a.listing_id
                   join public.listings lb on lb.id = b.listing_id
                  where a.listing_id = l.id and a.content_hash is not null and lb.user_id = l.user_id and lb.status = 'active') then
      v_pts := (poids->>'photo_reutilisee_soi')::int; score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'photo_reutilisee', 'detail', 'photo déjà utilisée sur une autre de ses annonces', 'points', v_pts);
    end if;
  end if;

  -- 7. Contenu des images, tel que l'analyse externe l'a noté.
  if coalesce((regles->>'images')::boolean, true) then
    if exists (select 1 from public.listing_photos where listing_id = l.id and moderation_niveau = 'certain') then
      bloque := true; certitude := 'certain';
      raisons := raisons || jsonb_build_object('code', 'image_explicite', 'detail', 'photo au contenu sexuel explicite', 'points', 100);
      details := details || jsonb_build_object('code', 'image_explicite', 'niveau', 'certain',
        'termes', coalesce((select jsonb_agg(coalesce(moderation->>'resume', 'nudité')) from public.listing_photos where listing_id = l.id and moderation_niveau = 'certain'), '[]'));
    else
      select count(*) into n_img_fort from public.listing_photos where listing_id = l.id and moderation_niveau = 'fort';
      if n_img_fort > 0 then
        v_pts := coalesce((poids->>'image_suspecte')::int, 25); score := score + v_pts;
        if certitude in ('aucun', 'faible') then certitude := 'fort'; end if;
        raisons := raisons || jsonb_build_object('code', 'image_suspecte', 'detail', format('%s photo%s à vérifier', n_img_fort, case when n_img_fort > 1 then 's' else '' end), 'points', v_pts);
        details := details || jsonb_build_object('code', 'image_suspecte', 'niveau', 'fort',
          'termes', coalesce((select jsonb_agg(coalesce(moderation->>'resume', 'image')) from public.listing_photos where listing_id = l.id and moderation_niveau = 'fort'), '[]'));
      end if;
    end if;
  end if;

  -- 8. Contact hors site.
  if coalesce((regles->>'contact')::boolean, true) then
    for terme in select lower(x) from jsonb_array_elements_text(motifs) x loop
      if position(terme in texte) > 0 then
        v_pts := (poids->>'contact_suspect')::int; score := score + v_pts;
        raisons := raisons || jsonb_build_object('code', 'contact_suspect', 'detail', 'invitation à poursuivre hors du site', 'points', v_pts);
        details := details || jsonb_build_object('code', 'contact_suspect', 'termes', jsonb_build_array(terme), 'niveau', 'faible');
        exit;
      end if;
    end loop;
  end if;

  -- 9. Signalements ouverts.
  if coalesce((regles->>'signalements')::boolean, true) then
    select count(*) into n_signal from public.reports where listing_id = l.id and not handled;
    if n_signal > 0 then
      v_pts := least(n_signal * (poids->>'signalement')::int, (poids->>'signalements_max')::int);
      score := score + v_pts;
      raisons := raisons || jsonb_build_object('code', 'signalements', 'detail', format('%s signalement%s en attente', n_signal, case when n_signal > 1 then 's' else '' end), 'points', v_pts);
    end if;
  end if;

  score := least(score, 100);

  -- L'état. Le blocage exige une certitude ; un score très élevé sans
  -- certitude dit « incertain » et va vers un humain, jamais vers un
  -- blocage. Une décision humaine n'est pas renversée.
  if bloque then
    etat := 'blocked';
  elsif l.reviewed_at is not null and l.review_state in ('published', 'watch') then
    etat := l.review_state;
  elsif score >= seuil_bloc then
    etat := 'pending';
    raisons := raisons || jsonb_build_object('code', 'incertain', 'detail', 'score très élevé sans certitude : vérification humaine', 'points', 0);
  elsif score >= (seuils->>'verification')::int then
    etat := 'pending';
  elsif certitude = 'fort' then
    -- Un seul terme fort, même avec un score modeste : quelqu'un regarde.
    etat := 'pending';
  elsif score >= (seuils->>'surveillance')::int then
    etat := 'watch';
  else
    etat := 'published';
  end if;

  update public.listings
     set risk_score = score, risk_reasons = raisons, review_state = etat
   where id = l.id;

  insert into public.moderation_details (listing_id, details, certitude, updated_at)
  values (l.id, details, certitude, now())
  on conflict (listing_id) do update set details = excluded.details, certitude = excluded.certitude, updated_at = now();

  if etat in ('pending', 'blocked') or n_signal > 0 then
    insert into public.moderation_cases (listing_id, source, score, reasons)
    values (l.id, case when n_signal > 0 then 'signalement' else 'auto' end, score, raisons)
    on conflict (listing_id) where status = 'open'
    do update set score = excluded.score, reasons = excluded.reasons,
                  source = case when excluded.source = 'signalement' then 'signalement' else moderation_cases.source end;
  end if;
end $$;

-- La route serveur (clé de service) relance l'évaluation après l'analyse
-- d'une photo.
grant execute on function public.evaluer_annonce(uuid) to service_role;

-- ---------- Messages ----------

-- Avant l'insertion : un compte suspendu n'écrit pas ; un contenu certain
-- est refusé avec un message générique, rien n'est enregistré.
create or replace function public.trg_moderer_message_avant()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  regles  jsonb := public.mod_setting('regles', '{}');
  ana jsonb;
  fin     timestamptz;
begin
  select suspended_until into fin from public.profiles where id = new.sender_id;
  if fin > now() then
    raise exception 'Votre compte est suspendu jusqu''au %.',
      to_char(fin at time zone 'America/Port_of_Spain', 'DD/MM/YYYY à HH24"h"MI');
  end if;
  if coalesce((regles->>'messages')::boolean, true) then
    ana := public.mod_analyser_texte(null, new.body);
    if (ana->>'bloque')::boolean then
      raise exception 'Ce message ne peut pas être envoyé : son contenu ne respecte pas les règles de Ti Kanal.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists moderer_message_avant on public.messages;
create trigger moderer_message_avant
  before insert on public.messages
  for each row execute function public.trg_moderer_message_avant();

-- Les messages qui méritent un regard, sans être refusés.
create table if not exists public.moderation_messages (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid references public.messages(id) on delete cascade,
  conversation_id uuid not null,
  sender_id       uuid not null,
  body            text not null,
  score           integer not null,
  reasons         jsonb not null default '[]',
  details         jsonb not null default '[]',
  status          text not null default 'open' check (status in ('open', 'resolved')),
  decision        text,
  decided_by      uuid,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists idx_mod_messages_open on public.moderation_messages (status, created_at desc);
alter table public.moderation_messages enable row level security;
drop policy if exists "modmsg_admin" on public.moderation_messages;
create policy "modmsg_admin" on public.moderation_messages for select using (public.is_admin());
revoke all on public.moderation_messages from anon, authenticated;
grant select on public.moderation_messages to authenticated;

create or replace function public.trg_moderer_message_apres()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  regles  jsonb := public.mod_setting('regles', '{}');
  seuils  jsonb := public.mod_setting('seuils', '{"verification":61}');
  ana jsonb;
begin
  if not coalesce((regles->>'messages')::boolean, true) then return null; end if;
  ana := public.mod_analyser_texte(null, new.body);
  if (ana->>'certitude') = 'fort' or (ana->>'score')::int >= (seuils->>'verification')::int then
    insert into public.moderation_messages (message_id, conversation_id, sender_id, body, score, reasons, details)
    values (new.id, new.conversation_id, new.sender_id, new.body, (ana->>'score')::int, ana->'raisons', ana->'details');
  end if;
  return null;
end $$;

drop trigger if exists moderer_message_apres on public.messages;
create trigger moderer_message_apres
  after insert on public.messages
  for each row execute function public.trg_moderer_message_apres();

-- ---------- Administration ----------

create or replace function public.admin_file_moderation()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_id',      c.id,
      'source',       c.source,
      'opened_at',    c.opened_at,
      'listing', jsonb_build_object(
        'id', l.id, 'title', l.title, 'description', l.description,
        'module', l.module::text, 'subcategory', l.subcategory,
        'price_cents', l.price_cents, 'status', l.status::text,
        'review_state', l.review_state, 'risk_score', l.risk_score,
        'risk_reasons', l.risk_reasons, 'created_at', l.created_at,
        'photos', coalesce((select jsonb_agg(ph.storage_key order by ph.position)
                              from public.listing_photos ph where ph.listing_id = l.id), '[]')),
      'details',   coalesce((select d.details from public.moderation_details d where d.listing_id = l.id), '[]'),
      'certitude', (select d.certitude from public.moderation_details d where d.listing_id = l.id),
      'auteur', jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'created_at', p.created_at,
        'is_banned', p.is_banned, 'suspended_until', p.suspended_until,
        'email', (select u.email from auth.users u where u.id = p.id),
        'nb_annonces', (select count(*) from public.listings x where x.user_id = p.id),
        'nb_signalements', (select count(*) from public.reports r
                              join public.listings x on x.id = r.listing_id where x.user_id = p.id),
        'nb_retirees', (select count(*) from public.listings x where x.user_id = p.id and x.status = 'removed'),
        'nb_decisions_contre', (select count(*) from public.moderation_decisions d
                                  join public.listings x on x.id = d.listing_id
                                 where x.user_id = p.id and d.decision in ('masquer','supprimer','suspendre','bannir'))),
      'signalements', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'motif', r.motif, 'reason', r.reason,
                 'created_at', r.created_at,
                 'par', (select display_name from public.profiles where id = r.reporter_id))
               order by r.created_at desc)
          from public.reports r where r.listing_id = l.id and not r.handled), '[]')
    ) order by l.risk_score desc, c.opened_at)
    from public.moderation_cases c
    join public.listings l on l.id = c.listing_id
    join public.profiles p on p.id = l.user_id
    where c.status = 'open'
  ), '[]'::jsonb);
end $$;

-- « Erreur de détection » : l'annonce est publiée, et la décision porte la
-- marque du faux positif — c'est elle qui servira à recaler le lexique.
create or replace function public.admin_decider(
  p_case_id   uuid,
  p_decision  text,
  p_note      text default null,
  p_jours     int  default 7
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.moderation_cases;
  l public.listings;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select * into c from public.moderation_cases where id = p_case_id and status = 'open';
  if c.id is null then raise exception 'Dossier introuvable ou déjà traité.'; end if;
  select * into l from public.listings where id = c.listing_id;

  insert into public.moderation_decisions (case_id, listing_id, decided_by, decision, score_avant, reasons, note, faux_positif)
  values (c.id, c.listing_id, auth.uid(), p_decision, c.score, c.reasons, nullif(btrim(coalesce(p_note, '')), ''), p_decision = 'erreur');

  case p_decision
    when 'publier', 'maintenir', 'erreur' then
      update public.listings set review_state = 'published', moderation_note = null, reviewed_at = now()
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'masquer' then
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now(),
             moderation_note = coalesce(nullif(btrim(p_note), ''), 'Annonce retirée par la modération.')
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'supprimer' then
      delete from public.listings where id = c.listing_id;
    when 'demander_modification' then
      update public.listings set review_state = 'pending', reviewed_at = null,
             moderation_note = coalesce(nullif(btrim(p_note), ''), 'Merci de compléter ou corriger votre annonce.')
       where id = c.listing_id;
    when 'suspendre' then
      update public.profiles set suspended_until = now() + make_interval(days => greatest(1, coalesce(p_jours, 7)))
       where id = l.user_id;
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now(),
             moderation_note = 'Annonce retirée par la modération.'
       where id = c.listing_id;
      update public.reports set handled = true where listing_id = c.listing_id and not handled;
    when 'bannir' then
      update public.profiles set is_banned = true where id = l.user_id;
      update public.listings set status = 'removed', review_state = 'published', reviewed_at = now()
       where user_id = l.user_id and status = 'active';
      update public.reports set handled = true where listing_id in (select id from public.listings where user_id = l.user_id) and not handled;
    else
      raise exception 'Décision inconnue.';
  end case;

  update public.moderation_cases set status = 'resolved', resolved_at = now() where id = c.id;

  if to_regclass('public.admin_audit_log') is not null then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'moderation_' || p_decision, 'listing', c.listing_id,
            jsonb_build_object('score', c.score, 'note', p_note, 'auteur', l.user_id));
  end if;
end $$;

-- Les messages signalés, avec de quoi juger : qui, à qui, sur quelle annonce.
create or replace function public.admin_messages_signales()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'message_id', m.message_id, 'body', m.body, 'score', m.score,
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
      delete from public.messages where id = m.message_id;
    when 'suspendre' then
      delete from public.messages where id = m.message_id;
      update public.profiles set suspended_until = now() + make_interval(days => greatest(1, coalesce(p_jours, 7)))
       where id = m.sender_id;
    when 'bannir' then
      delete from public.messages where id = m.message_id;
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
    values (auth.uid(), 'moderation_message_' || p_decision, 'message', m.message_id,
            jsonb_build_object('score', m.score, 'expediteur', m.sender_id));
  end if;
end $$;

-- Réévaluer les annonces en ligne après un changement de réglage ou de
-- lexique. Volontaire, jamais automatique : on choisit le moment.
-- Les annonces déjà tranchées par un humain gardent leur état.
create or replace function public.admin_reevaluer()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  attente int := 0;
  retenues int := 0;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  for r in select id from public.listings where status = 'active' loop
    perform public.evaluer_annonce(r.id);
    n := n + 1;
  end loop;
  select count(*) filter (where review_state = 'pending'), count(*) filter (where review_state = 'blocked')
    into attente, retenues from public.listings where status = 'active';
  return jsonb_build_object('evaluees', n, 'en_attente', attente, 'retenues', retenues);
end $$;

-- Tester une phrase, pour régler le lexique sans publier d'annonce.
create or replace function public.admin_tester_texte(p_texte text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return public.mod_analyser_texte(null, p_texte) || jsonb_build_object('normalise', public.mod_normaliser(p_texte));
end $$;

-- ---------- Droits ----------

revoke all on function public.mod_normaliser(text)              from public, anon, authenticated;
revoke all on function public.mod_serrer(text)                  from public, anon, authenticated;
revoke all on function public.mod_contient(text, text)          from public, anon, authenticated;
revoke all on function public.mod_analyser_texte(text, text)    from public, anon, authenticated;
revoke all on function public.admin_messages_signales()         from public;
revoke all on function public.admin_decider_message(uuid, text, int) from public;
revoke all on function public.admin_reevaluer()                 from public;
revoke all on function public.admin_tester_texte(text)          from public;
grant execute on function public.admin_messages_signales()      to authenticated;
grant execute on function public.admin_decider_message(uuid, text, int) to authenticated;
grant execute on function public.admin_reevaluer()              to authenticated;
grant execute on function public.admin_tester_texte(text)       to authenticated;

-- Vérification (SQL Editor) :
-- select public.mod_normaliser('M4ss4ge  s.e.n.s.u.e.l  disc®et');
-- select count(*) from public.moderation_lexique;
