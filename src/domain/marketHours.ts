import type { PriceCacheEntry } from './types'

/** Cada cuánto se actualiza con todos los mercados cerrados, en vez de cada minuto. */
export const CLOSED_MARKETS_INTERVAL_MS = 15 * 60_000

/**
 * ¿Estaban cerradas todas las bolsas de la cartera la última vez que se
 * consultaron? Solo cuenta lo que se sabe con seguridad: un precio sin el
 * dato (proveedor que no lo dice, o guardado antes de existir) cuenta como
 * abierto, para no dejar de actualizar por falta de información.
 */
export function allMarketsClosed(prices: (PriceCacheEntry | undefined)[]): boolean {
  return prices.length > 0 && prices.every((p) => p?.marketOpen === false)
}
