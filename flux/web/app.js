const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

const state = {
  projects: [],
  config: {},
  day: null,
  weekTo: null,
  dayReport: null,
  weekReport: null,
  view: 'jour',
}

const UNASSIGNED_COLOR = '#9aa5a6'

/* ---------------------------------------------------------------- outils */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `erreur ${res.status}`)
  return data
}

function toast(message) {
  const el = $('#toast')
  el.textContent = message
  el.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => {
    el.hidden = true
  }, 2600)
}

/** 1 h 05, 42 min, 15 s — la précision utile change avec la durée. */
function humanDuration(ms) {
  const total = Math.round((ms || 0) / 1000)
  if (total < 60) return `${total} s`
  const minutes = Math.round(total / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

function clockTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function todayKey() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function shiftDay(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number)
  return shiftDay(key, -((new Date(y, m - 1, d).getDay() + 6) % 7))
}

function projectById(id) {
  return state.projects.find((p) => p.id === id)
}

function colorOf(id) {
  return projectById(id)?.color || UNASSIGNED_COLOR
}

function frenchDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/* ------------------------------------------------------------ rendu jour */

function renderBreakdown(container, rows) {
  container.innerHTML = ''
  if (!rows.length) {
    container.innerHTML = '<p class="empty">Rien d\'enregistré sur cette période.</p>'
    return
  }
  const max = Math.max(...rows.map((r) => r.durationMs))
  for (const row of rows) {
    const el = document.createElement('div')
    el.className = 'bar-row'
    el.innerHTML = `
      <div class="bar-name">
        <span class="swatch" style="background:${row.color}"></span>
        <span title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(row.durationMs / max) * 100}%;background:${row.color}"></div></div>
      <div class="bar-value">${humanDuration(row.durationMs)} · ${row.share}%</div>`
    container.append(el)
  }
}

function renderTimeline(sessions) {
  const track = $('#day-timeline')
  const scale = $('#timeline-scale')
  track.innerHTML = ''
  scale.innerHTML = ''
  if (!sessions.length) {
    track.innerHTML = '<p class="empty" style="padding:0.6rem">Aucune activité.</p>'
    return
  }
  // Le fil se cale sur les instants réels, arrondis à l'heure : une journée qui
  // déborde sur minuit reste lisible, et une journée courte n'est pas écrasée.
  const first = Math.min(...sessions.map((s) => s.start))
  const last = Math.max(...sessions.map((s) => s.end))
  const base = new Date(first).setMinutes(0, 0, 0)
  const end = new Date(last + 3_599_999).setMinutes(0, 0, 0)
  const span = Math.max(3_600_000, end - base)

  for (const s of sessions) {
    const left = ((s.start - base) / span) * 100
    const width = ((s.end - s.start) / span) * 100
    if (left < -5 || left > 105) continue
    const block = document.createElement('div')
    block.className = 'timeline-block'
    block.style.left = `${Math.max(0, left)}%`
    block.style.width = `${Math.max(0.25, width)}%`
    block.style.background = colorOf(s.projectId)
    block.title = `${clockTime(s.start)} – ${clockTime(s.end)} · ${humanDuration(s.durationMs)}\n${s.title || s.app}\n${projectById(s.projectId)?.name || 'Non classé'}`
    track.append(block)
  }

  const hours = Math.round(span / 3_600_000)
  const step = Math.max(1, Math.ceil(hours / 8))
  for (let h = 0; h <= hours; h += step) {
    const tick = document.createElement('span')
    tick.textContent = `${String(new Date(base + h * 3_600_000).getHours()).padStart(2, '0')}h`
    scale.append(tick)
  }
}

function renderRanking(container, rows, label) {
  container.innerHTML = ''
  if (!rows.length) {
    container.innerHTML = `<li class="empty">Aucun ${label}.</li>`
    return
  }
  for (const row of rows) {
    const li = document.createElement('li')
    li.innerHTML = `<span title="${escapeHtml(row.key)}">${escapeHtml(row.key)}</span><span>${humanDuration(row.durationMs)}</span>`
    container.append(li)
  }
}

function projectOptions(selectedId) {
  const options = ['<option value="">Non classé</option>']
  for (const p of state.projects.filter((p) => !p.archived)) {
    options.push(`<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`)
  }
  return options.join('')
}

function renderSessions(sessions) {
  const container = $('#day-sessions')
  container.innerHTML = ''
  $('#day-count').textContent = sessions.length ? `· ${sessions.length}` : ''
  if (!sessions.length) {
    container.innerHTML = '<p class="empty">Aucune session ce jour-là.</p>'
    return
  }
  for (const s of [...sessions].reverse()) {
    const el = document.createElement('div')
    el.className = 'session'
    const why =
      s.assignedBy === 'manual'
        ? 'rangé à la main'
        : (s.reasons || []).map((r) => `${r.kind}: ${r.value}`).join(' · ') || 'aucun signal'
    el.innerHTML = `
      <div class="session-time">${clockTime(s.start)}</div>
      <div class="session-color" style="background:${colorOf(s.projectId)}"></div>
      <div class="session-main">
        <div class="session-title" title="${escapeHtml(s.title || '')}">${escapeHtml(s.title || s.app || s.domain || '—')}</div>
        <div class="session-meta" title="${escapeHtml(why)}">${escapeHtml([s.app, s.domain].filter(Boolean).join(' · '))} — ${escapeHtml(why)}</div>
      </div>
      <div class="session-dur">${humanDuration(s.durationMs)}</div>
      <select data-session="${s.id}" data-day="${s.day}">${projectOptions(s.projectId)}</select>`
    container.append(el)
  }
}

function renderDay(report) {
  state.dayReport = report
  $('#day-total').textContent = humanDuration(report.totalMs)
  $('#day-input').value = report.day
  renderBreakdown($('#day-projects'), report.byProject)
  renderTimeline(report.sessions)
  renderRanking($('#day-sites'), report.bySite, 'site')
  renderRanking($('#day-apps'), report.byApp, 'application')
  renderSessions(report.sessions)
  renderSortQueue(report.toSort)
  const badge = $('#tab-badge')
  badge.hidden = !report.unassignedCount
  badge.textContent = report.unassignedCount
}

/* ---------------------------------------------------------- file à trier */

function renderSortQueue(items) {
  const container = $('#sort-list')
  container.innerHTML = ''
  if (!items?.length) {
    container.innerHTML = '<p class="empty">Tout est rangé. 👌</p>'
    return
  }
  for (const item of items) {
    const el = document.createElement('div')
    el.className = 'sortitem'
    el.innerHTML = `
      <div>
        <strong title="${escapeHtml(item.title)}">${escapeHtml(item.domain || item.app || item.key)}</strong>
        <span class="muted small">${escapeHtml(item.title)}</span>
      </div>
      <span class="muted">${humanDuration(item.durationMs)} · ${item.count} session${item.count > 1 ? 's' : ''}</span>
      <select data-sort-ids="${item.sessionIds.join(',')}">${projectOptions(null)}</select>`
    container.append(el)
  }
}

/* -------------------------------------------------------------- semaine */

function renderWeek(report) {
  state.weekReport = report
  $('#week-total').textContent = humanDuration(report.totalMs)
  $('#week-label').textContent = `${frenchDate(report.from)} → ${frenchDate(report.to)}`
  renderBreakdown($('#week-projects'), report.byProject)

  const chart = $('#week-days')
  chart.innerHTML = ''
  const max = Math.max(1, ...report.days.map((d) => d.totalMs))
  for (const day of report.days) {
    const el = document.createElement('div')
    el.className = 'weekday'
    const stack = report.days.length
      ? day.byProject
          .map(
            (p) =>
              `<div class="weekday-seg" style="height:${(p.durationMs / max) * 130}px;background:${p.color}" title="${escapeHtml(p.name)} · ${humanDuration(p.durationMs)}"></div>`,
          )
          .join('')
      : ''
    el.innerHTML = `
      <div class="weekday-stack">${stack}</div>
      <div class="weekday-label">${new Date(`${day.day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })}<br />${day.totalMs ? humanDuration(day.totalMs) : '—'}</div>`
    el.addEventListener('click', () => {
      state.day = day.day
      switchView('jour')
      loadDay()
    })
    chart.append(el)
  }

  const params = `from=${report.from}&to=${report.to}`
  $('#export-timesheet').href = `/api/export?mode=timesheet&${params}`
  $('#export-detail').href = `/api/export?mode=detail&${params}`
  $('#export-json').href = `/api/export?mode=json&${params}`
}

/* -------------------------------------------------------------- projets */

function renderProjects() {
  const container = $('#projects-list')
  container.innerHTML = ''
  if (!state.projects.length) {
    container.innerHTML = '<p class="empty">Aucun projet. Créez-en un pour que le rangement automatique ait une cible.</p>'
    return
  }
  for (const project of state.projects) {
    const rules = project.rules || {}
    const summary = [
      rules.domains?.length ? `${rules.domains.length} domaine(s)` : '',
      rules.apps?.length ? `${rules.apps.length} appli(s)` : '',
      rules.codes?.length ? `${rules.codes.length} code(s)` : '',
      rules.keywords?.length ? `${rules.keywords.length} mot(s)-clé(s)` : '',
      Object.keys(project.learned || {}).length ? `${Object.keys(project.learned).length} appris` : '',
    ].filter(Boolean)
    const el = document.createElement('article')
    el.className = 'project-card'
    el.style.borderLeftColor = project.color
    el.innerHTML = `
      <h3>${escapeHtml(project.name)}</h3>
      <div class="muted small">${escapeHtml(project.client || '')}</div>
      <div class="project-rules">${escapeHtml((rules.domains || []).slice(0, 4).join(', ')) || 'Aucune règle explicite'}</div>
      <div class="project-rules">${summary.join(' · ') || '—'}</div>`
    el.addEventListener('click', () => openProjectDialog(project))
    container.append(el)
  }
}

let editingProject = null

function openProjectDialog(project) {
  editingProject = project
  $('#project-dialog-title').textContent = project ? project.name : 'Nouveau projet'
  $('#pf-name').value = project?.name || ''
  $('#pf-client').value = project?.client || ''
  $('#pf-color').value = project?.color || '#2f6f6d'
  for (const key of ['domains', 'apps', 'codes', 'keywords', 'urlPatterns', 'titlePatterns']) {
    $(`#pf-${key}`).value = (project?.rules?.[key] || []).join('\n')
  }
  $('#pf-delete').hidden = !project
  $('#project-dialog').showModal()
}

/* ------------------------------------------------------------- réglages */

function renderConfig() {
  const c = state.config
  $('#cfg-ignore').value = (c.ignore || []).join('\n')
  $('#cfg-idle').value = Math.round((c.idleTimeoutMs || 180000) / 60000)
  $('#cfg-min').value = Math.round((c.minSessionMs || 8000) / 1000)
  $('#cfg-threshold').value = c.matchThreshold ?? 30
  $('#cfg-daystart').value = c.dayStartHour ?? 7
}

/* -------------------------------------------------------------- « en ce moment » */

function renderNow(snapshot) {
  const el = $('#now-value')
  if (!snapshot) {
    el.innerHTML = '<span class="muted">rien en cours</span>'
    return
  }
  const project = projectById(snapshot.projectId)
  const label = snapshot.kind === 'manual' ? `⏱ ${snapshot.title}` : snapshot.title || snapshot.app || snapshot.domain
  el.innerHTML = `<span class="dot" style="background:${project?.color || UNASSIGNED_COLOR}"></span>${escapeHtml(label)} <span class="muted">— ${humanDuration(snapshot.elapsedMs)} · ${escapeHtml(project?.name || 'non classé')}</span>`
}

/* ---------------------------------------------------------------- charge */

async function loadProjects() {
  state.projects = (await api('/api/projects')).projects
  renderProjects()
}

async function loadDay() {
  const report = await api(`/api/day?d=${state.day}`)
  renderDay(report)
}

async function loadWeek() {
  const from = weekStart(state.weekTo)
  const to = shiftDay(from, 6)
  renderWeek(await api(`/api/range?from=${from}&to=${to}`))
}

async function poll() {
  try {
    const s = await api('/api/state')
    state.serverDay = s.day
    renderNow(s.current)
    $('#pause-toggle').setAttribute('aria-pressed', String(Boolean(s.paused)))
    $('#pause-toggle').textContent = s.paused ? 'Capture en pause' : 'Pause'
    $('#timer-toggle').textContent = s.current?.kind === 'manual' ? 'Arrêter le minuteur' : 'Démarrer un minuteur'
    if (state.view === 'jour' && state.day === s.day && state.dayReport?.totalMs !== s.totalMs) await loadDay()
  } catch {
    $('#now-value').innerHTML = '<span class="muted">serveur injoignable</span>'
  }
}

/* ------------------------------------------------------------ interactions */

function switchView(view) {
  state.view = view
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === view))
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === view))
  if (view === 'semaine') loadWeek()
  if (view === 'projets') renderProjects()
  if (view === 'reglages') renderConfig()
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function wire() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)))

  $('#day-prev').addEventListener('click', () => {
    state.day = shiftDay(state.day, -1)
    loadDay()
  })
  $('#day-next').addEventListener('click', () => {
    state.day = shiftDay(state.day, 1)
    loadDay()
  })
  $('#day-today').addEventListener('click', () => {
    state.day = state.serverDay || todayKey()
    loadDay()
  })
  $('#day-input').addEventListener('change', (e) => {
    if (!e.target.value) return
    state.day = e.target.value
    loadDay()
  })

  $('#week-prev').addEventListener('click', () => {
    state.weekTo = shiftDay(state.weekTo, -7)
    loadWeek()
  })
  $('#week-next').addEventListener('click', () => {
    state.weekTo = shiftDay(state.weekTo, 7)
    loadWeek()
  })

  // Ranger une session (liste du jour) ou tout un paquet (file à trier).
  document.addEventListener('change', async (event) => {
    const select = event.target
    if (select.dataset.session) {
      await api('/api/sessions/assign', {
        method: 'POST',
        body: { id: select.dataset.session, day: select.dataset.day, projectId: select.value || null },
      })
      toast('Rangé — la règle est apprise.')
      await Promise.all([loadProjects(), loadDay()])
    } else if (select.dataset.sortIds) {
      const ids = select.dataset.sortIds.split(',').filter(Boolean)
      const { updated } = await api('/api/sessions/assign', {
        method: 'POST',
        body: { ids, day: state.day, projectId: select.value || null },
      })
      toast(`${updated} session(s) rangée(s).`)
      await Promise.all([loadProjects(), loadDay()])
    }
  })

  $('#sort-reclassify').addEventListener('click', async () => {
    const { changed } = await api('/api/reclassify', { method: 'POST', body: { from: state.day, to: state.day } })
    toast(changed ? `${changed} activité(s) rangée(s).` : 'Rien de nouveau à ranger.')
    await loadDay()
  })

  $('#pause-toggle').addEventListener('click', async () => {
    const paused = $('#pause-toggle').getAttribute('aria-pressed') !== 'true'
    state.config = (await api('/api/config', { method: 'PATCH', body: { paused } })).config
    toast(paused ? 'Capture en pause.' : 'Capture reprise.')
    poll()
  })

  $('#timer-toggle').addEventListener('click', async () => {
    if ($('#timer-toggle').textContent.startsWith('Arrêter')) {
      await api('/api/timer/stop', { method: 'POST' })
      toast('Minuteur arrêté.')
      await loadDay()
      return poll()
    }
    $('#timer-project').innerHTML = projectOptions(null)
    $('#timer-title').value = ''
    $('#timer-dialog').showModal()
  })

  $('#timer-form').addEventListener('submit', async (event) => {
    if (event.submitter?.value !== 'start') return
    await api('/api/timer/start', {
      method: 'POST',
      body: { title: $('#timer-title').value, projectId: $('#timer-project').value || null },
    })
    toast('Minuteur démarré.')
    poll()
  })

  $('#project-new').addEventListener('click', () => openProjectDialog(null))

  $('#project-form').addEventListener('submit', async (event) => {
    if (event.submitter?.value !== 'save') return
    const rules = {}
    for (const key of ['domains', 'apps', 'codes', 'keywords', 'urlPatterns', 'titlePatterns']) {
      rules[key] = $(`#pf-${key}`).value.split('\n').map((s) => s.trim()).filter(Boolean)
    }
    const body = { name: $('#pf-name').value, client: $('#pf-client').value, color: $('#pf-color').value, rules }
    if (editingProject) await api(`/api/projects?id=${editingProject.id}`, { method: 'PATCH', body })
    else await api('/api/projects', { method: 'POST', body })
    toast('Projet enregistré.')
    await Promise.all([loadProjects(), loadDay()])
  })

  $('#pf-delete').addEventListener('click', async () => {
    if (!editingProject || !confirm(`Supprimer « ${editingProject.name} » ? Les sessions déjà rangées deviennent « Non classé ».`)) return
    await api(`/api/projects?id=${editingProject.id}`, { method: 'DELETE' })
    $('#project-dialog').close()
    toast('Projet supprimé.')
    await Promise.all([loadProjects(), loadDay()])
  })

  $('#cfg-save').addEventListener('click', async () => {
    const body = {
      ignore: $('#cfg-ignore').value.split('\n'),
      idleTimeoutMs: Number($('#cfg-idle').value) * 60000,
      minSessionMs: Number($('#cfg-min').value) * 1000,
      matchThreshold: Number($('#cfg-threshold').value),
      dayStartHour: Number($('#cfg-daystart').value),
    }
    state.config = (await api('/api/config', { method: 'PATCH', body })).config
    $('#cfg-status').textContent = 'Enregistré.'
    setTimeout(() => ($('#cfg-status').textContent = ''), 2000)
  })

  $('#cfg-compact').addEventListener('click', async () => {
    const { days, sessions } = await api('/api/compact', { method: 'POST', body: {} })
    toast(`${days} journée(s) compactée(s), ${sessions} sessions.`)
  })
}

/* ----------------------------------------------------------------- départ */

async function boot() {
  wire()
  state.config = (await api('/api/config')).config
  renderConfig()
  // Le jour courant vient du serveur : avec un début de journée à 7 h, « aujourd'hui »
  // à 2 h du matin est encore la veille, et le tableau de bord doit dire la même chose.
  state.day = (await api('/api/state')).day
  state.weekTo = state.day
  await loadProjects()
  await loadDay()
  await poll()
  setInterval(poll, 5000)
}

boot().catch((error) => {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<p style="padding:1rem;color:#a8402f">Impossible de joindre le serveur Flux : ${escapeHtml(error.message)}</p>`,
  )
})
