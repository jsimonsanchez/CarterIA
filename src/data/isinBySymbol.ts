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
 * ticker juntos. Cada par se verificó comparando el precio que devuelve
 * Frankfurt para ese ISIN con el que da Yahoo para el ticker: los 15 con dato
 * en ambos coincidían dentro del 0,21%, así que ninguna entrada apunta a un
 * instrumento equivocado. Esa verificación importa porque un ISIN mal puesto
 * no da error: devuelve el precio de otro valor sin avisar.
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

  // Cotizan fuera de Alemania, así que hoy no se usan para pedir a Frankfurt.
  // Se guardan igualmente porque el ISIN es un identificador permanente del
  // instrumento y volver a recopilarlo cuesta.
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
