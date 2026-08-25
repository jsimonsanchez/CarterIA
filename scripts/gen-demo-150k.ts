import ExcelJS from 'exceljs'

// Genera un extracto sintético de XTB con 15 posiciones abiertas que suman
// ~170.000 € de valor de mercado (>150.000 € pedido), más unas pocas
// posiciones cerradas, dividendos, intereses e ingresos — para demos, sin
// usar datos reales del usuario.

const USD_EUR = 0.85734
const SEK_EUR = 0.09025

interface Position {
  ticker: string
  instrument: string
  category: 'STOCK' | 'ETF'
  qty: number
  eurPrice: number // precio actual objetivo, ya en EUR
  gainPct: number
  currency: 'USD' | 'EUR' | 'SEK'
  fxRate: number // divisa nativa -> EUR
}

const POSITIONS: Position[] = [
  { ticker: 'AAPL.US', instrument: 'Apple', category: 'STOCK', qty: 48, eurPrice: 320, gainPct: 0.2, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'MSFT.US', instrument: 'Microsoft', category: 'STOCK', qty: 28, eurPrice: 540, gainPct: 0.16, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'GOOGL.US', instrument: 'Alphabet', category: 'STOCK', qty: 60, eurPrice: 200, gainPct: 0.3, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'AMZN.US', instrument: 'Amazon', category: 'STOCK', qty: 52, eurPrice: 230, gainPct: 0.25, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'NVDA.US', instrument: 'Nvidia', category: 'STOCK', qty: 90, eurPrice: 190, gainPct: 1.2, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'META.US', instrument: 'Meta', category: 'STOCK', qty: 15, eurPrice: 800, gainPct: 0.35, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'TSLA.US', instrument: 'Tesla', category: 'STOCK', qty: 24, eurPrice: 420, gainPct: -0.1, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'JPM.US', instrument: 'JPMorgan Chase', category: 'STOCK', qty: 38, eurPrice: 270, gainPct: 0.14, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'ASML.US', instrument: 'ASML', category: 'STOCK', qty: 11, eurPrice: 920, gainPct: 0.48, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'SAP.DE', instrument: 'SAP', category: 'STOCK', qty: 41, eurPrice: 250, gainPct: 0.22, currency: 'EUR', fxRate: 1 },
  { ticker: 'SPYL.DE', instrument: 'S&P 500', category: 'ETF', qty: 708, eurPrice: 16.8, gainPct: 0.28, currency: 'EUR', fxRate: 1 },
  { ticker: 'EVO.SE', instrument: 'Evolution', category: 'STOCK', qty: 8, eurPrice: 860, gainPct: 0.42, currency: 'SEK', fxRate: SEK_EUR },
  { ticker: 'IUSS.DE', instrument: 'MSCI Saudi Arabia Capped', category: 'ETF', qty: 1079, eurPrice: 6.3, gainPct: 0.08, currency: 'EUR', fxRate: 1 },
  { ticker: 'V.US', instrument: 'Visa', category: 'STOCK', qty: 32, eurPrice: 320, gainPct: 0.18, currency: 'USD', fxRate: USD_EUR },
  { ticker: 'UNH.US', instrument: 'UnitedHealth', category: 'STOCK', qty: 17, eurPrice: 600, gainPct: 0.06, currency: 'USD', fxRate: USD_EUR },
]

const CLOSED_TRADES = [
  { ticker: 'NOK.US', instrument: 'Nokia', qty: 300, openPrice: 3.2, closePrice: 4.1, openDate: '2025-03-10', closeDate: '2025-11-20' },
  { ticker: 'PYPL.US', instrument: 'PayPal', qty: 40, openPrice: 62, closePrice: 54, openDate: '2025-05-01', closeDate: '2025-08-02' },
  { ticker: 'INTC.US', instrument: 'Intel', qty: 120, openPrice: 21, closePrice: 33, openDate: '2025-06-18', closeDate: '2026-03-11' },
  { ticker: 'BA.US', instrument: 'Boeing', qty: 15, openPrice: 175, closePrice: 210, openDate: '2025-10-02', closeDate: '2026-04-22' },
]

async function main() {
  const wb = new ExcelJS.Workbook()

  // ---- Cash Operations ----
  const cash = wb.addWorksheet('Cash Operations')
  cash.addRow(['Account number', 88888888])
  cash.addRow(['Cash Operations'])
  cash.addRow(['Date from (UTC)', new Date('2025-01-01')])
  cash.addRow(['Date to (UTC)', new Date('2026-08-25')])
  cash.addRow(['Type', 'Instrument', 'Ticker', 'Category', 'Time', 'Amount', 'ID', 'Comment', 'Product', 'Position ID'])

  let id = 5000000000
  let otherFlows = 0

  for (const [i, p] of POSITIONS.entries()) {
    const avgCostEur = p.eurPrice / (1 + p.gainPct)
    const purchaseAmountEur = -(p.qty * avgCostEur)
    const nativeCost = avgCostEur / p.fxRate
    cash.addRow([
      'Stock purchase',
      p.instrument,
      p.ticker,
      p.category,
      new Date(`2025-0${(i % 9) + 1}-${10 + (i % 15)}T10:00:00Z`),
      purchaseAmountEur,
      id++,
      `OPEN BUY ${p.qty} @ ${nativeCost.toFixed(2)}`,
      'My Trades',
      id,
    ])

    for (let d = 0; d < 2; d++) {
      const divEur = p.qty * p.eurPrice * 0.006 * (d + 1)
      const taxEur = -divEur * 0.19
      cash.addRow([
        'Dividend', p.instrument, p.ticker, p.category,
        new Date(`2025-${(((i + d * 4) % 12) + 1).toString().padStart(2, '0')}-15T09:00:00Z`),
        divEur, id++, `${p.ticker} dividendo`, 'My Trades', null,
      ])
      cash.addRow([
        'Withholding tax', p.instrument, p.ticker, p.category,
        new Date(`2025-${(((i + d * 4) % 12) + 1).toString().padStart(2, '0')}-15T09:00:01Z`),
        taxEur, id++, `${p.ticker} WHT`, 'My Trades', null,
      ])
      otherFlows += divEur + taxEur
    }
  }

  cash.addRow(['Free funds interest', null, null, null, new Date('2026-07-06T12:30:00Z'), 92.4, id++, 'Free-funds Interest 2026-06', 'My Trades', null])
  cash.addRow(['Free funds interest tax', null, null, null, new Date('2026-07-06T12:24:00Z'), -19.4, id++, 'Free-funds Interest Tax 2026-06', 'My Trades', null])
  otherFlows += 92.4 - 19.4

  const totalCostEur = POSITIONS.reduce((acc, p) => acc + p.qty * (p.eurPrice / (1 + p.gainPct)), 0)
  const desiredLiquidity = 12800
  const depositAmount = totalCostEur + desiredLiquidity - otherFlows
  cash.addRow(['Deposit', null, null, null, new Date('2025-01-02T09:00:00Z'), Math.round(depositAmount * 100) / 100, id++, 'JP_MORGAN deposit', 'My Trades', null])

  cash.addRow(['Total', null, null, null, null, desiredLiquidity])

  // ---- Closed Positions ----
  const closed = wb.addWorksheet('Closed Positions')
  closed.addRow(['Account number', 88888888])
  closed.addRow(['Closed Positions'])
  closed.addRow(['Date from (UTC)', new Date('2025-01-01')])
  closed.addRow(['Date to (UTC)', new Date('2026-08-25')])
  closed.addRow([
    'Instrument', 'Ticker', 'Category', 'Type', 'Volume', 'Open Price', 'Open Time (UTC)',
    'Close Price', 'Close Time (UTC)', 'Product', 'Profit/Loss', 'Gross Profit', 'Purchase Value',
    'Sale Value', 'Stop Loss', 'Take Profit', 'Commission', 'Margin', 'Swap', 'Rollover',
    'Open Conversion Rate', 'Close Conversion Rate', 'Close Origin', 'Position ID', 'Comment',
  ])

  let posId = 9000000000
  for (const t of CLOSED_TRADES) {
    const purchaseValue = t.qty * t.openPrice
    const saleValue = t.qty * t.closePrice
    const pnl = saleValue - purchaseValue
    closed.addRow([
      t.instrument, t.ticker, 'STOCK', 'BUY', t.qty, t.openPrice, new Date(`${t.openDate}T10:00:00Z`),
      t.closePrice, new Date(`${t.closeDate}T10:00:00Z`), 'My Trades', pnl, pnl, purchaseValue, saleValue,
      null, null, 0, null, null, null, 1, 1, 'Android', posId++, null,
    ])
  }

  await wb.xlsx.writeFile('demo-cartera-150k.xlsx')

  const marketValue = POSITIONS.reduce((acc, p) => acc + p.qty * p.eurPrice, 0)
  console.log('posiciones:', POSITIONS.length)
  console.log('valor de mercado objetivo (EUR):', marketValue.toFixed(2))
  console.log('coste (EUR):', totalCostEur.toFixed(2))
  console.log('escrito demo-cartera-150k.xlsx')
}

main()
