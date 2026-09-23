import { ibkrMarketRule } from '../data/ibkrMarketRules'
import { ibkrSymbolOverride } from '../data/ibkrSymbolOverrides'
import type { OperationType, SymbolMapping, Transaction } from '../domain/types'

/**
 * Códigos de actividad del "Estado de fondos" (Statement of Funds) de IBKR.
 *
 * FOREX son las conversiones automáticas de divisa: en el informe en divisa
 * base cada una deja una línea con su efecto en euros (céntimos), no con el
 * importe convertido. No es ni ingreso ni comisión —IBKR no cobra por las
 * conversiones automáticas, el coste va en el tipo de cambio—, pero sí mueve
 * el saldo, así que entra como `other` para que la liquidez cuadre.
 */
const TYPE_BY_ACTIVITY: Record<string, OperationType> = {
  DEP: 'deposit',
  WITH: 'deposit',
  BUY: 'buy',
  SELL: 'sell',
  DIV: 'dividend',
  FRTAX: 'fee',
  STAX: 'fee',
  OFEE: 'fee',
  CFEE: 'fee',
  COMM: 'fee',
  CINT: 'interest',
  CRINT: 'interest',
  DINT: 'interest',
  FOREX: 'other',
}

/** Subcategoría de IBKR → categoría de instrumento de la app (ver `instrumentCategory.ts`). */
const CATEGORY_BY_SUBCATEGORY: Record<string, string> = {
  COMMON: 'STOCK',
  PREFERRED: 'STOCK',
  ADR: 'STOCK',
  ETF: 'ETF',
  ETC: 'ETC',
  ETN: 'ETN',
}

export interface IbkrInstrument {
  /** Símbolo canónico de la app (BASE.MERCADO) — ver `SymbolMapping.xtbSymbol`. */
  symbol: string
  ibkrSymbol: string
  isin: string
  /** Divisa en la que cotiza, necesaria para elegir la línea correcta del mismo ISIN. */
  currency: string
  listingExchange: string
  name?: string
}

export interface IbkrImportWarning {
  rowId: string
  message: string
}

export interface IbkrSkippedRow {
  row: number
  reason: string
}

export interface IbkrImportResult {
  transactions: Transaction[]
  mappings: SymbolMapping[]
  /** Instrumentos sin regla de bolsa conocida: no se les podrá pedir precio. */
  unresolved: string[]
  /** Posiciones que declara el propio informe, para contrastar con las calculadas. */
  reportedPositions: { symbol: string; quantity: number }[]
  /** Fecha final del informe (AAAAMMDD), para saber cuál es el más reciente. */
  toDate: string
  warnings: IbkrImportWarning[]
  skippedRows: IbkrSkippedRow[]
}

/** Atributos de todas las etiquetas `tag` del XML, en orden de aparición. */
function parseTags(xml: string, tag: string): Record<string, string>[] {
  const tagRe = new RegExp(`<${tag}\\b([^>]*)/?>`, 'g')
  const attrRe = /([\w:-]+)="([^"]*)"/g
  const rows: Record<string, string>[] = []

  for (const tagMatch of xml.matchAll(tagRe)) {
    const attrs: Record<string, string> = {}
    for (const attrMatch of tagMatch[1].matchAll(attrRe)) {
      attrs[attrMatch[1]] = decodeEntities(attrMatch[2])
    }
    rows.push(attrs)
  }

  return rows
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function num(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** "20250820" → ISO. IBKR no da hora en el estado de fondos, solo el día. */
function toIsoDate(yyyymmdd: string): string {
  const match = yyyymmdd.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!match) return ''
  return `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`
}

/**
 * Catálogo de instrumentos del informe, indexado por `conid` (el
 * identificador interno de IBKR, que es el único campo presente en todas las
 * secciones). Se recorren de más fiable a menos: las posiciones abiertas y
 * las transacciones de efectivo traen el ticker "limpio" (HACK), mientras
 * que las operaciones lo traen con la terminación de la plaza (HACKs).
 */
function buildInstruments(xml: string): Map<string, IbkrInstrument> {
  const byConid = new Map<string, IbkrInstrument>()

  for (const tag of ['OpenPosition', 'CashTransaction', 'Trade', 'StatementOfFundsLine']) {
    for (const row of parseTags(xml, tag)) {
      const conid = row.conid
      const isin = row.isin || row.securityID
      // Las conversiones de divisa (assetCategory CASH) también tienen conid,
      // pero no son un instrumento de la cartera.
      if (!conid || !isin || row.assetCategory === 'CASH' || byConid.has(conid)) continue

      const ibkrSymbol = row.symbol
      const listingExchange = row.listingExchange ?? ''
      const currency = row.currency ?? ''
      if (!ibkrSymbol) continue

      const rule = ibkrMarketRule(listingExchange)
      const override = ibkrSymbolOverride(isin, currency)

      byConid.set(conid, {
        symbol: rule ? `${ibkrSymbol}.${rule.market}` : ibkrSymbol,
        ibkrSymbol,
        isin,
        currency,
        listingExchange,
        name: override?.name ?? row.description ?? undefined,
      })
    }
  }

  return byConid
}

function mappingFor(instrument: IbkrInstrument): SymbolMapping | undefined {
  const override = ibkrSymbolOverride(instrument.isin, instrument.currency)
  if (override) {
    return {
      xtbSymbol: instrument.symbol,
      twelveDataSymbol: override.twelveDataSymbol,
      twelveDataExchange: override.twelveDataExchange,
      yahooSymbol: override.yahooSymbol,
      name: override.name ?? instrument.name,
    }
  }

  const rule = ibkrMarketRule(instrument.listingExchange)
  if (!rule) return undefined

  return {
    xtbSymbol: instrument.symbol,
    twelveDataSymbol: instrument.ibkrSymbol,
    twelveDataExchange: rule.twelveDataExchange,
    yahooSymbol: `${instrument.ibkrSymbol}${rule.yahooSuffix}`,
    name: instrument.name,
  }
}

/**
 * Parsea un informe Flex de actividad de IBKR (XML).
 *
 * Se lee la sección "Estado de fondos" (StatementOfFundsLine) y no la de
 * operaciones: es el libro de caja completo —compras, dividendos,
 * retenciones, comisiones, ingresos y conversiones—, una línea por
 * movimiento y con los importes ya convertidos a la divisa base de la
 * cuenta. Es decir, el equivalente exacto de la hoja "Cash Operations" de
 * XTB, así que el resto de la app no necesita saber de dónde viene cada
 * movimiento. Las demás secciones se usan solo para identificar los
 * instrumentos y para contrastar las posiciones calculadas.
 */
export function parseIbkrFlexReport(xml: string): IbkrImportResult {
  const statement = parseTags(xml, 'FlexStatement')[0]
  const account = parseTags(xml, 'AccountInformation')[0]
  if (!statement || !account) {
    throw new Error('El fichero no parece un informe Flex de IBKR (falta FlexStatement/AccountInformation).')
  }

  // Toda la app trabaja en euros y da por hecho que los importes del extracto
  // ya vienen convertidos. Con otra divisa base los importes serían de otra
  // moneda sin que nada lo advirtiera, así que se rechaza el fichero.
  if (account.currency !== 'EUR') {
    throw new Error(
      `La divisa base de la cuenta de IBKR es ${account.currency}, y la app solo maneja cuentas en EUR.`,
    )
  }

  const instrumentsByConid = buildInstruments(xml)
  const transactions: Transaction[] = []
  const warnings: IbkrImportWarning[] = []
  const skippedRows: IbkrSkippedRow[] = []
  const usedConids = new Set<string>()

  const lines = parseTags(xml, 'StatementOfFundsLine')
  // El informe puede traer, además de la vista en divisa base, una línea por
  // divisa del mismo movimiento; sumarlas todas duplicaría los importes.
  const baseLines = lines.filter((l) => l.levelOfDetail === 'BaseCurrency')
  if (lines.length > 0 && baseLines.length === 0) {
    throw new Error('El informe no trae el estado de fondos en divisa base (levelOfDetail "BaseCurrency").')
  }

  baseLines.forEach((line, index) => {
    const activityCode = line.activityCode ?? ''
    // El identificador tiene que salir del contenido de la línea, nunca de su
    // posición en el fichero: el histórico son varios informes de un año cada
    // uno y sus rangos pueden solaparse, así que el mismo movimiento llega
    // dos veces con distinto número de fila. Si el id dependiera de la fila,
    // se guardaría dos veces y ese importe contaría doble en la caja. El
    // saldo resultante desempata dos líneas por lo demás idénticas: es
    // distinto en cada una y el mismo en los dos informes.
    const id = `ibkr-${line.transactionID || [line.date, activityCode, line.amount, line.symbol, line.balance].join('-')}`
    const date = toIsoDate(line.date ?? line.reportDate ?? '')
    if (!date) {
      skippedRows.push({ row: index + 1, reason: `Línea sin fecha reconocible (${activityCode})` })
      return
    }

    const type = TYPE_BY_ACTIVITY[activityCode] ?? 'other'
    if (!TYPE_BY_ACTIVITY[activityCode]) {
      warnings.push({ rowId: id, message: `Tipo de operación no reconocido: "${activityCode}"` })
    }

    const instrument = line.conid ? instrumentsByConid.get(line.conid) : undefined
    if (instrument) usedConids.add(line.conid)

    const quantity = Math.abs(num(line.tradeQuantity))
    // El precio se reconstruye del importe bruto y no se toma `tradePrice`:
    // ese viene en divisa nativa, mientras que el bruto ya está en euros,
    // que es la divisa en la que la app calcula el coste.
    const price = quantity > 0 ? Math.abs(num(line.tradeGross)) / quantity : 0

    transactions.push({
      id,
      broker: 'ibkr',
      date,
      type,
      // Las líneas sin instrumento (ingresos, comisiones de datos, IVA,
      // conversiones de divisa) solo mueven la caja.
      symbol: instrument?.symbol ?? '',
      isin: instrument?.isin,
      quantity: type === 'buy' || type === 'sell' ? quantity : 0,
      price: type === 'buy' || type === 'sell' ? price : 0,
      currency: 'EUR',
      // Va aparte del precio, no sumada a él: `computePositions` la añade al
      // coste y el informe de caja puede contarla como comisión.
      commission: Math.abs(num(line.tradeCommission)),
      total: num(line.amount),
      rawSymbol: line.symbol ?? '',
      rawDescription: `${activityCode} — ${line.activityDescription ?? ''}`.trim(),
      category: instrument ? CATEGORY_BY_SUBCATEGORY[line.subCategory ?? ''] : undefined,
    })
  })

  const mappings: SymbolMapping[] = []
  const unresolved: string[] = []
  for (const conid of usedConids) {
    const instrument = instrumentsByConid.get(conid)!
    const mapping = mappingFor(instrument)
    if (mapping) mappings.push(mapping)
    else unresolved.push(instrument.symbol)
  }

  const reportedPositions = parseTags(xml, 'OpenPosition')
    .filter((p) => p.levelOfDetail !== 'LOT')
    .map((p) => ({
      symbol: instrumentsByConid.get(p.conid)?.symbol ?? p.symbol,
      quantity: num(p.position),
    }))

  return {
    transactions,
    mappings,
    unresolved,
    reportedPositions,
    toDate: statement.toDate ?? '',
    warnings,
    skippedRows,
  }
}
