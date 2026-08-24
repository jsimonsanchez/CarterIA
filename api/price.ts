export const config = { runtime: 'edge' }

interface PriceResult {
  price: number
  currency: string
  source: 'twelvedata' | 'yahoo'
}

// Yahoo devuelve 403/429 sin una cabecera User-Agent de navegador real.
const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function fetchTwelveData(symbol: string, exchange: string | null): Promise<PriceResult | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return null

  const url = new URL('https://api.twelvedata.com/quote')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('apikey', apiKey)
  if (exchange) url.searchParams.set('exchange', exchange)

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    // Twelve Data responde 200 con {status:"error", ...} cuando se agota la
    // cuota o el símbolo no existe, en vez de un código HTTP de error.
    if (data.status === 'error' || !data.close || !data.currency) return null
    return { price: Number(data.close), currency: data.currency, source: 'twelvedata' }
  } catch {
    return null
  }
}

async function fetchYahoo(symbol: string): Promise<PriceResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const price = result?.meta?.regularMarketPrice
    const currency = result?.meta?.currency
    if (typeof price !== 'number' || !currency) return null
    return { price, currency, source: 'yahoo' }
  } catch {
    return null
  }
}

/**
 * Proxy same-origin para los precios de mercado: el navegador nunca llama a
 * Twelve Data ni a Yahoo directamente (ninguno de los dos permite CORS desde
 * un origen de navegador), y la API key de Twelve Data se queda en el
 * servidor en vez de ir embebida en el bundle del cliente.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const twelveDataSymbol = url.searchParams.get('twelveDataSymbol')
  const twelveDataExchange = url.searchParams.get('twelveDataExchange')
  const yahooSymbol = url.searchParams.get('yahooSymbol')

  if (!twelveDataSymbol || !yahooSymbol) {
    return Response.json({ error: 'Faltan parámetros twelveDataSymbol/yahooSymbol' }, { status: 400 })
  }

  const fromTwelveData = await fetchTwelveData(twelveDataSymbol, twelveDataExchange)
  if (fromTwelveData) {
    return Response.json(fromTwelveData)
  }

  const fromYahoo = await fetchYahoo(yahooSymbol)
  if (fromYahoo) {
    return Response.json(fromYahoo)
  }

  return Response.json({ error: 'No se pudo obtener precio de ningún proveedor' }, { status: 502 })
}
