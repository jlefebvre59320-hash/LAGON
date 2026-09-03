# Mise en production — Ti Kanal

Le pas-à-pas complet, dans l'ordre. Les étapes 1 à 3 sont **bloquantes**
(sans elles, des inscriptions échoueront en silence) ; le reste peut se
faire après le lancement.

---

## 1. Le domaine — ✅ fait

**`tikanal.com`**, acheté chez Cloudflare Registrar. C'est l'adresse
officielle du site : elle est inscrite dans `src/lib/siteUrl.ts` et alimente
les métadonnées, le sitemap, robots.txt, le JSON-LD et les liens de partage.

La **zone DNS se gère chez Cloudflare** (dash.cloudflare.com → le domaine →
DNS → Records) : c'est là que se posent les enregistrements des étapes 2 et 4.

## 2. SMTP dédié avec Resend (le point critique)

> **Version détaillée : [`SMTP.md`](./SMTP.md)** — SPF/DKIM/DMARC pas à pas,
> sous-domaine d'envoi, tests de délivrabilité et dépannage. Le résumé
> ci-dessous suffit pour un premier branchement ; le document dédié est à
> suivre pour un envoi vraiment solide.

Sans cela, Supabase limite les emails à ~2 par heure : les confirmations
d'inscription se perdent en silence dès le deuxième inscrit de l'heure.

1. Créez un compte sur **resend.com** (gratuit jusqu'à 3 000 emails/mois,
   largement assez pour démarrer).
2. **Domains → Add Domain** → `tikanal.com`, région **Ireland (eu-west-1)**,
   Custom Return-Path `send`, click tracking **décoché**.
3. Resend affiche 3–4 enregistrements DNS à créer (SPF, DKIM, éventuellement
   MX de retour). Recopiez-les **exactement** dans votre zone DNS,
   puis cliquez **Verify** dans Resend. La vérification prend de quelques
   minutes à une heure.
4. **API Keys → Create API Key** (permission « Sending access » suffit).
   Copiez la clé : c'est le mot de passe SMTP.
5. Dans **Supabase → Project Settings → Authentication → SMTP Settings**
   (section « Custom SMTP ») :
   - Enable Custom SMTP : **activé**
   - Sender email : `no-reply@tikanal.com`
   - Sender name : `Ti Kanal`
   - Host : `smtp.resend.com`
   - Port : `465`
   - Username : `resend`
   - Password : la clé API Resend
   - Save.
6. Toujours dans Supabase : **Authentication → Rate Limits** → montez
   « Emails sent per hour » (2 par défaut) à **50 ou 100**.
7. Ajoutez un enregistrement **DMARC** (recommandé, améliore la
   délivrabilité) : TXT sur `_dmarc.tikanal.com` →
   `v=DMARC1; p=none; rua=mailto:dmarc@tikanal.com`.
8. **Test** : créez un compte avec une adresse à vous → l'email doit
   arriver en quelques secondes, expéditeur `no-reply@tikanal.com`.
   Vérifiez aussi « mot de passe oublié ».

## 3. URLs d'authentification Supabase

Les liens des emails pointent vers cette configuration — si elle reste sur
l'ancienne adresse, les confirmations redirigeront au mauvais endroit.

**Supabase → Authentication → URL Configuration** :
- **Site URL** : `https://tikanal.com`
- **Redirect URLs** : ajoutez `https://tikanal.com/**`
  **et gardez** `https://lagon-orcin.vercel.app/**` (l'adresse Vercel
  reste accessible).

## 4. Brancher le domaine sur Vercel

1. **Vercel → projet `lagon` → Settings → Domains → Add** →
   `tikanal.com` (+ `www.tikanal.com` en redirection).
   Vercel indique l'enregistrement DNS à créer (A `76.76.21.21` ou CNAME
   `cname.vercel-dns.com`) — ajoutez-le dans la zone DNS.
2. **Settings → Environment Variables** → ajoutez
   `NEXT_PUBLIC_SITE_URL` = `https://tikanal.com` (Production).
3. **Redeploy** (Deployments → ⋯ → Redeploy). Sitemap, robots, métadonnées
   et JSON-LD suivent automatiquement — l'URL n'est plus écrite en dur
   nulle part (`src/lib/siteUrl.ts`).

## 5. Emails aux couleurs Ti Kanal

Les modèles sont dans `supabase/email-templates/` :

| Fichier | Modèle Supabase | Objet conseillé |
|---|---|---|
| `confirmation.html` | Confirm signup | Confirmez votre compte Ti Kanal |
| `magic-link.html` | Magic Link | Votre lien de connexion Ti Kanal |
| `reset-password.html` | Reset Password | Réinitialisez votre mot de passe Ti Kanal |
| `email-change.html` | Change Email Address | Confirmez votre nouvelle adresse email |

**Supabase → Authentication → Email Templates** → pour chaque modèle,
remplacez l'objet et collez le contenu HTML du fichier correspondant.

## 6. Nettoyage des données de test

- Exécutez `remise_a_neuf_prod_v2.sql` (déjà fourni) dans le SQL Editor —
  puis videz le bucket `photos` depuis Storage (Supabase interdit sa
  suppression par SQL) :
  annonces, photos, favoris, votes, signalements, retours et stats → zéro ;
  les 54 fiches restaurants et votre compte admin sont conservés.
- **Authentication → Users** : supprimez les comptes de test
  (gardez votre compte admin).

## 6 bis. Modération des photos (Sightengine)

Le texte des annonces et des messages est filtré par la base (migrations
0032 et 0033), sans rien à configurer. L'analyse des **photos** passe par un
service externe, Sightengine, gratuit jusqu'à 500 images par mois :

1. Compte sur **sightengine.com** → **API keys** : notez l'API user et
   l'API secret.
2. **Vercel → Settings → Environment Variables** (Production) :
   `SIGHTENGINE_USER` et `SIGHTENGINE_SECRET`. Sans préfixe `NEXT_PUBLIC_`.
3. **Redeploy**.

Sans ces deux variables, la route `/api/moderer-photo` ne fait rien et la
modération continue avec le texte seul. Les seuils (nudité, arme, drogue,
violence, symbole haineux) se règlent dans Administration › Modération ›
Réglages, et l'interrupteur « Analyse des photos » coupe le tout.

## 7. Après le lancement (non bloquant)

- **Mentions légales** : remplir les champs entre [crochets] dans
  `src/app/mentions-legales/page.tsx` et `src/app/confidentialite/page.tsx`
  (éditeur, hébergeur, contact).
- **Google Search Console** : ajouter le domaine, soumettre
  `https://tikanal.com/sitemap.xml`.
- **Photos de cuisines** : déposer les 14 JPG libres de droits dans
  `public/cuisines/` (liste des slugs dans le README).
- Supprimer le projet Vercel `st-barth-food` s'il existe encore.
- Renommer le dépôt GitHub en `ti-kanal` (Settings → General → Rename).

## Checklist finale avant d'annoncer le site

- [ ] Un compte neuf reçoit son email de confirmation en < 1 minute
- [ ] « Mot de passe oublié » fonctionne
- [ ] Déposer une annonce avec 2 photos fonctionne (compression comprise)
- [ ] La fiche d'un restaurant s'ouvre, le vote étoiles fonctionne
- [ ] `https://tikanal.com/sitemap.xml` répond
- [ ] Base vidée des données de test
- [ ] Mentions légales complétées
