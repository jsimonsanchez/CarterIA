import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL = process.argv[2] || 'http://localhost:5173'
const OUT = process.argv[3] || 'visual-check.png'
const COLOR_SCHEME = process.argv[4] || 'dark'
const PORT = 9422

function sh(url, opts) {
  return fetch(url, opts).then((r) => r.json())
}

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      await sh(`http://127.0.0.1:${PORT}/json/version`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
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
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-chrome-'))
  const chrome = spawn(CHROME_PATH, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--window-size=1440,1000', `--user-data-dir=${userDataDir}`,
    `--force-color-profile=srgb`,
    'about:blank',
  ], { stdio: 'ignore' })

  try {
    await waitForCdp()
    const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
    const cdp = new CdpClient(ws)
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: COLOR_SCHEME }],
    })

    const loadOnce = () => new Promise((resolve) => {
      const handler = (ev) => {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', handler); resolve() }
      }
      ws.addEventListener('message', handler)
    })

    const load1 = loadOnce()
    await cdp.send('Page.navigate', { url: URL })
    await load1

    const inputPath = path.resolve('public/test-fixture.xlsx')
    const nodes = await cdp.send('DOM.getDocument')
    const found = await cdp.send('DOM.querySelector', { nodeId: nodes.root.nodeId, selector: 'input[type=file]' })
    await cdp.send('DOM.setFileInputFiles', { files: [inputPath], nodeId: found.nodeId })
    await new Promise((r) => setTimeout(r, 500))

    await fetch(`http://127.0.0.1:${PORT}/json`) // no-op keepalive
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => { const {db} = await import('/src/db/db.ts'); await db.priceCache.bulkPut([
        {symbol:'AAPL.US', price:200, currency:'EUR', source:'yahoo', fetchedAt:new Date().toISOString()},
        {symbol:'AMZN.DE', price:250, currency:'EUR', source:'yahoo', fetchedAt:new Date().toISOString()},
      ]); })()`,
      awaitPromise: true,
    })
    await new Promise((r) => setTimeout(r, 800))

    if (process.argv[5] === 'closed') {
      await cdp.send('Runtime.evaluate', {
        expression: `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Posiciones cerradas')?.click()`,
      })
      await new Promise((r) => setTimeout(r, 300))
    }
    if (process.argv[5] === 'expand') {
      await cdp.send('Runtime.evaluate', {
        expression: `document.querySelector('.position-row')?.click()`,
      })
      await new Promise((r) => setTimeout(r, 300))
    }

    const { cssContentSize } = await cdp.send('Page.getLayoutMetrics')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: Math.ceil(cssContentSize.width), height: Math.ceil(cssContentSize.height), deviceScaleFactor: 1, mobile: false })
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(OUT, Buffer.from(data, 'base64'))
    console.log('saved', OUT)
    ws.close()
  } finally {
    chrome.kill()
    await new Promise((r) => setTimeout(r, 400))
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
