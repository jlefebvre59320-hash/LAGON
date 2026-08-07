const DEFAULTS = { endpoint: 'http://127.0.0.1:7749', enabled: true, idleSeconds: 120 }
const $ = (id) => document.getElementById(id)

async function load() {
  const config = { ...DEFAULTS, ...(await chrome.storage.local.get(['endpoint', 'enabled', 'idleSeconds'])) }
  $('enabled').checked = config.enabled
  $('endpoint').value = config.endpoint
  $('idleSeconds').value = config.idleSeconds
  $('open').href = config.endpoint

  const { queue = [] } = await chrome.storage.local.get('queue')
  $('queue').textContent = queue.length ? `${queue.length} relevé(s) en attente d'envoi.` : ''
}

$('save').addEventListener('click', async () => {
  const endpoint = $('endpoint').value.trim().replace(/\/+$/, '') || DEFAULTS.endpoint
  const idleSeconds = Math.max(15, Number($('idleSeconds').value) || DEFAULTS.idleSeconds)
  await chrome.storage.local.set({ endpoint, enabled: $('enabled').checked, idleSeconds })
  chrome.idle.setDetectionInterval(idleSeconds)
  $('status').textContent = 'Enregistré.'
  $('open').href = endpoint
})

$('test').addEventListener('click', async () => {
  const endpoint = $('endpoint').value.trim().replace(/\/+$/, '') || DEFAULTS.endpoint
  $('status').textContent = 'Test en cours…'
  try {
    const res = await fetch(`${endpoint}/api/state`)
    const data = await res.json()
    $('status').textContent = `Serveur joignable — ${Math.round((data.totalMs || 0) / 60000)} min enregistrées aujourd'hui.`
  } catch (error) {
    $('status').textContent = `Serveur injoignable (${error.message}). Lancez « npm start » dans flux/.`
  }
})

load()
