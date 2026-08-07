import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureHome, loadConfig, saveConfig } from './config.mjs'
import { loadProjects, saveProjects, createProject, updateProject, deleteProject, normalizeRules } from './projects.mjs'
import { Tracker } from './tracker.mjs'
import { learn, match } from './matcher.mjs'
import { compactDay, deleteSession, findSession, listDays, putSession, readDay, readRange } from './store.mjs'
import { dayReport, rangeReport, shiftDay, toCsv, toTimesheetCsv, todayKey, weekStart } from './report.mjs'

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url))
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

ensureHome()
let config = loadConfig()
let projects = loadProjects()
const tracker = new Tracker({ config, getProjects: () => projects })

/**
 * Le serveur n'écoute que sur la boucle locale, mais une page web ouverte dans
 * le navigateur pourrait quand même appeler l'API. On n'accepte donc que les
 * appels sans origine (agent, curl), ceux d'une extension, et les nôtres.
 */
function originAllowed(req) {
  const origin = req.headers.origin
  if (!origin) return true
  if (/^(chrome|moz|safari-web)-extension:\/\//.test(origin)) return true
  return new RegExp(`^https?://(127\\.0\\.0\\.1|localhost):${config.port}$`).test(origin)
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(payload)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('corps de requête trop volumineux')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('JSON invalide')
  }
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  const file = join(WEB_DIR, rel)
  if (!file.startsWith(WEB_DIR) || !existsSync(file)) return send(res, 404, { error: 'introuvable' })
  const body = await readFile(file)
  send(res, 200, body, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' })
}

/** Rejoue le rangement automatique sur des sessions déjà enregistrées. */
function reclassify(sessions, { onlyUnassigned = true } = {}) {
  let changed = 0
  for (const session of sessions) {
    if (session.assignedBy === 'manual') continue // un choix humain n'est jamais écrasé
    if (onlyUnassigned && session.projectId) continue
    const decision = match(session, projects, { threshold: config.matchThreshold })
    if (decision.projectId !== session.projectId) {
      putSession(
        { ...session, projectId: decision.projectId, assignedBy: decision.projectId ? 'auto' : 'none', confidence: decision.confidence, reasons: decision.reasons },
        config.dayStartHour,
      )
      changed += 1
    }
  }
  return changed
}

const routes = {
  'POST /api/heartbeat': async (req, res, _url, body) => {
    const result = tracker.ingest(body)
    send(res, 200, { ok: true, ...result, paused: config.paused })
  },

  'POST /api/heartbeat/batch': async (req, res, _url, body) => {
    // L'agent et l'extension gardent les relevés en file quand le serveur est coupé.
    const samples = Array.isArray(body?.samples) ? body.samples.slice(0, 500) : []
    for (const sample of samples.sort((a, b) => (a.ts || 0) - (b.ts || 0))) tracker.ingest(sample)
    send(res, 200, { ok: true, accepted: samples.length })
  },

  'GET /api/state': async (req, res) => {
    const day = todayKey(config.dayStartHour)
    const report = dayReport(day, projects)
    send(res, 200, {
      now: Date.now(),
      paused: config.paused,
      current: tracker.snapshot(),
      day,
      totalMs: report.totalMs,
      byProject: report.byProject,
      unassignedMs: report.unassignedMs,
      unassignedCount: report.unassignedCount,
    })
  },

  'GET /api/day': async (req, res, url) => {
    const day = url.searchParams.get('d') || todayKey(config.dayStartHour)
    send(res, 200, dayReport(day, projects))
  },

  'GET /api/range': async (req, res, url) => {
    const to = url.searchParams.get('to') || todayKey(config.dayStartHour)
    const from = url.searchParams.get('from') || weekStart(to)
    send(res, 200, rangeReport(from, to, projects))
  },

  'GET /api/days': async (req, res) => send(res, 200, { days: listDays() }),

  'GET /api/projects': async (req, res) => send(res, 200, { projects }),

  'POST /api/projects': async (req, res, _url, body) => {
    const project = createProject(projects, { ...body, rules: normalizeRules(body?.rules || {}) })
    saveProjects(projects)
    send(res, 201, { project })
  },

  'PATCH /api/projects': async (req, res, url, body) => {
    const id = url.searchParams.get('id')
    const project = updateProject(projects, id, body)
    if (!project) return send(res, 404, { error: 'projet introuvable' })
    saveProjects(projects)
    // Les règles ont bougé : on repasse sur la file à trier du jour.
    const changed = reclassify(readDay(todayKey(config.dayStartHour)))
    send(res, 200, { project, reclassified: changed })
  },

  'DELETE /api/projects': async (req, res, url) => {
    const id = url.searchParams.get('id')
    if (!deleteProject(projects, id)) return send(res, 404, { error: 'projet introuvable' })
    saveProjects(projects)
    send(res, 200, { ok: true })
  },

  'POST /api/sessions/assign': async (req, res, _url, body) => {
    const ids = Array.isArray(body?.ids) ? body.ids : [body?.id].filter(Boolean)
    const projectId = body?.projectId || null
    if (!ids.length) return send(res, 400, { error: 'aucune session ciblée' })

    let updated = 0
    let sample = null
    for (const id of ids) {
      const session = findSession(id, body?.day)
      if (!session) continue
      const from = session.projectId
      putSession({ ...session, projectId, assignedBy: projectId ? 'manual' : 'none', confidence: projectId ? 1 : 0 }, config.dayStartHour)
      if (projectId) learn(projects, session, projectId, from)
      sample ||= session
      updated += 1
    }
    saveProjects(projects)

    // L'apprentissage vient de changer : on repropose un rangement sur ce qui traîne.
    const reclassified = body?.applyToSimilar === false ? 0 : reclassify(readDay(sample?.day || todayKey(config.dayStartHour)))
    send(res, 200, { ok: true, updated, reclassified })
  },

  'DELETE /api/sessions': async (req, res, url) => {
    const removed = deleteSession(url.searchParams.get('id'), url.searchParams.get('day'))
    if (!removed) return send(res, 404, { error: 'session introuvable' })
    send(res, 200, { ok: true })
  },

  'POST /api/sessions/manual': async (req, res, _url, body) => {
    const record = tracker.addManual(body || {})
    if (!record) return send(res, 400, { error: 'bornes de temps invalides' })
    send(res, 201, { session: record })
  },

  'POST /api/timer/start': async (req, res, _url, body) => send(res, 200, { timer: tracker.startManual(body || {}) }),

  'POST /api/timer/stop': async (req, res) => {
    const record = tracker.stopManual()
    if (!record) return send(res, 400, { error: 'aucun minuteur en cours' })
    send(res, 200, { session: record })
  },

  'GET /api/config': async (req, res) => send(res, 200, { config }),

  'PATCH /api/config': async (req, res, _url, body) => {
    if (body?.ignore !== undefined) {
      body.ignore = Array.isArray(body.ignore) ? body.ignore : String(body.ignore).split('\n')
      body.ignore = body.ignore.map((s) => String(s).trim()).filter(Boolean)
    }
    config = saveConfig(body || {})
    tracker.setConfig(config)
    send(res, 200, { config })
  },

  'POST /api/reclassify': async (req, res, _url, body) => {
    const to = body?.to || todayKey(config.dayStartHour)
    const from = body?.from || to
    const changed = reclassify(readRange(from, to), { onlyUnassigned: body?.all !== true })
    send(res, 200, { ok: true, changed })
  },

  'POST /api/compact': async (req, res, _url, body) => {
    const days = body?.day ? [body.day] : listDays()
    let kept = 0
    for (const day of days) kept += compactDay(day)
    send(res, 200, { ok: true, days: days.length, sessions: kept })
  },

  'GET /api/export': async (req, res, url) => {
    const to = url.searchParams.get('to') || todayKey(config.dayStartHour)
    const from = url.searchParams.get('from') || shiftDay(to, -30)
    const sessions = readRange(from, to)
    const mode = url.searchParams.get('mode') || 'detail'
    if (mode === 'json') {
      return send(res, 200, { from, to, projects, sessions }, {
        'content-disposition': `attachment; filename="flux-${from}_${to}.json"`,
      })
    }
    const csv = mode === 'timesheet' ? toTimesheetCsv(sessions, projects) : toCsv(sessions, projects)
    send(res, 200, `﻿${csv}`, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="flux-${mode}-${from}_${to}.csv"`,
    })
  },
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)

  if (req.method === 'OPTIONS') {
    return send(res, 204, '', {
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    })
  }

  if (url.pathname.startsWith('/api/')) {
    if (!originAllowed(req)) return send(res, 403, { error: 'origine non autorisée' })
    if (req.headers.origin) res.setHeader('access-control-allow-origin', req.headers.origin)

    const handler = routes[`${req.method} ${url.pathname}`]
    if (!handler) return send(res, 404, { error: 'route inconnue' })
    try {
      const body = req.method === 'GET' || req.method === 'DELETE' ? null : await readBody(req)
      await handler(req, res, url, body)
    } catch (error) {
      send(res, 400, { error: error.message })
    }
    return
  }

  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' })
  await serveStatic(res, url.pathname)
})

// Coupe la session en cours quand plus rien ne l'alimente (poste verrouillé, machine en veille).
const sweeper = setInterval(() => tracker.sweep(), 30_000)
sweeper.unref?.()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    tracker.closeCurrent()
    tracker.persist()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}

server.listen(config.port, config.host, () => {
  console.log(`Flux — tableau de bord sur http://${config.host}:${config.port}`)
  console.log(`Données locales : ${process.env.FLUX_HOME || '~/.flux'}`)
})

export { server, tracker }
