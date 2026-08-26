import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { annualizedReturn, cagr, modifiedDietzAnnualized, xirr } from './xirr'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

function assertClose(actual: number | undefined, expected: number, tolerance: number, message?: string) {
  assert.notEqual(actual, undefined, message ?? 'se esperaba un valor definido')
  assert.ok(
    Math.abs(actual! - expected) <= tolerance,
    message ?? `esperaba ${expected} ±${tolerance}, recibido ${actual}`,
  )
}

describe('xirr', () => {
  it('resuelve el caso conocido: 1000 → 1200 en un año = 20%', () => {
    const rate = xirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-12-31'), amount: 1200 },
    ])

    assertClose(rate, 0.2, 0.005)
  })

  it('devuelve una tasa negativa cuando se pierde dinero', () => {
    const rate = xirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-12-31'), amount: 800 },
    ])

    assert.ok(rate! < 0, 'la tasa debería ser negativa')
    assertClose(rate, -0.2, 0.01)
  })

  it('pondera por fecha: aportar más tarde para el mismo resultado sube la tasa', () => {
    const final = 2200
    const temprano = xirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-02-01'), amount: -1000 },
      { date: new Date('2024-12-31'), amount: final },
    ])!
    const tardio = xirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-11-01'), amount: -1000 },
      { date: new Date('2024-12-31'), amount: final },
    ])!

    // Mismo beneficio en euros, pero con el segundo euro trabajando menos
    // tiempo — la tasa anual resultante tiene que ser mayor.
    assert.ok(tardio > temprano, `esperaba ${tardio} > ${temprano}`)
  })

  it('aguanta muchas aportaciones periódicas sin dejar de converger', () => {
    const flows = Array.from({ length: 24 }, (_, i) => ({
      date: new Date(2023, i, 1),
      amount: -500,
    }))
    flows.push({ date: new Date(2025, 0, 1), amount: 14_000 })

    const rate = xirr(flows)
    assert.notEqual(rate, undefined)
    assert.ok(Number.isFinite(rate!), 'la tasa debe ser un número finito')
  })

  it('devuelve undefined si no hay flujos de ambos signos', () => {
    assert.equal(
      xirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: -500 },
      ]),
      undefined,
    )
  })
})

describe('modifiedDietzAnnualized', () => {
  it('se aproxima a xirr en un caso simple de un año', () => {
    const flows = [
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-12-31'), amount: 1200 },
    ]

    assertClose(modifiedDietzAnnualized(flows), xirr(flows)!, 0.01)
  })

  it('devuelve undefined si el capital ponderado no es positivo', () => {
    assert.equal(
      modifiedDietzAnnualized([
        { date: new Date('2024-01-01'), amount: 1000 },
        { date: new Date('2024-12-31'), amount: 1200 },
      ]),
      undefined,
    )
  })
})

describe('cagr', () => {
  it('calcula la tasa anual compuesta entre dos valores', () => {
    // 1000 → 1210 en dos años es exactamente un 10% anual compuesto.
    assertClose(cagr(1000, 1210, 730), 0.1, 0.001)
  })

  it('devuelve undefined con valor inicial no positivo o sin días', () => {
    assert.equal(cagr(0, 1210, 730), undefined)
    assert.equal(cagr(1000, 1210, 0), undefined)
  })
})

describe('annualizedReturn', () => {
  it('no anualiza por debajo del mínimo de días, para no dar cifras absurdas', () => {
    // +2% en 3 días anualizado serían cientos de % — se omite a propósito.
    assert.equal(
      annualizedReturn([
        { date: daysAgo(3), amount: -1000 },
        { date: daysAgo(0), amount: 1020 },
      ]),
      undefined,
    )
  })

  it('sí anualiza cuando hay recorrido suficiente', () => {
    assertClose(
      annualizedReturn([
        { date: daysAgo(365), amount: -1000 },
        { date: daysAgo(0), amount: 1200 },
      ]),
      0.2,
      0.01,
    )
  })
})
