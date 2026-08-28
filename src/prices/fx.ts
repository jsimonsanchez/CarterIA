const RATE_TTL_MS = 60 * 60 * 1000 // 1h — los tipos de cambio no varían tanto intradía
const STORAGE_KEY = 'cartera-tracker:fx'

interface CachedRate {
  rate: number
  fetchedAt: number
}

let cache: Record<string, CachedRate> | null = null

/**
 * Peticiones en curso, por divisa. Sin esto, las 27 posiciones de una
 * cartera preguntan a la vez y todas fallan el acierto de caché —que solo se
 * escribe al recibir la respuesta—, así que se lanzan decenas de peticiones
 * idénticas en paralelo y la pantalla no muestra nada hasta que vuelven
 * todas. Compartiendo la promesa, N posiciones de la misma divisa gastan una
 * sola petición.
 */
const inFlight = new Map<string, Promise<number>>()

/**
 * La caché vive en localStorage y no solo en memoria: así abrir la app no
 * necesita ni una petición de red si los tipos siguen frescos. Antes se
 * perdía con cada recarga.
 */
function readCache(): Record<string, CachedRate> {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as Record<string, CachedRate>) : {}
  } catch {
    // Sin almacenamiento (modo privado, permisos): se sigue con memoria.
    cache = {}
  }
  return cache
}

function writeCache(currency: string, rate: number): void {
  const current = readCache()
  current[currency] = { rate, fetchedAt: Date.now() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Se conserva en memoria aunque no se pueda persistir.
  }
}

async function fetchRate(currency: string): Promise<number> {
  const res = await fetch(`/api/fx?from=${encodeURIComponent(currency)}`)
  if (!res.ok) throw new Error(`No se pudo obtener el tipo de cambio ${currency}->EUR`)
  const data = (await res.json()) as { rate?: unknown }
  const rate = data?.rate
  if (typeof rate !== 'number') throw new Error(`Respuesta de tipo de cambio inesperada para ${currency}`)
  return rate
}

async function getFxRateToEur(currency: string): Promise<number> {
  const cached = readCache()[currency]
  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached.rate

  const pending = inFlight.get(currency)
  if (pending) return pending

  const request = fetchRate(currency)
    .then((rate) => {
      writeCache(currency, rate)
      return rate
    })
    .catch((err) => {
      // Un tipo de cambio de hace unas horas se parece mucho al de ahora, y
      // desde luego informa más que un error: con él la cartera se sigue
      // viendo aunque el proveedor esté caído o no haya conexión.
      if (cached) return cached.rate
      throw err
    })
    .finally(() => {
      inFlight.delete(currency)
    })

  inFlight.set(currency, request)
  return request
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

/** Vacía la caché. Solo para las pruebas: cada una parte de cero. */
export function resetFxCacheForTests(): void {
  cache = null
  inFlight.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sin almacenamiento no hay nada que limpiar.
  }
}
