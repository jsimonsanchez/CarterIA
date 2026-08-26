import ExcelJS from 'exceljs'
import type { OperationType, Transaction } from '../domain/types'

const TYPE_MAP: Record<string, OperationType> = {
  'Stock purchase': 'buy',
  'Stock sell': 'sell',
  Dividend: 'dividend',
  'Withholding tax': 'fee',
  'SEC fee': 'fee',
  'Stamp duty': 'fee',
  'Tax IFTT': 'fee',
  Correction: 'fee',
  'Free funds interest tax': 'fee',
  'Free funds interest': 'interest',
  Deposit: 'deposit',
}

// Ejemplos vistos en extractos reales de XTB (compra y venta pueden venir
// como fill único o parcial, con o sin el denominador "/total"):
//   "OPEN BUY 6 @ 529.71"
//   "OPEN BUY 1/21 @ 108.80"
//   "CLOSE BUY 40 @ 750.00"
//   "CLOSE BUY 15/25 @ 798.20"
const TRADE_COMMENT_RE = /(?:OPEN|CLOSE) BUY\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i

export interface XtbImportWarning {
  rowId: string
  message: string
}

/** Fila de la hoja "Cash Operations" ignorada a propósito (fila de totales, filas vacías de cierre de hoja). */
export interface XtbSkippedRow {
  /** Número de fila tal cual en el .xlsx (para poder localizarla abriendo el extracto). */
  row: number
  reason: string
}

export interface XtbImportResult {
  transactions: Transaction[]
  warnings: XtbImportWarning[]
  skippedRows: XtbSkippedRow[]
}

/**
 * Parsea la hoja "Cash Operations" del extracto de XTB (.xlsx), que es el libro
 * mayor de caja con una fila por evento (compra, venta, dividendo, comisión,
 * interés, ingreso...). Los importes de XTB ya vienen convertidos a la divisa
 * de la cuenta (EUR en este caso), así que se usan directamente como base de
 * coste en vez de reconstruir el tipo de cambio histórico de cada instrumento.
 */
export async function parseXtbWorkbook(buffer: ArrayBuffer): Promise<XtbImportResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.getWorksheet('Cash Operations')
  if (!sheet) {
    throw new Error('No se encontró la hoja "Cash Operations". ¿Es un extracto de XTB exportado en Excel?')
  }

  // Filas 1-4: metadatos (nº de cuenta, rango de fechas). Fila 5: cabecera real.
  const headerRow = sheet.getRow(5).values as unknown[]
  const columns = headerRow.map((v) => (typeof v === 'string' ? v.trim() : v))
  const colIndex = (name: string) => columns.indexOf(name)

  const idxType = colIndex('Type')
  const idxInstrument = colIndex('Instrument')
  const idxTicker = colIndex('Ticker')
  const idxTime = colIndex('Time')
  const idxAmount = colIndex('Amount')
  const idxId = colIndex('ID')
  const idxComment = colIndex('Comment')

  if ([idxType, idxTime, idxAmount, idxId].some((i) => i < 1)) {
    throw new Error('La hoja "Cash Operations" no tiene las columnas esperadas (Type, Time, Amount, ID).')
  }

  const transactions: Transaction[] = []
  const warnings: XtbImportWarning[] = []
  const skippedRows: XtbSkippedRow[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return // metadatos + cabecera

    try {
      const rawType = row.getCell(idxType).text?.trim()
      // Comparación insensible a mayúsculas: se ha visto la fila de totales
      // como "Total" y como "TOTAL" según la exportación.
      if (!rawType || rawType.toLowerCase() === 'total') {
        skippedRows.push({
          row: rowNumber,
          reason: rawType ? 'Fila de totales' : 'Fila sin tipo de operación (vacía)',
        })
        return
      }

      const rawId = row.getCell(idxId).value
      const id = `xtb-${String(rawId)}`
      const dateValue = row.getCell(idxTime).value
      const date = dateValue instanceof Date ? dateValue.toISOString() : String(dateValue ?? '')
      const amount = Number(row.getCell(idxAmount).value ?? 0)
      const ticker = idxTicker > 0 ? String(row.getCell(idxTicker).value ?? '').trim() : ''
      const instrument = idxInstrument > 0 ? String(row.getCell(idxInstrument).value ?? '').trim() : ''
      const comment = idxComment > 0 ? String(row.getCell(idxComment).value ?? '').trim() : ''

      const type = TYPE_MAP[rawType] ?? 'other'
      if (type === 'other') {
        warnings.push({ rowId: id, message: `Tipo de operación no reconocido: "${rawType}"` })
      }

      let quantity = 0
      let price = 0

      if (type === 'buy' || type === 'sell') {
        const match = comment.match(TRADE_COMMENT_RE)
        if (match) {
          quantity = Number(match[1])
          price = quantity > 0 ? Math.abs(amount) / quantity : 0
        } else {
          warnings.push({ rowId: id, message: `No se pudo extraer cantidad/precio del comentario: "${comment}"` })
        }
      }

      transactions.push({
        id,
        date,
        type,
        symbol: ticker || instrument,
        quantity,
        price,
        currency: 'EUR',
        commission: 0,
        total: amount,
        rawSymbol: ticker,
        rawDescription: `${rawType}${instrument ? ' — ' + instrument : ''}${comment ? ' — ' + comment : ''}`,
      })
    } catch (err) {
      // Una fila con un formato inesperado (p.ej. otra variante de fila de
      // resumen) no debe tirar abajo la importación entera: se omite esa
      // fila concreta y el resto del extracto se procesa igual.
      skippedRows.push({
        row: rowNumber,
        reason: `No se pudo procesar la fila: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  })

  return { transactions, warnings, skippedRows }
}
