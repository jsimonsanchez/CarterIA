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
 * Da de alta o refresca en `symbolMappings` los símbolos de XTB presentes en
 * `xtbSymbols`, usando `resolveSymbol`. Se sobrescribe siempre en vez de
 * respetar entradas existentes: todavía no hay UI para editar el mapeo a
 * mano, así que no hay ediciones de usuario que proteger, y sobrescribir
 * permite que una corrección en las reglas de mapeo se autoaplique en la
 * siguiente importación sin pasos manuales. Si en el futuro se añade edición
 * manual, este comportamiento tendrá que cambiar para no pisarla. Los
 * símbolos sin regla conocida (mercado no cubierto) se devuelven en
 * `unresolved` para que la UI pida un mapeo manual.
 */
export async function ensureSymbolMappings(xtbSymbols: Iterable<string>): Promise<{ unresolved: string[] }> {
  const unresolved: string[] = []

  for (const xtbSymbol of new Set(xtbSymbols)) {
    if (!xtbSymbol) continue

    const resolved = resolveSymbol(xtbSymbol)
    if (resolved) {
      // El nombre de la empresa y el logo no salen del extracto: los aporta
      // el proveedor de precios y cuesta una llamada conseguirlos. Se
      // conservan al reimportar en vez de volver a pedirlos.
      const existing = await db.symbolMappings.get(xtbSymbol)
      await db.symbolMappings.put({
        ...resolved,
        name: resolved.name ?? existing?.name,
        logoUrl: existing?.logoUrl,
      })
    } else {
      unresolved.push(xtbSymbol)
    }
  }

  return { unresolved }
}
