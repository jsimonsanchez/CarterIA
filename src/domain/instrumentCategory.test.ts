import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { categoryLabel, SIN_CATEGORIA } from './instrumentCategory'

describe('categoryLabel', () => {
  it('traduce las cuatro categorias verificadas contra un extracto real', () => {
    assert.equal(categoryLabel('STOCK'), 'Acción')
    assert.equal(categoryLabel('ETF'), 'ETF')
    assert.equal(categoryLabel('ETC'), 'ETC')
    assert.equal(categoryLabel('ETN'), 'ETN')
  })

  it('no distingue mayusculas/minusculas, como puede variar entre exportaciones', () => {
    assert.equal(categoryLabel('stock'), 'Acción')
  })

  it('deja tal cual un valor que no esta en el mapa, en vez de forzarlo a una categoria', () => {
    assert.equal(categoryLabel('CFD'), 'CFD')
  })

  it('usa la etiqueta de "sin categoria" cuando no hay dato', () => {
    assert.equal(categoryLabel(undefined), SIN_CATEGORIA)
  })
})
