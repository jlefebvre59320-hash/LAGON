import { matchesPattern } from './normalize.mjs'

/**
 * Rangement automatique d'une activité dans un projet.
 *
 * Deux sources de signal, cumulées :
 *  1. les règles explicites du projet (domaines, applis, codes, mots-clés, motifs d'URL) ;
 *  2. l'apprentissage — chaque fois qu'une activité est reclassée à la main,
 *     ses jetons sont crédités au projet choisi et débités au projet abandonné.
 *
 * Le score le plus haut gagne s'il dépasse le seuil ; sinon l'activité reste
 * « Non classé » et remonte dans la file à trier du tableau de bord.
 */

const WEIGHTS = {
  code: 120, // un code ticket/SAM ne ment pas
  urlPattern: 80,
  domainPath: 70, // domaine + début de chemin : airtable.com/appXXX
  domain: 45,
  app: 40,
  titlePattern: 60,
  keyword: 25,
  learnedToken: 4, // faible seul, décisif en nombre
  learnedMax: 40, // plafond des jetons appris
  /**
   * Poids du site appris, par correction. Le dosage est le cœur du comportement :
   * une correction suffit à ranger un site que personne d'autre ne réclame
   * (20 + jetons > seuil), mais pas à détrôner une règle écrite à la main
   * (20 + jetons < 45) ; deux corrections répétées, si. Un choix humain redit
   * vaut mieux qu'une règle générique.
   */
  learnedDomain: 20,
  learnedDomainMax: 45,
}

function asArray(v) {
  if (!v) return []
  return Array.isArray(v) ? v.filter(Boolean) : [v]
}

function safeRegex(pattern) {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

/**
 * Score d'un projet pour un échantillon, avec le détail des signaux retenus
 * (le tableau de bord affiche « pourquoi » une activité a été rangée là).
 */
export function scoreProject(sample, project) {
  const rules = project.rules || {}
  const reasons = []
  let score = 0

  const codes = new Set(sample.codes || [])
  for (const code of asArray(rules.codes)) {
    const c = String(code).toLowerCase()
    if (codes.has(c) || [...codes].some((k) => k.startsWith(c))) {
      score += WEIGHTS.code
      reasons.push({ kind: 'code', value: code, points: WEIGHTS.code })
    }
  }

  for (const pattern of asArray(rules.urlPatterns)) {
    const target = sample.domain ? `${sample.domain}${sample.path}` : sample.url
    if (target && (matchesPattern(pattern, target) || target.toLowerCase().includes(String(pattern).toLowerCase()))) {
      score += WEIGHTS.urlPattern
      reasons.push({ kind: 'url', value: pattern, points: WEIGHTS.urlPattern })
    }
  }

  for (const d of asArray(rules.domains)) {
    const rule = String(d).toLowerCase()
    if (!sample.domain) continue
    const withPath = `${sample.domain}${sample.path}`
    if (rule.includes('/')) {
      if (withPath.toLowerCase().startsWith(rule)) {
        score += WEIGHTS.domainPath
        reasons.push({ kind: 'domaine', value: d, points: WEIGHTS.domainPath })
      }
      continue
    }
    if (sample.domain === rule || sample.domain.endsWith(`.${rule}`) || matchesPattern(rule, sample.domain)) {
      score += WEIGHTS.domain
      reasons.push({ kind: 'domaine', value: d, points: WEIGHTS.domain })
    }
  }

  for (const a of asArray(rules.apps)) {
    if (sample.app && (matchesPattern(a, sample.app) || sample.app.toLowerCase().includes(String(a).toLowerCase()))) {
      score += WEIGHTS.app
      reasons.push({ kind: 'appli', value: a, points: WEIGHTS.app })
    }
  }

  for (const p of asArray(rules.titlePatterns)) {
    const rx = safeRegex(p)
    if (rx && sample.title && rx.test(sample.title)) {
      score += WEIGHTS.titlePattern
      reasons.push({ kind: 'titre', value: p, points: WEIGHTS.titlePattern })
    }
  }

  const tokens = new Set(sample.tokens || [])
  for (const k of asArray(rules.keywords)) {
    const kw = String(k).toLowerCase()
    const hit = tokens.has(kw) || (sample.title || '').toLowerCase().includes(kw)
    if (hit) {
      score += WEIGHTS.keyword
      reasons.push({ kind: 'mot-clé', value: k, points: WEIGHTS.keyword })
    }
  }

  const learned = project.learned || {}
  let learnedScore = 0
  const learnedHits = []
  for (const token of tokens) {
    const weight = learned[token]
    if (weight > 0) {
      learnedScore += Math.min(weight, 5) * WEIGHTS.learnedToken
      learnedHits.push(token)
    }
  }
  if (learnedScore > 0) {
    const capped = Math.min(learnedScore, WEIGHTS.learnedMax)
    score += capped
    reasons.push({ kind: 'appris', value: learnedHits.slice(0, 5).join(', '), points: capped })
  }

  // Le site lui-même est le signal appris le plus fort : c'est ce que l'on
  // désigne en rangeant une activité à la main.
  const domainCount = sample.domain ? learned[`@${sample.domain}`] || 0 : 0
  if (domainCount > 0) {
    const points = Math.min(domainCount * WEIGHTS.learnedDomain, WEIGHTS.learnedDomainMax)
    score += points
    reasons.push({ kind: 'appris (site)', value: sample.domain, points })
  }

  return { score: Math.round(score), reasons }
}

/**
 * Choisit le projet d'une activité. Renvoie toujours un objet, même sans gagnant,
 * pour que l'appelant sache s'il doit mettre l'activité dans la file à trier.
 */
export function match(sample, projects = [], { threshold = 30 } = {}) {
  const ranked = projects
    .filter((p) => p.archived !== true)
    .map((p) => ({ project: p, ...scoreProject(sample, p) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  const runnerUp = ranked[1]
  if (!best || best.score < threshold) {
    return { projectId: null, score: best?.score || 0, reasons: [], confidence: 0, alternatives: ranked.slice(0, 3) }
  }

  // Confiance : à quel point le gagnant se détache du suivant.
  const gap = best.score - (runnerUp?.score || 0)
  const confidence = Math.max(0, Math.min(1, (best.score / 120) * 0.6 + (gap / 60) * 0.4))

  return {
    projectId: best.project.id,
    score: best.score,
    reasons: best.reasons,
    confidence: Number(confidence.toFixed(2)),
    alternatives: ranked.slice(0, 3),
  }
}

/**
 * Apprentissage : l'utilisateur a rangé cette activité dans `toProjectId`.
 * On crédite les jetons et le domaine au projet choisi, et on débite le projet
 * proposé à tort — sinon une mauvaise habitude se réinstalle à chaque relevé.
 */
export function learn(projects, session, toProjectId, fromProjectId = null) {
  const gainer = projects.find((p) => p.id === toProjectId)
  if (gainer) {
    gainer.learned ||= {}
    for (const token of session.tokens || []) {
      gainer.learned[token] = Math.min((gainer.learned[token] || 0) + 1, 12)
    }
    if (session.domain) {
      gainer.rules ||= {}
      gainer.rules.domains ||= []
      gainer.learned[`@${session.domain}`] = (gainer.learned[`@${session.domain}`] || 0) + 1

      // Un domaine réassigné 3 fois vers le même projet devient une règle explicite —
      // sauf s'il appartient déjà, explicitement, à un autre projet : on ne réécrit
      // pas une règle posée à la main, on laisse le poids appris trancher.
      const claimedElsewhere = projects.some(
        (p) => p.id !== gainer.id && (p.rules?.domains || []).some((d) => String(d).toLowerCase() === session.domain),
      )
      const alreadyThere = gainer.rules.domains.some((d) => String(d).toLowerCase() === session.domain)
      if (gainer.learned[`@${session.domain}`] >= 3 && !alreadyThere && !claimedElsewhere) {
        gainer.rules.domains.push(session.domain)
        gainer.autoDomains = [...new Set([...(gainer.autoDomains || []), session.domain])]
      }
    }
  }

  const loser = fromProjectId && fromProjectId !== toProjectId ? projects.find((p) => p.id === fromProjectId) : null
  if (loser) {
    loser.learned ||= {}
    for (const token of session.tokens || []) {
      if (loser.learned[token]) {
        loser.learned[token] -= 2
        if (loser.learned[token] <= 0) delete loser.learned[token]
      }
    }
    // Une règle de domaine apprise toute seule se défait aussi toute seule ;
    // une règle écrite à la main, jamais.
    const key = `@${session.domain}`
    if (session.domain && loser.learned[key]) {
      loser.learned[key] -= 2
      if (loser.learned[key] <= 0) delete loser.learned[key]
      if ((loser.learned[key] || 0) < 3 && (loser.autoDomains || []).includes(session.domain)) {
        loser.rules.domains = (loser.rules.domains || []).filter((d) => String(d).toLowerCase() !== session.domain)
        loser.autoDomains = loser.autoDomains.filter((d) => d !== session.domain)
      }
    }
  }

  return projects
}
