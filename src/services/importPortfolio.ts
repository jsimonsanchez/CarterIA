import { db } from '../db/db'
import { computePositions } from '../domain/positions'
import { ensureSymbolMappings } from '../domain/symbolResolver'
import type { Broker, SymbolMapping } from '../domain/types'
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
 * Borra de este dispositivo los datos de un bróker: sus movimientos y sus
 * operaciones cerradas. Se ejecuta al confirmar la importación, antes
 * incluso de elegir fichero (y aunque luego no se elija ninguno): el
 * extracto trae el histórico completo de ese bróker, así que cada
 * importación parte de cero en vez de mezclarse con restos de la anterior.
 *
 * Solo toca al bróker indicado: importar IBKR no debe llevarse por delante
 * lo de XTB. Las posiciones se recalculan con lo que quede de los demás.
 *
 * symbolMappings se conserva a propósito: no contiene datos de la cartera,
 * solo la equivalencia de tickers entre proveedores más el nombre y el logo
 * ya descargados. Borrarla obligaría a volver a gastar crédito de Twelve Data
 * en resolver cada logo.
 */
export async function clearBrokerData(broker: Broker): Promise<void> {
  await db.transaction('rw', db.transactions, db.closedTrades, db.positions, db.priceCache, async () => {
    await db.transactions.where('broker').equals(broker).delete()
    await db.closedTrades.where('broker').equals(broker).delete()
    await recomputePositions()
    await db.priceCache.clear()
  })
}

/** Recalcula las posiciones desde el histórico completo de movimientos de todos los brókers. */
async function recomputePositions(): Promise<number> {
  const all = await db.transactions.toArray()
  const positions = computePositions(all)
  await db.positions.clear()
  await db.positions.bulkPut(positions)
  return positions.length
}

/**
 * Da de alta el mapeo de precios de unos instrumentos, conservando el nombre
 * y el logo ya resueltos — mismo criterio que `ensureSymbolMappings`, pero
 * con mapeos ya calculados por el importador en vez de deducidos del ticker.
 */
async function saveMappings(mappings: SymbolMapping[]): Promise<void> {
  for (const mapping of mappings) {
    const existing = await db.symbolMappings.get(mapping.xtbSymbol)
    await db.symbolMappings.put({
      ...mapping,
      name: mapping.name ?? existing?.name,
      logoUrl: existing?.logoUrl,
    })
  }
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

  const positionCount = await db.transaction('rw', db.transactions, db.positions, recomputePositions)

  const symbols = result.transactions.map((t) => t.symbol).filter(Boolean)
  const { unresolved } = await ensureSymbolMappings(symbols)

  return {
    imported: result.transactions.length,
    skippedRows: result.skippedRows,
    warnings: result.warnings,
    positions: positionCount,
    closedTrades: closedResult.trades.length,
    unresolvedSymbols: unresolved,
  }
}

/**
 * Importa uno o varios informes Flex de IBKR (.xml). Se admiten varios de
 * golpe porque IBKR no deja pedir más de un año por informe: el histórico
 * completo son varios ficheros, y cargarlos de uno en uno borraría el
 * anterior. Reimportar el mismo informe no duplica (upsert por id).
 */
export async function importIbkrFiles(files: File[]): Promise<ImportSummary> {
  const { parseIbkrFlexReport } = await import('../import/ibkrImporter')

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        return parseIbkrFlexReport(await file.text())
      } catch (err) {
        throw new Error(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }),
  )

  const transactions = results.flatMap((r) => r.transactions)
  await db.transactions.bulkPut(transactions)
  await saveMappings(results.flatMap((r) => r.mappings))

  const positionCount = await db.transaction('rw', db.transactions, db.positions, recomputePositions)

  // Las posiciones que declara el informe más reciente son la única
  // comprobación independiente de que los movimientos se han interpretado
  // bien: si lo calculado no coincide, se avisa en vez de enseñar cifras
  // que no cuadran con el bróker.
  const latest = results.reduce((a, b) => (b.toDate > a.toDate ? b : a))
  const computed = await db.positions.toArray()
  const warnings = [...results.flatMap((r) => r.warnings)]
  for (const reported of latest.reportedPositions) {
    const ours = computed.find((p) => p.symbol === reported.symbol)?.quantity ?? 0
    if (Math.abs(ours - reported.quantity) > 1e-6) {
      warnings.push({
        rowId: reported.symbol,
        message: `IBKR declara ${reported.quantity} de ${reported.symbol} y de los movimientos salen ${ours}.`,
      })
    }
  }

  return {
    imported: transactions.length,
    skippedRows: results.flatMap((r) => r.skippedRows),
    warnings,
    positions: positionCount,
    closedTrades: 0,
    unresolvedSymbols: [...new Set(results.flatMap((r) => r.unresolved))],
  }
}
