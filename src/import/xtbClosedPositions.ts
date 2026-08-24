import ExcelJS from 'exceljs'
import type { ClosedTrade } from '../domain/types'
import { hashTransactionLine } from './hash'

export interface ClosedPositionsWarning {
  rowId: string
  message: string
}

export interface ClosedPositionsResult {
  trades: ClosedTrade[]
  warnings: ClosedPositionsWarning[]
}

/**
 * Parsea la hoja "Closed Positions" del extracto de XTB: cada fila es un
 * round-trip completo (compra→venta) ya cerrado, con la plusvalía realizada
 * calculada por XTB en EUR (columna "Profit/Loss") — se usa directamente en
 * vez de reconstruirla emparejando compras y ventas de "Cash Operations".
 */
export async function parseXtbClosedPositions(buffer: ArrayBuffer): Promise<ClosedPositionsResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.getWorksheet('Closed Positions')
  if (!sheet) {
    return { trades: [], warnings: [] }
  }

  // Filas 1-4: metadatos. Fila 5: cabecera real.
  const headerRow = sheet.getRow(5).values as unknown[]
  const columns = headerRow.map((v) => (typeof v === 'string' ? v.trim() : v))
  const colIndex = (name: string) => columns.indexOf(name)

  const idx = {
    instrument: colIndex('Instrument'),
    ticker: colIndex('Ticker'),
    volume: colIndex('Volume'),
    openPrice: colIndex('Open Price'),
    openTime: colIndex('Open Time (UTC)'),
    closePrice: colIndex('Close Price'),
    closeTime: colIndex('Close Time (UTC)'),
    profitLoss: colIndex('Profit/Loss'),
    purchaseValue: colIndex('Purchase Value'),
    saleValue: colIndex('Sale Value'),
    positionId: colIndex('Position ID'),
  }

  if (Object.values(idx).some((i) => i < 1)) {
    throw new Error('La hoja "Closed Positions" no tiene las columnas esperadas.')
  }

  const rows: { rowNumber: number; row: ExcelJS.Row }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return
    rows.push({ rowNumber, row })
  })

  const trades: ClosedTrade[] = []
  const warnings: ClosedPositionsWarning[] = []

  for (const { rowNumber, row } of rows) {
    const ticker = String(row.getCell(idx.ticker).value ?? '').trim()
    if (!ticker) continue

    const closeTimeValue = row.getCell(idx.closeTime).value
    const closeDate = closeTimeValue instanceof Date ? closeTimeValue.toISOString() : String(closeTimeValue ?? '')
    if (!closeDate) {
      warnings.push({ rowId: `row-${rowNumber}`, message: `Fila ${rowNumber} (${ticker}): sin fecha de cierre, se omite.` })
      continue
    }

    const openTimeValue = row.getCell(idx.openTime).value
    const openDate = openTimeValue instanceof Date ? openTimeValue.toISOString() : String(openTimeValue ?? '')
    const volume = Number(row.getCell(idx.volume).value ?? 0)
    const closePrice = Number(row.getCell(idx.closePrice).value ?? 0)
    const positionId = String(row.getCell(idx.positionId).value ?? '')

    const id = await hashTransactionLine([positionId, closeDate, String(volume), String(closePrice)])

    trades.push({
      id,
      symbol: ticker,
      name: String(row.getCell(idx.instrument).value ?? '').trim() || undefined,
      quantity: volume,
      openDate,
      closeDate,
      openPrice: Number(row.getCell(idx.openPrice).value ?? 0),
      closePrice,
      purchaseValueEur: Number(row.getCell(idx.purchaseValue).value ?? 0),
      saleValueEur: Number(row.getCell(idx.saleValue).value ?? 0),
      realizedPnlEur: Number(row.getCell(idx.profitLoss).value ?? 0),
      positionId,
    })
  }

  return { trades, warnings }
}
