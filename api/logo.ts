export const config = { runtime: 'edge' }

/** Prefijo público (sin API key) donde Twelve Data sirve las imágenes de los logos. */
const LOGO_IMAGE_PREFIX = 'https://api.twelvedata.com/logo/'

/**
 * Proxy same-origin del logo de una empresa, en dos modos:
 *
 * - `?symbol=X[&exchange=Y]` → RESUELVE la URL del logo y la devuelve como
 *   JSON. Consume un crédito de la API de Twelve Data, así que el cliente
 *   guarda el resultado y no vuelve a preguntar por ese símbolo nunca más
 *   (los logos no cambian).
 * - `?src=<url>` → RETRANSMITE los bytes de una imagen ya resuelta. No gasta
 *   crédito, porque esa URL es pública y no lleva API key.
 *
 * La imagen se sirve desde aquí en vez de enlazarla directamente porque hay
 * redes (p.ej. corporativas) que bloquean la conexión del navegador a
 * api.twelvedata.com aunque nuestras propias funciones sí lleguen.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const src = url.searchParams.get('src')

  if (src) return streamImage(src)

  const symbol = url.searchParams.get('symbol')
  if (!symbol) return new Response(null, { status: 400 })

  return resolveLogoUrl(symbol, url.searchParams.get('exchange'))
}

/** Retransmite la imagen. Solo desde el dominio de logos de Twelve Data: si no, esto sería un proxy abierto a cualquier destino. */
async function streamImage(src: string): Promise<Response> {
  if (!src.startsWith(LOGO_IMAGE_PREFIX)) {
    return new Response(null, { status: 400 })
  }

  try {
    let imgRes = await fetch(src)

    // Twelve Data a veces resuelve un dominio (p.ej. para empresas recién
    // salidas a bolsa) pero todavía no tiene la imagen en su CDN: la propia
    // URL que ellos devuelven da 404. Se recurre entonces al favicon público
    // de Google para ese mismo dominio.
    if (!imgRes.ok || !imgRes.body) {
      const domain = src.slice(LOGO_IMAGE_PREFIX.length)
      if (!domain) return new Response(null, { status: 404 })
      imgRes = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`)
    }

    if (!imgRes.ok || !imgRes.body) return new Response(null, { status: 404 })

    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}

/** Pregunta a Twelve Data por el dominio del logo (1 crédito) y devuelve la URL de la imagen. */
async function resolveLogoUrl(symbol: string, exchange: string | null): Promise<Response> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return new Response(null, { status: 404 })

  try {
    const meta = new URL('https://api.twelvedata.com/logo')
    meta.searchParams.set('symbol', symbol)
    meta.searchParams.set('apikey', apiKey)
    if (exchange) meta.searchParams.set('exchange', exchange)

    const metaRes = await fetch(meta)
    if (!metaRes.ok) return new Response(null, { status: 404 })
    const metaData = await metaRes.json()

    // Se agota la cuota diaria del plan gratuito con un 200 + {status:"error"}.
    // Hay que distinguirlo de "este símbolo no tiene logo": lo primero es
    // temporal y conviene reintentarlo, lo segundo es permanente y el cliente
    // debe dejar de preguntar.
    if (metaData.code === 429) {
      return Response.json({ error: 'quota' }, { status: 429 })
    }
    if (metaData.status === 'error' || typeof metaData.url !== 'string') {
      return new Response(null, { status: 404 })
    }

    return Response.json({ url: metaData.url })
  } catch {
    return new Response(null, { status: 502 })
  }
}
