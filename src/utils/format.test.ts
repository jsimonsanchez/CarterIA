import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatNativePrice, formatPct } from './format'

describe('formatNativePrice', () => {
  it('convierte los peniques del Reino Unido a libras', () => {
    // Yahoo devuelve las plazas de Londres en peniques: 1749,5 GBp = 17,50 GBP.
    assert.equal(formatNativePrice(1749.5, 'GBp'), '17,5 GBP')
    assert.equal(formatNativePrice(1749.5, 'GBX'), '17,5 GBP')
  })

  it('deja el resto de divisas tal cual', () => {
    assert.equal(formatNativePrice(178.28, 'EUR'), '178,28 EUR')
    assert.equal(formatNativePrice(224.35, 'USD'), '224,35 USD')
  })

  it('no confunde GBP (libras) con GBp (peniques)', () => {
    assert.equal(formatNativePrice(17.5, 'GBP'), '17,5 GBP')
  })

  it('permite más decimales para instrumentos de precio bajo', () => {
    // Con los 2 decimales por defecto se perdería la cotización real.
    assert.equal(formatNativePrice(0.0345, 'EUR'), '0,03 EUR')
    assert.equal(formatNativePrice(0.0345, 'EUR', 4), '0,0345 EUR')
  })
})

describe('formatPct', () => {
  it('antepone el signo + solo a los positivos', () => {
    assert.equal(formatPct(12.3), '+12.30%')
    assert.equal(formatPct(-4.5), '-4.50%')
    assert.equal(formatPct(0), '0.00%')
  })
})
