import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9522

const svgPath = process.argv[2]
const size = Number(process.argv[3] || 512)
const outPath = process.argv[4] || 'icon-out.png'
const bg = process.argv[5] || null // color de fondo del <html>, o null para transparente

const svgContent = fs.readFileSync(svgPath, 'utf8')

function sh(url, opts) {
  return fetch(url, opts).then((r) => r.json())
}

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try { await sh(`http://127.0.0.1:${PORT}/json/version`); return } catch { await new Promise((r) => setTimeout(r, 300)) }
  }
  throw new Error('CDP no respondió a tiempo')
}

class CdpClient {
  constructor(ws) {
    this.ws = ws
    this.nextId = 1
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-chrome-'))
  const chrome = spawn(CHROME_PATH, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--window-size=${size},${size}`, `--user-data-dir=${userDataDir}`,
    '--force-color-profile=srgb', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' })

  try {
    await waitForCdp()
    const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
    const cdp = new CdpClient(ws)
    await cdp.send('Page.enable')
    if (bg === null) {
      // omitBackground de Puppeteer no existe en el protocolo CDP puro; el
      // equivalente real es forzar el color de fondo por defecto a alpha 0.
      await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    }

    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:${bg ?? 'transparent'};}
      svg{display:block;width:${size}px;height:${size}px;}
    </style></head><body>${svgContent}</body></html>`

    const loadOnce = () => new Promise((resolve) => {
      const handler = (ev) => {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', handler); resolve() }
      }
      ws.addEventListener('message', handler)
    })
    const load1 = loadOnce()
    await cdp.send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) })
    await load1
    await new Promise((r) => setTimeout(r, 150))

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false })
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
      captureBeyondViewport: true,
    })
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'))
    console.log('saved', outPath, size + 'x' + size)
    ws.close()
  } finally {
    chrome.kill()
    await new Promise((r) => setTimeout(r, 300))
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
