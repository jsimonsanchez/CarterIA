import { useEffect, useState } from 'react'
import { db } from '../db/db'

// Caché a nivel de módulo (no en IndexedDB): los logos casi nunca cambian y
// como mucho se piden 6 a la vez (los del panel de volatilidad), así que
// con que dure la sesión del navegador es más que suficiente.
const logoCache = new Map<string, string | null>()

/** Resuelve el logo de cada símbolo (vía /api/logo, Twelve Data) para mostrarlo junto al ticker. `null` = sin logo disponible para ese símbolo. */
export function useLogos(symbols: string[]): Record<string, string | null> {
  const [, forceRender] = useState(0)
  const key = symbols.join(',')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const missing = symbols.filter((s) => !logoCache.has(s))
      if (missing.length === 0) return

      const mappings = await db.symbolMappings.bulkGet(missing)
      await Promise.all(
        missing.map(async (symbol, i) => {
          const mapping = mappings[i]
          if (!mapping) {
            logoCache.set(symbol, null)
            return
          }
          try {
            const params = new URLSearchParams({ symbol: mapping.twelveDataSymbol })
            if (mapping.twelveDataExchange) params.set('exchange', mapping.twelveDataExchange)
            const res = await fetch(`/api/logo?${params.toString()}`)
            const data = res.ok ? await res.json() : null
            logoCache.set(symbol, typeof data?.url === 'string' ? data.url : null)
          } catch {
            logoCache.set(symbol, null)
          }
        }),
      )

      if (!cancelled) forceRender((n) => n + 1)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [key])

  const result: Record<string, string | null> = {}
  for (const s of symbols) result[s] = logoCache.get(s) ?? null
  return result
}
