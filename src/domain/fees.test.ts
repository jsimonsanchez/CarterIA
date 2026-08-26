import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isTaxFee } from './fees'

describe('isTaxFee', () => {
  it('reconoce los impuestos aunque la línea lleve instrumento y comentario', () => {
    assert.equal(isTaxFee('Withholding tax — NVO.US — DIV'), true)
    assert.equal(isTaxFee('Stamp duty — DGE.UK'), true)
    assert.equal(isTaxFee('Tax IFTT'), true)
    assert.equal(isTaxFee('Free funds interest tax'), true)
  })

  it('no confunde las comisiones con impuestos', () => {
    assert.equal(isTaxFee('SEC fee — MU.US'), false)
    assert.equal(isTaxFee('Correction'), false)
  })

  it('cuenta como comisión cualquier etiqueta desconocida, para que no desaparezca del informe', () => {
    assert.equal(isTaxFee('Alguna comisión nueva de XTB — AAPL.US'), false)
    assert.equal(isTaxFee(''), false)
  })

  it('no se deja engañar por una etiqueta que solo empiece parecido', () => {
    // El separador es " — ": sin él, no es la etiqueta completa.
    assert.equal(isTaxFee('Withholding tax refund'), false)
  })
})
