import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ISIN_BY_XTB_SYMBOL, frankfurtIsinFor } from './isinBySymbol'

describe('frankfurtIsinFor', () => {
  it('da el ISIN de los listados alemanes, que son los que cotizan en euros', () => {
    assert.equal(frankfurtIsinFor('SLVR.DE'), 'IE000UL6CLP7')
    assert.equal(frankfurtIsinFor('XUTC.DE'), 'IE00BGQYRS42')
  })

  // Frankfurt siempre responde en euros. Combinar ese cierre con un precio en
  // coronas o libras no da un error, da un porcentaje que en realidad es el
  // tipo de cambio: en produccion se vio Diageo con +8.451% y Novo con +636%.
  it('no lo da para valores que cotizan en otra divisa', () => {
    for (const symbol of ['NOVOB.DK', 'DGE.UK', 'IGLN.UK', 'AAPL.US', 'BRE.IT', 'EVO.SE']) {
      assert.equal(frankfurtIsinFor(symbol), undefined, symbol + ' no debe ir a Frankfurt')
    }
  })

  // El cierre de Frankfurt arrastra la tarde americana. En un instrumento que
  // cierra a las 17:30 esa tarde no existe, asi que ese cierre solo mete
  // error: IB1T se publico con +1,11% cuando el broker daba -1,04%.
  it('no lo da para instrumentos sin sesion ampliada, aunque sean alemanes', () => {
    assert.equal(frankfurtIsinFor('IB1T.DE'), undefined)
    // Pero el ISIN sigue guardado: lo que se excluye es pedir a Frankfurt.
    assert.equal(ISIN_BY_XTB_SYMBOL['IB1T.DE'], 'XS2940466316')
  })

  it('devuelve undefined cuando no se conoce el simbolo', () => {
    assert.equal(frankfurtIsinFor('LULU.US'), undefined)
    assert.equal(frankfurtIsinFor('DESCONOCIDO.DE'), undefined)
  })

  it('guarda los ISIN con el formato valido de 12 caracteres', () => {
    for (const [symbol, isin] of Object.entries(ISIN_BY_XTB_SYMBOL)) {
      assert.match(isin, /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, symbol + ' tiene un ISIN mal formado')
    }
  })
})
