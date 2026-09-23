import Dexie, { type EntityTable } from 'dexie'
import type { ClosedTrade, Position, PriceCacheEntry, SymbolMapping, Transaction } from '../domain/types'

export class CarteraDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  positions!: EntityTable<Position, 'symbol'>
  priceCache!: EntityTable<PriceCacheEntry, 'symbol'>
  symbolMappings!: EntityTable<SymbolMapping, 'xtbSymbol'>
  closedTrades!: EntityTable<ClosedTrade, 'id'>

  constructor() {
    super('cartera-tracker')

    this.version(1).stores({
      transactions: 'id, date, symbol, type',
      positions: 'symbol',
      priceCache: 'symbol, fetchedAt',
      symbolMappings: 'xtbSymbol',
      closedTrades: 'id, symbol, closeDate',
    })

    // v2: varios brókers. El índice permite borrar solo lo de uno al
    // reimportarlo; lo ya guardado es de XTB, que era el único origen.
    this.version(2)
      .stores({
        transactions: 'id, date, symbol, type, broker',
        closedTrades: 'id, symbol, closeDate, broker',
      })
      .upgrade(async (tx) => {
        await tx.table('transactions').toCollection().modify({ broker: 'xtb' })
        await tx.table('closedTrades').toCollection().modify({ broker: 'xtb' })
      })
  }
}

export const db = new CarteraDB()
