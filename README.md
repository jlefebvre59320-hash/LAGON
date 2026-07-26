# La famille St Barth — Ti Kanal · St Barth Event · St Barth Food

Un seul code, une charte commune, trois sites : les annonces (Ti Kanal),
l'agenda (St Barth Event, à venir) et les restaurants (St Barth Food).
Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage) — base commune,
compte unique valable sur les trois sites.

Une seule application, une seule adresse : Ti Kanal est le site, St Barth Food
vit sous `/food` et St Barth Event sous `/event` (page d'attente). Chaque
section a sa marque et ses couleurs — un bloc `[data-site="…"]` dans
`globals.css`, posé par le layout de la section. Le sélecteur « Nos sites » du
bandeau navigue entre les sections. Un seul projet Vercel suffit ; la variable
`NEXT_PUBLIC_SITE` n'existe plus.

## Ti Kanal — petites annonces

4 univers : Véhicules & Nautisme, Immobilier, Emploi & Services, Achats & Ventes.

## St Barth Food — annuaire des restaurants

Présentation et mise en relation, sans livraison ni paiement : cartes avec badge
ouvert/fermé calculé sur l'heure de l'île, filtres cuisine / quartier / ouvert
maintenant / à emporter, fiche avec horaires, itinéraire et boutons Appeler /
WhatsApp. Pas de photos en v1 — on ne publie que des faits (nom, adresse,
horaires…), jamais les visuels d'un établissement sans son accord.

Chaque fiche porte un lien « C'est votre établissement ? » : revendication,
correction ou demande de retrait, sans compte requis (`restaurant_claims`,
lisible par l'administration). Les fiches sont pré-remplies par l'administration
(`restaurants.owner_id` vide), puis remises au restaurateur quand il les
revendique.

Vignettes : chaque cuisine a une scène illustrée à ses couleurs. Pour la
remplacer par une vraie photo, déposer un JPG **libre de droits** dans
`public/cuisines/<slug>.jpg` — slugs : `francais`, `creole-caribeen`,
`italien`, `poissons-fruits-de-mer`, `grillades-viandes`, `sushi-asiatique`,
`pizza`, `burgers-snack`, `salades-healthy`, `cafe-brunch`,
`glaces-desserts`, `food-truck`, `traiteur`, `tapas-cocktails`. La photo
prend le dessus automatiquement, aucun code à changer. Jamais la photo d'un
établissement sans son accord écrit.

Amorçage : `supabase/seed_restaurants_osm.sql` contient ~54 fiches extraites
d'OpenStreetMap (licence ODbL — l'attribution obligatoire est dans le pied de
page du site food). **À relire avant exécution** (établissements fermés
possibles, cuisines « À classer », quartiers déduits de la position), et à
exécuter une seule fois : le script n'a pas de garde-fou anti-doublon.

## Charte graphique

Reprise du logo Ti Kanal : contour de Saint-Barthélemy en filet or, sérif haute
densité, capitales très espacées.
Tokens dans `src/app/globals.css`, marque vectorielle dans `src/components/Brand.tsx`.

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Vert lagon | `#05282c` (`--green`) | bandeaux, pied de page, boutons principaux |
| Or sable | `#c9a86a` (`--gold`) | filets, sur-titres, CTA sur fond vert |
| Or profond | `#8a6a2a` (`--gold-deep`) | seul or lisible sur fond clair (≥ 4.5:1) |
| Crème | `#f6f2e9` (`--cream`) | fond de page |
| Encre | `#16292b` (`--text`) | texte courant |

Typographie : **Playfair Display** (marque, titres, prix) + **Inter** (interface).
Capitales très espacées (`.overline`, `letter-spacing: .32em`) pour les sur-titres.

Couleurs d'univers (`src/lib/taxonomy.ts`) : déclinaisons de la charte — lagon
`#12626d`, bronze `#96691d`, palme `#2f6b4f`, terre cuite `#a04e30`. Chacune passe
4.5:1 sur blanc, avec une variante `dark` pour le texte sur fond `soft`.

Le logo fourni sert d'icône et d'image de partage : `src/app/icon.png`,
`apple-icon.png`, `opengraph-image.jpg`, et `public/logo-ti-kanal.jpg`.

## Mobile

Le site est construit mobile-first (le trafic d'une petite annonce locale est
presque entièrement téléphone) :

- `viewport` avec `viewport-fit=cover` + `themeColor` vert, zoom utilisateur conservé ;
- champs à `font-size: 16px` — en dessous, Safari iOS zoome automatiquement à la saisie ;
- cibles tactiles ≥ 44 px (`.btn`, `.tab`, `.chip`) ;
- grille 2 colonnes sous 560 px, `auto-fill` au-delà ;
- onglets et filtres en défilement horizontal avec accroche (`scroll-snap`), barre masquée ;
- bouton flottant « + Déposer » sur mobile (masqué ≥ 720 px, où le bouton du bandeau prend le relais) ;
- barre de contact WhatsApp collée en bas de la fiche annonce, à portée de pouce ;
- respect de `env(safe-area-inset-*)` (encoche et barre gestuelle iOS).

## Installation

### 1. Créer le projet Supabase
- Créer un compte sur https://supabase.com et un nouveau projet (région : `eu-west-3` Paris, la plus proche des Antilles avec de bonnes latences transatlantiques).
- Dans **SQL Editor**, exécuter dans l'ordre les migrations de
  `supabase/migrations/` (0001 → 0008).
  Le premier crée les tables (profiles, listings, listing_photos, reports), les index,
  toutes les policies RLS, le bucket `photos` et le quota anti-spam (10 annonces actives/utilisateur).
  Le second reprend le nom affiché saisi à l'inscription ; il est rejouable sans risque.

### 2. Configurer l'authentification

Les comptes se créent avec **email + mot de passe** (8 caractères minimum),
avec mot de passe oublié, et un lien magique par email en secours.

- **Authentication → Providers → Email** : activé, avec *Confirm email* — un
  compte n'est utilisable qu'après clic sur le lien de confirmation. C'est ce
  qui empêche l'inscription avec l'adresse de quelqu'un d'autre. Si vous le
  désactivez, la connexion est immédiate après inscription (le code gère les
  deux cas), mais n'importe quelle adresse inventée devient utilisable.
- **Authentication → URL Configuration** : renseigner *Site URL* et ajouter
  dans *Redirect URLs* l'URL de production **et** `http://localhost:3000`.
  Les emails de confirmation et de réinitialisation pointent vers ces URLs ;
  sans elles, les liens ramènent sur `localhost` et ne fonctionnent pour personne.
- **Authentication → Providers → Email → Minimum password length** : mettre 8,
  pour coller à ce que le formulaire annonce à l'utilisateur.
- En production, configurer un SMTP dédié (Resend, Brevo…) : le SMTP par défaut
  de Supabase est limité à quelques emails/heure — largement insuffisant dès que
  chaque inscription et chaque oubli de mot de passe déclenchent un envoi.

### 3. Variables d'environnement
```
cp .env.example .env.local
```
Remplir avec les valeurs de **Settings → API** du projet Supabase :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Lancer
```
npm install
npm run dev
```
→ http://localhost:3000

## Mise en ligne

Le site est une application Next.js 15 : il lui faut un hébergeur qui exécute
Node (Vercel, Netlify, Cloudflare Workers…), pas un simple hébergement de
fichiers statiques. La fiche annonce `/annonce/[id]` est une route dynamique,
elle ne peut pas être pré-générée en export statique.

### Vercel (le plus direct, éditeur de Next.js)

1. https://vercel.com → **Add New… → Project** → importer le dépôt GitHub.
2. Rien à configurer : framework détecté, `npm run build` par défaut.
3. **Settings → Environment Variables**, pour *Production* et *Preview* :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Ces deux valeurs sont publiques par nature (préfixe `NEXT_PUBLIC_`, envoyées
   au navigateur) ; c'est le RLS Supabase qui protège les données, jamais le
   secret de la clé. Ne jamais mettre la `service_role` ici.
4. **Deploy**. Chaque push sur la branche par défaut redéploie ; les autres
   branches donnent une URL de préversion.

### Après le premier déploiement (obligatoire, sinon la connexion échoue)

Dans Supabase → **Authentication → URL Configuration** :
- *Site URL* : l'URL de production (ex. `https://ti-kanal.vercel.app`) ;
- *Redirect URLs* : ajouter cette même URL **et** `http://localhost:3000`.

Le lien magique pointe sinon vers `localhost` et ne fonctionne pas pour les
utilisateurs. Prévoir aussi un SMTP dédié (Resend, Brevo) : le SMTP par défaut
de Supabase est limité à quelques emails par heure.

### Nom de domaine

Vercel → **Settings → Domains** → ajouter le domaine, puis créer chez le
registrar l'enregistrement affiché (`A` sur la racine, `CNAME` sur `www`).
Le certificat HTTPS est émis automatiquement. Penser à remettre à jour l'URL
du site dans Supabase après le changement de domaine.

## Structure

```
supabase/migrations/0001_init.sql   Schéma complet + RLS + storage
supabase/migrations/0002_auth_password.sql  Nom affiché repris à l'inscription
supabase/migrations/0003_intent.sql Sens de l'annonce : proposition ou recherche
supabase/migrations/0004_favoris_stats.sql  Favoris, fréquentation, droits admin
supabase/migrations/0005_profiles_colonnes.sql  Lecture de profiles colonne par colonne
supabase/migrations/0006_restaurants.sql    Restaurants + demandes des établissements
src/lib/sites.ts                    La famille de sites (marque, couleurs, URLs)
src/lib/food.ts                     Cuisines, quartiers, horaires (heure de l'île)
src/components/SiteSwitcher.tsx     Bascule entre les sites de la famille
src/components/food/                Accueil et cartes St Barth Food
src/app/resto/[id]/page.tsx         Fiche restaurant + revendication
src/lib/session.ts                  Session courante (hook useSession)
src/lib/favorites.tsx               Favoris chargés une fois pour toute la page
src/lib/analytics.ts                Enregistrement des pages vues
src/app/mon-espace/page.tsx         Mes annonces (avec stats) et mes favoris
src/app/stats/page.tsx              Tableau de bord du site (administrateurs)
src/lib/taxonomy.ts                 Modules, sous-catégories, champs dynamiques + couleurs
src/lib/supabase.ts                 Client Supabase (navigateur)
src/app/globals.css                 Charte graphique (tokens, composants, breakpoints)
src/components/Brand.tsx            Marque : île en SVG (2 niveaux de détail), verrouillage typo, bandeau
src/app/page.tsx                    Accueil : onglets modules, chips, recherche, filtre prix
src/app/annonce/[id]/page.tsx       Fiche annonce : photos, détails, WhatsApp, signalement
src/app/deposer/page.tsx            Dépôt en 3 étapes, champs par catégorie, upload photos
src/app/connexion/page.tsx          Compte : inscription, connexion, mot de passe oublié
```

## Compte, favoris et statistiques

- **Accès au compte** en haut à droite de toutes les pages : *Se connecter* si on
  ne l'est pas, *Mon espace* sinon. Le dépôt d'annonce continue de rediriger vers
  la connexion, inscription comprise.
- **Favoris** : cœur sur chaque carte et sur la fiche annonce, retrouvés dans
  *Mon espace → Mes favoris*. Un visiteur non connecté qui appuie sur un cœur est
  envoyé vers la page de connexion.
- **Mes annonces** : statut, vues, visiteurs uniques, mises en favori, et les
  actions *Marquer vendu* / *Remettre en ligne* / *Supprimer*.
- **Fréquentation** : chaque page vue est enregistrée dans `page_views` avec un
  `viewer_key` — un identifiant aléatoire tiré dans le navigateur, sans lien avec
  un compte, qui sert uniquement à ne pas compter dix fois la même personne.

### Ce qu'un annonceur voit — et ce qu'il ne voit pas

Un annonceur voit **combien** de personnes ont consulté son annonce, jamais
**qui**. La table des favoris n'est lisible que par son propriétaire, et
`my_listings_stats()` ne rend que des compteurs, pour ses propres annonces.
Publier l'identité des visiteurs d'une petite annonce serait à la fois une faute
vis-à-vis du RGPD et un très bon moyen de faire fuir les acheteurs.

### Créer le compte administrateur

Il n'y a pas de compte administrateur livré avec le site — un mot de passe écrit
dans le code serait le premier trou de sécurité venu. On promeut un compte
existant :

1. Créer un compte normal depuis le site (par exemple `admin@ti-kanal.fr`) et
   confirmer l'email.
2. Dans Supabase → **SQL Editor**, exécuter une fois :

```sql
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'admin@ti-kanal.fr');
```

3. Se reconnecter : *Mon espace* affiche alors le bouton **Statistiques du site**.

Tout est verrouillé côté base, pas seulement côté écran : `site_stats()` refuse de
répondre à un non-administrateur, la table `page_views` n'est lisible que par un
administrateur, et la colonne `is_admin` est retirée de la lecture publique
(migration `0005`) pour que personne ne puisse lister les administrateurs du site.
Le contrôle passe par `is_admin()`, qui ne répond que pour l'appelant.

## Proposition ou recherche

Chaque annonce porte un sens (`listings.intent`) : `offer` (je vends / je propose)
ou `wanted` (je recherche). Il vaut pour les quatre univers — on cherche un
logement comme on cherche une perceuse — et se choisit en premier au dépôt.

- Vocabulaire par univers dans `INTENT_LABEL` (`src/lib/taxonomy.ts`) : on ne
  « vend » pas une location saisonnière ni un poste, d'où « Je propose ».
- Sur les cartes et la fiche, seule une recherche porte une pastille : une
  proposition est le cas courant, l'étiqueter n'apprendrait rien.
- Le prix d'une recherche s'affiche comme un **budget**.
- Filtre *Afficher : Tout · Propositions · Recherches* sur l'accueil et dans
  chaque univers.
- Les annonces créées avant la migration `0003` sont des propositions (défaut SQL).

## Ajouter un critère à une catégorie

Tout se fait dans `src/lib/taxonomy.ts`, fonction `fieldsFor()` :
ajouter une ligne `{ k: "Libellé", t: "select", o: ["Oui","Non"], adv: true }`.
`adv: true` = replié derrière « Plus de détails » au dépôt.
Aucune migration nécessaire : les valeurs vont dans la colonne JSONB `attrs`.

## Sécurité (déjà en place)

- RLS activé sur toutes les tables : seules les annonces `active` sont lisibles publiquement,
  chaque utilisateur ne peut écrire que ses propres annonces/photos.
- Bucket photos : lecture publique, écriture limitée au dossier `{user_id}/` de chacun,
  5 Mo max, jpeg/png/webp uniquement.
- Quota : 10 annonces actives max par compte (trigger SQL).
- Les utilisateurs bannis (`profiles.is_banned`) ne peuvent plus publier.

## Reste à faire avant lancement public (par ordre de priorité)

0. **SMTP dédié** (Resend/Brevo + SPF/DKIM/DMARC) : sans lui, les emails de
   confirmation ne partent pas de façon fiable — bloquant pour toute inscription.
0bis. **Notifications** (à brancher plus tard, demandé) : prévenir un vendeur
   d'un favori ou d'un message, un restaurateur d'une note — email d'abord,
   push ensuite. Rien n'existe encore.
0ter. **St Barth Event** : construire la section (page d'attente en place).
   Pas de base ouverte d'évènements : sources = partenariats (comité du
   tourisme, associations, organisateurs) et saisie directe.

1. **Expiration automatique** : activer pg_cron (extension Supabase) et décommenter
   le `cron.schedule` en fin de migration, ou appeler la requête via un cron externe.
2. **Modération** : back-office admin (lecture de `reports`, passage d'annonces en
   `removed`, bannissement). V1 possible directement dans le Table Editor Supabase.
3. **Compression des images côté client** avant upload (une photo de téléphone fait
   4-8 Mo ; recompresser en WebP ~1600px divise le poids par 10). Lib : browser-image-compression.
4. **Mes annonces** : page de gestion (marquer vendu, renouveler, supprimer).
5. **Mentions légales, CGU, politique de confidentialité** (obligations LCEN + RGPD).
6. **SEO** : les pages sont en rendu client (choix v1 pour la simplicité) ; passer la
   fiche annonce en Server Component quand le trafic organique deviendra un enjeu.
7. **Rate limiting** sur la création de comptes (protection Supabase Auth ou Cloudflare Turnstile).
