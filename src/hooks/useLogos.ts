import { useEffect, useState } from 'react'
import { db } from '../db/db'

/**
 * URL del logo de cada símbolo, servida siempre por nuestro propio proxy
 * (/api/logo) — el navegador nunca contacta a api.twelvedata.com
 * directamente, así que funciona igual detrás de un firewall/red que
 * bloquee ese dominio de terceros. `null` = sin mapeo de símbolo todavía
 * (no se puede construir la URL).
 */
export function useLogos(symbols: string[]): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const key = symbols.join(',')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const mappings = await db.symbolMappings.bulkGet(symbols)
      const next: Record<string, string | null> = {}
      symbols.forEach((symbol, i) => {
        const mapping = mappings[i]
        if (!mapping) {
          next[symbol] = null
          return
        }
        const params = new URLSearchParams({ symbol: mapping.twelveDataSymbol })
        if (mapping.twelveDataExchange) params.set('exchange', mapping.twelveDataExchange)
        next[symbol] = `/api/logo?${params.toString()}`
      })
      if (!cancelled) setUrls(next)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [key])

  return urls
}
