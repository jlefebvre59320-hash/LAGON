import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Le stockage est choisi à l'import : la variable doit être posée avant.
const HOME = mkdtempSync(join(tmpdir(), 'flux-test-'))
process.env.FLUX_HOME = HOME

const { Tracker } = await import('../server/tracker.mjs')
const { readDay, dayKey } = await import('../server/store.mjs')
const { summarize, toCsv, toTimesheetCsv } = await import('../server/report.mjs')

const CONFIG = {
  idleTimeoutMs: 180_000,
  mergeGapMs: 45_000,
  minSessionMs: 8_000,
  matchThreshold: 30,
  dayStartHour: 0,
  ignore: ['*.bank'],
  paused: false,
}

const PROJETS = [{ id: 'p1', name: 'Dev', color: '#123456', rules: { domains: ['github.com'] }, learned: {} }]

function makeTracker(overrides = {}) {
  rmSync(join(HOME, 'state.json'), { force: true })
  return new Tracker({ config: { ...CONFIG, ...overrides }, getProjects: () => PROJETS })
}

const T0 = new Date('2026-03-10T00:00:00').getTime()
const beat = (ts, extra) => ({ source: 'browser', ts, ...extra })

// Tous les tests écrivent dans le même fichier de journée : chacun prend sa
// propre heure pour que les sessions des autres ne polluent pas ses assertions.
const hour = (n) => T0 + n * 3_600_000

after(() => rmSync(HOME, { recursive: true, force: true }))

test('des relevés successifs identiques forment une seule session', () => {
  const tracker = makeTracker()
  const base = hour(8)
  for (let i = 0; i < 5; i += 1) {
    tracker.ingest(beat(base + i * 30_000, { url: 'https://github.com/org/repo', title: 'repo' }))
  }
  const closed = tracker.closeCurrent(base + 5 * 30_000)
  assert.equal(closed.durationMs, 150_000)
  assert.equal(closed.projectId, 'p1', 'rangée automatiquement grâce au domaine')
})

test('changer de page ferme la session et en ouvre une autre', () => {
  const tracker = makeTracker()
  const base = hour(9)
  tracker.ingest(beat(base, { url: 'https://github.com/org/repo', title: 'repo' }))
  tracker.ingest(beat(base + 30_000, { url: 'https://github.com/org/repo', title: 'repo' }))
  tracker.ingest(beat(base + 60_000, { url: 'https://notion.so/notes', title: 'Notes' }))
  tracker.closeCurrent(base + 90_000)

  const sessions = readDay(dayKey(base)).filter((s) => s.start >= base && s.start <= base + 90_000)
  assert.equal(sessions.length, 2)
  assert.equal(sessions[0].durationMs, 60_000)
  assert.equal(sessions[1].title, 'Notes')
})

test('un silence long clôt la session au dernier signe de vie, pas au retour', () => {
  const tracker = makeTracker()
  const base = hour(10)
  tracker.ingest(beat(base, { url: 'https://github.com/org/repo', title: 'repo' }))
  tracker.ingest(beat(base + 30_000, { url: 'https://github.com/org/repo', title: 'repo' }))
  // Pause déjeuner : rien pendant 50 minutes, puis retour sur la même page.
  tracker.ingest(beat(base + 3_000_000, { url: 'https://github.com/org/repo', title: 'repo' }))

  const sessions = readDay(dayKey(base)).filter((s) => s.start === base)
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].durationMs, 30_000, 'la pause n’est pas comptée')
})

test('un aller-retour d’une seconde est du bruit et n’est pas enregistré', () => {
  const tracker = makeTracker()
  tracker.ingest(beat(hour(12), { url: 'https://exemple.fr/x', title: 'Coup d’œil' }))
  assert.equal(tracker.closeCurrent(hour(12) + 2_000), null)
})

test('les relevés inactifs ferment la session en cours', () => {
  const tracker = makeTracker()
  const base = hour(13)
  tracker.ingest(beat(base, { url: 'https://github.com/org/repo', title: 'repo' }))
  tracker.ingest(beat(base + 30_000, { url: 'https://github.com/org/repo', title: 'repo' }))
  tracker.ingest(beat(base + 40_000, { idle: true }))
  assert.equal(tracker.snapshot(), null)
  assert.equal(readDay(dayKey(base)).find((s) => s.start === base).durationMs, 40_000)
})

test('un domaine exclu ne laisse aucune trace', () => {
  const tracker = makeTracker()
  const before = readDay(dayKey(T0)).length
  for (let i = 0; i < 4; i += 1) {
    tracker.ingest(beat(hour(14) + i * 30_000, { url: 'https://client.credit.bank/', title: 'Comptes' }))
  }
  tracker.closeCurrent(hour(14) + 200_000)
  assert.equal(readDay(dayKey(T0)).length, before)
})

test('en pause, plus rien n’est capté', () => {
  const tracker = makeTracker({ paused: true })
  assert.equal(tracker.ingest(beat(hour(15), { url: 'https://github.com/x', title: 'x' })).status, 'paused')
  assert.equal(tracker.snapshot(), null)
})

test('le minuteur manuel a la priorité sur la capture automatique', () => {
  const tracker = makeTracker()
  tracker.startManual({ title: 'Réunion client', projectId: 'p1' })
  assert.equal(tracker.ingest(beat(Date.now(), { url: 'https://github.com/x', title: 'x' })).status, 'manual-running')
  const record = tracker.stopManual()
  assert.equal(record.source, 'manual')
  assert.equal(record.projectId, 'p1')
})

test('une saisie après coup refuse des bornes incohérentes', () => {
  const tracker = makeTracker()
  assert.equal(tracker.addManual({ title: 'x', start: hour(16), end: hour(16) - 1000 }), null)
  const ok = tracker.addManual({ title: 'Déplacement', start: hour(16), end: hour(17) })
  assert.equal(ok.durationMs, 3_600_000)
})

test('la synthèse totalise, répartit et remonte ce qui reste à trier', () => {
  const sessions = [
    { id: 'a', durationMs: 3_600_000, projectId: 'p1', domain: 'github.com', app: 'Navigateur', source: 'browser', day: '2026-03-10', start: T0, end: T0 + 3_600_000, title: 'repo' },
    { id: 'b', durationMs: 1_800_000, projectId: null, domain: 'inconnu.fr', app: 'Navigateur', source: 'browser', day: '2026-03-10', start: T0, end: T0 + 1_800_000, title: 'page' },
  ]
  const résumé = summarize(sessions, PROJETS)
  assert.equal(résumé.totalMs, 5_400_000)
  assert.equal(résumé.byProject.find((p) => p.projectId === 'p1').share, 66.7)
  assert.equal(résumé.unassignedCount, 1)
  assert.equal(résumé.toSort[0].key, 'inconnu.fr')

  const csv = toCsv(sessions, PROJETS)
  assert.ok(csv.split('\n')[0].startsWith('day;debut;fin'))
  assert.ok(csv.includes('Non classé'))
  assert.ok(toTimesheetCsv(sessions, PROJETS).includes('1,00'), 'les heures sont en décimal français')
})
