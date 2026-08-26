import { useEffect, useState } from 'react'
import { db } from '../db/db'
import type { SymbolMapping } from '../domain/types'

/**
 * URL (servida por nuestro propio proxy) del logo de cada símbolo. `null` =
 * sin logo disponible. El navegador nunca contacta a api.twelvedata.com
 * directamente, así que funciona igual detrás de una red que bloquee ese
 * dominio de terceros.
 *
 * Como los logos no cambian nunca, se resuelve dónde está UNA sola vez por
 * símbolo y se guarda en `symbolMappings`; a partir de ahí solo se piden los
 * bytes de la imagen. Un símbolo sin logo se marca con `null` para no volver
 * a preguntar por él. Esto importa porque el respaldo (Twelve Data) gasta
 * crédito de una cuota diaria compartida con los precios.
 */
export function useLogos(symbols: string[]): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const key = symbols.join(',')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const mappings = await db.symbolMappings.bulkGet(symbols)
      const next: Record<string, string | null> = {}
      const pending: { symbol: string; mapping: SymbolMapping }[] = []

      symbols.forEach((symbol, i) => {
        const mapping = mappings[i]
        if (!mapping) {
          next[symbol] = null
          return
        }
        if (mapping.logoUrl === undefined) {
          // Aún no se ha preguntado por este símbolo.
          next[symbol] = null
          pending.push({ symbol, mapping })
          return
        }
        next[symbol] = mapping.logoUrl === null ? null : toProxyUrl(mapping.logoUrl)
      })

      if (!cancelled) setUrls(next)

      for (const { symbol, mapping } of pending) {
        if (cancelled) return

        const resolved = await resolveLogo(mapping)
        // La cuota agotada (o un fallo de red) es temporal: no se guarda nada,
        // porque marcarlo como "sin logo" lo volvería permanente.
        if (resolved === 'retry') continue

        await db.symbolMappings.put({ ...mapping, logoUrl: resolved })
        if (resolved !== null && !cancelled) {
          setUrls((prev) => ({ ...prev, [symbol]: toProxyUrl(resolved) }))
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [key])

  return urls
}

function toProxyUrl(logoUrl: string): string {
  return `/api/logo?src=${encodeURIComponent(logoUrl)}`
}

async function resolveLogo(mapping: SymbolMapping): Promise<string | null | 'retry'> {
  const params = new URLSearchParams({
    yahooSymbol: mapping.yahooSymbol,
    twelveDataSymbol: mapping.twelveDataSymbol,
  })
  if (mapping.twelveDataExchange) params.set('exchange', mapping.twelveDataExchange)

  try {
    const res = await fetch(`/api/logo?${params.toString()}`)
    if (res.status === 429 || res.status >= 500) return 'retry'
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.url === 'string' ? data.url : null
  } catch {
    return 'retry'
  }
}
