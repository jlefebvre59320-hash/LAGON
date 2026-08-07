/**
 * Capture navigateur : quel onglet est réellement sous les yeux, et depuis quand.
 *
 * On envoie un relevé au serveur local à chaque changement d'onglet et toutes
 * les 30 s tant que l'onglet reste actif. Le serveur recolle ces relevés en
 * sessions — l'extension ne compte rien elle-même, elle observe.
 *
 * Si le serveur est éteint, les relevés sont mis en file localement et rejoués
 * au retour : une journée de travail n'est pas perdue parce que Flux n'a pas
 * été lancé le matin.
 */

const DEFAULTS = { endpoint: 'http://127.0.0.1:7749', enabled: true, idleSeconds: 120 }
const ALARM = 'flux-heartbeat'
const QUEUE_KEY = 'queue'
const QUEUE_MAX = 2000

async function settings() {
  const stored = await chrome.storage.local.get(['endpoint', 'enabled', 'idleSeconds'])
  return { ...DEFAULTS, ...stored }
}

chrome.runtime.onInstalled.addListener(async () => {
  const { idleSeconds } = await settings()
  chrome.idle.setDetectionInterval(Math.max(15, idleSeconds))
  chrome.alarms.create(ALARM, { periodInMinutes: 0.5 })
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 0.5 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) capture('tick')
})

chrome.tabs.onActivated.addListener(() => capture('activated'))
chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
  // Le titre arrive souvent après l'URL : on attend qu'il soit là pour ne pas
  // enregistrer une page « en cours de chargement ».
  if (tab.active && (changeInfo.title || changeInfo.status === 'complete')) capture('updated')
})
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) capture('blur', { idle: true })
  else capture('focus')
})
chrome.idle.onStateChanged.addListener((idleState) => {
  if (idleState !== 'active') capture('idle', { idle: true })
  else capture('active')
})

async function capture(_reason, extra = {}) {
  const config = await settings()
  if (!config.enabled) return

  if (extra.idle) return post({ source: 'browser', ts: Date.now(), idle: true }, config)

  const idleState = await chrome.idle.queryState(Math.max(15, config.idleSeconds))
  if (idleState !== 'active') return post({ source: 'browser', ts: Date.now(), idle: true }, config)

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab || !tab.url) return

  // Les pages internes du navigateur ne sont pas du travail : on ne les remonte pas.
  if (/^(chrome|edge|about|devtools|chrome-extension|moz-extension):/i.test(tab.url)) return

  await post({ source: 'browser', ts: Date.now(), url: tab.url, title: tab.title || '', app: 'Navigateur' }, config)
}

async function post(sample, config) {
  try {
    const response = await fetch(`${config.endpoint}/api/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sample),
    })
    if (!response.ok) throw new Error(String(response.status))
    await flushQueue(config)
  } catch {
    await enqueue(sample)
  }
}

async function enqueue(sample) {
  const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY)
  queue.push(sample)
  // On garde les plus récents : au-delà, la file ne raconte plus rien d'utile.
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-QUEUE_MAX) })
}

async function flushQueue(config) {
  const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY)
  if (!queue.length) return
  const response = await fetch(`${config.endpoint}/api/heartbeat/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ samples: queue.slice(0, 500) }),
  })
  if (!response.ok) return
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(500) })
}
