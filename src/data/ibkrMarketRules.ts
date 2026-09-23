/**
 * Equivalencias de las bolsas que nombra IBKR en sus informes.
 *
 * `market` es el sufijo con el que la app nombra al instrumento, en el mismo
 * formato BASE.MERCADO que usa XTB: así el mismo valor comprado en los dos
 * brókers cae en una única posición en vez de duplicarse.
 *
 * `yahooSuffix` es el de Yahoo Finance para esa plaza, y `twelveDataExchange`
 * el nombre que espera Twelve Data — los mismos valores que ya usa
 * `symbolSuffixRules.ts` para XTB.
 */
interface IbkrMarketRule {
  market: string
  yahooSuffix: string
  twelveDataExchange?: string
}

const IBKR_MARKET_RULES: Record<string, IbkrMarketRule> = {
  // EEUU: varias plazas y enrutadores comparten el mismo ticker sin sufijo.
  NASDAQ: { market: 'US', yahooSuffix: '' },
  NYSE: { market: 'US', yahooSuffix: '' },
  ARCA: { market: 'US', yahooSuffix: '' },
  BATS: { market: 'US', yahooSuffix: '' },
  AMEX: { market: 'US', yahooSuffix: '' },
  PINK: { market: 'US', yahooSuffix: '' },
  IBIS: { market: 'DE', yahooSuffix: '.DE', twelveDataExchange: 'XETR' },
  IBIS2: { market: 'DE', yahooSuffix: '.DE', twelveDataExchange: 'XETR' },
  LSE: { market: 'UK', yahooSuffix: '.L', twelveDataExchange: 'LSE' },
  LSEETF: { market: 'UK', yahooSuffix: '.L', twelveDataExchange: 'LSE' },
  SFB: { market: 'SE', yahooSuffix: '.ST', twelveDataExchange: 'OMX' },
  OMXNO: { market: 'NO', yahooSuffix: '.OL' },
  CPH: { market: 'DK', yahooSuffix: '.CO', twelveDataExchange: 'OMXC' },
  SBF: { market: 'FR', yahooSuffix: '.PA', twelveDataExchange: 'Euronext' },
  BVME: { market: 'IT', yahooSuffix: '.MI', twelveDataExchange: 'MTA' },
  AEB: { market: 'NL', yahooSuffix: '.AS', twelveDataExchange: 'Euronext' },
  BM: { market: 'ES', yahooSuffix: '.MC', twelveDataExchange: 'BME' },
  // EBS es la bolsa suiza (SIX). Ojo: ahí conviven líneas del mismo ETP en
  // varias divisas, así que el ticker de Yahoo no se deduce solo del
  // mercado — ver `ibkrSymbolOverrides.ts`.
  EBS: { market: 'CH', yahooSuffix: '.SW' },
}

export function ibkrMarketRule(listingExchange: string): IbkrMarketRule | undefined {
  return IBKR_MARKET_RULES[listingExchange.toUpperCase()]
}
