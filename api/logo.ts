export const config = { runtime: 'edge' }

/**
 * Resuelve el logo de una empresa vía Twelve Data (/logo?symbol=...) — solo
 * este paso de resolución necesita la API key; la imagen en sí que devuelve
 * (api.twelvedata.com/logo/{dominio}) es pública, así que el cliente la
 * carga directamente sin pasar otra vez por aquí.
 */
export default async function handler(request: Request): Promise<Response> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return Response.json({ error: 'Sin API key configurada' }, { status: 500 })

  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  const exchange = url.searchParams.get('exchange')
  if (!symbol) return Response.json({ error: 'Falta el parámetro symbol' }, { status: 400 })

  const upstream = new URL('https://api.twelvedata.com/logo')
  upstream.searchParams.set('symbol', symbol)
  upstream.searchParams.set('apikey', apiKey)
  if (exchange) upstream.searchParams.set('exchange', exchange)

  try {
    const res = await fetch(upstream)
    if (!res.ok) return Response.json({ error: `Twelve Data respondió ${res.status}` }, { status: 502 })
    const data = await res.json()
    if (data.status === 'error' || typeof data.url !== 'string') {
      return Response.json({ error: 'Sin logo disponible para este símbolo' }, { status: 404 })
    }
    return Response.json({ url: data.url })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
