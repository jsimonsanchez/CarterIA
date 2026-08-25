import type { SymbolMapping } from '../domain/types'

/**
 * Excepciones manuales donde el ticker de XTB no se resuelve bien con la
 * simple regla de sufijo por mercado (`deriveSymbolMapping`) — normalmente
 * porque Yahoo/Twelve Data usan un ticker base distinto al de XTB para el
 * mismo instrumento en ese mercado (clase de acción, código abreviado...).
 *
 * Verificado contra `/symbol_search` de Twelve Data y Yahoo Finance en vivo.
 */
export const SYMBOL_OVERRIDES: SymbolMapping[] = [
  {
    xtbSymbol: 'NOVOB.DK',
    // XTB concatena "NOVOB"; Yahoo usa guion para la clase de acción B.
    twelveDataSymbol: 'NOVO B',
    twelveDataExchange: 'OMXC',
    yahooSymbol: 'NOVO-B.CO',
    name: 'Novo Nordisk B',
  },
  {
    xtbSymbol: 'AMZN.DE',
    // XTB usa "AMZN"; en Xetra el ticker real de Amazon es "AMZ" (sin la N).
    twelveDataSymbol: 'AMZ',
    twelveDataExchange: 'XETR',
    yahooSymbol: 'AMZ.DE',
    name: 'Amazon.com',
  },
]
