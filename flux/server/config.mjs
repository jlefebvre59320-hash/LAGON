import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

/**
 * Tout vit sur le poste. FLUX_HOME permet de déplacer le dossier (tests, second profil).
 */
export const HOME = process.env.FLUX_HOME || join(homedir(), '.flux')
export const DAYS_DIR = join(HOME, 'days')
export const CONFIG_FILE = join(HOME, 'config.json')
export const PROJECTS_FILE = join(HOME, 'projects.json')
export const STATE_FILE = join(HOME, 'state.json')

const DEFAULTS = {
  port: 7749,
  host: '127.0.0.1',
  /** Au-delà de ce silence, la session courante est close : on ne compte pas l'écran laissé allumé. */
  idleTimeoutMs: 3 * 60_000,
  /** Deux relevés identiques séparés de moins que ça sont recollés en une seule session. */
  mergeGapMs: 45_000,
  /** Sous ce seuil, la session est du bruit (alt-tab) et n'est pas conservée. */
  minSessionMs: 8_000,
  /** Score minimal pour qu'un rangement automatique soit retenu. */
  matchThreshold: 30,
  /** Domaines et applications jamais enregistrés (banque, santé, perso…). */
  ignore: ['*.bank', 'mail.google.com/mail/u/1'],
  /** Capture en pause : plus rien n'est enregistré tant que ça vaut true. */
  paused: false,
  /** Journée de travail affichée par défaut sur le tableau de bord. */
  dayStartHour: 7,
}

export function ensureHome() {
  mkdirSync(DAYS_DIR, { recursive: true })
}

export function readJson(file, fallback) {
  try {
    if (!existsSync(file)) return structuredClone(fallback)
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return structuredClone(fallback)
  }
}

export function writeJson(file, value) {
  ensureHome()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  // rename est atomique sur le même volume : jamais de fichier à moitié écrit si ça coupe.
  renameSync(tmp, file)
}

export function loadConfig() {
  return { ...DEFAULTS, ...readJson(CONFIG_FILE, {}) }
}

export function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch }
  writeJson(CONFIG_FILE, next)
  return next
}

export { DEFAULTS }
