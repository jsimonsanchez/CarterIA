export const config = { runtime: 'edge' }

/**
 * Proxy same-origin del logo de una empresa (Twelve Data): a diferencia de
 * la versión anterior, aquí también se descarga la IMAGEN en el servidor y
 * se retransmite — el navegador nunca llega a pedir nada directamente a
 * api.twelvedata.com. Necesario porque algunas redes (p.ej. corporativas)
 * bloquean la conexión directa del navegador a ese dominio de terceros
 * aunque las peticiones a nuestro propio proxy (precios, tipo de cambio)
 * funcionen sin problema.
 */
export default async function handler(request: Request): Promise<Response> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return new Response(null, { status: 404 })

  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  const exchange = url.searchParams.get('exchange')
  if (!symbol) return new Response(null, { status: 400 })

  try {
    const meta = new URL('https://api.twelvedata.com/logo')
    meta.searchParams.set('symbol', symbol)
    meta.searchParams.set('apikey', apiKey)
    if (exchange) meta.searchParams.set('exchange', exchange)

    const metaRes = await fetch(meta)
    if (!metaRes.ok) return new Response(null, { status: 404 })
    const metaData = await metaRes.json()
    if (metaData.status === 'error' || typeof metaData.url !== 'string') {
      return new Response(null, { status: 404 })
    }

    let imgRes = await fetch(metaData.url)

    // Twelve Data a veces resuelve un dominio (p.ej. para empresas recién
    // salidas a bolsa) pero todavía no tiene la imagen del logo en su CDN
    // (la propia URL que ellos devuelven da 404). En ese caso recurrimos al
    // favicon público de Google para ese mismo dominio como aproximación.
    if (!imgRes.ok || !imgRes.body) {
      const domain = metaData.url.split('/').pop()
      if (!domain) return new Response(null, { status: 404 })
      imgRes = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`)
    }

    if (!imgRes.ok || !imgRes.body) return new Response(null, { status: 404 })

    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') ?? 'image/png',
        // Los logos no cambian casi nunca — cachear un día es seguro.
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
