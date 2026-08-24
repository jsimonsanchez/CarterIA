import type { Position, Transaction } from './types'

/**
 * Recalcula las posiciones agregadas a partir del histórico completo de transacciones,
 * usando coste medio ponderado. Se recalcula desde cero en cada importación en vez de
 * actualizarse incrementalmente, para no arrastrar errores de ejecuciones anteriores.
 */
export function computePositions(transactions: Transaction[]): Position[] {
  const bySymbol = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const list = bySymbol.get(tx.symbol) ?? []
    list.push(tx)
    bySymbol.set(tx.symbol, list)
  }

  const now = new Date().toISOString()
  const positions: Position[] = []

  for (const [symbol, txs] of bySymbol) {
    txs.sort((a, b) => a.date.localeCompare(b.date))

    let quantity = 0
    let totalCost = 0
    let currency = txs[0]?.currency ?? ''

    for (const tx of txs) {
      if (tx.type === 'buy') {
        quantity += tx.quantity
        totalCost += tx.quantity * tx.price + tx.commission
        currency = tx.currency
      } else if (tx.type === 'sell') {
        const averageCost = quantity > 0 ? totalCost / quantity : 0
        quantity -= tx.quantity
        totalCost -= tx.quantity * averageCost
      }
      // dividend/fee/other no afectan a cantidad ni coste de la posición
    }

    if (quantity > 1e-9) {
      positions.push({
        symbol,
        quantity,
        averageCost: totalCost / quantity,
        currency,
        lastUpdated: now,
      })
    }
  }

  return positions
}
