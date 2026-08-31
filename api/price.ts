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

// La API de Börse Frankfurt no está documentada y alguna petición suelta se
// queda colgada más de un minuto. Como su dato es una mejora opcional y no un
// requisito, se corta pronto y se sigue con el cierre de Yahoo.
const FRANKFURT_TIMEOUT_MS = 3000

/**
 * Cierre de la sesión anterior en Börse Frankfurt, que es la plaza que cotiza
 * XTB. Importa porque Frankfurt negocia hasta las 22:00 y XETRA cierra a las
 * 17:30: en los ETF de subyacente estadounidense, el cierre de XETRA se deja
 * fuera la mitad de la sesión americana y la variación diaria sale con un
 * hueco que no ve el broker (medido: 1,75 puntos de desvío medio con XETRA
 * frente a 0,24 con Frankfurt).
 *
 * Solo se toma el cierre anterior. El precio actual sigue viniendo de Yahoo:
 * estos ETF se negocian poco en Frankfurt y su último cruce puede ser de hace
 * horas, además de que la respuesta no dice en qué divisa cotiza.
 */
async function fetchFrankfurtPreviousClose(isin: string): Promise<number | null> {
  const url =
    'https://api.boerse-frankfurt.de/v1/data/quote_box/single?isin=' +
    encodeURIComponent(isin) +
    '&mic=XFRA'
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': YAHOO_USER_AGENT },
      signal: AbortSignal.timeout(FRANKFURT_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json()
    const last = data?.lastPrice
    const pct = data?.changeToPrevDayInPercent
    if (typeof last !== 'number' || typeof pct !== 'number') return null
    // Se reconstruye desde el porcentaje en vez de restar
    // `changeToPrevDayAbsolute`: viene redondeado a menos decimales y en
    // precios de un dígito eso ya mueve la variación en la segunda cifra.
    const previousClose = last / (1 + pct / 100)
    return Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null
  } catch {
    return null
  }
}

/** Día natural (AAAA-MM-DD) de un instante, en la zona horaria de la plaza. */
function diaEnLaPlaza(epochSegundos: number, desfaseSegundos: number): string {
  return new Date((epochSegundos + desfaseSegundos) * 1000).toISOString().slice(0, 10)
}

/**
 * ¿El último precio corresponde a la sesión de HOY en su propia plaza?
 *
 * Se compara el día natural y no la hora de apertura. La versión anterior
 * miraba si el precio era posterior al inicio de la sesión en curso, lo cual
 * falla en festivo: Yahoo no adelanta `currentTradingPeriod` a un día que no
 * se negocia, así que el viernes seguía siendo "la sesión en curso" y el
 * cierre del viernes caía dentro. El lunes del Summer Bank Holiday, con
 * Londres cerrado, Diageo y iShares Physical Gold aparecían en el panel de
 * volatilidad con la variación del viernes presentada como la de hoy.
 *
 * Comparar el día cubre además el caso para el que se escribió la
 * comprobación original —el mercado que aún no ha abierto hoy—, porque su
 * último precio sigue siendo el del día anterior.
 */
function sesionDeHoy(
  regularMarketTime: unknown,
  gmtOffset: unknown,
  inicioSesion: unknown,
): boolean | undefined {
  if (typeof regularMarketTime !== 'number') return undefined
  if (typeof gmtOffset === 'number') {
    return diaEnLaPlaza(regularMarketTime, gmtOffset) === diaEnLaPlaza(Date.now() / 1000, gmtOffset)
  }
  // Sin zona horaria no se puede saber el día en la plaza; se recurre a la
  // comprobación antigua, que al menos detecta el mercado que no ha abierto.
  return typeof inicioSesion === 'number' ? regularMarketTime >= inicioSesion : undefined
}

async function fetchYahooFromHost(host: string, symbol: string): Promise<PriceResult | null> {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const price = result?.meta?.regularMarketPrice
    const currency = result?.meta?.currency
    const previousClose = result?.meta?.previousClose ?? result?.meta?.chartPreviousClose
    if (typeof price !== 'number' || !currency) return null

    const regularMarketTime = result?.meta?.regularMarketTime
    const regularSessionStart = result?.meta?.currentTradingPeriod?.regular?.start
    const isTodaySession = sesionDeHoy(
      regularMarketTime,
      result?.meta?.gmtoffset,
      regularSessionStart,
    )

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
  const isin = url.searchParams.get('isin')

  if (!twelveDataSymbol || !yahooSymbol) {
    return Response.json({ error: 'Faltan parámetros twelveDataSymbol/yahooSymbol' }, { status: 400 })
  }

  // En paralelo: el cierre de Frankfurt no debe añadir latencia al de Yahoo,
  // que es el que de verdad hace falta para valorar la cartera.
  const [fromYahoo, frankfurtPreviousClose] = await Promise.all([
    fetchYahoo(yahooSymbol),
    isin ? fetchFrankfurtPreviousClose(isin) : Promise.resolve(null),
  ])

  if (fromYahoo) {
    // Frankfurt cotiza siempre en euros. Si el precio viene en otra divisa
    // (DKK, GBP, USD...), mezclarlo con ese cierre da una variación que en
    // realidad es el tipo de cambio: Diageo llegó a publicarse con +8.451% y
    // Novo Nordisk con +636%. Ante la duda se prefiere el cierre de Yahoo,
    // que al menos está en la misma divisa que el precio.
    const usarFrankfurt = frankfurtPreviousClose !== null && fromYahoo.currency === 'EUR'
    return Response.json(
      usarFrankfurt ? { ...fromYahoo, previousClose: frankfurtPreviousClose } : fromYahoo,
    )
  }

  const fromTwelveData = await fetchTwelveData(twelveDataSymbol, twelveDataExchange)
  if (fromTwelveData) {
    return Response.json(fromTwelveData)
  }

  return Response.json({ error: 'No se pudo obtener precio de ningún proveedor' }, { status: 502 })
}
