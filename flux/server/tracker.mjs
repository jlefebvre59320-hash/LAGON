import { STATE_FILE, readJson, writeJson } from './config.mjs'
import { isIgnored, normalizeSample } from './normalize.mjs'
import { match } from './matcher.mjs'
import { newId, putSession } from './store.mjs'

/**
 * Transforme un flux de relevés (un toutes les ~15 s) en sessions de travail.
 *
 * Les relevés successifs de même signature sont recollés ; un silence plus long
 * que `idleTimeoutMs` clôt la session en cours à son dernier signe de vie, pour
 * ne jamais compter un écran resté allumé pendant une pause déjeuner.
 */
export class Tracker {
  constructor({ config, getProjects }) {
    this.config = config
    this.getProjects = getProjects
    const saved = readJson(STATE_FILE, {})
    this.current = saved.current || null
    this.manual = saved.manual || null
    this.lastClosed = saved.lastClosed || null
  }

  setConfig(config) {
    this.config = config
  }

  persist() {
    writeJson(STATE_FILE, { current: this.current, manual: this.manual, lastClosed: this.lastClosed })
  }

  /** Relevé venu de l'extension ou de l'agent. Renvoie ce qui a été fait, pour le débogage. */
  ingest(raw) {
    const sample = normalizeSample(raw)

    if (this.config.paused) return { status: 'paused' }

    // Une session manuelle en cours fait autorité : c'est une déclaration explicite.
    if (this.manual) return { status: 'manual-running', manual: this.manual }

    // Un relevé d'inactivité n'a ni titre ni domaine : il doit être traité avant
    // le test « relevé vide », sinon le poste verrouillé continue d'être compté.
    if (sample.idle) {
      this.closeCurrent(sample.ts)
      this.persist()
      return { status: 'idle' }
    }

    if (!sample.title && !sample.domain && !sample.app) return { status: 'empty' }

    if (isIgnored(sample, this.config.ignore)) {
      this.closeCurrent(sample.ts)
      this.persist()
      return { status: 'ignored' }
    }

    const gap = this.current ? sample.ts - this.current.lastSeen : Infinity

    if (this.current && this.current.signature === sample.signature && gap <= this.config.mergeGapMs) {
      this.current.lastSeen = sample.ts
      // L'URL et le titre peuvent s'affiner en cours de route (page qui finit de charger).
      if (sample.url) this.current.url = sample.url
      this.persist()
      return { status: 'extended', session: this.current }
    }

    // Silence trop long : la session s'est arrêtée à son dernier signe de vie, pas maintenant.
    const closedAt = gap > this.config.idleTimeoutMs ? this.current?.lastSeen : sample.ts
    this.closeCurrent(closedAt)
    this.openFrom(sample)
    this.persist()
    return { status: 'started', session: this.current }
  }

  openFrom(sample) {
    const decision = match(sample, this.getProjects(), { threshold: this.config.matchThreshold })
    this.current = {
      id: newId(),
      source: sample.source,
      start: sample.ts,
      lastSeen: sample.ts,
      app: sample.app,
      domain: sample.domain,
      path: sample.path,
      url: sample.url,
      title: sample.title,
      tokens: sample.tokens,
      codes: sample.codes,
      signature: sample.signature,
      projectId: decision.projectId,
      assignedBy: decision.projectId ? 'auto' : 'none',
      confidence: decision.confidence,
      reasons: decision.reasons,
    }
  }

  closeCurrent(endTs = Date.now()) {
    const session = this.current
    this.current = null
    if (!session) return null
    const end = Math.max(session.start, Math.min(endTs ?? session.lastSeen, session.lastSeen + this.config.mergeGapMs))
    const durationMs = end - session.start
    if (durationMs < this.config.minSessionMs) return null // alt-tab : du bruit, pas du travail
    const record = putSession(
      { ...session, end, durationMs, lastSeen: undefined },
      this.config.dayStartHour,
    )
    this.lastClosed = { id: record.id, end: record.end }
    return record
  }

  /** Coupe la session en cours si plus rien ne l'alimente (appelé par une minuterie). */
  sweep(now = Date.now()) {
    if (this.current && now - this.current.lastSeen > this.config.idleTimeoutMs) {
      const closed = this.closeCurrent(this.current.lastSeen)
      this.persist()
      return closed
    }
    return null
  }

  /** Minuteur manuel : réunion, appel, déplacement — tout ce qui n'a pas d'écran. */
  startManual({ title = 'Activité', projectId = null, note = '' } = {}) {
    this.closeCurrent()
    this.manual = {
      id: newId(),
      source: 'manual',
      start: Date.now(),
      title: String(title).slice(0, 300),
      note: String(note).slice(0, 1000),
      app: 'Saisie manuelle',
      domain: '',
      path: '',
      url: '',
      tokens: [],
      codes: [],
      projectId,
      assignedBy: projectId ? 'manual' : 'none',
      confidence: projectId ? 1 : 0,
      reasons: [],
    }
    this.persist()
    return this.manual
  }

  stopManual() {
    const running = this.manual
    this.manual = null
    if (!running) return null
    const end = Date.now()
    const record = putSession(
      { ...running, end, durationMs: end - running.start },
      this.config.dayStartHour,
    )
    this.persist()
    return record
  }

  /** Session déjà terminée, saisie après coup (« hier 14h-15h30, réunion client »). */
  addManual({ title = 'Activité', projectId = null, start, end, note = '' }) {
    const s = Number(start)
    const e = Number(end)
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
    return putSession(
      {
        id: newId(),
        source: 'manual',
        start: s,
        end: e,
        durationMs: e - s,
        title: String(title).slice(0, 300),
        note: String(note).slice(0, 1000),
        app: 'Saisie manuelle',
        domain: '',
        path: '',
        url: '',
        tokens: [],
        codes: [],
        projectId,
        assignedBy: projectId ? 'manual' : 'none',
        confidence: projectId ? 1 : 0,
        reasons: [],
      },
      this.config.dayStartHour,
    )
  }

  /** Vue de l'instant : ce qui est en train d'être compté. */
  snapshot(now = Date.now()) {
    if (this.manual) return { kind: 'manual', ...this.manual, elapsedMs: now - this.manual.start }
    if (this.current) {
      return {
        kind: 'auto',
        ...this.current,
        elapsedMs: this.current.lastSeen - this.current.start,
        staleMs: now - this.current.lastSeen,
      }
    }
    return null
  }
}
