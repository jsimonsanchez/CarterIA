/**
 * Excepciones del mapeo de instrumentos de IBKR al proveedor de precios,
 * cuando la regla de bolsa (`ibkrMarketRules.ts`) no da el ticker correcto.
 *
 * La clave es ISIN + divisa, no solo el ISIN: un mismo ETP cotiza en varias
 * plazas y divisas con el ISIN idéntico, y elegir la línea equivocada
 * valoraría la posición en otra moneda. Caso real: WisdomTree Physical
 * Bitcoin (GB00BJYDH287) en la bolsa suiza; la línea que corresponde a la
 * posición en dólares es la de Londres (20,49 USD), no la suiza, que cotiza
 * en francos (16,86 CHF).
 */
interface IbkrSymbolOverride {
  yahooSymbol: string
  twelveDataSymbol: string
  twelveDataExchange?: string
  name?: string
}

const IBKR_SYMBOL_OVERRIDES: Record<string, IbkrSymbolOverride> = {
  'GB00BJYDH287|USD': {
    yahooSymbol: 'BTCW.L',
    twelveDataSymbol: 'BTCW',
    twelveDataExchange: 'LSE',
    name: 'WisdomTree Physical Bitcoin',
  },
}

export function ibkrSymbolOverride(isin: string, currency: string): IbkrSymbolOverride | undefined {
  return IBKR_SYMBOL_OVERRIDES[`${isin}|${currency}`]
}
