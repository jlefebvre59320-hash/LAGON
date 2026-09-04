# Migrations

Les fichiers s'exécutent **dans l'ordre alphabétique de leur nom**, une fois
chacun, dans le SQL Editor de Supabase (ou par `supabase db push`).

## Deux fichiers renommés le 4 septembre 2026

Deux numéros étaient en double, ce qui rendait l'ordre ambigu et a déjà
causé une erreur en production (le mauvais `0030` exécuté). Ils ont été
renommés pour retrouver un ordre strict, **sans changer une ligne de leur
contenu** :

| Ancien nom | Nouveau nom | Pourquoi |
|---|---|---|
| `0019_gestion_admins.sql` | `0018b_gestion_admins.sql` | Antérieur à `0019_security_hardening.sql`, dont il est indépendant. |
| `0030_admin_workspace.sql` | `0029b_admin_workspace.sql` | Antérieur à `0030_module_services.sql`, dont il est indépendant. |

**Si votre base a déjà reçu ces deux fichiers sous leur ancien nom, il n'y a
rien à refaire** : le contenu est identique. C'est le cas de la base de
production Ti Kanal au moment du renommage.

## Règles

- Un fichier ajoute une valeur à un type `enum` ? Il doit être exécuté
  **seul**, hors de toute transaction (Supabase enveloppe chaque exécution
  dans une transaction ; `alter type … add value` n'y survit pas quand la
  valeur est utilisée plus bas). Exemple : `0030_module_services.sql`.
- Chaque colonne lisible ou modifiable par un compte sur `profiles`,
  `listings`, `listing_photos`, `reports`, `search_alerts` doit recevoir un
  `grant` explicite : les droits sont donnés colonne par colonne depuis
  `0019_security_hardening.sql`.
- Toute écriture passe par une fonction `security definer` ou une RLS
  stricte ; jamais de `grant update` large.

## Tests

`npm run test:sql` rejoue les migrations de modération et d'alertes sur un
Postgres local et vérifie les règles (voir `supabase/tests/`).
