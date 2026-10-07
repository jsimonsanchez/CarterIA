import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summaryAvailability, type SummaryInputs } from './summaryAvailability'

const LISTO: SummaryInputs = {
  isLoading: false,
  transactionsLoaded: true,
  tradesLoaded: true,
  positions: 8,
  priced: 8,
}

describe('summaryAvailability', () => {
  it('con todo cargado y todas las posiciones con precio, enseña todo', () => {
    assert.deepEqual(summaryAvailability(LISTO), {
      cost: true,
      liquidity: true,
      realized: true,
      unrealized: true,
      valuation: true,
    })
  })

  it('mientras carga no enseña ni el coste, que dependen de filas aún sin preparar', () => {
    const a = summaryAvailability({ ...LISTO, isLoading: true, priced: 0 })

    assert.equal(a.cost, false)
    assert.equal(a.unrealized, false)
    assert.equal(a.valuation, false)
  })

  it('sin ningún precio cargado no calcula el total: la cartera valdría cero', () => {
    const a = summaryAvailability({ ...LISTO, priced: 0 })

    assert.equal(a.valuation, false)
    assert.equal(a.unrealized, false)
    // Lo que no depende de los precios sigue disponible.
    assert.equal(a.cost, true)
    assert.equal(a.realized, true)
    assert.equal(a.liquidity, true)
  })

  it('si falta el precio de alguna posición, el total no se calcula pero la latente sí, parcial', () => {
    const a = summaryAvailability({ ...LISTO, priced: 7 })

    assert.equal(a.valuation, false)
    assert.equal(a.unrealized, true)
  })

  it('sin movimientos cargados no calcula nada que dependa de la caja', () => {
    const a = summaryAvailability({ ...LISTO, transactionsLoaded: false })

    assert.equal(a.liquidity, false)
    assert.equal(a.realized, false)
    assert.equal(a.valuation, false)
  })

  it('sin operaciones cerradas cargadas no enseña la plusvalía realizada', () => {
    assert.equal(summaryAvailability({ ...LISTO, tradesLoaded: false }).realized, false)
  })

  it('una cartera sin posiciones se puede valorar: solo hay caja', () => {
    const a = summaryAvailability({ ...LISTO, positions: 0, priced: 0 })

    assert.equal(a.valuation, true)
    assert.equal(a.unrealized, true)
  })
})
