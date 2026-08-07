import { randomUUID } from 'node:crypto'
import { PROJECTS_FILE, readJson, writeJson } from './config.mjs'

const PALETTE = ['#c9a86a', '#3a7d7c', '#a8553f', '#5b6ea8', '#7a8b3f', '#8a5a8f', '#b5793a', '#4a7fa5']

/**
 * Projets livrés au premier lancement : quelques rangements évidents pour que
 * le tri automatique ait déjà quelque chose à dire dès la première heure.
 * Tout est modifiable depuis le tableau de bord.
 */
function seedProjects() {
  return [
    {
      id: randomUUID(),
      name: 'Développement',
      color: PALETTE[1],
      rules: {
        domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com'],
        apps: ['Code', 'Visual Studio Code', 'Terminal', 'iTerm', 'WindowsTerminal', 'nvim'],
        keywords: ['commit', 'merge', 'deploy', 'build', 'pull request'],
      },
      learned: {},
    },
    {
      id: randomUUID(),
      name: 'Communication',
      color: PALETTE[3],
      rules: {
        domains: ['slack.com', 'teams.microsoft.com', 'outlook.office.com', 'mail.google.com', 'meet.google.com'],
        apps: ['Slack', 'Teams', 'Outlook', 'Thunderbird', 'Zoom'],
        keywords: ['réunion', 'meeting', 'visio'],
      },
      learned: {},
    },
    {
      id: randomUUID(),
      name: 'Gestion & suivi',
      color: PALETTE[0],
      rules: {
        domains: ['airtable.com', 'notion.so', 'accelo.com', 'linear.app', 'atlassian.net'],
        apps: ['Excel', 'LibreOffice Calc'],
        keywords: ['ticket', 'facture', 'devis', 'planning', 'budget'],
      },
      learned: {},
    },
    {
      id: randomUUID(),
      name: 'Veille & lecture',
      color: PALETTE[4],
      rules: {
        domains: ['news.ycombinator.com', 'lemonde.fr', 'youtube.com', 'medium.com'],
        keywords: ['article', 'blog'],
      },
      learned: {},
    },
  ]
}

export function loadProjects() {
  const stored = readJson(PROJECTS_FILE, null)
  if (Array.isArray(stored) && stored.length) return stored
  const seeded = seedProjects()
  writeJson(PROJECTS_FILE, seeded)
  return seeded
}

export function saveProjects(projects) {
  writeJson(PROJECTS_FILE, projects)
  return projects
}

export function createProject(projects, input = {}) {
  const project = {
    id: randomUUID(),
    name: String(input.name || 'Nouveau projet').slice(0, 80),
    color: input.color || PALETTE[projects.length % PALETTE.length],
    client: String(input.client || '').slice(0, 80),
    archived: false,
    rules: {
      domains: [],
      apps: [],
      keywords: [],
      codes: [],
      urlPatterns: [],
      titlePatterns: [],
      ...(input.rules || {}),
    },
    learned: {},
    createdAt: Date.now(),
  }
  projects.push(project)
  return project
}

export function updateProject(projects, id, patch = {}) {
  const project = projects.find((p) => p.id === id)
  if (!project) return null
  if (patch.name !== undefined) project.name = String(patch.name).slice(0, 80)
  if (patch.color !== undefined) project.color = patch.color
  if (patch.client !== undefined) project.client = String(patch.client).slice(0, 80)
  if (patch.archived !== undefined) project.archived = Boolean(patch.archived)
  if (patch.rules) project.rules = { ...project.rules, ...normalizeRules(patch.rules) }
  return project
}

/** Les règles arrivent du formulaire en texte libre (une entrée par ligne ou séparée par des virgules). */
export function normalizeRules(rules = {}) {
  const out = {}
  for (const key of ['domains', 'apps', 'keywords', 'codes', 'urlPatterns', 'titlePatterns']) {
    if (rules[key] === undefined) continue
    const raw = Array.isArray(rules[key]) ? rules[key] : String(rules[key]).split(/[\n,]/)
    out[key] = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 120)
  }
  return out
}

export function deleteProject(projects, id) {
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return false
  projects.splice(index, 1)
  return true
}
