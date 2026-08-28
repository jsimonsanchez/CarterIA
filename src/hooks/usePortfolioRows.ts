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
  /** % de variación respecto al cierre de la sesión anterior — igual en cualquier divisa, no hace falta convertir. */
  dayChangePct?: number
  dayChangeEur?: number
}

/**
 * Posiciones + último precio cacheado + conversión a EUR, recalculado cada
 * vez que cambian las posiciones, la caché de precios o el mapeo de
 * símbolos (todas fuentes reactivas de Dexie).
 *
 * Se publica en dos pasos. Primero, lo que se sabe sin salir a la red —
 * símbolo, cantidad, coste medio—, para que la tabla aparezca de inmediato;
 * después, los importes que dependen del tipo de cambio. Antes no se pintaba
 * ni una fila hasta tener convertidas todas las divisas.
 *
 * `isLoading` distingue "todavía no hay datos" de "no hay posiciones": sin
 * él, mientras cargaba se anunciaba una cartera vacía a quien tiene 27
 * posiciones.
 */
export function usePortfolioRows(): { rows: PortfolioRow[]; isLoading: boolean } {
  const positions = useLiveQuery(() => db.positions.toArray(), [])
  const priceCache = useLiveQuery(() => db.priceCache.toArray(), [])
  const mappings = useLiveQuery(() => db.symbolMappings.toArray(), [])

  const [rows, setRows] = useState<PortfolioRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!positions) return

    let cancelled = false
    const priceBySymbol = new Map((priceCache ?? []).map((p) => [p.symbol, p]))
    const mappingBySymbol = new Map((mappings ?? []).map((m) => [m.xtbSymbol, m]))

    const baseRow = (pos: (typeof positions)[number]): PortfolioRow => ({
      symbol: pos.symbol,
      name: mappingBySymbol.get(pos.symbol)?.name,
      quantity: pos.quantity,
      averageCost: pos.averageCost,
      costBasis: pos.quantity * pos.averageCost,
    })

    // Paso 1: sin esperar a nada, para que la tabla se vea ya. Se marca como
    // "cargando" en CADA recálculo, no solo en el primero: al refrescar
    // precios las filas vuelven a quedarse sin importes un instante, y sin
    // esto se anunciaría "sin precio" en valores que sí lo tienen.
    setIsLoading(true)
    setRows(positions.map(baseRow))

    async function compute() {
      const computed = await Promise.all(
        positions!.map(async (pos): Promise<PortfolioRow> => {
          const price = priceBySymbol.get(pos.symbol)
          const base = baseRow(pos)
          const costBasis = base.costBasis

          if (!price) return base

          try {
            const currentPriceEur = await convertToEur(price.price, price.currency)
            const marketValueEur = pos.quantity * currentPriceEur
            const unrealizedPnlEur = marketValueEur - costBasis

            let dayChangePct: number | undefined
            let dayChangeEur: number | undefined
            // Si el mercado de este valor aún no ha abierto hoy, "price" sigue
            // siendo el cierre de ayer: calcular la variación daría el cambio de
            // ayer disfrazado de "hoy" — se omite para no mezclarlo con valores
            // de otros mercados que sí llevan ya sesión abierta.
            if (price.previousClose && price.previousClose > 0 && price.isTodaySession !== false) {
              dayChangePct = ((price.price - price.previousClose) / price.previousClose) * 100
              const previousCloseEur = await convertToEur(price.previousClose, price.currency)
              dayChangeEur = pos.quantity * (currentPriceEur - previousCloseEur)
            }

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
              dayChangePct,
              dayChangeEur,
            }
          } catch (err) {
            return { ...base, priceError: err instanceof Error ? err.message : String(err) }
          }
        }),
      )

      // Paso 2: los importes ya convertidos sustituyen a las filas base.
      if (!cancelled) {
        setRows(computed)
        setIsLoading(false)
      }
    }

    void compute()
    return () => {
      cancelled = true
    }
  }, [positions, priceCache, mappings])

  return { rows, isLoading }
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
