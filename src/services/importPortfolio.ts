import { db } from '../db/db'
import { computePositions } from '../domain/positions'
import { ensureSymbolMappings } from '../domain/symbolResolver'
import type { XtbImportWarning } from '../import/xtbImporter'

export interface ImportSummary {
  imported: number
  skipped: number
  warnings: XtbImportWarning[]
  positions: number
  unresolvedSymbols: string[]
}

/**
 * Importa un extracto de XTB (.xlsx): parsea, persiste las transacciones
 * (upsert por id — reimportar el mismo extracto no duplica), recalcula
 * posiciones desde el histórico completo y da de alta el mapeo de símbolos
 * que falte.
 */
export async function importXtbFile(file: File): Promise<ImportSummary> {
  // exceljs es pesado (~1MB) y solo hace falta al importar — se carga bajo
  // demanda en vez de ir en el bundle inicial de la app.
  const { parseXtbWorkbook } = await import('../import/xtbImporter')
  const buffer = await file.arrayBuffer()
  const result = await parseXtbWorkbook(buffer)

  await db.transactions.bulkPut(result.transactions)

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
    skipped: result.skipped,
    warnings: result.warnings,
    positions: positions.length,
    unresolvedSymbols: unresolved,
  }
}
