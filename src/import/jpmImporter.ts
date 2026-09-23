import type { Transaction } from '../domain/types'

/** Una entrega de acciones (RSU consolidadas) que todavía se conserva. */
export interface JpmHolding {
  /** Número de certificado: identifica la entrega y sirve de clave estable. */
  certificate: string
  /** Fecha de la entrega, en ISO. */
  issuanceDate: string
  /** Acciones que siguen en cartera de esa entrega (ya descontadas las vendidas). */
  quantity: number
  /** Valor de la acción el día de la entrega, en su divisa: es el coste de adquisición. */
  fmv: number
  fmvCurrency: string
  source: string
}

export interface JpmStatement {
  /** Ticker de la empresa (p.ej. "SRAD"). */
  ticker: string
  /** Símbolo canónico de la app para ese ticker. */
  symbol: string
  holdings: JpmHolding[]
  warnings: { rowId: string; message: string }[]
  skippedRows: { row: number; reason: string }[]
}

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

/** "04-Apr-2025" → ISO. El extracto no da hora, solo el día. */
function toIsoDate(value: string): string {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return ''
  const month = MONTHS[match[2].toLowerCase()]
  if (!month) return ''
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}T00:00:00.000Z`
}

/** "USD 21.62" → 21.62; "EUR 1,908.46" → 1908.46; "(USD 1,283.20)" → -1283.2. */
function parseMoney(value: string): { amount: number; currency: string } | undefined {
  const negative = value.includes('(')
  const match = value.replace(/[()]/g, '').trim().match(/^([A-Z]{3})\s*([\d,.]+)$/)
  if (!match) return undefined
  const amount = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return undefined
  return { amount: negative ? -amount : amount, currency: match[1] }
}

/** Divide una línea de CSV por `;`, respetando las comillas. */
function splitLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      // Dos comillas seguidas dentro de un campo entrecomillado son una comilla literal.
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ';' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields.map((f) => f.trim())
}

/**
 * Parsea el extracto "My Share Statement" de J.P. Morgan Workplace Solutions
 * (.csv), el portal de los planes de acciones de empresa.
 *
 * No es un libro de movimientos como los de XTB o IBKR, sino una foto de lo
 * que se conserva hoy: una línea por entrega de RSU, con las acciones que
 * quedan de ella y el valor que tenía la acción ese día. De ahí sale
 * directamente el coste de adquisición, que es además el criterio con el que
 * tributan. Como es una foto y no un histórico, las ventas anteriores no
 * aparecen: lo vendido simplemente ya no está en el fichero.
 */
export function parseJpmStatement(text: string): JpmStatement {
  const lines = text.split(/\r?\n/)
  const rows = lines.map(splitLine)

  const headerIndex = rows.findIndex((r) => r[0] === 'Date of Statement')
  const tickerIndex = headerIndex >= 0 ? rows[headerIndex].indexOf('Ticker') : -1
  const ticker = tickerIndex >= 0 ? (rows[headerIndex + 1]?.[tickerIndex] ?? '') : ''
  if (!ticker) {
    throw new Error('El fichero no parece un extracto de J.P. Morgan (no se encontró el ticker).')
  }

  const columnsIndex = rows.findIndex((r) => r[0] === 'Certificate Number')
  if (columnsIndex < 0) {
    throw new Error('El extracto no trae la tabla de acciones ("Certificate Number").')
  }
  const columns = rows[columnsIndex]
  const col = (name: string) => columns.indexOf(name)

  const idxDate = col('Issuance Date')
  const idxSource = col('Issuance Source')
  const idxOutstanding = col('Outstanding Shares')
  const idxFmv = col('FMV at Issuance')
  if ([idxDate, idxOutstanding, idxFmv].some((i) => i < 0)) {
    throw new Error('La tabla de acciones no tiene las columnas esperadas (Issuance Date, Outstanding Shares, FMV at Issuance).')
  }

  const holdings: JpmHolding[] = []
  const warnings: { rowId: string; message: string }[] = []
  const skippedRows: { row: number; reason: string }[] = []

  for (let i = columnsIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const certificate = row[0]
    // La tabla termina en la fila de totales; después vienen líneas vacías y
    // el aviso legal. Ninguna de las dos cosas es un problema que reportar.
    if (!certificate || certificate === 'Total') break

    const issuanceDate = toIsoDate(row[idxDate] ?? '')
    const fmv = parseMoney(row[idxFmv] ?? '')
    const quantity = Number((row[idxOutstanding] ?? '').replace(/,/g, ''))

    if (!issuanceDate || !fmv || !Number.isFinite(quantity)) {
      skippedRows.push({ row: i + 1, reason: `No se pudo leer la entrega ${certificate}` })
      continue
    }
    // Una entrega vendida por completo sigue apareciendo con 0 acciones: no
    // es un error, simplemente ya no forma parte de la cartera.
    if (quantity <= 0) continue

    holdings.push({
      certificate,
      issuanceDate,
      quantity,
      fmv: fmv.amount,
      fmvCurrency: fmv.currency,
      source: idxSource >= 0 ? (row[idxSource] ?? '') : '',
    })
  }

  if (holdings.length === 0) {
    warnings.push({ rowId: ticker, message: 'El extracto no trae ninguna entrega con acciones en cartera.' })
  }

  return {
    ticker,
    // El extracto no dice en qué bolsa cotiza. Estos planes son de empresas
    // cotizadas en EEUU, que además es el mercado sin sufijo en Yahoo.
    symbol: `${ticker}.US`,
    holdings,
    warnings,
    skippedRows,
  }
}

/**
 * Convierte las entregas en movimientos de la app, con el coste ya en euros.
 *
 * Cada entrega genera dos apuntes que se compensan en caja: la compra de las
 * acciones y un ingreso por el mismo importe. Las RSU no cuestan dinero, así
 * que sin el ingreso su valor entero se contaría como beneficio y la
 * rentabilidad total saldría disparada; con él, lo que se mide es lo que ha
 * hecho la acción desde que te la entregaron, y la liquidez no se mueve.
 *
 * `costEurByCertificate` trae el coste total de cada entrega ya convertido al
 * cambio de SU fecha (ver `convertToEurAt`): la conversión necesita red y
 * esta función se mantiene pura para poder probarla.
 */
export function jpmTransactions(statement: JpmStatement, costEurByCertificate: Map<string, number>): Transaction[] {
  const transactions: Transaction[] = []

  for (const holding of statement.holdings) {
    const costEur = costEurByCertificate.get(holding.certificate)
    if (costEur === undefined) continue

    const base = {
      broker: 'jpm' as const,
      date: holding.issuanceDate,
      currency: 'EUR',
      commission: 0,
      rawSymbol: statement.ticker,
    }

    transactions.push({
      ...base,
      id: `jpm-${holding.certificate}-grant`,
      type: 'deposit',
      symbol: '',
      quantity: 0,
      price: 0,
      total: costEur,
      rawDescription: `${holding.source || 'RSU'} — valor entregado de ${holding.certificate}`,
    })

    transactions.push({
      ...base,
      id: `jpm-${holding.certificate}`,
      type: 'buy',
      symbol: statement.symbol,
      quantity: holding.quantity,
      price: costEur / holding.quantity,
      total: -costEur,
      rawDescription: `${holding.source || 'RSU'} — ${holding.certificate} a ${holding.fmv} ${holding.fmvCurrency}`,
      category: 'STOCK',
    })
  }

  return transactions
}
