# Morceaux à coller

L'éditeur SQL de Supabase (ou le presse-papiers) tronque parfois un texte
collé au-delà de quelques kilo-octets : la migration arrive incomplète et
échoue sur « unterminated dollar-quoted string ».

Ce dossier contient les migrations longues **découpées en morceaux de
moins de 4 500 octets**, chacun complet et exécutable seul. Collez-les
**dans l'ordre des numéros**, un par un, Run à chaque fois.

Ils sont générés depuis `supabase/migrations/` par :

    python3 supabase/tests/decouper.py supabase/migrations/0038_stats_visibles.sql

Ne modifiez pas les morceaux à la main : modifiez la migration, puis
régénérez.
