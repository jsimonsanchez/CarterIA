export const config = { runtime: 'edge' }

/**
 * Proxy same-origin para el tipo de cambio (frankfurter.app, API del BCE).
 * Igual que con Twelve Data/Yahoo en api/price.ts: frankfurter tampoco envía
 * cabeceras CORS, así que la petición no puede salir directamente desde el
 * navegador.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')

  if (!from) {
    return Response.json({ error: 'Falta el parámetro from' }, { status: 400 })
  }
  if (from.toUpperCase() === 'EUR') {
    return Response.json({ rate: 1 })
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=EUR`)
    if (!res.ok) {
      return Response.json({ error: `frankfurter.app respondió ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const rate = data?.rates?.EUR
    if (typeof rate !== 'number') {
      return Response.json({ error: 'Respuesta de frankfurter.app inesperada' }, { status: 502 })
    }
    return Response.json({ rate })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
