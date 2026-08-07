import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DAYS_DIR, ensureHome } from './config.mjs'

/**
 * Une journée = un fichier JSONL de sessions. Pas de base à installer, un format
 * lisible et greppable, et un export qui se réduit à copier des fichiers.
 * Une correction est écrite en fin de fichier ; à la lecture, la dernière
 * version d'un identifiant gagne.
 */

export function dayKey(ts = Date.now(), dayStartHour = 0) {
  const d = new Date(ts)
  if (dayStartHour > 0 && d.getHours() < dayStartHour) d.setDate(d.getDate() - 1)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayFile(key) {
  return join(DAYS_DIR, `${key}.jsonl`)
}

export function newId() {
  return randomUUID()
}

/** Écrit (ou réécrit) une session dans le fichier de sa journée. */
export function putSession(session, dayStartHour = 0) {
  ensureHome()
  const key = session.day || dayKey(session.start, dayStartHour)
  const record = { ...session, day: key, updatedAt: Date.now() }
  appendFileSync(dayFile(key), `${JSON.stringify(record)}\n`)
  return record
}

/** Sessions d'une journée, corrections appliquées, triées par heure de début. */
export function readDay(key) {
  const file = dayFile(key)
  if (!existsSync(file)) return []
  const byId = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      if (record.deleted) byId.delete(record.id)
      else byId.set(record.id, record)
    } catch {
      // Ligne tronquée par un arrêt brutal : on la saute, le reste de la journée reste lisible.
    }
  }
  return [...byId.values()].sort((a, b) => a.start - b.start)
}

/** Sessions sur un intervalle de journées (bornes incluses, format AAAA-MM-JJ). */
export function readRange(fromKey, toKey) {
  const out = []
  for (const key of listDays()) {
    if (key >= fromKey && key <= toKey) out.push(...readDay(key))
  }
  return out.sort((a, b) => a.start - b.start)
}

export function listDays() {
  ensureHome()
  return readdirSync(DAYS_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => f.replace(/\.jsonl$/, ''))
    .sort()
}

export function findSession(id, dayHint) {
  const days = dayHint ? [dayHint, ...listDays().filter((d) => d !== dayHint)] : listDays().reverse()
  for (const key of days) {
    const found = readDay(key).find((s) => s.id === id)
    if (found) return found
  }
  return null
}

export function deleteSession(id, dayHint) {
  const found = findSession(id, dayHint)
  if (!found) return null
  appendFileSync(dayFile(found.day), `${JSON.stringify({ id, deleted: true, updatedAt: Date.now() })}\n`)
  return found
}

/**
 * Réécrit le fichier d'une journée en ne gardant que l'état final de chaque
 * session — le journal grossit vite quand on trie beaucoup à la main.
 */
export function compactDay(key) {
  const sessions = readDay(key)
  const file = dayFile(key)
  if (!existsSync(file)) return 0
  writeFileSync(file, sessions.map((s) => JSON.stringify(s)).join('\n') + (sessions.length ? '\n' : ''))
  return sessions.length
}
