import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRealizedYears, netDividends } from './realized'
import type { ClosedTrade, Transaction } from './types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'type' | 'total'>): Transaction {
  return {
    broker: 'xtb',
    symbol: '',
    quantity: 0,
    price: 0,
    currency: 'EUR',
    commission: 0,
    rawSymbol: '',
    rawDescription: '',
    ...partial,
  }
}

function trade(partial: Partial<ClosedTrade> & Pick<ClosedTrade, 'id' | 'symbol' | 'closeDate'>): ClosedTrade {
  const purchase = partial.purchaseValueEur ?? 1000
  const sale = partial.saleValueEur ?? 1200
  return {
    broker: 'xtb',
    quantity: 10,
    openDate: '2023-01-01T00:00:00.000Z',
    openPrice: 100,
    closePrice: 120,
    purchaseValueEur: purchase,
    saleValueEur: sale,
    realizedPnlEur: sale - purchase,
    positionId: partial.id,
    ...partial,
  }
}

const DIVIDENDO = tx({
  id: 'd1',
  date: '2025-05-12T00:00:00.000Z',
  type: 'dividend',
  symbol: 'SAN.ES',
  total: 160,
  rawDescription: 'Dividend — SAN.ES',
})

const RETENCION = tx({
  id: 'd2',
  date: '2025-05-12T00:00:00.000Z',
  type: 'fee',
  symbol: 'SAN.ES',
  total: -48,
  rawDescription: 'Withholding tax — SAN.ES',
})

const IMPUESTO_COMPRAVENTA = tx({
  id: 'd3',
  date: '2025-05-12T00:00:00.000Z',
  type: 'fee',
  symbol: 'SAN.ES',
  total: -5,
  rawDescription: 'Stamp duty — SAN.ES',
})

describe('netDividends', () => {
  it('resta al dividendo su retención, y nada más', () => {
    assert.equal(netDividends([DIVIDENDO, RETENCION, IMPUESTO_COMPRAVENTA]), 112)
  })
})

describe('buildRealizedYears', () => {
  it('suma los dividendos netos a la plusvalía de las ventas del mismo valor y año', () => {
    const years = buildRealizedYears(
      [trade({ id: 't1', symbol: 'SAN.ES', closeDate: '2025-09-01T00:00:00.000Z', purchaseValueEur: 1000, saleValueEur: 1200 })],
      [DIVIDENDO, RETENCION],
    )

    assert.equal(years.length, 1)
    const san = years[0].symbols[0]
    assert.equal(san.dividendTotal, 112)
    // 200 € de la venta + 112 € de dividendos netos.
    assert.equal(san.pnl, 312)
    assert.equal(san.pct, 31.2)
    assert.equal(years[0].pnl, 312)
  })

  it('incluye los dividendos de un valor que sigue en cartera, sin porcentaje', () => {
    const years = buildRealizedYears([], [DIVIDENDO, RETENCION])

    const san = years[0].symbols[0]
    assert.equal(san.trades.length, 0)
    assert.equal(san.pnl, 112)
    // Sin venta no hay coste sobre el que calcular un porcentaje.
    assert.equal(san.pct, undefined)
    assert.equal(san.annualizedRate, undefined)
    assert.equal(years[0].tradeCount, 0)
  })

  it('separa por año de cobro, aunque la venta sea de otro año', () => {
    const years = buildRealizedYears(
      [trade({ id: 't1', symbol: 'SAN.ES', closeDate: '2026-02-01T00:00:00.000Z' })],
      [DIVIDENDO],
    )

    assert.deepEqual(
      years.map((y) => [y.year, y.pnl]),
      [
        [2026, 200],
        [2025, 160],
      ],
    )
  })

  it('no confunde un impuesto de compraventa con la retención de un dividendo', () => {
    const years = buildRealizedYears([], [DIVIDENDO, IMPUESTO_COMPRAVENTA])

    assert.equal(years[0].symbols[0].dividendTotal, 160)
  })

  it('agrupa bajo "Otros" los dividendos que llegan sin valor asociado', () => {
    const years = buildRealizedYears([], [tx({ id: 'x', date: '2025-01-01T00:00:00.000Z', type: 'dividend', total: 20 })])

    assert.equal(years[0].symbols[0].symbol, 'Otros')
    assert.equal(years[0].pnl, 20)
  })

  it('el anualizado de un valor tiene en cuenta sus dividendos', () => {
    const sinDividendo = buildRealizedYears(
      [trade({ id: 't1', symbol: 'SAN.ES', closeDate: '2025-09-01T00:00:00.000Z' })],
      [],
    )[0].symbols[0].annualizedRate
    const conDividendo = buildRealizedYears(
      [trade({ id: 't1', symbol: 'SAN.ES', closeDate: '2025-09-01T00:00:00.000Z' })],
      [DIVIDENDO, RETENCION],
    )[0].symbols[0].annualizedRate

    assert.ok(sinDividendo !== undefined && conDividendo !== undefined)
    assert.ok(conDividendo > sinDividendo)
  })
})
