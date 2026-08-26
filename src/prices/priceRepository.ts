import { db } from '../db/db'
import type { PriceCacheEntry, SymbolMapping } from '../domain/types'

interface ProxyPriceResponse {
  price: number
  currency: string
  source: 'twelvedata' | 'yahoo'
  previousClose?: number
  isTodaySession?: boolean
  name?: string
}

/**
 * Orquesta la cadena de fallback Twelve Data → Yahoo (vía `/api/price`,
 * proxy serverless — ver `api/price.ts`) → última cotización cacheada en
 * IndexedDB. El proxy ya resuelve el fallback entre proveedores; esta capa
 * solo añade el último nivel (caché local) cuando el proxy en sí falla
 * (sin conexión, función caída, etc.).
 */
export async function getPrice(mapping: SymbolMapping): Promise<PriceCacheEntry> {
  try {
    const params = new URLSearchParams({
      twelveDataSymbol: mapping.twelveDataSymbol,
      yahooSymbol: mapping.yahooSymbol,
    })
    if (mapping.twelveDataExchange) {
      params.set('twelveDataExchange', mapping.twelveDataExchange)
    }

    const res = await fetch(`/api/price?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`El proxy de precios respondió ${res.status}`)
    }

    const data = (await res.json()) as ProxyPriceResponse
    const entry: PriceCacheEntry = {
      symbol: mapping.xtbSymbol,
      price: data.price,
      currency: data.currency,
      source: data.source,
      fetchedAt: new Date().toISOString(),
      previousClose: data.previousClose,
      isTodaySession: data.isTodaySession,
    }
    await db.priceCache.put(entry)

    // El nombre completo del instrumento no viene en el extracto de XTB —
    // se rellena a partir de lo que devuelva el proveedor de precios, la
    // primera vez que se consigue.
    if (data.name && data.name !== mapping.name) {
      await db.symbolMappings.put({ ...mapping, name: data.name })
    }

    return entry
  } catch (err) {
    const cached = await db.priceCache.get(mapping.xtbSymbol)
    if (cached) return cached

    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Sin precio disponible para ${mapping.xtbSymbol} (proxy falló y no hay caché previa: ${reason})`)
  }
}

/** Obtiene el precio de varios símbolos en paralelo; los fallos individuales no interrumpen al resto. */
export async function getPrices(
  mappings: SymbolMapping[],
): Promise<{ prices: PriceCacheEntry[]; failed: { symbol: string; error: string }[] }> {
  const results = await Promise.allSettled(mappings.map((m) => getPrice(m)))

  const prices: PriceCacheEntry[] = []
  const failed: { symbol: string; error: string }[] = []

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      prices.push(result.value)
    } else {
      failed.push({ symbol: mappings[i].xtbSymbol, error: String(result.reason) })
    }
  })

  return { prices, failed }
}
