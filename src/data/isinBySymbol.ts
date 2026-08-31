/**
 * Ticker de XTB → ISIN.
 *
 * Sirve para pedir el cierre anterior a Börse Frankfurt (ver `api/price.ts`),
 * que es la plaza que cotiza XTB: su sesión llega hasta las 22:00 y recoge la
 * tarde americana entera, mientras que XETRA cierra a las 17:30 y deja fuera
 * el tramo en el que más se mueven los ETF de subyacente estadounidense. Con
 * el cierre de XETRA la variación diaria difería del broker una media de
 * 1,75 puntos; con la de Frankfurt, 0,24.
 *
 * Origen: el resumen anual de operaciones de XTB, que lista nombre, ISIN y
 * ticker juntos.
 *
 * Al añadir una entrada hay que comprobar DOS cosas distintas:
 *
 * - Que el ISIN es el del instrumento: se compara el precio que devuelve
 *   Frankfurt con el que da Yahoo para el ticker. Un ISIN equivocado no da
 *   error, devuelve el precio de otro valor sin avisar.
 * - Que el **porcentaje** resultante cuadra con el del broker. Esto es aparte,
 *   y no vale saltárselo: en IB1T el precio coincidía (6,75 frente a 6,744) y
 *   aun así el cierre estaba mal, porque ese instrumento no tiene sesión
 *   ampliada. Comparar solo precios no lo detecta.
 *
 * Solo hacen falta los tickers alemanes (`.DE`): el resto de mercados cotizan
 * en su propia plaza, donde Yahoo ya coincide con el broker. Los símbolos que
 * no estén aquí siguen usando el cierre de Yahoo, sin más consecuencia.
 */
export const ISIN_BY_XTB_SYMBOL: Record<string, string> = {
  '5MVW.DE': 'IE00BJ5JP105',
  'AMZN.DE': 'US0231351067',
  'ASWC.DE': 'IE000OJ5TQP4',
  'CBUK.DE': 'IE000NFR7C63',
  'CEBS.DE': 'IE00063FT9K6',
  'ESIT.DE': 'IE00BMW42413',
  'ETLK.DE': 'IE00BFXR5W90',
  'FLXK.DE': 'IE00BHZRR030',
  'IB1T.DE': 'XS2940466316',
  'IQQ7.DE': 'IE00B1FZSF77',
  'IUSS.DE': 'IE00BYYR0489',
  'SLVR.DE': 'IE000UL6CLP7',
  'SPYL.DE': 'IE000XZSV718',
  'WTEJ.DE': 'IE00BJGWQN72',
  'XPQP.DE': 'LU0592215403',
  'XUTC.DE': 'IE00BGQYRS42',

  // Cotizan fuera de Alemania. NO se usan para pedir a Frankfurt: ver
  // `frankfurtIsinFor`, que es quien filtra. Se guardan porque el ISIN es un
  // identificador permanente del instrumento y volver a recopilarlo cuesta.
  'AAPL.US': 'US0378331005',
  'ASML.US': 'USN070592100',
  'BLSH.US': 'KYG169101204',
  'BRE.IT': 'NL0015001KT6',
  'DGE.UK': 'GB0002374006',
  'EGLN.UK': 'IE00B4ND3602',
  'EVO.SE': 'SE0012673267',
  'GOOGL.US': 'US02079K3059',
  'GPN.US': 'US37940X1028',
  'IGLN.UK': 'IE00B4ND3602',
  'LVS.US': 'US5178341070',
  'LYB.US': 'NL0009434992',
  'META.US': 'US30303M1027',
  'MU.US': 'US5951121038',
  // XTB exporta este ticker como "NOVOB" (sin punto entre clase y mercado).
  'NOVOB.DK': 'DK0062498333',
  'NVDA.US': 'US67066G1040',
  'NVO.US': 'US6701002056',
  'OXY.US': 'US6745991058',
  'RELY.US': 'US75960P1049',
  'TAP.US': 'US60871R2094',
  'UBER.US': 'US90353T1007',
  'UNH.US': 'US91324P1021',
}

/**
 * Instrumentos que el broker NO negocia en sesión ampliada.
 *
 * Todo el sentido de preguntar a Frankfurt es recoger la tarde que XETRA se
 * pierde por cerrar a las 17:30. Un instrumento que tampoco se negocia después
 * de esa hora no tiene esa tarde: su cierre de referencia es el de XETRA, y el
 * de Frankfurt —siempre más bajo, porque arrastra el tramo americano— solo
 * introduce error. IB1T se publicó con +1,11% cuando el broker daba −1,04%.
 *
 * Se reconoce en la ficha del instrumento en XTB: los de sesión ampliada
 * marcan 07:30–22:00; IB1T marca 09:04–17:30.
 */
const SIN_SESION_AMPLIADA = new Set(['IB1T.DE'])

/**
 * ISIN a usar para pedir el cierre a Frankfurt, o `undefined` si no procede.
 *
 * Tres condiciones, y las tres nacen de un fallo que llegó a producción:
 *
 * 1. Solo listados alemanes. Frankfurt cotiza **siempre en euros** y el precio
 *    lo pone Yahoo en la divisa de origen: juntar un precio en DKK, GBP o USD
 *    con un cierre en EUR da el tipo de cambio disfrazado de variación. Se vio
 *    Diageo con +8.451% y Novo Nordisk con +636%.
 * 2. Ni siquiera basta con que ambos sean euros: EGLN cotiza en euros en
 *    Londres, y mezclarlo con el cierre de Frankfurt daba +1,87% en vez de
 *    −0,47%. Por eso el filtro es por mercado y no solo por divisa.
 * 3. Y el instrumento tiene que negociarse en sesión ampliada — ver
 *    `SIN_SESION_AMPLIADA`.
 *
 * `api/price.ts` vuelve a comprobar la divisa por su cuenta. Son dos redes
 * distintas a propósito y basta con que una acierte.
 */
export function frankfurtIsinFor(xtbSymbol: string): string | undefined {
  if (!xtbSymbol.endsWith('.DE')) return undefined
  if (SIN_SESION_AMPLIADA.has(xtbSymbol)) return undefined
  return ISIN_BY_XTB_SYMBOL[xtbSymbol]
}
