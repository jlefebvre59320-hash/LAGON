# Déploiement de la passe de sécurité

La migration `0019_security_hardening.sql` et le frontend doivent être livrés
ensemble. Le frontend appelle les nouvelles fonctions SQL d'administration et
de mesure d'audience ; le publier avant la migration rendrait ces fonctions
indisponibles.

## Ordre recommandé

1. Sauvegarder la base Supabase.
2. Appliquer toutes les migrations manquantes dans l'ordre, jusqu'à
   `supabase/migrations/0019_security_hardening.sql` incluse (`supabase db push`
   ou SQL Editor).
3. Renseigner les quatre variables légales dans Vercel :
   `NEXT_PUBLIC_LEGAL_EDITOR_NAME`, `NEXT_PUBLIC_LEGAL_EDITOR_ADDRESS`,
   `NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR` et
   `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`.
4. Déployer le frontend.
5. Vérifier la connexion, le dépôt puis la modification d'une annonce, la
   proposition d'un événement et le tableau de bord administrateur.

## Contrôles avant envoi

```sh
npm ci
npm run check
npm audit --omit=dev
```

La CI GitHub exécute les mêmes contrôles à chaque push et chaque pull request.

## Contrôles de sécurité après migration

- Un compte normal ne peut modifier que `display_name` et `phone_wa` dans son
  profil, jamais `is_admin`, `is_banned` ou `is_pro`.
- Une annonce retirée ne peut pas être remise en ligne par son auteur.
- L'API publique des événements ne rend pas la colonne privée `contact`.
- Une photo ne peut être envoyée que sous le dossier de son auteur et pour une
  annonce qu'il possède, avec un maximum de cinq photos par annonce.
- Les actions de modération passent par les fonctions `admin_*`, qui vérifient
  le rôle administrateur dans la base.

La migration essaie de programmer une purge quotidienne avec `pg_cron`. Si
l'extension n'est pas active, elle affiche un `NOTICE` et la fonction
`purge_expired_operational_data()` reste disponible pour une planification
manuelle.
