import type { SymbolMapping } from '../domain/types'

/**
 * Excepciones manuales donde el ticker de XTB no se resuelve bien con la
 * simple regla de sufijo por mercado (`deriveSymbolMapping`) — normalmente
 * porque Yahoo usa una notación de clase de acción distinta a la de XTB.
 *
 * NO VERIFICADO CONTRA LA API en vivo — son las mejores mapeos conocidos a
 * fecha de creación de esta tabla; revisar cuando se conecte `PriceRepository`
 * de verdad (punto 5 del brief).
 */
export const SYMBOL_OVERRIDES: SymbolMapping[] = [
  {
    xtbSymbol: 'NOVOB.DK',
    // XTB concatena "NOVOB"; Yahoo usa guion para la clase de acción B.
    twelveDataSymbol: 'NOVO B',
    twelveDataExchange: 'Nasdaq Copenhagen',
    yahooSymbol: 'NOVO-B.CO',
    name: 'Novo Nordisk B',
  },
]
