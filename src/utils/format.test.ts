import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatNativePrice, formatPct, priceDecimalsFor } from './format'

describe('formatNativePrice', () => {
  it('convierte los peniques del Reino Unido a libras', () => {
    // Yahoo devuelve las plazas de Londres en peniques: 1749,5 GBp = 17,495 GBP.
    assert.equal(formatNativePrice(1749.5, 'GBp'), '17,50 GBP')
    assert.equal(formatNativePrice(1749.5, 'GBX', 3), '17,495 GBP')
  })

  it('deja el resto de divisas tal cual', () => {
    assert.equal(formatNativePrice(178.28, 'EUR'), '178,28 EUR')
    assert.equal(formatNativePrice(224.35, 'USD'), '224,35 USD')
  })

  it('no confunde GBP (libras) con GBp (peniques)', () => {
    assert.equal(formatNativePrice(17.5, 'GBP'), '17,50 GBP')
  })

  it('rellena con ceros hasta los decimales pedidos, para alinear la columna', () => {
    assert.equal(formatNativePrice(266, 'EUR'), '266,00 EUR')
    assert.equal(formatNativePrice(266, 'EUR', 3), '266,000 EUR')
    assert.equal(formatNativePrice(0.034, 'EUR', 3), '0,034 EUR')
  })
})

describe('priceDecimalsFor', () => {
  it('se queda en 2 cuando ningún precio necesita más', () => {
    assert.equal(priceDecimalsFor([{ price: 178.28, currency: 'EUR' }, { price: 6.7, currency: 'EUR' }]), 2)
  })

  it('sube a los que necesite el precio más exigente', () => {
    // Un solo valor con 3 decimales manda sobre toda la columna.
    assert.equal(
      priceDecimalsFor([{ price: 178.28, currency: 'EUR' }, { price: 0.034, currency: 'EUR' }]),
      3,
    )
  })

  it('tiene en cuenta los decimales que aparecen al pasar peniques a libras', () => {
    // 1749,5 GBp = 17,495 GBP: necesita 3 aunque el original solo tenga 1.
    assert.equal(priceDecimalsFor([{ price: 1749.5, currency: 'GBp' }]), 3)
  })

  it('no pasa de 3 decimales, para no ensanchar la columna sin motivo', () => {
    assert.equal(priceDecimalsFor([{ price: 1.23456789, currency: 'EUR' }]), 3)
    // Un precio de 4 decimales se redondea a 3 en vez de arrastrar a la columna.
    assert.equal(priceDecimalsFor([{ price: 0.0345, currency: 'EUR' }]), 3)
  })

  it('devuelve 2 sin precios', () => {
    assert.equal(priceDecimalsFor([]), 2)
  })
})

describe('formatPct', () => {
  it('antepone el signo + solo a los positivos', () => {
    assert.equal(formatPct(12.3), '+12.30%')
    assert.equal(formatPct(-4.5), '-4.50%')
    assert.equal(formatPct(0), '0.00%')
  })
})
