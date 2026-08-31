export const config = { runtime: 'edge' }

interface PriceResult {
  price: number
  currency: string
  source: 'twelvedata' | 'yahoo'
  /** Cierre de la sesión anterior, para calcular la variación del día — mismo % con cualquier divisa, no hace falta convertir. */
  previousClose?: number
  /**
   * Si el precio/cierre-anterior corresponden ya a la sesión de HOY (mercado
   * abierto o ya cerrado hoy) frente a la última sesión disponible cuando el
   * mercado de ese valor concreto todavía no ha abierto (p.ej. bolsa de
   * EEUU consultada por la mañana en España) — en ese caso "price" sigue
   * siendo el cierre de ayer y calcular la variación diaria daría el cambio
   * de ayer, no el de hoy. `undefined` cuando el proveedor no da datos
   * suficientes para saberlo (se trata como fresco, para no ocultar de más).
   */
  isTodaySession?: boolean
  /** Nombre completo del instrumento (p.ej. "Apple Inc."), cuando el proveedor lo da. */
  name?: string
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
    const previousClose = Number(data.previous_close)
    const today = new Date().toISOString().slice(0, 10)
    return {
      price: Number(data.close),
      currency: data.currency,
      source: 'twelvedata',
      previousClose: Number.isFinite(previousClose) ? previousClose : undefined,
      isTodaySession: data.is_market_open === true || data.datetime === today,
      name: typeof data.name === 'string' ? data.name : undefined,
    }
  } catch {
    return null
  }
}

// Yahoo balancea entre estos dos hosts; si uno falla (caída puntual de ese
// servidor concreto, no un bloqueo del proveedor entero) se reintenta con el otro.
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

/**
 * El último elemento de la serie diaria es la barra de hoy (todavía
 * formándose); el cierre anterior es el de la barra justo antes. Si esa
 * barra es null (sin ninguna operación esa sesión — frecuente en ETFs UCITS
 * poco líquidos, p.ej. viernes sin cruzarse ni una orden) NO se sigue
 * retrocediendo a por un cierre más antiguo: comparar el precio de hoy con
 * el de hace dos o más sesiones da un % de variación diaria que no es tal
 * y no coincide con lo que muestra el bróker. Se prefiere no dar variación
 * a dar una equivocada.
 */
function previousCloseFromSeries(result: unknown): number | undefined {
  const closes = (result as { indicators?: { quote?: { close?: unknown[] }[] } })?.indicators?.quote?.[0]
    ?.close
  if (!Array.isArray(closes) || closes.length < 2) return undefined
  const prev = closes[closes.length - 2]
  return typeof prev === 'number' ? prev : undefined
}

async function fetchYahooFromHost(host: string, symbol: string): Promise<PriceResult | null> {
  // range=5d&interval=1d: no basta con el precio y "previousClose" del
  // endpoint por defecto. Ese campo (meta.previousClose / chartPreviousClose)
  // lo calcula Yahoo sobre el propio rango consultado y no es de fiar: en
  // valores poco líquidos puede devolver el cierre de varias sesiones atrás
  // sin que coincida con ningún cierre real de la serie, y hasta con un
  // valor líquido (comprobado con AAPL) cambia según el rango pedido. Por
  // eso no se usa en absoluto: el cierre anterior se calcula aquí a partir
  // de la propia serie de cierres diarios.
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const price = result?.meta?.regularMarketPrice
    const currency = result?.meta?.currency
    const previousClose = previousCloseFromSeries(result)
    if (typeof price !== 'number' || !currency) return null

    const regularMarketTime = result?.meta?.regularMarketTime
    const regularSessionStart = result?.meta?.currentTradingPeriod?.regular?.start
    const isTodaySession =
      typeof regularMarketTime === 'number' && typeof regularSessionStart === 'number'
        ? regularMarketTime >= regularSessionStart
        : undefined

    const name = result?.meta?.longName ?? result?.meta?.shortName

    return {
      price,
      currency,
      source: 'yahoo',
      previousClose: typeof previousClose === 'number' ? previousClose : undefined,
      isTodaySession,
      name: typeof name === 'string' ? name : undefined,
    }
  } catch {
    return null
  }
}

async function fetchYahoo(symbol: string): Promise<PriceResult | null> {
  for (const host of YAHOO_HOSTS) {
    const result = await fetchYahooFromHost(host, symbol)
    if (result) return result
  }
  return null
}

/**
 * Proxy same-origin para los precios de mercado: el navegador nunca llama a
 * Twelve Data ni a Yahoo directamente (ninguno de los dos permite CORS desde
 * un origen de navegador), y la API key de Twelve Data se queda en el
 * servidor en vez de ir embebida en el bundle del cliente.
 *
 * Yahoo va primero y Twelve Data queda como respaldo. El orden era el
 * inverso, pero el plan gratuito de Twelve Data ya rechazaba la mayoría de
 * plazas europeas —así que se acababa consultando a Yahoo igualmente, tras
 * gastar un crédito— y su límite diario (800) se agota rápido, porque cada
 * actualización consume uno por posición. Al agotarse dejaban de funcionar
 * también los logos, que dependen del mismo crédito y no tienen alternativa
 * en Yahoo. Yahoo no pide clave ni tiene cuota.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const twelveDataSymbol = url.searchParams.get('twelveDataSymbol')
  const twelveDataExchange = url.searchParams.get('twelveDataExchange')
  const yahooSymbol = url.searchParams.get('yahooSymbol')

  if (!twelveDataSymbol || !yahooSymbol) {
    return Response.json({ error: 'Faltan parámetros twelveDataSymbol/yahooSymbol' }, { status: 400 })
  }

  const fromYahoo = await fetchYahoo(yahooSymbol)
  if (fromYahoo) {
    return Response.json(fromYahoo)
  }

  const fromTwelveData = await fetchTwelveData(twelveDataSymbol, twelveDataExchange)
  if (fromTwelveData) {
    return Response.json(fromTwelveData)
  }

  return Response.json({ error: 'No se pudo obtener precio de ningún proveedor' }, { status: 502 })
}
