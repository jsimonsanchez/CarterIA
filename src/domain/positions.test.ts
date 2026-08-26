import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computePositions } from './positions'
import type { Transaction } from './types'

/** Transacción con los campos que no afectan al cálculo ya rellenos. */
function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'type' | 'symbol'>): Transaction {
  return {
    quantity: 0,
    price: 0,
    currency: 'EUR',
    commission: 0,
    total: 0,
    rawSymbol: partial.symbol,
    rawDescription: '',
    ...partial,
  }
}

describe('computePositions', () => {
  it('calcula el coste medio ponderado de varias compras a precios distintos', () => {
    const positions = computePositions([
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
      tx({ id: '2', date: '2024-06-01', type: 'buy', symbol: 'AAPL.US', quantity: 30, price: 200 }),
    ])

    assert.equal(positions.length, 1)
    assert.equal(positions[0].quantity, 40)
    // (10*100 + 30*200) / 40 = 7000/40 = 175
    assert.equal(positions[0].averageCost, 175)
  })

  it('mantiene el coste medio al vender parcialmente (solo baja la cantidad)', () => {
    const positions = computePositions([
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
      tx({ id: '2', date: '2024-06-01', type: 'sell', symbol: 'AAPL.US', quantity: 4, price: 500 }),
    ])

    assert.equal(positions[0].quantity, 6)
    // El precio de venta no debe contaminar el coste medio de lo que queda.
    assert.equal(positions[0].averageCost, 100)
  })

  it('excluye las posiciones cerradas del todo', () => {
    const positions = computePositions([
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
      tx({ id: '2', date: '2024-06-01', type: 'sell', symbol: 'AAPL.US', quantity: 10, price: 150 }),
    ])

    assert.equal(positions.length, 0)
  })

  it('ignora dividendos y comisiones al calcular cantidad y coste', () => {
    const positions = computePositions([
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
      tx({ id: '2', date: '2024-02-01', type: 'dividend', symbol: 'AAPL.US', total: 25 }),
      tx({ id: '3', date: '2024-03-01', type: 'fee', symbol: 'AAPL.US', total: -3 }),
    ])

    assert.equal(positions[0].quantity, 10)
    assert.equal(positions[0].averageCost, 100)
  })

  it('procesa las transacciones por fecha aunque lleguen desordenadas', () => {
    const positions = computePositions([
      tx({ id: '2', date: '2024-06-01', type: 'sell', symbol: 'AAPL.US', quantity: 5, price: 300 }),
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
    ])

    assert.equal(positions[0].quantity, 5)
    assert.equal(positions[0].averageCost, 100)
  })

  it('agrupa por símbolo de forma independiente', () => {
    const positions = computePositions([
      tx({ id: '1', date: '2024-01-01', type: 'buy', symbol: 'AAPL.US', quantity: 10, price: 100 }),
      tx({ id: '2', date: '2024-01-01', type: 'buy', symbol: 'AMZN.DE', quantity: 2, price: 50 }),
    ])

    assert.equal(positions.length, 2)
    assert.equal(positions.find((p) => p.symbol === 'AMZN.DE')?.averageCost, 50)
  })
})
