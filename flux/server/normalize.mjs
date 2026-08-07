/**
 * Mise en forme d'un relevé brut (onglet, fenêtre, saisie) en signal exploitable :
 * domaine, chemin, titre propre, et les jetons qui serviront à ranger par projet.
 */

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|_hs)/i

/** Suffixes de marque que les onglets collent au titre et qui polluent les jetons. */
const TITLE_TAILS = [
  ' - Google Chrome',
  ' — Mozilla Firefox',
  ' - Mozilla Firefox',
  ' and 1 more page - Personal',
  ' - Microsoft​ Edge',
  ' - Microsoft Edge',
]

/** Mots trop communs pour distinguer un projet d'un autre. */
const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
  'en', 'sur', 'pour', 'par', 'dans', 'avec', 'sans', 'chez', 'que', 'qui',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your',
  'new', 'tab', 'page', 'home', 'accueil', 'inbox', 'boite', 'boîte',
  'google', 'search', 'recherche', 'www', 'com', 'fr', 'net', 'org', 'io',
  'https', 'http', 'html', 'php', 'index', 'login', 'connexion',
])

export function parseUrl(rawUrl) {
  if (!rawUrl) return { domain: '', path: '', url: '' }
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return { domain: '', path: '', url: String(rawUrl).slice(0, 500) }
  }
  if (!/^https?:$/.test(u.protocol)) {
    // file://, chrome://, vscode:// — pas de domaine, mais le chemin reste parlant.
    return { domain: u.protocol.replace(':', ''), path: u.pathname, url: u.href.slice(0, 500) }
  }
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key)
  }
  const domain = u.hostname.replace(/^www\./, '').toLowerCase()
  return { domain, path: u.pathname + (u.search || ''), url: u.href.slice(0, 500) }
}

export function cleanTitle(title = '') {
  let t = String(title).trim()
  for (const tail of TITLE_TAILS) {
    if (t.endsWith(tail)) t = t.slice(0, -tail.length)
  }
  // Les compteurs de notifications changent à chaque relevé et casseraient le recollage.
  t = t.replace(/^\(\d+\)\s*/, '').replace(/^\s*[•●]\s*/, '')
  return t.trim().slice(0, 300)
}

/**
 * Codes métier repérables dans un titre ou une URL : ticket Accelo (T15423),
 * code SAM (EROCAM401), ticket Jira/Linear (ABC-123), identifiant de PR (#421).
 * Ce sont les signaux les plus fiables pour rattacher une activité à un projet.
 */
export function extractCodes(text = '') {
  const codes = new Set()
  const s = String(text)
  for (const m of s.matchAll(/\bT-?(\d{4,6})\b/gi)) codes.add(`t${m[1]}`)
  for (const m of s.matchAll(/\b([A-Z]{3,8}\d{2,4}[A-Z]?\d*)\b/g)) codes.add(m[1].toLowerCase())
  for (const m of s.matchAll(/\b([A-Z]{2,6})-(\d{1,5})\b/g)) codes.add(`${m[1].toLowerCase()}-${m[2]}`)
  return [...codes]
}

/** Jetons signifiants du titre + du chemin, base de l'apprentissage. */
export function tokenize(text = '') {
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && w.length <= 30 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    ),
  ].slice(0, 40)
}

/**
 * Signature d'une activité : deux relevés de même signature consécutifs
 * sont le même moment de travail, et sont fusionnés.
 */
export function signature(sample) {
  if (sample.source === 'manual') return `manual:${sample.title}`
  const key = sample.domain ? `${sample.domain}${firstPathSegment(sample.path)}` : sample.app || ''
  return `${sample.source}:${key}:${sample.title}`
}

function firstPathSegment(path = '') {
  const seg = String(path).split('?')[0].split('/').filter(Boolean)[0]
  return seg ? `/${seg}` : ''
}

/** Transforme un relevé brut reçu par l'API en échantillon normalisé. */
export function normalizeSample(raw = {}) {
  const { domain, path, url } = parseUrl(raw.url)
  const title = cleanTitle(raw.title)
  const app = String(raw.app || '').trim().slice(0, 120)
  const sample = {
    source: raw.source === 'agent' || raw.source === 'manual' ? raw.source : 'browser',
    ts: Number.isFinite(raw.ts) ? raw.ts : Date.now(),
    domain,
    path,
    url,
    title,
    app: app || (domain ? 'Navigateur' : ''),
    idle: Boolean(raw.idle),
  }
  sample.codes = extractCodes(`${title} ${path}`)
  sample.tokens = tokenize(`${title} ${path.replace(/[/?=&]/g, ' ')} ${domain.replace(/\./g, ' ')}`)
  sample.signature = signature(sample)
  return sample
}

/** Un motif d'exclusion accepte les jokers : `*.bank`, `mail.google.com/*`, `Signal`. */
export function matchesPattern(pattern, value) {
  if (!pattern || !value) return false
  const rx = new RegExp(
    `^${String(pattern)
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')}$`,
  )
  return rx.test(String(value).toLowerCase())
}

export function isIgnored(sample, ignoreList = []) {
  const haystacks = [
    sample.domain,
    sample.domain ? `${sample.domain}${sample.path}` : '',
    sample.app,
    sample.title,
  ].filter(Boolean)
  return ignoreList.some((raw) => {
    const p = String(raw || '').trim()
    if (!p) return false
    if (p.includes('*')) return haystacks.some((h) => matchesPattern(p, h))
    // Sans joker, un motif d'au moins 3 caractères vaut « contient » : `Signal`, `impots.gouv`.
    const needle = p.toLowerCase()
    if (needle.length < 3) return haystacks.some((h) => h.toLowerCase() === needle)
    return haystacks.some((h) => h.toLowerCase().includes(needle))
  })
}
