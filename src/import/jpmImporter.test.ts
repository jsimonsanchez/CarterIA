import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { jpmTransactions, parseJpmStatement } from './jpmImporter'

/** Extracto con el formato real de J.P. Morgan, con datos inventados. */
const STATEMENT = `sep=;
"My Share Statement"
""
"Date of Statement";"Participant ID";"Name";"Address";"Ticker";"Share Price";"Alternative Currency";"Estimated Exchange Rate";"Filter"
"23-Sep-2026";"00000";"Nombre Apellido";"Calle Ejemplo 1";"ACME";"USD 13.60";"EUR";"0.877050";"Outstanding"
""
"My Shares"
""
"Certificate Number";"Issuance Date";"Issuance Source";"Grant Number Source";"Issued Shares";"FMV at Issuance";"Transacted Shares";"Outstanding Shares";"Value of Shares Held";"Capital Gain/Loss"
"CERT_1";"04-Apr-2025";"RSU Issuance";"G_1";"160";"USD 21.62";"0";"160";"EUR 1,908.46";"(USD 1,283.20)"
"CERT_2";"08-Apr-2026";"RSU Issuance";"G_2";"100";"USD 16.74";"40";"60";"EUR 715.68";"(USD 188.40)"
"CERT_3";"08-Apr-2026";"RSU Issuance";"G_3";"25";"USD 16.74";"25";"0";"EUR 0.00";"(USD 0.00)"
"Total";"";"";"";"285";"";"65";"220";"EUR 2,624.14";"(USD 1,471.60)"
""
"In the event of any inconsistency between the information shown above and your scheme documentation, your scheme documentation shall take precedence."
`

describe('parseJpmStatement', () => {
  it('lee las entregas que siguen en cartera, con su fecha y su valor de entrega', () => {
    const statement = parseJpmStatement(STATEMENT)

    assert.equal(statement.ticker, 'ACME')
    assert.equal(statement.symbol, 'ACME.US')
    assert.deepEqual(statement.holdings, [
      {
        certificate: 'CERT_1',
        issuanceDate: '2025-04-04T00:00:00.000Z',
        quantity: 160,
        fmv: 21.62,
        fmvCurrency: 'USD',
        source: 'RSU Issuance',
      },
      {
        certificate: 'CERT_2',
        issuanceDate: '2026-04-08T00:00:00.000Z',
        // De las 100 entregadas se vendieron 40: la posición es lo que queda.
        quantity: 60,
        fmv: 16.74,
        fmvCurrency: 'USD',
        source: 'RSU Issuance',
      },
    ])
  })

  it('ignora las entregas vendidas por completo, que siguen apareciendo a cero', () => {
    const statement = parseJpmStatement(STATEMENT)

    assert.equal(
      statement.holdings.find((h) => h.certificate === 'CERT_3'),
      undefined,
    )
    assert.deepEqual(statement.skippedRows, [])
  })

  it('rechaza un fichero que no sea un extracto de acciones', () => {
    assert.throws(() => parseJpmStatement('cualquier;cosa\n'), /J\.P\. Morgan/)
  })
})

describe('jpmTransactions', () => {
  const statement = parseJpmStatement(STATEMENT)
  // 160 × 21,62 USD al cambio de aquel día (0,9044) = 3.128,51 €.
  const costes = new Map([
    ['CERT_1', 3128.51],
    ['CERT_2', 858.02],
  ])

  it('registra cada entrega como una compra al coste del día en que se entregó', () => {
    const compras = jpmTransactions(statement, costes).filter((t) => t.type === 'buy')

    assert.equal(compras.length, 2)
    assert.equal(compras[0].symbol, 'ACME.US')
    assert.equal(compras[0].broker, 'jpm')
    assert.equal(compras[0].quantity, 160)
    assert.equal(compras[0].price, 3128.51 / 160)
    assert.equal(compras[0].total, -3128.51)
    assert.equal(compras[0].category, 'STOCK')
  })

  it('acompaña cada compra de un ingreso por el mismo importe, para no mover la caja', () => {
    const transactions = jpmTransactions(statement, costes)
    const caja = transactions.reduce((acc, t) => acc + t.total, 0)

    assert.equal(caja, 0)
    // Las RSU no cuestan dinero, pero su valor sí cuenta como aportación: si
    // no, la rentabilidad total las contaría enteras como beneficio.
    const ingresos = transactions.filter((t) => t.type === 'deposit')
    assert.equal(ingresos.length, 2)
    assert.equal(ingresos[0].total, 3128.51)
    assert.equal(ingresos[0].symbol, '')
  })

  it('usa el certificado como identificador, para que reimportar no duplique', () => {
    const primera = jpmTransactions(statement, costes).map((t) => t.id)
    const segunda = jpmTransactions(statement, costes).map((t) => t.id)

    assert.deepEqual(primera, segunda)
    assert.equal(new Set(primera).size, primera.length)
  })
})
