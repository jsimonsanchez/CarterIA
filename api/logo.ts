export const config = { runtime: 'edge' }

/**
 * Orígenes permitidos para el modo `?src=`. Sin esta lista, el endpoint sería
 * un proxy abierto capaz de descargar cualquier URL de internet.
 */
const ALLOWED_IMAGE_PREFIXES = [
  'https://financialmodelingprep.com/image-stock/',
  'https://api.twelvedata.com/logo/',
  'https://www.google.com/s2/favicons?',
]

/** Logos por ticker, sin clave ni cuota. Acepta el mismo formato de símbolo que Yahoo (SAP.DE, NOVO-B.CO, DGE.L...). */
const FMP_LOGO_PREFIX = 'https://financialmodelingprep.com/image-stock/'

/**
 * Proxy same-origin del logo de una empresa, en dos modos:
 *
 * - `?yahooSymbol=X[&twelveDataSymbol=Y&exchange=Z]` → RESUELVE dónde está el
 *   logo y devuelve la URL en JSON. El cliente guarda el resultado y no
 *   vuelve a preguntar por ese símbolo (los logos no cambian).
 * - `?src=<url>` → RETRANSMITE los bytes de una imagen ya resuelta.
 *
 * La imagen se sirve desde aquí en vez de enlazarla directamente porque hay
 * redes (p.ej. corporativas) que bloquean la conexión del navegador a esos
 * dominios de terceros aunque nuestras propias funciones sí lleguen.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const src = url.searchParams.get('src')

  if (src) return streamImage(src)

  const yahooSymbol = url.searchParams.get('yahooSymbol')
  const twelveDataSymbol = url.searchParams.get('twelveDataSymbol')
  if (!yahooSymbol && !twelveDataSymbol) return new Response(null, { status: 400 })

  return resolveLogoUrl(yahooSymbol, twelveDataSymbol, url.searchParams.get('exchange'))
}

async function streamImage(src: string): Promise<Response> {
  if (!ALLOWED_IMAGE_PREFIXES.some((prefix) => src.startsWith(prefix))) {
    return new Response(null, { status: 400 })
  }

  try {
    const imgRes = await fetch(src)
    if (!imgRes.ok || !imgRes.body) return new Response(null, { status: 404 })

    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') ?? 'image/png',
        // El logo de una empresa no cambia: se cachea un año e `immutable`
        // evita incluso la petición de revalidación. Cada dispositivo lo
        // descarga una sola vez.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}

/**
 * Busca el logo primero en Financial Modeling Prep (sin clave ni cuota, y
 * acepta el ticker de Yahoo tal cual) y solo si no lo tiene recurre a Twelve
 * Data, cuyo plan gratuito comparte un límite diario de 800 créditos con los
 * precios y se agota con facilidad.
 */
async function resolveLogoUrl(
  yahooSymbol: string | null,
  twelveDataSymbol: string | null,
  exchange: string | null,
): Promise<Response> {
  if (yahooSymbol) {
    const fmpUrl = `${FMP_LOGO_PREFIX}${encodeURIComponent(yahooSymbol)}.png`
    try {
      const res = await fetch(fmpUrl, { method: 'HEAD' })
      if (res.ok) return Response.json({ url: fmpUrl })
    } catch {
      // Se ignora y se prueba con Twelve Data.
    }
  }

  if (!twelveDataSymbol) return new Response(null, { status: 404 })
  return resolveFromTwelveData(twelveDataSymbol, exchange)
}

async function resolveFromTwelveData(symbol: string, exchange: string | null): Promise<Response> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return new Response(null, { status: 404 })

  try {
    const meta = new URL('https://api.twelvedata.com/logo')
    meta.searchParams.set('symbol', symbol)
    meta.searchParams.set('apikey', apiKey)
    if (exchange) meta.searchParams.set('exchange', exchange)

    const metaRes = await fetch(meta)

    // La cuota agotada hay que distinguirla de "este símbolo no tiene logo":
    // lo primero es temporal y hay que reintentarlo, lo segundo es permanente
    // y el cliente deja de preguntar. Confundirlos dejaría esos logos
    // desactivados para siempre por haber agotado la cuota un solo día.
    if (metaRes.status === 429) {
      return Response.json({ error: 'quota' }, { status: 429 })
    }
    if (!metaRes.ok) return new Response(null, { status: 404 })

    const metaData = await metaRes.json()
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
