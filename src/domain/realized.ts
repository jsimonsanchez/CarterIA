import { isDividendWithholding } from './fees'
import { annualizedReturnOfTrades } from './performance'
import type { ClosedTrade, Transaction } from './types'

/** Un cobro de dividendo o la retención practicada sobre él, tal cual vino del extracto. */
export interface DividendMovement {
  id: string
  date: string
  /** Positivo el dividendo, negativo la retención. */
  amountEur: number
  isWithholding: boolean
}

export interface RealizedSymbol {
  symbol: string
  trades: ClosedTrade[]
  dividends: DividendMovement[]
  /** Coste de adquisición de lo vendido. */
  cost: number
  /** Importe obtenido en las ventas. */
  sale: number
  /** Dividendos ya netos de su retención. */
  dividendTotal: number
  /** Ganancia de las ventas más los dividendos netos. */
  pnl: number
  /** Sobre el coste de lo vendido; `undefined` si no se vendió nada (solo dividendos). */
  pct?: number
  /** Tasa (no porcentaje) anualizada del valor, dividendos incluidos. */
  annualizedRate?: number
}

export interface RealizedYear {
  year: number
  symbols: RealizedSymbol[]
  cost: number
  sale: number
  dividendTotal: number
  pnl: number
  pct?: number
  /** Cuántas operaciones cerradas hubo ese año. */
  tradeCount: number
}

/** ¿Este movimiento forma parte de un dividendo neto? */
function isDividendFlow(tx: Transaction): boolean {
  return tx.type === 'dividend' || (tx.type === 'fee' && isDividendWithholding(tx.rawDescription))
}

/** Los dividendos cobrados, ya netos de sus retenciones. */
export function netDividends(transactions: Transaction[]): number {
  return transactions.filter(isDividendFlow).reduce((acc, tx) => acc + tx.total, 0)
}

/**
 * Agrupa por año y valor las posiciones cerradas, con los dividendos que
 * pagó cada valor en ese mismo año.
 *
 * Solo entran valores con alguna venta ese año: una posición cerrada es una
 * venta, y un valor que solo repartió dividendos no ha cerrado nada. Sus
 * dividendos siguen contando como realizados en el resumen —son dinero ya
 * cobrado—, pero no tienen sitio en esta tabla.
 *
 * Cada dividendo se asigna al año en que se cobró y a su valor, así que
 * aparece como mucho una vez: los de un año sin ventas de ese valor
 * simplemente no salen aquí, en vez de arrastrarse al año de la venta y
 * acabar contados dos veces.
 */
export function buildRealizedYears(trades: ClosedTrade[], transactions: Transaction[]): RealizedYear[] {
  const byYear = new Map<number, Map<string, RealizedSymbol>>()

  const symbolEntry = (year: number, symbol: string): RealizedSymbol => {
    const symbols = byYear.get(year) ?? new Map<string, RealizedSymbol>()
    byYear.set(year, symbols)
    const existing = symbols.get(symbol)
    if (existing) return existing

    const created: RealizedSymbol = {
      symbol,
      trades: [],
      dividends: [],
      cost: 0,
      sale: 0,
      dividendTotal: 0,
      pnl: 0,
    }
    symbols.set(symbol, created)
    return created
  }

  for (const trade of trades) {
    const entry = symbolEntry(new Date(trade.closeDate).getFullYear(), trade.symbol)
    entry.trades.push(trade)
    entry.cost += trade.purchaseValueEur
    entry.sale += trade.saleValueEur
  }

  for (const tx of transactions.filter(isDividendFlow)) {
    // `symbols.get` y no `symbolEntry`: si ese valor no vendió nada ese año
    // no se le crea fila — el dividendo se queda fuera de la tabla.
    const entry = byYear.get(new Date(tx.date).getFullYear())?.get(tx.symbol)
    if (!entry) continue
    entry.dividends.push({
      id: tx.id,
      date: tx.date,
      amountEur: tx.total,
      isWithholding: tx.type === 'fee',
    })
    entry.dividendTotal += tx.total
  }

  const years: RealizedYear[] = []

  for (const [year, symbols] of byYear) {
    const list = [...symbols.values()]
    for (const entry of list) {
      entry.trades.sort((a, b) => b.closeDate.localeCompare(a.closeDate))
      entry.dividends.sort((a, b) => b.date.localeCompare(a.date))
      entry.pnl = entry.sale - entry.cost + entry.dividendTotal
      entry.pct = entry.cost > 0 ? (entry.pnl / entry.cost) * 100 : undefined
      entry.annualizedRate = annualizedReturnOfTrades(
        entry.trades,
        entry.dividends.map((d) => ({ date: new Date(d.date), amount: d.amountEur })),
      )
    }

    // De mayor a menor aportación: lo primero que se quiere ver es qué valor
    // explica el resultado del año.
    list.sort((a, b) => b.pnl - a.pnl)

    const cost = list.reduce((acc, s) => acc + s.cost, 0)
    const sale = list.reduce((acc, s) => acc + s.sale, 0)
    const dividendTotal = list.reduce((acc, s) => acc + s.dividendTotal, 0)
    const pnl = sale - cost + dividendTotal

    years.push({
      year,
      symbols: list,
      cost,
      sale,
      dividendTotal,
      pnl,
      pct: cost > 0 ? (pnl / cost) * 100 : undefined,
      tradeCount: list.reduce((acc, s) => acc + s.trades.length, 0),
    })
  }

  return years.sort((a, b) => b.year - a.year)
}
