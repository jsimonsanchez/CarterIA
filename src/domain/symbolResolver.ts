import { db } from '../db/db'
import { SYMBOL_OVERRIDES } from '../data/symbolOverrides'
import type { SymbolMapping } from './types'
import { deriveSymbolMapping } from './symbolSuffixRules'

const overridesByXtbSymbol = new Map(SYMBOL_OVERRIDES.map((m) => [m.xtbSymbol, m]))

/** Resuelve un ticker de XTB a Twelve Data/Yahoo: excepción manual primero, si no la regla de sufijo por mercado. */
export function resolveSymbol(xtbSymbol: string): SymbolMapping | undefined {
  return overridesByXtbSymbol.get(xtbSymbol) ?? deriveSymbolMapping(xtbSymbol)
}

/**
 * Da de alta en `symbolMappings` los símbolos de XTB que aún no tengan
 * entrada, usando `resolveSymbol`. No toca las entradas ya existentes, para
 * no pisar ediciones manuales del usuario en reimportaciones. Los símbolos
 * sin regla conocida (mercado no cubierto) se devuelven en `unresolved` para
 * que la UI pida un mapeo manual.
 */
export async function ensureSymbolMappings(xtbSymbols: Iterable<string>): Promise<{ unresolved: string[] }> {
  const unresolved: string[] = []

  for (const xtbSymbol of new Set(xtbSymbols)) {
    if (!xtbSymbol) continue
    const existing = await db.symbolMappings.get(xtbSymbol)
    if (existing) continue

    const resolved = resolveSymbol(xtbSymbol)
    if (resolved) {
      await db.symbolMappings.put(resolved)
    } else {
      unresolved.push(xtbSymbol)
    }
  }

  return { unresolved }
}
