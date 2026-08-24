import type { SymbolMapping } from './types'

interface MarketSuffixRule {
  /** Sufijo que añade Yahoo Finance al ticker base (vacío para mercados de EEUU). */
  yahooSuffix: string
  /** Nombre de exchange que espera Twelve Data en el parámetro `exchange` (undefined = mercado de EEUU, sin parámetro). */
  twelveDataExchange?: string
}

/**
 * Reglas de conversión de sufijo por mercado, derivadas de los sufijos que usa
 * XTB en sus extractos. Cubren el caso general (ticker base idéntico entre
 * proveedores, solo cambia el sufijo/exchange). Las excepciones reales
 * (tickers de clase de acción, ETCs con nombre distinto, etc.) van en
 * `symbolOverrides.ts` en vez de aquí.
 */
const XTB_SUFFIX_RULES: Record<string, MarketSuffixRule> = {
  US: { yahooSuffix: '' },
  DE: { yahooSuffix: '.DE', twelveDataExchange: 'XETRA' },
  UK: { yahooSuffix: '.L', twelveDataExchange: 'LSE' },
  SE: { yahooSuffix: '.ST', twelveDataExchange: 'Nasdaq Stockholm' },
  DK: { yahooSuffix: '.CO', twelveDataExchange: 'Nasdaq Copenhagen' },
  FR: { yahooSuffix: '.PA', twelveDataExchange: 'Euronext Paris' },
  IT: { yahooSuffix: '.MI', twelveDataExchange: 'Borsa Italiana' },
}

/**
 * Deriva el mapeo de un ticker de XTB por regla de sufijo de mercado. Sirve
 * como valor por defecto razonable para la mayoría de instrumentos; los casos
 * excepcionales (p.ej. tickers de clase de acción distintos entre XTB y
 * Yahoo) se resuelven con una entrada manual en `symbolOverrides.ts` que
 * tiene prioridad sobre esta derivación — ver `resolveSymbol`.
 */
export function deriveSymbolMapping(xtbSymbol: string): SymbolMapping | undefined {
  const dotIndex = xtbSymbol.lastIndexOf('.')
  if (dotIndex === -1) return undefined

  const base = xtbSymbol.slice(0, dotIndex)
  const suffix = xtbSymbol.slice(dotIndex + 1)
  const rule = XTB_SUFFIX_RULES[suffix]
  if (!rule) return undefined

  return {
    xtbSymbol,
    twelveDataSymbol: base,
    twelveDataExchange: rule.twelveDataExchange,
    yahooSymbol: base + rule.yahooSuffix,
  }
}
