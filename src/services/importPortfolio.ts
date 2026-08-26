import { db } from '../db/db'
import { computePositions } from '../domain/positions'
import { ensureSymbolMappings } from '../domain/symbolResolver'
import type { XtbImportWarning, XtbSkippedRow } from '../import/xtbImporter'

export interface ImportSummary {
  imported: number
  skippedRows: XtbSkippedRow[]
  warnings: XtbImportWarning[]
  positions: number
  closedTrades: number
  unresolvedSymbols: string[]
}

/**
 * Importa un extracto de XTB (.xlsx): parsea "Cash Operations" y "Closed
 * Positions", persiste (upsert por id — reimportar el mismo extracto no
 * duplica), recalcula posiciones desde el histórico completo y da de alta
 * el mapeo de símbolos que falte.
 */
export async function importXtbFile(file: File): Promise<ImportSummary> {
  // exceljs es pesado (~1MB) y solo hace falta al importar — se carga bajo
  // demanda en vez de ir en el bundle inicial de la app.
  const [{ parseXtbWorkbook }, { parseXtbClosedPositions }] = await Promise.all([
    import('../import/xtbImporter'),
    import('../import/xtbClosedPositions'),
  ])
  const buffer = await file.arrayBuffer()
  // Cada parser recibe su propia copia del buffer: no se puede garantizar
  // que ambas lecturas concurrentes sean seguras sobre el mismo ArrayBuffer.
  const [result, closedResult] = await Promise.all([
    parseXtbWorkbook(buffer),
    parseXtbClosedPositions(buffer.slice(0)),
  ])

  await db.transactions.bulkPut(result.transactions)
  await db.closedTrades.bulkPut(closedResult.trades)

  const allTransactions = await db.transactions.toArray()
  const positions = computePositions(allTransactions)
  await db.transaction('rw', db.positions, async () => {
    await db.positions.clear()
    await db.positions.bulkPut(positions)
  })

  const symbols = allTransactions.map((t) => t.symbol).filter(Boolean)
  const { unresolved } = await ensureSymbolMappings(symbols)

  return {
    imported: result.transactions.length,
    skippedRows: result.skippedRows,
    warnings: result.warnings,
    positions: positions.length,
    closedTrades: closedResult.trades.length,
    unresolvedSymbols: unresolved,
  }
}
