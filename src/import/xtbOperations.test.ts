import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseTradeComment, signedAmount, TYPE_MAP } from './xtbOperations'

describe('parseTradeComment', () => {
  it('lee el formato con el ticker delante de la cantidad', () => {
    assert.deepEqual(parseTradeComment('OPEN BUY RARE.DE 60 @ 41.625'), { quantity: 60, unitPrice: 41.625 })
    assert.deepEqual(parseTradeComment('OPEN BUY VVMX.DE 500 @ 9.410'), { quantity: 500, unitPrice: 9.41 })
    assert.deepEqual(parseTradeComment('OPEN BUY URNU.DE 160 @ 19.210'), { quantity: 160, unitPrice: 19.21 })
  })

  it('sigue leyendo el formato antiguo, sin ticker', () => {
    assert.deepEqual(parseTradeComment('OPEN BUY 6 @ 529.71'), { quantity: 6, unitPrice: 529.71 })
    assert.deepEqual(parseTradeComment('CLOSE BUY 40 @ 750.00'), { quantity: 40, unitPrice: 750 })
  })

  it('lee los fills parciales con denominador, con o sin ticker', () => {
    assert.deepEqual(parseTradeComment('OPEN BUY 1/21 @ 108.80'), { quantity: 1, unitPrice: 108.8 })
    assert.deepEqual(parseTradeComment('CLOSE BUY 15/25 @ 798.20'), { quantity: 15, unitPrice: 798.2 })
    assert.deepEqual(parseTradeComment('OPEN BUY SAN.ES 15/25 @ 4.10'), { quantity: 15, unitPrice: 4.1 })
  })

  it('lee tickers con números, guiones o de varios mercados', () => {
    assert.deepEqual(parseTradeComment('OPEN BUY 1810.HK 200 @ 14.5'), { quantity: 200, unitPrice: 14.5 })
    assert.deepEqual(parseTradeComment('OPEN BUY BRK-B.US 3 @ 410.2'), { quantity: 3, unitPrice: 410.2 })
    assert.deepEqual(parseTradeComment('CLOSE BUY NOVOB.DK 12 @ 650'), { quantity: 12, unitPrice: 650 })
  })

  it('devuelve undefined si el comentario no es una compra o venta', () => {
    assert.equal(parseTradeComment(''), undefined)
    assert.equal(parseTradeComment('Dividend ASML.NL'), undefined)
  })
})

describe('tipos de operación', () => {
  it('reconoce las retiradas, como un ingreso con signo negativo', () => {
    assert.equal(TYPE_MAP['Withdrawal'], 'deposit')
    assert.equal(signedAmount('Withdrawal', -500), -500)
  })

  it('una retirada siempre resta, aunque el extracto la traiga en positivo', () => {
    assert.equal(signedAmount('Withdrawal', 500), -500)
  })

  it('deja intactos los importes del resto de operaciones', () => {
    assert.equal(signedAmount('Deposit', 1000), 1000)
    assert.equal(signedAmount('Stock purchase', -250.5), -250.5)
    assert.equal(signedAmount('Dividend', 12), 12)
  })
})
