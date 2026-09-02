# SMTP solide — Ti Kanal

Objectif : que **100 %** des emails de confirmation, de réinitialisation et
(bientôt) d'alerte arrivent en boîte de réception, pas en spam, et jamais
en silence.

Comptez **1 heure** de mise en place, puis 15 minutes de vérification le
lendemain.

---

## Pourquoi c'est le point critique

Par défaut, Supabase envoie les emails via son serveur mutualisé :
- **2 emails par heure maximum** (limite dure) ;
- expéditeur `noreply@mail.app.supabase.io`, inconnu des filtres anti-spam ;
- au-delà du quota, **l'inscription échoue sans message clair** : la personne
  ne reçoit rien, ne comprend pas, et ne revient pas.

C'est LE risque numéro un au lancement : le jour où le site est partagé sur
WhatsApp, il y aura plus de 2 inscriptions dans l'heure.

---

## Étape 1 — Le domaine — ✅ fait

**`tikanal.com`**, chez **Cloudflare Registrar**. La zone DNS se gère donc
sur dash.cloudflare.com → `tikanal.com` → **DNS → Records** : c'est là que
tous les enregistrements ci-dessous se posent.

> **Où vivent les enregistrements**
> Les emails partent de `no-reply@tikanal.com` — une adresse lisible, qui
> inspire confiance. L'isolation technique passe par le **Custom Return-Path**
> de Resend, réglé sur `send` : les rebonds et le SPF vivent donc sur
> `send.tikanal.com`, tandis que la signature DKIM et la politique DMARC
> sont sur `tikanal.com`.
>
> Rien à créer à la main : l'intégration Cloudflare de Resend pose tous ces
> enregistrements pour vous (sauf le DMARC, voir étape 3).

---

## Étape 2 — Resend

1. Compte sur **resend.com** — le palier gratuit (3 000 emails/mois,
   100/jour) couvre largement le lancement.
2. **Domains → Add Domain** → `tikanal.com`.
   Dans **Advanced options** : région **Ireland (eu-west-1)** — les données
   restent en Europe ; **Custom Return-Path** `send` ; et **décochez
   « Enable click tracking »** (sur un email de confirmation, réécrire le
   lien d'activation via un domaine de redirection nuit à la délivrabilité
   et ajoute un point de panne sur le lien le plus critique du site).
3. Utilisez le bouton **Auto configure** : Resend crée directement les
   enregistrements chez Cloudflare, sans risque de faute de frappe. S'il
   signale un conflit avec un enregistrement existant, vérifiez qu'il ne
   s'agit que de résidus d'une configuration précédente avant d'autoriser.
4. **Verify** dans Resend. Compte quelques minutes à 1 heure.
5. **API Keys → Create API Key**, permission **Sending access** uniquement,
   et si proposé, restreinte à votre domaine. Copiez la clé
   (elle ne s'affiche qu'une fois) — c'est votre mot de passe SMTP.

---

## Étape 3 — Les trois piliers de l'authentification

C'est ce qui sépare un SMTP « qui marche » d'un SMTP **solide**. Les deux
premiers sont fournis par Resend, le troisième est à vous d'ajouter.

### SPF — qui a le droit d'envoyer

Resend fournit un enregistrement TXT à mettre sur le domaine d'envoi.
Ressemble à : `v=spf1 include:amazonses.com ~all`

⚠️ **Un seul enregistrement SPF par domaine.** Si vous en avez déjà un
(Google Workspace, Microsoft 365…), ne créez pas un second : fusionnez les
`include:` dans la même ligne. Deux SPF = SPF invalide = spam.

### DKIM — la signature cryptographique

Resend fournit un ou plusieurs enregistrements (souvent
`resend._domainkey`). Rien à décider, juste à copier fidèlement — une seule
lettre manquante casse la signature.

### DMARC — la politique (l'étape que tout le monde oublie)

À créer vous-même, TXT sur `_dmarc.tikanal.com` :

**Au démarrage** (on observe sans rien bloquer) :
```
v=DMARC1; p=none; rua=mailto:jl@solutech.com; fo=1
```

**Après 2–4 semaines**, si les rapports sont propres, on durcit :
```
v=DMARC1; p=quarantine; pct=100; rua=mailto:jl@solutech.com
```

**À terme** (protection maximale contre l'usurpation de votre nom) :
```
v=DMARC1; p=reject; rua=mailto:jl@solutech.com
```

> Passer directement à `p=reject` sans période d'observation est le meilleur
> moyen de faire disparaître ses propres emails. Respectez les paliers.

### En bonus : MX de retour et enregistrement de suivi

Si Resend propose un MX (`send.` → `feedback-smtp…amazonses.com`) et un
enregistrement de tracking, ajoutez-les : ils permettent de recevoir les
retours de rebond et de savoir quelles adresses sont mortes.

---

## Étape 4 — Brancher Supabase

**Supabase → Project Settings → Authentication → SMTP Settings**, section
*Custom SMTP* :

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | **activé** |
| Sender email | `no-reply@tikanal.com` |
| Sender name | `Ti Kanal` |
| Host | `smtp.resend.com` |
| Port | **465** (SSL) — si bloqué, `587` en STARTTLS |
| Username | `resend` (littéralement ce mot) |
| Password | votre clé API Resend |

**Save**, puis **Authentication → Rate Limits** :
- « Emails sent per hour » : passez de 2 à **100**.

> Le mot de passe SMTP est la clé API : ne la mettez jamais dans le dépôt
> GitHub, dans une capture d'écran publique, ni dans un fichier `.env`
> versionné. Elle vit uniquement dans Supabase et dans votre gestionnaire de
> mots de passe.

---

## Étape 5 — Les modèles d'emails

**Supabase → Authentication → Email Templates**, coller le contenu de
`supabase/email-templates/` :

| Fichier | Modèle | Objet conseillé |
|---|---|---|
| `confirmation.html` | Confirm signup | Confirmez votre compte Ti Kanal |
| `magic-link.html` | Magic Link | Votre lien de connexion Ti Kanal |
| `reset-password.html` | Reset Password | Réinitialisez votre mot de passe Ti Kanal |
| `email-change.html` | Change Email Address | Confirmez votre nouvelle adresse email |

Et **Authentication → URL Configuration** :
- Site URL : `https://tikanal.com`
- Redirect URLs : `https://tikanal.com/**` **et** `https://lagon-orcin.vercel.app/**`

---

## Étape 6 — Vérifier (la partie qu'on saute à tort)

### Test 1 — le score de délivrabilité
1. Allez sur **mail-tester.com**, copiez l'adresse jetable affichée.
2. Créez un compte Ti Kanal avec cette adresse.
3. Revenez sur mail-tester et lancez le test.

**Objectif : 9/10 ou 10/10.** En dessous de 8, la page explique
précisément ce qui manque (le plus souvent : DMARC absent, SPF en double,
ou lien de désabonnement).

### Test 2 — les DNS vus de l'extérieur
Sur **mxtoolbox.com/SuperTool.aspx** :
- `spf:send.tikanal.com` → un seul enregistrement, valide (le SPF vit sur le return-path) ;
- `dmarc:tikanal.com` → doit trouver votre politique ;
- `dkim:tikanal.com:resend` → signature trouvée.

### Test 3 — les vraies boîtes
Créez un compte de test avec :
- une adresse **Gmail**,
- une adresse **Outlook/Hotmail** (le plus sévère),
- une adresse **Orange/Wanadoo** ou **Yahoo** (courantes sur l'île).

L'email doit arriver **en boîte de réception**, en moins d'une minute.
S'il est en spam : cliquez « Non spam », vérifiez le score mail-tester, et
attendez 24 h après un correctif DNS avant de conclure.

### Test 4 — le parcours complet
- Inscription → email reçu → clic → compte activé ✔
- « Mot de passe oublié » → email reçu → nouveau mot de passe accepté ✔
- Renvoyer l'email de confirmation (bouton présent sur `/connexion`) ✔

---

## Surveillance continue

- **Resend → Logs** : chaque email envoyé, délivré, rebondi. À regarder
  après le lancement — un rebond dur (`bounce`) signale une adresse
  invalide, un `complaint` signale un signalement spam.
- **Rapports DMARC** : ils arrivent à `jl@solutech.com` en XML (illisible
  à l'œil). Passez-les dans **dmarcian.com** ou **postmarkapp.com/dmarc**
  (gratuits) pour un rapport lisible.
- **Quota Resend** : 3 000/mois. Un email par inscription + les alertes à
  venir — surveillez si le trafic décolle, le palier suivant est à ~20 $/mois.

---

## Dépannage

| Symptôme | Cause la plus probable |
|---|---|
| « Trop de tentatives, patientez » | Rate limit Supabase encore à 2/h — étape 4 |
| Rien ne part, aucune erreur | Custom SMTP pas activé (la case), ou clé API invalide |
| Email en spam chez Outlook uniquement | DMARC manquant ou en `p=none` depuis trop longtemps |
| `535 Authentication failed` | Username doit être `resend`, pas votre email |
| Domaine bloqué sur « Pending » chez Resend | Enregistrement DNS mal recopié, ou TTL pas encore expiré (attendre 1 h) |
| Les liens des emails pointent au mauvais endroit | Site URL / Redirect URLs — étape 5 |

---

## Récapitulatif — la checklist

- [ ] Domaine acheté
- [ ] Domaine (ou sous-domaine `send.`) vérifié dans Resend
- [ ] SPF unique et valide
- [ ] DKIM en place
- [ ] **DMARC `p=none` posé** (puis `quarantine` à J+30)
- [ ] Custom SMTP activé dans Supabase, port 465, user `resend`
- [ ] Rate limit passé à 100/h
- [ ] 4 modèles d'emails collés
- [ ] Site URL et Redirect URLs à jour
- [ ] mail-tester ≥ 9/10
- [ ] Test réel Gmail + Outlook + Orange : boîte de réception
