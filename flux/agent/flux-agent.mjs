#!/usr/bin/env node
/**
 * Agent bureau : relève la fenêtre au premier plan et le temps d'inactivité,
 * puis les envoie au serveur Flux local. C'est ce qui permet de voir Outlook,
 * Teams, VS Code ou un terminal — tout ce que l'extension navigateur ne voit pas.
 *
 *   node agent/flux-agent.mjs [--endpoint http://127.0.0.1:7749] [--interval 20]
 *
 * Rien n'est envoyé ailleurs que sur la boucle locale. Si le serveur est coupé,
 * les relevés attendent en mémoire et repartent ensemble à son retour.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'

const run = promisify(execFile)

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const ENDPOINT = (argValue('endpoint', process.env.FLUX_ENDPOINT || 'http://127.0.0.1:7749')).replace(/\/+$/, '')
const INTERVAL_MS = Math.max(5, Number(argValue('interval', 20))) * 1000
const IDLE_THRESHOLD_S = Math.max(30, Number(argValue('idle', 120)))
const VERBOSE = args.includes('--verbose')

const queue = []
const QUEUE_MAX = 2000
const warned = new Set()

function warnOnce(key, message) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

/* --------------------------------------------------------------- Linux (X11) */

async function linuxActiveWindow() {
  try {
    const { stdout: idOut } = await run('xdotool', ['getactivewindow'])
    const id = idOut.trim()
    const [{ stdout: name }, { stdout: cls }] = await Promise.all([
      run('xdotool', ['getwindowname', id]),
      run('xprop', ['-id', id, 'WM_CLASS']).catch(() => ({ stdout: '' })),
    ])
    const app = (cls.match(/"([^"]+)"\s*$/) || [])[1] || ''
    return { app, title: name.trim() }
  } catch {
    warnOnce(
      'linux-tools',
      'Fenêtre active illisible. Installez xdotool (`sudo apt install xdotool x11-utils`).\n' +
        'Sous Wayland, ces outils ne voient pas les fenêtres : la capture bureau reste indisponible, l\'extension navigateur continue de fonctionner.',
    )
    return null
  }
}

async function linuxIdleSeconds() {
  try {
    const { stdout } = await run('xprintidle', [])
    return Number(stdout.trim()) / 1000
  } catch {
    warnOnce('xprintidle', 'xprintidle absent : l\'inactivité clavier/souris n\'est pas détectée (`sudo apt install xprintidle`).')
    return 0
  }
}

/* ------------------------------------------------------------------- macOS */

const MAC_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set winTitle to name of front window of frontApp
  on error
    set winTitle to ""
  end try
end tell
return appName & "|" & winTitle
`

async function macActiveWindow() {
  try {
    const { stdout } = await run('osascript', ['-e', MAC_SCRIPT])
    const [app, ...rest] = stdout.trim().split('|')
    return { app: app || '', title: rest.join('|') }
  } catch {
    warnOnce(
      'mac-permission',
      'Fenêtre active illisible. Autorisez le terminal dans Réglages Système → Confidentialité et sécurité → Accessibilité.',
    )
    return null
  }
}

async function macIdleSeconds() {
  try {
    const { stdout } = await run('sh', ['-c', "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}'"])
    return Number(stdout.trim()) / 1_000_000_000
  } catch {
    return 0
  }
}

/* ----------------------------------------------------------------- Windows */

const WIN_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Flux {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  public static uint IdleMs() {
    LASTINPUTINFO i = new LASTINPUTINFO();
    i.cbSize = (uint)Marshal.SizeOf(i);
    GetLastInputInfo(ref i);
    return (uint)Environment.TickCount - i.dwTime;
  }
}
"@
$h = [Flux]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][Flux]::GetWindowText($h, $sb, 512)
$pid2 = 0
[void][Flux]::GetWindowThreadProcessId($h, [ref]$pid2)
$name = ""
try { $name = (Get-Process -Id $pid2 -ErrorAction Stop).ProcessName } catch {}
Write-Output ("{0}|{1}|{2}" -f $name, $sb.ToString(), [Flux]::IdleMs())
`

async function windowsSample() {
  try {
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
    const [app, title, idleMs] = stdout.trim().split('|')
    return { app: app || '', title: title || '', idleSeconds: Number(idleMs) / 1000 }
  } catch {
    warnOnce('win-powershell', 'PowerShell injoignable : la capture des applications Windows est désactivée.')
    return null
  }
}

/* ------------------------------------------------------------------- boucle */

async function readSample() {
  const os = platform()
  if (os === 'win32') return windowsSample()
  if (os === 'darwin') {
    const [window, idleSeconds] = await Promise.all([macActiveWindow(), macIdleSeconds()])
    return window && { ...window, idleSeconds }
  }
  const [window, idleSeconds] = await Promise.all([linuxActiveWindow(), linuxIdleSeconds()])
  return window && { ...window, idleSeconds }
}

/**
 * Le navigateur est déjà couvert, en bien plus fin, par l'extension : si on
 * remontait aussi sa fenêtre, chaque page compterait deux fois.
 */
const BROWSER_APPS = /^(chrome|chromium|google-chrome|firefox|msedge|safari|brave|opera|vivaldi|zen)/i

async function tick() {
  const sample = await readSample()
  if (!sample) return

  const idle = sample.idleSeconds >= IDLE_THRESHOLD_S
  if (!idle && BROWSER_APPS.test(sample.app || '')) {
    if (VERBOSE) console.log(`· navigateur ignoré (${sample.app})`)
    return
  }

  const payload = {
    source: 'agent',
    ts: Date.now(),
    app: sample.app,
    title: sample.title,
    idle,
  }
  if (VERBOSE) console.log(`${idle ? '💤' : '▶'} ${payload.app} — ${payload.title}`)
  await send(payload)
}

async function send(sample) {
  try {
    const response = await fetch(`${ENDPOINT}/api/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sample),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    warned.delete('offline')
    if (queue.length) await flush()
  } catch (error) {
    queue.push(sample)
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX)
    warnOnce('offline', `Serveur Flux injoignable (${error.message}) — les relevés sont mis de côté et repartiront tout seuls.`)
  }
}

async function flush() {
  const batch = queue.splice(0, 500)
  try {
    const response = await fetch(`${ENDPOINT}/api/heartbeat/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ samples: batch }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    console.log(`${batch.length} relevé(s) en attente ont été rattrapés.`)
  } catch {
    queue.unshift(...batch)
  }
}

console.log(`Agent Flux — ${platform()} → ${ENDPOINT} (relevé toutes les ${INTERVAL_MS / 1000} s)`)
tick()
const loop = setInterval(() => {
  tick().catch((error) => console.error('relevé impossible :', error.message))
}, INTERVAL_MS)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(loop)
    console.log('\nAgent arrêté.')
    process.exit(0)
  })
}
