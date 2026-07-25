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
