import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { annualizedReturnOfTrades, totalReturn } from './performance'

const DIA = 24 * 60 * 60 * 1000
const haceDias = (n: number) => new Date(Date.now() - n * DIA).toISOString()

describe('annualizedReturnOfTrades', () => {
  it('resuelve el caso conocido: 1000 → 1200 en un año es un 20%', () => {
    const rate = annualizedReturnOfTrades([
      { openDate: haceDias(365), closeDate: haceDias(0), purchaseValueEur: 1000, saleValueEur: 1200 },
    ])

    assert.notEqual(rate, undefined)
    assert.ok(Math.abs(rate! - 0.2) < 0.01, `esperaba ~0,20 y recibí ${rate}`)
  })

  it('pondera por importe, no da el mismo peso a cada operación', () => {
    // Una operación diminuta que multiplica por 10 junto a una grande y
    // plana: el resultado debe parecerse más a la grande.
    const rate = annualizedReturnOfTrades([
      { openDate: haceDias(365), closeDate: haceDias(0), purchaseValueEur: 100, saleValueEur: 1000 },
      { openDate: haceDias(365), closeDate: haceDias(0), purchaseValueEur: 10_000, saleValueEur: 10_000 },
    ])

    // La media simple de los dos porcentajes (900% y 0%) daría un 450%.
    assert.ok(rate! < 0.5, `una media simple habría dado ~4,5; recibí ${rate}`)
  })

  it('tiene en cuenta el tiempo: lo mismo ganado en menos tiempo anualiza más', () => {
    const lento = annualizedReturnOfTrades([
      { openDate: haceDias(730), closeDate: haceDias(0), purchaseValueEur: 1000, saleValueEur: 1500 },
    ])!
    const rapido = annualizedReturnOfTrades([
      { openDate: haceDias(365), closeDate: haceDias(0), purchaseValueEur: 1000, saleValueEur: 1500 },
    ])!

    assert.ok(rapido > lento, `esperaba ${rapido} > ${lento}`)
  })

  it('refleja las pérdidas con una tasa negativa', () => {
    const rate = annualizedReturnOfTrades([
      { openDate: haceDias(365), closeDate: haceDias(0), purchaseValueEur: 1000, saleValueEur: 800 },
    ])

    assert.ok(rate! < 0, `esperaba negativo, recibí ${rate}`)
  })

  it('no anualiza operaciones demasiado breves, para no dar cifras absurdas', () => {
    assert.equal(
      annualizedReturnOfTrades([
        { openDate: haceDias(3), closeDate: haceDias(0), purchaseValueEur: 1000, saleValueEur: 1020 },
      ]),
      undefined,
    )
  })

  it('devuelve undefined sin operaciones', () => {
    assert.equal(annualizedReturnOfTrades([]), undefined)
  })
})

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
