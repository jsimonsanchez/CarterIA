// Captura capturas de demo de la app desplegada usando Chrome vía CDP
// directamente (sin puppeteer, para no depender de una instalación npm que
// está siendo poco fiable en esta red). Siembra datos sintéticos en el
// IndexedDB de una pestaña headless aislada (no toca los datos reales del
// usuario, que viven en su propio perfil de navegador) y hace capturas a
// página completa en 1920x1080.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL = 'https://carter-ia.vercel.app/'
const PORT = 9333
const OUT_DIR = process.argv[2] || '.'

function sh(url) {
  return fetch(url).then((r) => r.json())
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
    this.listeners = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      } else if (msg.method) {
        const cbs = this.listeners.get(msg.method)
        if (cbs) cbs.forEach((cb) => cb(msg.params))
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

  once(method) {
    return new Promise((resolve) => {
      const cb = (params) => {
        const cbs = this.listeners.get(method)
        cbs.delete(cb)
        resolve(params)
      }
      if (!this.listeners.has(method)) this.listeners.set(method, new Set())
      this.listeners.get(method).add(cb)
    })
  }
}

function seedExpression() {
  const USD_EUR = 0.85734
  const SEK_EUR = 0.09025
  const POSITIONS = [
    { ticker: 'AAPL.US', instrument: 'Apple', category: 'STOCK', qty: 167, eurPrice: 320, gainPct: 0.22, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'MSFT.US', instrument: 'Microsoft', category: 'STOCK', qty: 99, eurPrice: 540, gainPct: 0.18, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'GOOGL.US', instrument: 'Alphabet', category: 'STOCK', qty: 201, eurPrice: 200, gainPct: 0.35, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'AMZN.US', instrument: 'Amazon', category: 'STOCK', qty: 175, eurPrice: 230, gainPct: 0.28, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'NVDA.US', instrument: 'Nvidia', category: 'STOCK', qty: 317, eurPrice: 190, gainPct: 1.45, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'META.US', instrument: 'Meta', category: 'STOCK', qty: 50, eurPrice: 800, gainPct: 0.4, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'TSLA.US', instrument: 'Tesla', category: 'STOCK', qty: 80, eurPrice: 420, gainPct: -0.12, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'UNH.US', instrument: 'UnitedHealth', category: 'STOCK', qty: 45, eurPrice: 600, gainPct: 0.08, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'JPM.US', instrument: 'JPMorgan Chase', category: 'STOCK', qty: 124, eurPrice: 270, gainPct: 0.15, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'V.US', instrument: 'Visa', category: 'STOCK', qty: 105, eurPrice: 320, gainPct: 0.2, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'XOM.US', instrument: 'Exxon Mobil', category: 'STOCK', qty: 223, eurPrice: 120, gainPct: -0.06, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'PG.US', instrument: 'Procter & Gamble', category: 'STOCK', qty: 157, eurPrice: 170, gainPct: 0.05, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'KO.US', instrument: 'Coca-Cola', category: 'STOCK', qty: 287, eurPrice: 70, gainPct: 0.03, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'DIS.US', instrument: 'Walt Disney', category: 'STOCK', qty: 175, eurPrice: 115, gainPct: -0.15, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'NFLX.US', instrument: 'Netflix', category: 'STOCK', qty: 27, eurPrice: 1000, gainPct: 0.65, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'SAP.DE', instrument: 'SAP', category: 'STOCK', qty: 107, eurPrice: 250, gainPct: 0.25, currency: 'EUR', fxRate: 1 },
    { ticker: 'ASML.US', instrument: 'ASML', category: 'STOCK', qty: 36, eurPrice: 920, gainPct: 0.55, currency: 'USD', fxRate: USD_EUR },
    { ticker: 'SPYL.DE', instrument: 'S&P 500', category: 'ETF', qty: 2389, eurPrice: 16.8, gainPct: 0.3, currency: 'EUR', fxRate: 1 },
    { ticker: 'EVO.SE', instrument: 'Evolution', category: 'STOCK', qty: 23, eurPrice: 860, gainPct: 0.48, currency: 'SEK', fxRate: SEK_EUR },
    { ticker: 'IUSS.DE', instrument: 'MSCI Saudi Arabia Capped', category: 'ETF', qty: 2124, eurPrice: 6.3, gainPct: 0.1, currency: 'EUR', fxRate: 1 },
  ]
  const CLOSED = [
    { ticker: 'NOK.US', instrument: 'Nokia', qty: 500, openPrice: 3.2, closePrice: 4.1, openDate: '2025-02-10', closeDate: '2025-11-20' },
    { ticker: 'BABA.US', instrument: 'Alibaba', qty: 40, openPrice: 78, closePrice: 95, openDate: '2025-04-05', closeDate: '2025-09-14' },
    { ticker: 'PYPL.US', instrument: 'PayPal', qty: 60, openPrice: 62, closePrice: 54, openDate: '2025-05-01', closeDate: '2025-08-02' },
    { ticker: 'INTC.US', instrument: 'Intel', qty: 200, openPrice: 21, closePrice: 33, openDate: '2025-06-18', closeDate: '2026-03-11' },
    { ticker: 'BA.US', instrument: 'Boeing', qty: 25, openPrice: 175, closePrice: 210, openDate: '2025-10-02', closeDate: '2026-04-22' },
    { ticker: 'F.US', instrument: 'Ford Motor', qty: 400, openPrice: 10.5, closePrice: 9.1, openDate: '2025-12-01', closeDate: '2026-06-05' },
  ]

  const DAY_CHANGE_PCT = {
    'AAPL.US': 2.56, 'NVDA.US': 10.47, 'AMZN.US': -6.5, 'TSLA.US': -7.89,
    'EVO.SE': 7.63, 'UNH.US': 8.5, 'GOOGL.US': 2.56, 'META.US': -1.36,
  }

  return `(async () => {
    const POSITIONS = ${JSON.stringify(POSITIONS)};
    const CLOSED = ${JSON.stringify(CLOSED)};
    const DAY_CHANGE_PCT = ${JSON.stringify(DAY_CHANGE_PCT)};
    const nowIso = new Date().toISOString();
    let idc = 3000000000;
    const transactions = [];
    const positions = [];
    const priceCache = [];
    const symbolMappings = [];
    let costBasis = 0;

    for (const p of POSITIONS) {
      const avgCostEur = p.eurPrice / (1 + p.gainPct);
      costBasis += p.qty * avgCostEur;
      transactions.push({ id: 'xtb-demo-' + (idc++), date: '2025-03-01T10:00:00.000Z', type: 'buy', symbol: p.ticker, quantity: p.qty, price: avgCostEur, currency: 'EUR', commission: 0, total: -(p.qty * avgCostEur), rawSymbol: p.ticker, rawDescription: 'Stock purchase' });
      positions.push({ symbol: p.ticker, quantity: p.qty, averageCost: avgCostEur, currency: 'EUR', lastUpdated: nowIso });
      const nativePrice = p.eurPrice / p.fxRate;
      const dayPct = DAY_CHANGE_PCT[p.ticker];
      const previousClose = dayPct !== undefined ? nativePrice / (1 + dayPct / 100) : undefined;
      priceCache.push({ symbol: p.ticker, price: nativePrice, currency: p.currency, source: 'yahoo', fetchedAt: nowIso, previousClose });
      symbolMappings.push({ xtbSymbol: p.ticker, twelveDataSymbol: p.ticker.split('.')[0], yahooSymbol: p.ticker, name: p.instrument });
    }

    const totalDividends = 8200, totalWht = -1550, interest = 620, interestTax = -130, fees = -95, desiredLiquidity = 28450;
    const otherFlows = totalDividends + totalWht + interest + interestTax + fees;
    const deposit = costBasis + desiredLiquidity - otherFlows;

    transactions.push(
      { id: 'xtb-demo-div', date: '2025-11-15T09:00:00.000Z', type: 'dividend', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: totalDividends, rawSymbol: '', rawDescription: 'Dividendos del periodo' },
      { id: 'xtb-demo-wht', date: '2025-11-15T09:00:01.000Z', type: 'fee', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: totalWht, rawSymbol: '', rawDescription: 'Retenciones sobre dividendos' },
      { id: 'xtb-demo-interest', date: '2026-07-06T12:30:00.000Z', type: 'interest', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: interest, rawSymbol: '', rawDescription: 'Interés de fondos libres' },
      { id: 'xtb-demo-interest-tax', date: '2026-07-06T12:24:00.000Z', type: 'fee', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: interestTax, rawSymbol: '', rawDescription: 'Impuesto sobre intereses' },
      { id: 'xtb-demo-fees', date: '2025-06-01T09:00:00.000Z', type: 'fee', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: fees, rawSymbol: '', rawDescription: 'Comisiones varias' },
      { id: 'xtb-demo-deposit', date: '2025-01-02T09:00:00.000Z', type: 'deposit', symbol: '', quantity: 0, price: 0, currency: 'EUR', commission: 0, total: Math.round(deposit * 100) / 100, rawSymbol: '', rawDescription: 'Ingreso' },
    );

    const closedTrades = CLOSED.map((t, i) => ({
      id: 'xtb-demo-closed-' + i, symbol: t.ticker, name: t.instrument, quantity: t.qty,
      openDate: t.openDate + 'T10:00:00.000Z', closeDate: t.closeDate + 'T10:00:00.000Z',
      openPrice: t.openPrice, closePrice: t.closePrice,
      purchaseValueEur: t.qty * t.openPrice, saleValueEur: t.qty * t.closePrice,
      realizedPnlEur: t.qty * (t.closePrice - t.openPrice), positionId: 'pos-' + i,
    }));

    const storeNames = ['transactions', 'positions', 'priceCache', 'symbolMappings', 'closedTrades'];
    const keyPaths = { transactions: 'id', positions: 'symbol', priceCache: 'symbol', symbolMappings: 'xtbSymbol', closedTrades: 'id' };
    // Sin número de versión: se adapta a lo que Dexie ya haya creado (usa
    // internamente version*10 en IndexedDB) en vez de forzar la v1 cruda,
    // que si se queda abierta bloquea la apertura real de Dexie después.
    const req = indexedDB.open('cartera-tracker');
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const name of storeNames) {
        if (d.objectStoreNames.contains(name)) continue;
        const store = d.createObjectStore(name, { keyPath: keyPaths[name] });
        if (name === 'transactions') { store.createIndex('date', 'date'); store.createIndex('symbol', 'symbol'); store.createIndex('type', 'type'); }
        if (name === 'priceCache') store.createIndex('fetchedAt', 'fetchedAt');
      }
    };
    const idb = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const tx = idb.transaction(storeNames, 'readwrite');
    for (const name of storeNames) tx.objectStore(name).clear();
    for (const t of transactions) tx.objectStore('transactions').put(t);
    for (const p of positions) tx.objectStore('positions').put(p);
    for (const pc of priceCache) tx.objectStore('priceCache').put(pc);
    for (const sm of symbolMappings) tx.objectStore('symbolMappings').put(sm);
    for (const ct of closedTrades) tx.objectStore('closedTrades').put(ct);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    idb.close();
    return 'seeded';
  })()`
}

async function fullPageScreenshot(cdp, outPath) {
  const { cssContentSize } = await cdp.send('Page.getLayoutMetrics')
  const width = Math.ceil(cssContentSize.width)
  const height = Math.ceil(cssContentSize.height)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'))
  await cdp.send('Emulation.clearDeviceMetricsOverride')
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-chrome-'))
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1920,1080',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'pipe' })
  chrome.on('error', (e) => console.error('spawn error:', e))
  chrome.stderr.on('data', (d) => process.stderr.write(`[chrome] ${d}`))

  try {
    await waitForCdp()

    const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', reject)
    })
    const cdp = new CdpClient(ws)

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    cdp.listeners.set('Runtime.consoleAPICalled', new Set([(p) => {
      const parts = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      console.log(`[console.${p.type}]`, parts)
    }]))
    cdp.listeners.set('Runtime.exceptionThrown', new Set([(p) => {
      console.log('[page exception]', p.exceptionDetails?.text, p.exceptionDetails?.exception?.description)
    }]))

    const loadPromise = cdp.once('Page.loadEventFired')
    await cdp.send('Page.navigate', { url: URL })
    await loadPromise
    // Primera carga en un perfil nunca visitado: Dexie crea la base de datos
    // (versión real x10 respecto a la declarada) de forma asíncrona y a
    // veces queda bloqueada transitoriamente en el primer intento. Se
    // recarga una vez más para dar tiempo a que se asiente antes de sembrar.
    await new Promise((r) => setTimeout(r, 1000))
    const settlePromise = cdp.once('Page.loadEventFired')
    await cdp.send('Page.reload')
    await settlePromise
    await new Promise((r) => setTimeout(r, 500))

    const seedResult = await cdp.send('Runtime.evaluate', { expression: seedExpression(), awaitPromise: true })
    console.log('seed result:', seedResult)

    const reloadPromise = cdp.once('Page.loadEventFired')
    await cdp.send('Page.reload')
    await reloadPromise
    // usePortfolioRows calcula el valor de cada posición de forma asíncrona
    // (llamada real a /api/fx por cada divisa distinta) antes de pintar nada
    // — hace falta esperar a que esas peticiones de red terminen.
    await new Promise((r) => setTimeout(r, 9000))

    const verify2 = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const req = indexedDB.open('cartera-tracker');
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
        const counts = {};
        for (const name of ['transactions','positions','priceCache','symbolMappings','closedTrades']) {
          counts[name] = await new Promise((res) => { const r = idb.transaction(name).objectStore(name).count(); r.onsuccess = () => res(r.result); });
        }
        idb.close();
        return JSON.stringify(counts);
      })()`,
      awaitPromise: true,
    })
    console.log('store counts after reload:', verify2.result?.value)

    // Solo para esta captura: apila la tabla a ancho completo en vez de
    // compartir fila con el gráfico, para que quepan las 7 columnas sin
    // scroll horizontal (en uso normal el scroll interno es correcto).
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const s = document.createElement('style'); s.textContent = '.main-grid { grid-template-columns: 1fr !important; }'; document.head.appendChild(s); })()`,
    })
    await new Promise((r) => setTimeout(r, 200))

    await fullPageScreenshot(cdp, path.join(OUT_DIR, 'demo-cartera.png'))
    console.log('saved demo-cartera.png')

    await cdp.send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Posiciones cerradas')?.click()`,
    })
    await new Promise((r) => setTimeout(r, 400))

    await fullPageScreenshot(cdp, path.join(OUT_DIR, 'demo-cerradas.png'))
    console.log('saved demo-cerradas.png')

    await cdp.send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('td strong')].find(el => el.textContent.trim() === '2026')?.closest('tr')?.click()`,
    })
    await new Promise((r) => setTimeout(r, 300))
    await fullPageScreenshot(cdp, path.join(OUT_DIR, 'demo-cerradas-detalle.png'))
    console.log('saved demo-cerradas-detalle.png')

    ws.close()
  } finally {
    chrome.kill()
    await new Promise((r) => setTimeout(r, 500))
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // el perfil temporal puede tardar en liberarse en Windows; no es crítico limpiarlo.
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
