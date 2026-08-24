import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { convertToEur } from '../prices/fx'
import { getPrices } from '../prices/priceRepository'

export interface PortfolioRow {
  symbol: string
  name?: string
  quantity: number
  averageCost: number // EUR/acción
  costBasis: number // EUR
  currentPriceNative?: number
  currentCurrency?: string
  currentPriceEur?: number
  marketValueEur?: number
  unrealizedPnlEur?: number
  unrealizedPnlPct?: number
  priceSource?: 'twelvedata' | 'yahoo' | 'cache'
  priceFetchedAt?: string
  priceError?: string
}

/**
 * Posiciones + último precio cacheado + conversión a EUR, recalculado cada
 * vez que cambian las posiciones, la caché de precios o el mapeo de
 * símbolos (todas fuentes reactivas de Dexie). La conversión a EUR es
 * asíncrona (FX en vivo), así que se calcula en un efecto en vez de en el
 * propio `useLiveQuery`.
 */
export function usePortfolioRows() {
  const positions = useLiveQuery(() => db.positions.toArray(), [])
  const priceCache = useLiveQuery(() => db.priceCache.toArray(), [])
  const mappings = useLiveQuery(() => db.symbolMappings.toArray(), [])

  const [rows, setRows] = useState<PortfolioRow[]>([])

  useEffect(() => {
    if (!positions) return

    let cancelled = false
    const priceBySymbol = new Map((priceCache ?? []).map((p) => [p.symbol, p]))
    const mappingBySymbol = new Map((mappings ?? []).map((m) => [m.xtbSymbol, m]))

    async function compute() {
      const computed = await Promise.all(
        positions!.map(async (pos): Promise<PortfolioRow> => {
          const price = priceBySymbol.get(pos.symbol)
          const mapping = mappingBySymbol.get(pos.symbol)
          const costBasis = pos.quantity * pos.averageCost

          const base: PortfolioRow = {
            symbol: pos.symbol,
            name: mapping?.name,
            quantity: pos.quantity,
            averageCost: pos.averageCost,
            costBasis,
          }

          if (!price) return base

          try {
            const currentPriceEur = await convertToEur(price.price, price.currency)
            const marketValueEur = pos.quantity * currentPriceEur
            const unrealizedPnlEur = marketValueEur - costBasis
            return {
              ...base,
              currentPriceNative: price.price,
              currentCurrency: price.currency,
              currentPriceEur,
              marketValueEur,
              unrealizedPnlEur,
              unrealizedPnlPct: costBasis > 0 ? (unrealizedPnlEur / costBasis) * 100 : undefined,
              priceSource: price.source,
              priceFetchedAt: price.fetchedAt,
            }
          } catch (err) {
            return { ...base, priceError: err instanceof Error ? err.message : String(err) }
          }
        }),
      )

      if (!cancelled) setRows(computed)
    }

    void compute()
    return () => {
      cancelled = true
    }
  }, [positions, priceCache, mappings])

  return rows
}

/** Dispara la actualización de precios (Twelve Data → Yahoo → caché) para todas las posiciones actuales. */
export async function refreshPrices(): Promise<{ failed: { symbol: string; error: string }[] }> {
  const [positions, mappings] = await Promise.all([db.positions.toArray(), db.symbolMappings.toArray()])
  const mappingBySymbol = new Map(mappings.map((m) => [m.xtbSymbol, m]))

  const resolvedMappings = positions
    .map((p) => mappingBySymbol.get(p.symbol))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)

  const { failed } = await getPrices(resolvedMappings)
  return { failed }
}
