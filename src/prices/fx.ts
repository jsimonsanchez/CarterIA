const RATE_TTL_MS = 60 * 60 * 1000 // 1h — los tipos de cambio no varían tanto intradía

const rateCache = new Map<string, { rate: number; fetchedAt: number }>()

async function getFxRateToEur(currency: string): Promise<number> {
  const cached = rateCache.get(currency)
  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached.rate

  const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(currency)}&to=EUR`)
  if (!res.ok) throw new Error(`No se pudo obtener el tipo de cambio ${currency}->EUR`)
  const data = await res.json()
  const rate = data?.rates?.EUR
  if (typeof rate !== 'number') throw new Error(`Respuesta de tipo de cambio inesperada para ${currency}`)

  rateCache.set(currency, { rate, fetchedAt: Date.now() })
  return rate
}

/**
 * Convierte un importe a EUR. Los proveedores de precios devuelven algunas
 * plazas del Reino Unido en peniques ("GBp"/"GBX") en vez de libras, así que
 * ese caso se normaliza a GBP antes de aplicar el tipo de cambio.
 */
export async function convertToEur(amount: number, currency: string): Promise<number> {
  const cur = currency.trim()
  if (cur.toUpperCase() === 'EUR') return amount

  if (cur === 'GBp' || cur === 'GBX') {
    const gbpRate = await getFxRateToEur('GBP')
    return (amount / 100) * gbpRate
  }

  const rate = await getFxRateToEur(cur)
  return amount * rate
}
