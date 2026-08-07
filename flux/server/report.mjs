import { dayKey, readDay, readRange } from './store.mjs'

/** AAAA-MM-JJ → AAAA-MM-JJ, décalés de n jours. */
export function shiftDay(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const offset = (date.getDay() + 6) % 7 // lundi = 0
  return shiftDay(key, -offset)
}

function group(sessions, keyFn) {
  const map = new Map()
  for (const s of sessions) {
    const key = keyFn(s)
    if (key === null || key === undefined) continue
    const entry = map.get(key) || { key, durationMs: 0, count: 0 }
    entry.durationMs += s.durationMs || 0
    entry.count += 1
    map.set(key, entry)
  }
  return [...map.values()].sort((a, b) => b.durationMs - a.durationMs)
}

/** Synthèse d'une plage : total, répartition projets, sites, applis, file à trier. */
export function summarize(sessions, projects) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const totalMs = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0)

  const byProject = group(sessions, (s) => s.projectId || '__unassigned').map((entry) => {
    const project = byId.get(entry.key)
    return {
      projectId: entry.key === '__unassigned' ? null : entry.key,
      name: project?.name || 'Non classé',
      color: project?.color || '#9aa5a6',
      client: project?.client || '',
      durationMs: entry.durationMs,
      count: entry.count,
      share: totalMs ? Number(((entry.durationMs / totalMs) * 100).toFixed(1)) : 0,
    }
  })

  const unassigned = sessions
    .filter((s) => !s.projectId)
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))

  return {
    totalMs,
    sessionCount: sessions.length,
    byProject,
    bySite: group(sessions, (s) => s.domain || null).slice(0, 15),
    byApp: group(sessions, (s) => s.app || null).slice(0, 15),
    bySource: group(sessions, (s) => s.source),
    unassignedMs: unassigned.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    unassignedCount: unassigned.length,
    /** Regroupe la file à trier par cible : on range 20 visites d'un coup, pas une par une. */
    toSort: group(unassigned, (s) => s.domain || s.app || s.title)
      .slice(0, 40)
      .map((entry) => {
        const sample = unassigned.find((s) => (s.domain || s.app || s.title) === entry.key)
        return {
          key: entry.key,
          durationMs: entry.durationMs,
          count: entry.count,
          title: sample?.title || '',
          domain: sample?.domain || '',
          app: sample?.app || '',
          sessionIds: unassigned.filter((s) => (s.domain || s.app || s.title) === entry.key).map((s) => s.id),
        }
      }),
  }
}

export function dayReport(key, projects) {
  const sessions = readDay(key)
  return { day: key, ...summarize(sessions, projects), sessions }
}

export function rangeReport(fromKey, toKey, projects) {
  const sessions = readRange(fromKey, toKey)
  const days = []
  for (let key = fromKey; key <= toKey; key = shiftDay(key, 1)) {
    const daySessions = sessions.filter((s) => s.day === key)
    days.push({
      day: key,
      totalMs: daySessions.reduce((sum, s) => sum + (s.durationMs || 0), 0),
      byProject: summarize(daySessions, projects).byProject,
    })
    if (days.length > 400) break // garde-fou si les bornes sont inversées
  }
  return { from: fromKey, to: toKey, ...summarize(sessions, projects), days }
}

export function todayKey(dayStartHour = 0) {
  return dayKey(Date.now(), dayStartHour)
}

const CSV_COLUMNS = ['day', 'debut', 'fin', 'duree_min', 'projet', 'client', 'source', 'application', 'site', 'titre', 'rangement', 'note']

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Export feuille de temps : une ligne par session, séparateur `;` pour Excel FR. */
export function toCsv(sessions, projects) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const iso = (ts) => new Date(ts).toLocaleString('fr-FR', { hour12: false })
  const lines = [CSV_COLUMNS.join(';')]
  for (const s of sessions) {
    const project = byId.get(s.projectId)
    lines.push(
      [
        s.day,
        iso(s.start),
        iso(s.end),
        ((s.durationMs || 0) / 60000).toFixed(1).replace('.', ','),
        project?.name || 'Non classé',
        project?.client || '',
        s.source,
        s.app,
        s.domain,
        s.title,
        s.assignedBy || '',
        s.note || '',
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  return lines.join('\n')
}

/** Export agrégé par projet et par jour — le format qu'on recopie dans une feuille de temps. */
export function toTimesheetCsv(sessions, projects) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const map = new Map()
  for (const s of sessions) {
    const key = `${s.day}|${s.projectId || ''}`
    const entry = map.get(key) || { day: s.day, projectId: s.projectId, durationMs: 0 }
    entry.durationMs += s.durationMs || 0
    map.set(key, entry)
  }
  const lines = ['jour;projet;client;heures']
  for (const entry of [...map.values()].sort((a, b) => (a.day === b.day ? b.durationMs - a.durationMs : a.day < b.day ? -1 : 1))) {
    const project = byId.get(entry.projectId)
    lines.push(
      [entry.day, project?.name || 'Non classé', project?.client || '', (entry.durationMs / 3_600_000).toFixed(2).replace('.', ',')]
        .map(csvCell)
        .join(';'),
    )
  }
  return lines.join('\n')
}
