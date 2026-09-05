# Journal des décisions

Une ligne par décision structurante, dans l'ordre chronologique. Une décision ne se modifie pas : elle se remplace par une nouvelle ligne qui la cite.

| Date | Décision | Conséquences | Référence |
|---|---|---|---|
| 2026-09-05 | Premier sport : football, 5 grands championnats, marchés 1N2 et plus/moins 2,5 | Tennis en phase 2 ; combinés hors périmètre jusqu'au verdict M2 | Livrables 1, 3 |
| 2026-09-05 | Référence de marché : cote de clôture Pinnacle, marge retirée par Shin | La CLV est la métrique de valeur primaire | Livrables 1, 7 |
| 2026-09-05 | Moteur en Python, base PostgreSQL Supabase dédiée, interface Next.js en lecture | Second langage dans le dépôt, accepté | Livrable 4 |
| 2026-09-05 | Seuils de décision fixés avant tout test | Toute modification passe par une version datée du livrable 10 | Livrable 10 |
| 2026-09-05 | **Usage strictement personnel, aucune distribution** (décision du commanditaire) | Les licences non commerciales (Sackmann CC BY-NC-SA, StatsBomb Open Data, Open-Meteo gratuit non commercial, Match Charting Project) sont utilisables. Aucune redistribution de données, ni de prédictions, ni de rapports hors du dépôt privé. Un seul compte utilisateur ; la RLS reste activée par hygiène, pas par besoin multi-utilisateurs. Le déploiement peut rester local (moteur et DuckDB sur le poste) si l'interface web n'est pas jugée nécessaire ; Supabase et Vercel deviennent une option de confort, pas une exigence. Si l'usage change un jour, relire l'inventaire (livrable 2) source par source avant toute ouverture. | Livrables 1 §7, 2, 3 §8, 4 |
| 2026-09-05 | **Déploiement local sur un seul poste, sans Supabase ni Vercel** (décision du commanditaire) | Remplace la décision « base Supabase dédiée, interface Next.js » du même jour. Moteur Python, PostgreSQL local, interface web locale FastAPI + Jinja2 + HTMX sur 127.0.0.1, planification systemd, sauvegarde `pg_dump` quotidienne sur support externe. Coût d'hébergement nul. Pas d'accès distant ; le poste doit être allumé aux heures planifiées, une exécution manquée est signalée et le match concerné passe en « données insuffisantes ». | Livrables 3 §8, 4, 9 |
