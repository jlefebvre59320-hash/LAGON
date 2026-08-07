# Flux — toute mon activité au même endroit

Flux enregistre ce sur quoi vous passez réellement du temps — sites, pages,
applications, réunions — et le range **tout seul par projet**, à partir des
signaux que l'activité porte déjà : le domaine, l'URL, le nom de la fenêtre, les
codes ticket qui traînent dans les titres.

Ce que vous rangez à la main, il l'apprend. La correction suivante n'arrive pas.

**Tout reste sur le poste.** Le serveur n'écoute que sur `127.0.0.1`, n'appelle
aucun service distant, et n'a besoin d'aucun compte. Les données sont des
fichiers texte dans `~/.flux`, que vous pouvez lire, sauvegarder ou supprimer
avec les outils habituels.

---

## Démarrage

Aucune dépendance à installer : Node 20 ou plus suffit.

```bash
cd flux
npm start           # tableau de bord sur http://127.0.0.1:7749
```

Trois sources d'activité, indépendantes — prenez celles qui vous servent.

### 1. Extension navigateur — sites et pages

C'est la source principale : elle voit l'onglet réellement sous vos yeux, son
titre et son adresse.

1. `chrome://extensions` (ou `edge://extensions`) → **Mode développeur** ;
2. **Charger l'extension non empaquetée** → dossier `flux/extension` ;
3. cliquer sur l'icône Flux → **Tester** pour vérifier la liaison au serveur.

Elle ne remonte rien des pages internes du navigateur, se met en veille dès que
le clavier et la souris se taisent, et garde ses relevés de côté quand le serveur
est éteint pour les rejouer à son retour.

### 2. Agent bureau — applications natives

Pour tout ce qui n'est pas dans le navigateur : Outlook, Teams, VS Code, un
terminal, un client RDP.

```bash
npm run agent                       # ou : node agent/flux-agent.mjs --verbose
```

| Système | Prérequis |
| --- | --- |
| Linux (X11) | `sudo apt install xdotool x11-utils xprintidle` |
| macOS | autoriser le terminal dans Réglages → Confidentialité → Accessibilité |
| Windows | rien à installer (PowerShell) |

Sous Wayland, aucun outil ne donne le titre de la fenêtre active à un programme
tiers : l'agent le dit et s'efface, l'extension continue de fonctionner.

L'agent ignore volontairement les fenêtres de navigateur — l'extension les couvre
déjà, en bien plus précis, et les compter deux fois fausserait tout.

### 3. Minuteur et saisie manuelle — ce qui n'a pas d'écran

**Démarrer un minuteur** dans le bandeau, pour une réunion, un appel, un
déplacement. Une session manuelle prend le pas sur la capture automatique tant
qu'elle tourne : ce que vous déclarez fait autorité.

---

## Comment le rangement automatique décide

Chaque activité est confrontée à tous les projets. Le meilleur score l'emporte,
s'il dépasse le seuil ; sinon l'activité part dans **À trier**.

| Signal | Poids | Exemple |
| --- | --- | --- |
| Code métier | 120 | `T15423`, `EROCAM401`, `ABC-42` repérés dans un titre ou une URL |
| Motif d'URL | 80 | `airtable.com/appAssets*` |
| Domaine + chemin | 70 | `github.com/mon-org` |
| Motif de titre (regex) | 60 | `^LAGON` |
| Domaine | 45 | `slack.com` |
| Application | 40 | `Outlook` |
| Site appris | 20 par correction (max 45) | vous avez rangé ce site à la main |
| Mot-clé | 25 | `migration` |
| Jetons appris | 4 par jeton (max 40) | mots vus dans les activités que vous avez rangées |

Le dosage est délibéré :

- **une seule correction suffit** à ranger un site que personne d'autre ne
  réclame — la visite suivante tombe au bon endroit ;
- **elle ne suffit pas** à détrôner une règle que vous avez écrite à la main ;
- **deux corrections répétées, si.** Un choix humain redit vaut mieux qu'une
  règle générique, et le projet abandonné perd du poids au passage.

Un domaine rangé trois fois vers le même projet devient une règle explicite —
sauf si un autre projet le revendique déjà. Une règle ainsi apprise se défait
toute seule si vous changez d'avis ; une règle écrite à la main, jamais.

Chaque session affiche **pourquoi** elle a été rangée là. Quand le tri surprend,
la raison est lisible et la règle corrigeable.

---

## Ce qui est mesuré, et ce qui ne l'est pas

Les relevés arrivent toutes les 30 secondes environ ; le serveur les recolle en
sessions. Trois garde-fous évitent de compter du vide :

- un silence de plus de 3 minutes clôt la session **à son dernier signe de vie**,
  pas au retour — une pause déjeuner n'est jamais facturée ;
- l'inactivité clavier/souris et la perte de focus ferment la session en cours ;
- en dessous de 8 secondes, un passage est du bruit et n'est pas conservé.

Ces trois seuils se règlent dans l'onglet **Réglages**.

### Ne jamais enregistrer

Un motif par ligne : un domaine (`impots.gouv.fr`), un joker (`*.bank`), un nom
d'application (`Signal`). Ce qui correspond est écarté **avant écriture** — il
n'en reste aucune trace, pas même une ligne anonyme. Le bouton **Pause** coupe
tout d'un coup.

---

## Sortir les données

Onglet **Semaine**, sur la période affichée :

- **Feuille de temps (CSV)** — une ligne par jour et par projet, heures en
  décimal, séparateur `;` et BOM UTF-8 : Excel FR l'ouvre sans rien demander ;
- **Détail des sessions (CSV)** — tout, une ligne par session ;
- **Sauvegarde JSON** — projets et sessions, de quoi repartir ailleurs.

---

## Où vivent les données

```
~/.flux/
├── config.json              réglages
├── projects.json            projets, règles, apprentissage
├── state.json               session en cours (survit à un redémarrage)
└── days/2026-08-07.jsonl    une journée = un fichier, une session par ligne
```

Le format est un journal : une correction est ajoutée en fin de fichier et la
dernière version d'un identifiant l'emporte à la lecture. Une ligne tronquée par
un arrêt brutal est ignorée sans emporter le reste de la journée.
**Compacter le journal** (Réglages) réécrit les fichiers au propre.

`FLUX_HOME` déplace le dossier — pratique pour un second profil ou pour poser
les données sur un disque chiffré.

---

## Développement

```bash
npm test            # 32 tests : découpage des sessions, rangement, apprentissage, exports
```

```
server/   normalize (signal) · matcher (rangement) · tracker (sessions)
          store (journal) · report (agrégats, CSV) · index (API + statique)
web/      tableau de bord, sans build ni dépendance
extension/  capture navigateur (MV3)
agent/    capture bureau (Linux X11, macOS, Windows)
```

L'API n'accepte que les appels sans origine (agent, curl), ceux d'une extension
et les siens : une page web ouverte dans le navigateur ne peut pas lire votre
historique d'activité, même si elle connaît le port.
