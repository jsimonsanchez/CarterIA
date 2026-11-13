import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { convertToEur, isFxStale, resetFxCacheForTests } from './fx'

/** Sustituye a fetch y cuenta cuántas veces se ha llamado a /api/fx. */
function stubFetch(responder: (currency: string) => Promise<{ rate: number }>) {
  const llamadas: string[] = []
  globalThis.fetch = (async (url: string) => {
    const currency = new URL(url, 'http://x').searchParams.get('from')!
    llamadas.push(currency)
    const body = await responder(currency)
    return { ok: true, json: async () => body } as Response
  }) as typeof fetch
  return llamadas
}

describe('convertToEur', () => {
  beforeEach(() => resetFxCacheForTests())

  it('no pide nada para euros', async () => {
    const llamadas = stubFetch(async () => ({ rate: 1 }))
    assert.equal(await convertToEur(100, 'EUR'), 100)
    assert.equal(llamadas.length, 0)
  })

  it('comparte una única petición entre todas las posiciones de la misma divisa', async () => {
    // Es el caso real: una cartera con muchas posiciones en dólares pedía el
    // tipo de cambio una vez por posición.
    const llamadas = stubFetch(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return { rate: 0.9 }
    })

    const resultados = await Promise.all(Array.from({ length: 20 }, () => convertToEur(100, 'USD')))

    assert.equal(llamadas.length, 1, `esperaba 1 petición y hubo ${llamadas.length}`)
    assert.deepEqual(new Set(resultados), new Set([90]))
  })

  it('reutiliza el tipo ya obtenido en conversiones posteriores', async () => {
    const llamadas = stubFetch(async () => ({ rate: 0.9 }))

    await convertToEur(100, 'USD')
    await convertToEur(200, 'USD')
    await convertToEur(300, 'USD')

    assert.equal(llamadas.length, 1)
  })

  it('pide por separado cada divisa distinta', async () => {
    const llamadas = stubFetch(async (c) => ({ rate: c === 'USD' ? 0.9 : 0.13 }))

    await Promise.all([convertToEur(100, 'USD'), convertToEur(100, 'SEK'), convertToEur(100, 'USD')])

    assert.deepEqual([...new Set(llamadas)].sort(), ['SEK', 'USD'])
    assert.equal(llamadas.length, 2)
  })

  it('pasa los peniques del Reino Unido a libras antes de convertir', async () => {
    stubFetch(async () => ({ rate: 1.2 }))
    // 1000 peniques son 10 libras, que a 1,2 son 12 euros.
    assert.equal(await convertToEur(1000, 'GBp'), 12)
  })

  it('usa el último tipo conocido si el proveedor falla', async () => {
    stubFetch(async () => ({ rate: 0.9 }))
    await convertToEur(100, 'USD')

    // El proveedor se cae y el tipo guardado ya ha caducado.
    resetFxCacheForTests()
    stubFetch(async () => ({ rate: 0.9 }))
    await convertToEur(100, 'USD')
    globalThis.fetch = (async () => {
      throw new Error('sin conexión')
    }) as typeof fetch

    // Sigue respondiendo con el tipo cacheado en vez de romper la vista.
    assert.equal(await convertToEur(100, 'USD'), 90)
  })

  it('marca la divisa como caducada si tiene que tirar de un tipo viejo, y lo desmarca al recuperarse', async () => {
    const ahora = Date.now
    try {
      stubFetch(async () => ({ rate: 0.9 }))
      await convertToEur(100, 'USD')
      assert.equal(isFxStale('USD'), false)

      // Dos horas después el tipo guardado ha caducado y el proveedor no responde.
      Date.now = () => ahora() + 2 * 60 * 60 * 1000
      globalThis.fetch = (async () => {
        throw new Error('sin conexión')
      }) as typeof fetch
      assert.equal(await convertToEur(100, 'USD'), 90)
      assert.equal(isFxStale('USD'), true)

      // El proveedor vuelve: el aviso desaparece.
      stubFetch(async () => ({ rate: 0.95 }))
      Date.now = () => ahora() + 4 * 60 * 60 * 1000
      assert.equal(await convertToEur(100, 'USD'), 95)
      assert.equal(isFxStale('USD'), false)
    } finally {
      Date.now = ahora
    }
  })

  it('los peniques comparten el aviso de la libra', async () => {
    const ahora = Date.now
    try {
      stubFetch(async () => ({ rate: 1.2 }))
      await convertToEur(100, 'GBP')
      Date.now = () => ahora() + 2 * 60 * 60 * 1000
      globalThis.fetch = (async () => {
        throw new Error('sin conexión')
      }) as typeof fetch
      await convertToEur(1000, 'GBp')
      assert.equal(isFxStale('GBp'), true)
    } finally {
      Date.now = ahora
    }
  })

  it('propaga el error si nunca hubo un tipo que reutilizar', async () => {
    globalThis.fetch = (async () => {
      throw new Error('sin conexión')
    }) as typeof fetch

    await assert.rejects(() => convertToEur(100, 'USD'))
  })
})
