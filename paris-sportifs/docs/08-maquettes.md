# Maquettes des écrans principaux

Livrable 8 sur 10. Rédigé le 2026-09-05. Maquettes filaires en texte ; la charte visuelle sera décidée en M1. Langue : français. Aucun écran n'incite à parier ; le verdict « rien d'intéressant » est un état normal, affiché en gris neutre.

## Principes d'interface

1. **La probabilité et le prix sont deux colonnes distinctes.** Un match peut être très probable et sans intérêt ; l'interface ne fusionne jamais les deux.
2. **Chaque chiffre a une date.** Cote, composition, prédiction : l'horodatage est affiché à côté, pas dans une infobulle.
3. **L'incertitude est visible.** Une probabilité s'affiche avec sa fourchette ; une espérance avec son intervalle.
4. **Trois verdicts seulement** : « Intéressant » (vert sobre), « Rien » (gris), « Données insuffisantes » (orange, avec la liste de ce qui manque).
5. **Pas de compte à rebours, pas de notification sonore, pas de « dernière chance ».** Les limites de budget sont affichées en permanence dans l'en-tête.

## Écran 1 : Tableau de bord

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Paris sportifs · Analyse            Budget fictif : 1 000 € · Exposé : 40 € (4 %)      │
│ [Rencontres] [Simulateur] [Portefeuille] [Performances] [Données] [Paramètres]         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Filtres : Compétition [Toutes ▾]  Marché [1N2 ▾]  Verdict [Tous ▾]  Complétude ≥ [60] │
│ Période : [Aujourd'hui] [3 jours] [7 jours]         Dernière mise à jour : 09:02       │
├──────────┬──────────────────────────┬──────────┬───────────┬──────────────┬────────────┤
│ Coup     │ Rencontre                │ Complé-  │ Verdict   │ Meilleure    │ CLV attendue│
│ d'envoi  │                          │ tude     │           │ espérance    │ (si dispo)  │
├──────────┼──────────────────────────┼──────────┼───────────┼──────────────┼────────────┤
│ Sam 15:00│ Lens – Nantes   (L1)     │ 82       │ Intéressant│ +3,1 % [−1;+7]│ 1,012     │
│          │                          │          │           │ Nul @3,40 Winamax 08:55   │
│ Sam 17:00│ Bayern – Dortmund (BL)   │ 91       │ Rien      │ −1,8 %       │ 0,996      │
│ Sam 21:00│ Real Madrid – Getafe (LL)│ 47       │ Insuffisant│ Compos. absentes, cotes >6h│
│ Dim 14:00│ Torino – Lecce (SA)      │ 78       │ Rien      │ +0,4 % [−3;+4]│ 1,001     │
│ ...      │                          │          │           │              │            │
├──────────┴──────────────────────────┴──────────┴───────────┴──────────────┴────────────┤
│ 23 rencontres analysées · 1 intéressante · 18 rien · 4 données insuffisantes            │
│ Rappel : une espérance positive estimée n'est pas un gain. Modèle ensemble_v0.1.        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Tri par défaut : coup d'envoi. Le verdict « Intéressant » n'est jamais mis en tête de liste par défaut.

## Écran 2 : Fiche rencontre

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Rencontres      Lens – Nantes · Ligue 1 · J4 · samedi 15:00 · Stade Bollaert          │
│ Complétude 82/100  ·  Verdict : Intéressant (Nul)  ·  Prédiction H-2 générée à 12:58    │
├──────────────────────────────┬───────────────────────────────────────────────────────┤
│ PROBABILITÉS (modèle)        │ PRIX (marché)                                          │
│                              │                                                        │
│ Lens   44 % [40 ; 48]        │ Bookmaker   Cote   Relevé   P. implicite (Shin)  Espér.│
│  cote théorique 2,27         │ Pinnacle    2,20   12:40    44,6 %              −3,2 % │
│ Nul    29 % [26 ; 32]        │ Winamax     2,15   08:55    45,0 %              −5,4 % │
│  cote théorique 3,45         │ Betclic     2,10   08:55    46,0 %              −7,6 % │
│ Nantes 27 % [24 ; 30]        │ ─ Nul ─                                                │
│  cote théorique 3,70         │ Pinnacle    3,30   12:40    29,5 %              −4,3 % │
│                              │ Winamax     3,40   08:55    28,2 %              +3,1 % │
│ Plus de 2,5 buts  48 %       │ Betclic     3,25   08:55    29,9 %              −5,8 % │
│ Moins de 2,5 buts 52 %       │                                                        │
│                              │ ⚠ Cotes Winamax/Betclic relevées il y a 4 h.           │
├──────────────────────────────┴───────────────────────────────────────────────────────┤
│ FACTEURS PRINCIPAUX                         │ INFORMATIONS MANQUANTES                 │
│ • Forme xG Lens (10 m.) : +0,35 xG/m vs moy │ • Composition officielle (attendue H-1)  │
│ • Nantes 3 matchs en 8 jours (repos 2 j)    │ • Météo prévue non récupérée            │
│ • Avantage domicile L1 2025/26 : +0,22 buts │                                          │
│ • Arbitre : 24 matchs, 4,1 cartons/m (ligue 3,8) : effet nul sur 1N2 │                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ CONTEXTE ET SOURCES                                                                    │
│ Officiel  Lens : Danso suspendu (LFP, communiqué 03/09 18:12, ingéré 03/09 18:30)        │
│ Presse    Nantes : XI probable sans Simon (L'Équipe, J. Dupont, 05/09 08:10)             │
│ Rumeur    « Coach Lens en instance de départ » (réseau social, 04/09) : non pris en compte│
├──────────────────────────────────────────────────────────────────────────────────────┤
│ HISTORIQUE DES PRÉDICTIONS SUR CE MATCH                                                 │
│ J-3 09:00  Lens 43 % · Nul 28 % · Nantes 29 %   verdict Rien                             │
│ J-1 09:00  Lens 44 % · Nul 29 % · Nantes 27 %   verdict Rien                             │
│ H-2 12:58  Lens 44 % · Nul 29 % · Nantes 27 %   verdict Intéressant (Winamax 3,40)       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Ajouter au portefeuille fictif : Nul @3,40 Winamax, mise conseillée 10 € (Kelly 1/8)]  │
│ Mise max autorisée 20 € · Exposition restante aujourd'hui 10 €                          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Écran 3 : Simulateur de stratégies

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Simulateur                                                                            │
├─────────────────────────────┬────────────────────────────────────────────────────────┤
│ Modèle      [ensemble_v0.1▾]│ Résultats 2019/20 → 2024/25 (walk-forward, 6 saisons)   │
│ Marché      [1N2 ▾]         │                                                        │
│ Cote jouée  [Max ▾]         │ Paris : 1 842   ROI : +0,8 %  IC 95 % [−2,1 ; +3,6]      │
│ Seuil EV    [2 %]           │ P(ROI < 0) : 0,31   CLV moy. : 1,004  IC [0,998 ; 1,010]  │
│ Mise        (•) fixe        │ Drawdown max : 61 unités   Série perdante : 14           │
│             ( ) Kelly 1/8   │ P(perte à 500 paris) : 0,38                              │
│ Plafond/pari [2 %]          │                                                        │
│ Marge FR simulée [12 %] [x] │  Capital cumulé (unités)                                │
│                             │  40 ┤        ╭─╮   ╭╮                                   │
│ [Comparer à : marché seul]  │  20 ┤   ╭────╯ ╰───╯╰─╮      ╭──                        │
│                             │   0 ┼───╯              ╰──╮╭─╯                          │
│ [Exécuter]                  │ −20 ┤                     ╰╯                            │
│                             │     └─────────────────────────────────────────          │
│ Stratégie pré-enregistrée   │       19/20   20/21   21/22   22/23   23/24   24/25    │
│ le 2026-09-05 (S3)          │                                                        │
│                             │ Verdict selon seuils : CORRIGER (IC CLV inclut 1,00)    │
└─────────────────────────────┴────────────────────────────────────────────────────────┘
```

Les chiffres de cette maquette sont des exemples de mise en page, pas des résultats.

## Écran 4 : Portefeuille fictif

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Portefeuille fictif « Principal »   Capital 1 000 € → 987 €   Exposé 40 €   Paris 27   │
│ Limites : 2 % par pari · 10 % exposition · 5 % par jour  [Modifier les limites]        │
├──────────┬──────────────────────┬──────────┬──────┬────────┬────────┬────────┬────────┤
│ Placé le │ Rencontre / sélection│ Bookmaker│ Cote │ Mise   │ Clôture│ CLV    │ Résultat│
├──────────┼──────────────────────┼──────────┼──────┼────────┼────────┼────────┼────────┤
│ 05/09 13:01│ Lens–Nantes · Nul  │ Winamax  │ 3,40 │ 10 €   │ 3,30   │ 1,012  │ En cours│
│ 30/08 12:50│ Genoa–Como · +2,5  │ Betclic  │ 2,05 │ 10 €   │ 2,00   │ 1,006  │ Perdu  │
│ 29/08 12:55│ Getafe–Alavés · 1  │ Unibet   │ 2,60 │ 8 €    │ 2,45   │ 1,020  │ Gagné  │
│ ...        │                    │          │      │        │        │        │        │
├──────────┴──────────────────────┴──────────┴──────┴────────┴────────┴────────┴────────┤
│ Historique immuable : une mise ne peut être ni modifiée ni supprimée.                  │
│ CLV moyenne 30 derniers paris : 1,008 · ROI : −1,3 %                                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Écran 5 : Suivi des performances

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Performances   Période [Saison 2025/26 ▾]   Marché [Tous ▾]   Modèle [ensemble_v0.1 ▾]  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Log-loss : modèle 1,0412 · marché pré-clôture 1,0388 · clôture 1,0351   (n = 612)      │
│ Brier :    modèle 0,6231 · clôture 0,6190                                               │
│                                                                                        │
│ Calibration (déciles)          │ CLV des paris fictifs         │ Séries                │
│ p prédite  fréquence  n        │ Moy. 1,004  IC [0,996;1,012]  │ Perdante max : 9      │
│ 0,1–0,2    0,17      88        │ 61 % des paris > 1,00         │ Drawdown : 38 €       │
│ 0,2–0,3    0,26     143        │                               │                       │
│ 0,3–0,4    0,37     201        │ ▁▂▃▅▆▅▃▂▁ distribution        │                       │
│ 0,4–0,5    0,41     120  ⚠     │                               │                       │
│ 0,5–0,6    0,58      60        │                               │                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Lecture : sans CLV positive et significative, un ROI positif est à considérer comme     │
│ de la chance. Décision selon les critères du livrable 10 : [voir l'état des critères]   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Écran 6 : Journal des données

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Données                                                                               │
├──────────────────┬───────────────┬──────────────┬─────────────────────────────────────┤
│ Source           │ Dernier relevé│ Statut       │ Détail                              │
├──────────────────┼───────────────┼──────────────┼─────────────────────────────────────┤
│ Football-Data    │ 04/09 06:10   │ OK           │ 5 ligues, 2025/26 : 76 matchs        │
│ Understat        │ 05/09 06:20   │ OK           │ 74/76 matchs avec xG (2 en attente)  │
│ The Odds API     │ 05/09 09:00   │ OK           │ 178 crédits restants ce mois         │
│ API-Football     │ 05/09 12:58   │ Dégradé      │ Compositions publiées H-1 sur 3/5 ligues│
│ Open-Meteo       │ 05/09 06:25   │ OK           │ Prévisions J-1 récupérées            │
│ Claude (extraction)│ 05/09 08:40 │ OK           │ 12 appels, 0,31 $ ; budget 20 $/mois │
│ Cotes FR (saisie)│ 05/09 08:55   │ À faire H-2  │ 3 opérateurs, 20 rencontres          │
├──────────────────┴───────────────┴──────────────┴─────────────────────────────────────┤
│ Alertes qualité : 1 bloquante (ESP1 2025/26 : 19 équipes après rapprochement : alias   │
│ « Real Oviedo » manquant pour understat) · 2 avertissements                            │
│ Alias en attente de validation : 3   [Valider]                                         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Écran 7 : Paramètres et limites

Budget fictif, mise maximale par pari (en % et en €), exposition maximale simultanée, mise maximale par jour, méthode de retrait de marge (Shin par défaut, multiplicative et power disponibles avec explication d'une phrase), seuil de complétude, opérateurs suivis, budget mensuel d'API et de Claude. Une modification de limite prend effet le jour suivant, jamais dans l'instant : c'est délibéré.
