import { getQuote, type PriceResult, type QuoteRequest } from './_lib/quote.ts'

export const config = { runtime: 'edge' }

/** Tope de instrumentos por petición, para que nadie pueda pedir miles de golpe. */
const MAX_ITEMS = 100

/**
 * Cuántos instrumentos se consultan a la vez. Antes el navegador lanzaba una
 * petición por posición, todas simultáneas, y con la actualización cada
 * minuto eso eran decenas de llamadas a Yahoo de golpe: el camino más corto
 * para que empiece a limitar. Aquí se reparten en tandas.
 */
const CONCURRENCY = 6

interface BatchItem extends QuoteRequest {
  /** Clave con la que el cliente identifica el resultado (su símbolo canónico). */
  key: string
}

/**
 * Proxy same-origin de precios, para varios instrumentos en una sola llamada:
 * el navegador nunca llama a Twelve Data ni a Yahoo directamente (ninguno de
 * los dos permite CORS desde un origen de navegador), y la API key de Twelve
 * Data se queda en el servidor en vez de ir embebida en el bundle del cliente.
 *
 * Responde siempre 200 con un resultado por clave: `null` para los que no se
 * pudieron obtener, de modo que un fallo suelto no tumba al resto.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 })

  let items: BatchItem[]
  try {
    const body = (await request.json()) as { items?: unknown }
    items = Array.isArray(body.items) ? (body.items as BatchItem[]) : []
  } catch {
    return Response.json({ error: 'Cuerpo JSON no válido' }, { status: 400 })
  }

  const valid = items.filter(
    (i) => i && typeof i.key === 'string' && typeof i.yahooSymbol === 'string' && typeof i.twelveDataSymbol === 'string',
  )
  if (valid.length === 0 || valid.length > MAX_ITEMS) {
    return Response.json({ error: `Hacen falta entre 1 y ${MAX_ITEMS} instrumentos` }, { status: 400 })
  }

  const results: Record<string, PriceResult | null> = {}
  let next = 0
  async function worker() {
    while (next < valid.length) {
      const item = valid[next++]
      results[item.key] = await getQuote(item).catch(() => null)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, valid.length) }, worker))

  return Response.json({ results })
}
