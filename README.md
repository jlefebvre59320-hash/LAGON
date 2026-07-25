# Ti Kanal — Échanges & petites annonces · St Barth

4 univers : Véhicules & Nautisme, Immobilier, Emploi & Services, Achats & Ventes.
Next.js 15 (App Router) + Supabase (Postgres, Auth par lien magique, Storage photos).

## Charte graphique

Reprise du logo Ti Kanal (cadre filet or, feuille de lagon, sérif haute densité).
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
- Dans **SQL Editor**, coller et exécuter le contenu de `supabase/migrations/0001_init.sql`.
  Ce script crée les tables (profiles, listings, listing_photos, reports), les index,
  toutes les policies RLS, le bucket `photos` et le quota anti-spam (10 annonces actives/utilisateur).

### 2. Configurer l'authentification
- Dans **Authentication → Providers**, vérifier que Email est activé (lien magique, pas de mot de passe).
- Dans **Authentication → URL Configuration**, ajouter l'URL du site
  (en dev : `http://localhost:3000`) dans *Site URL* et *Redirect URLs*.
- En production, configurer un SMTP dédié (Resend, Brevo…) : le SMTP par défaut
  de Supabase est limité à quelques emails/heure, insuffisant dès les premiers utilisateurs.

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
src/lib/taxonomy.ts                 Modules, sous-catégories, champs dynamiques + couleurs
src/lib/supabase.ts                 Client Supabase (navigateur)
src/app/globals.css                 Charte graphique (tokens, composants, breakpoints)
src/components/Brand.tsx            Marque : logo SVG, verrouillage typo, bandeau partagé
src/app/page.tsx                    Accueil : onglets modules, chips, recherche, filtre prix
src/app/annonce/[id]/page.tsx       Fiche annonce : photos, détails, WhatsApp, signalement
src/app/deposer/page.tsx            Dépôt en 3 étapes, champs par catégorie, upload photos
src/app/connexion/page.tsx          Connexion par lien magique email
```

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
