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
  }
}

export const db = new CarteraDB()
