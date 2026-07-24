# LAGON — Petites annonces Saint-Barthélemy

4 univers : Véhicules & Nautisme, Immobilier, Emploi & Services, Achats & Ventes.
Next.js 15 (App Router) + Supabase (Postgres, Auth par lien magique, Storage photos).

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
src/lib/taxonomy.ts                 Modules, sous-catégories, champs dynamiques (source unique)
src/lib/supabase.ts                 Client Supabase (navigateur)
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
