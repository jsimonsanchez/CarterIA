export type OperationType = 'buy' | 'sell' | 'dividend' | 'fee' | 'interest' | 'deposit' | 'other'

/** Una línea de movimiento importada del extracto de XTB, ya normalizada. */
export interface Transaction {
  /** Hash estable de los campos originales de la línea, usado como PK para deduplicar reimportaciones. */
  id: string
  date: string // ISO 8601
  type: OperationType
  symbol: string
  quantity: number
  price: number
  currency: string
  commission: number
  total: number
  /** Símbolo tal cual aparece en el extracto de XTB, antes de mapear a Twelve Data / Yahoo. */
  rawSymbol: string
  /** Texto original de la línea, para depuración y auditoría de la importación. */
  rawDescription: string
}

/** Posición agregada por símbolo, recalculada a partir de las transacciones. */
export interface Position {
  symbol: string
  quantity: number
  averageCost: number
  currency: string
  lastUpdated: string // ISO 8601
}

export type PriceSource = 'twelvedata' | 'yahoo' | 'cache'

export interface PriceCacheEntry {
  symbol: string
  price: number
  currency: string
  source: PriceSource
  fetchedAt: string // ISO 8601
}

/** Tabla de equivalencias manual entre el símbolo de XTB y los tickers de cada proveedor de precios. */
export interface SymbolMapping {
  /** Símbolo tal cual aparece en el extracto de XTB (clave). */
  xtbSymbol: string
  twelveDataSymbol: string
  /** Exchange que espera Twelve Data en el parámetro `exchange` (undefined para mercado de EEUU). */
  twelveDataExchange?: string
  yahooSymbol: string
  name?: string
}
