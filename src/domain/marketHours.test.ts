import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { allMarketsClosed } from './marketHours'
import type { PriceCacheEntry } from './types'

const precio = (marketOpen?: boolean): PriceCacheEntry => ({
  symbol: 'X',
  price: 1,
  currency: 'EUR',
  source: 'yahoo',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  marketOpen,
})

describe('allMarketsClosed', () => {
  it('solo si todas las bolsas estaban cerradas', () => {
    assert.equal(allMarketsClosed([precio(false), precio(false)]), true)
    assert.equal(allMarketsClosed([precio(false), precio(true)]), false)
  })

  it('sin el dato cuenta como abierto, para no dejar de actualizar a ciegas', () => {
    assert.equal(allMarketsClosed([precio(false), precio(undefined)]), false)
    assert.equal(allMarketsClosed([precio(false), undefined]), false)
  })

  it('sin precios guardados no hay nada que pausar', () => {
    assert.equal(allMarketsClosed([]), false)
  })
})
