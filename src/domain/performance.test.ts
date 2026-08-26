import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { totalReturn } from './performance'

describe('totalReturn', () => {
  it('duplicar lo ingresado es un 100% de rendimiento', () => {
    // El caso de referencia: 100.000 € ingresados, 200.000 € hoy entre
    // posiciones y liquidez.
    const { gain, pct } = totalReturn(200_000, 100_000)

    assert.equal(gain, 100_000)
    assert.equal(pct, 100)
  })

  it('mide contra lo ingresado, no contra lo que hay invertido ahora', () => {
    // Aunque casi todo esté en liquidez y quede poco invertido, el
    // rendimiento sigue siendo sobre el dinero aportado.
    const { pct } = totalReturn(110_000, 100_000)

    assert.equal(pct, 10)
  })

  it('devuelve rendimiento negativo cuando se ha perdido dinero', () => {
    const { gain, pct } = totalReturn(80_000, 100_000)

    assert.equal(gain, -20_000)
    assert.equal(pct, -20)
  })

  it('es 0% cuando el valor coincide con lo ingresado', () => {
    assert.equal(totalReturn(100_000, 100_000).pct, 0)
  })

  it('no calcula porcentaje sin ingresos (evita dividir por cero)', () => {
    assert.equal(totalReturn(5_000, 0).pct, undefined)
    assert.equal(totalReturn(5_000, -100).pct, undefined)
  })

  it('sigue dando la ganancia en euros aunque no haya porcentaje', () => {
    assert.equal(totalReturn(5_000, 0).gain, 5_000)
  })
})
