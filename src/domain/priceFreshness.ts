// A partir de aquí el precio en caché se considera desactualizado — 24h es
// más que de sobra para una app pensada para refrescarse al abrirla.
export const STALE_PRICE_MS = 24 * 60 * 60 * 1000

export function isPriceStale(fetchedAt: string | undefined): boolean {
  if (!fetchedAt) return false
  return Date.now() - new Date(fetchedAt).getTime() > STALE_PRICE_MS
}
