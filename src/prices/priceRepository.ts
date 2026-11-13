import { frankfurtIsinFor } from '../data/isinBySymbol'
import { db } from '../db/db'
import type { PriceCacheEntry, SymbolMapping } from '../domain/types'

interface ProxyPriceResponse {
  price: number
  currency: string
  source: 'twelvedata' | 'yahoo'
  previousClose?: number
  isTodaySession?: boolean
  preMarketChangePct?: number
  name?: string
  marketOpen?: boolean
}

/**
 * Margen para la llamada entera. El servidor ya corta cada consulta a un
 * proveedor a los 5 s; esto cubre que la propia función no responda.
 */
const REQUEST_TIMEOUT_MS = 30_000

/**
 * Actualiza el precio de varios instrumentos con UNA llamada a `/api/prices`
 * (ver `api/prices.ts`), que resuelve Yahoo → Twelve Data por cada uno.
 *
 * Los precios nuevos se guardan de una sola vez. Antes cada uno se escribía
 * por separado y cada escritura hacía recalcular la cartera entera: con 30
 * posiciones, 30 recálculos por actualización.
 *
 * Si la llamada falla o un instrumento no tiene precio, se queda con el
 * último guardado; solo cuenta como fallo si tampoco hay ninguno guardado.
 */
export async function getPrices(
  mappings: SymbolMapping[],
): Promise<{ prices: PriceCacheEntry[]; failed: { symbol: string; error: string }[] }> {
  if (mappings.length === 0) return { prices: [], failed: [] }

  let results: Record<string, ProxyPriceResponse | null> = {}
  let requestError: string | undefined
  try {
    const res = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: mappings.map((m) => ({
          key: m.xtbSymbol,
          yahooSymbol: m.yahooSymbol,
          twelveDataSymbol: m.twelveDataSymbol,
          twelveDataExchange: m.twelveDataExchange,
          // Con ISIN, el proxy toma el cierre anterior de Börse Frankfurt, que
          // es la plaza del broker; sin él, se queda con el de Yahoo. Se busca
          // en la tabla estática y no en el `mapping`, que se guarda al
          // importar y puede ser de antes de que existiera esa tabla.
          isin: frankfurtIsinFor(m.xtbSymbol),
        })),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`El proxy de precios respondió ${res.status}`)
    results = ((await res.json()) as { results?: typeof results }).results ?? {}
  } catch (err) {
    requestError = err instanceof Error ? err.message : String(err)
  }

  const fetchedAt = new Date().toISOString()
  const fresh: PriceCacheEntry[] = []
  const names: { symbol: string; name: string }[] = []

  for (const mapping of mappings) {
    const data = results[mapping.xtbSymbol]
    if (!data) continue
    fresh.push({
      symbol: mapping.xtbSymbol,
      price: data.price,
      currency: data.currency,
      source: data.source,
      fetchedAt,
      previousClose: data.previousClose,
      isTodaySession: data.isTodaySession,
      preMarketChangePct: data.preMarketChangePct,
      marketOpen: data.marketOpen,
    })
    // El nombre completo no viene en el extracto: se rellena con el que dé
    // el proveedor de precios.
    if (data.name && data.name !== mapping.name) names.push({ symbol: mapping.xtbSymbol, name: data.name })
  }

  await db.transaction('rw', db.priceCache, db.symbolMappings, async () => {
    await db.priceCache.bulkPut(fresh)
    // `update` y no `put` de una copia: solo toca el nombre. Escribir el
    // mapeo entero desde una copia leída antes pisaba el logo si se había
    // resuelto mientras tanto.
    for (const { symbol, name } of names) {
      await db.symbolMappings.update(symbol, { name })
    }
  })

  const freshSymbols = new Set(fresh.map((p) => p.symbol))
  const missing = mappings.filter((m) => !freshSymbols.has(m.xtbSymbol))
  const cached = await db.priceCache.bulkGet(missing.map((m) => m.xtbSymbol))

  const prices = [...fresh]
  const failed: { symbol: string; error: string }[] = []
  missing.forEach((mapping, i) => {
    const entry = cached[i]
    if (entry) prices.push(entry)
    else
      failed.push({
        symbol: mapping.xtbSymbol,
        error: `Sin precio disponible para ${mapping.xtbSymbol}${requestError ? ` (${requestError})` : ''}`,
      })
  })

  return { prices, failed }
}
