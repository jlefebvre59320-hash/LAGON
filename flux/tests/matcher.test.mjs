import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSample } from '../server/normalize.mjs'
import { learn, match, scoreProject } from '../server/matcher.mjs'

const projets = () => [
  {
    id: 'p-lagon',
    name: 'LAGON',
    rules: { domains: ['github.com/jlefebvre59320-hash'], keywords: ['lagon'], codes: ['EROCAM401'] },
    learned: {},
  },
  { id: 'p-com', name: 'Communication', rules: { domains: ['slack.com'], apps: ['Outlook'] }, learned: {} },
  { id: 'p-vide', name: 'Sans règle', rules: {}, learned: {} },
]

test('un code métier l’emporte sur un simple domaine', () => {
  const sample = normalizeSample({ url: 'https://slack.com/client/T1/C2', title: 'EROCAM401 — planning' })
  const decision = match(sample, projets())
  assert.equal(decision.projectId, 'p-lagon')
})

test('domaine + chemin ne déclenche que sur le bon chemin', () => {
  const bon = normalizeSample({ url: 'https://github.com/jlefebvre59320-hash/LAGON/pull/14', title: 'PR' })
  const autre = normalizeSample({ url: 'https://github.com/autre-org/truc', title: 'PR' })
  assert.equal(match(bon, projets()).projectId, 'p-lagon')
  assert.equal(match(autre, projets()).projectId, null)
})

test('le nom d’application range aussi une appli native', () => {
  const sample = normalizeSample({ source: 'agent', app: 'Outlook', title: 'Boîte de réception' })
  assert.equal(match(sample, projets()).projectId, 'p-com')
})

test('sans signal suffisant, l’activité reste à trier', () => {
  const sample = normalizeSample({ url: 'https://exemple-inconnu.fr/page', title: 'Une page quelconque' })
  const decision = match(sample, projets())
  assert.equal(decision.projectId, null)
  assert.equal(decision.confidence, 0)
})

test('un projet archivé ne capte plus rien', () => {
  const liste = projets()
  liste[1].archived = true
  const sample = normalizeSample({ url: 'https://slack.com/client', title: 'Slack' })
  assert.equal(match(sample, liste).projectId, null)
})

test('l’apprentissage fait basculer une activité vers le projet choisi', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://zabbix.interne.fr/latest', title: 'Supervision réseau villa' })
  assert.equal(match(sample, liste).projectId, null, 'inconnu au départ')

  for (let i = 0; i < 4; i += 1) learn(liste, sample, 'p-com')
  assert.equal(match(sample, liste).projectId, 'p-com', 'appris après quelques corrections')
})

test('un domaine réassigné trois fois devient une règle explicite', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://notion.so/equipe/page', title: 'Notes' })
  for (let i = 0; i < 3; i += 1) learn(liste, sample, 'p-vide')
  assert.ok(liste[2].rules.domains.includes('notion.so'))
})

test('reclasser débite le projet proposé à tort', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://exemple.fr/x', title: 'Rapport hebdomadaire' })
  // Deux fois seulement : sous le seuil de promotion en règle explicite,
  // pour que l'assertion porte bien sur le poids appris et rien d'autre.
  learn(liste, sample, 'p-com')
  learn(liste, sample, 'p-com')
  const avant = scoreProject(sample, liste[1]).score
  assert.ok(avant > 0, 'le projet a bien appris quelque chose')

  learn(liste, sample, 'p-lagon', 'p-com')
  assert.equal(scoreProject(sample, liste[1]).score, 0, 'le mauvais projet a tout perdu')
  assert.ok(scoreProject(sample, liste[0]).score > 0, 'le bon projet a pris le relais')
})

test('une règle de domaine apprise se défait quand on reclasse ailleurs', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://notion.so/equipe/page', title: 'Notes' })
  for (let i = 0; i < 3; i += 1) learn(liste, sample, 'p-vide')
  assert.ok(liste[2].rules.domains.includes('notion.so'))

  learn(liste, sample, 'p-com', 'p-vide')
  assert.ok(!liste[2].rules.domains.includes('notion.so'), 'la règle apprise se retire toute seule')
})

test('une règle de domaine écrite à la main survit à un reclassement', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://slack.com/client', title: 'Slack' })
  learn(liste, sample, 'p-lagon', 'p-com')
  assert.ok(liste[1].rules.domains.includes('slack.com'), 'une règle explicite n’est jamais retirée')
})

test('une seule correction ne détrône pas une règle écrite à la main', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://slack.com/client', title: 'Point hebdo' })
  learn(liste, sample, 'p-vide')
  assert.equal(match(sample, liste).projectId, 'p-com', 'la règle explicite tient bon')
})

test('deux corrections répétées finissent par l’emporter', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://slack.com/client', title: 'Point hebdo' })
  learn(liste, sample, 'p-vide', 'p-com')
  learn(liste, sample, 'p-vide', 'p-com')
  assert.equal(match(sample, liste).projectId, 'p-vide', 'un choix humain redit deux fois passe devant')
})

test('une correction suffit à ranger un site que personne ne réclame', () => {
  const liste = projets()
  const sample = normalizeSample({ url: 'https://exemple-inconnu.fr/doc', title: 'Doc mystère' })
  assert.equal(match(sample, liste).projectId, null)
  learn(liste, sample, 'p-com')
  const suivante = normalizeSample({ url: 'https://exemple-inconnu.fr/autre', title: 'Doc suivant' })
  assert.equal(match(suivante, liste).projectId, 'p-com', 'la visite suivante se range toute seule')
})

test('la décision explique ses raisons', () => {
  const sample = normalizeSample({ url: 'https://slack.com/client', title: 'Slack' })
  const decision = match(sample, projets())
  assert.ok(decision.reasons.some((r) => r.kind === 'domaine' && r.value === 'slack.com'))
})
