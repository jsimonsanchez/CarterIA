export interface SummaryInputs {
  /** Las filas de la cartera aún se están preparando (posiciones, precios y conversión a EUR). */
  isLoading: boolean
  transactionsLoaded: boolean
  tradesLoaded: boolean
  /** Posiciones abiertas. */
  positions: number
  /** De ellas, las que ya tienen precio. */
  priced: number
}

export interface SummaryAvailability {
  /** Coste de la cartera: solo depende de las posiciones. */
  cost: boolean
  /** Liquidez: solo depende de los movimientos. */
  liquidity: boolean
  /** Plusvalía realizada: movimientos y operaciones cerradas. */
  realized: boolean
  /** Plusvalía latente: necesita precio en al menos las posiciones que sí tienen. */
  unrealized: boolean
  /** Valor total, Total y XIRR: necesitan el precio de TODAS las posiciones. */
  valuation: boolean
}

/**
 * Qué cifras del resumen se pueden calcular con lo que hay cargado ahora.
 *
 * Una posición sin precio vale 0 en el cálculo, así que cualquier cifra que
 * dependa del valor de toda la cartera sale falsa mientras falte alguno: con
 * los precios aún sin cargar, el "Total" enseñaba una pérdida del 80 % y el
 * XIRR otra del 70 %, simplemente porque la cartera valía cero. Es mejor no
 * enseñar nada que enseñar eso.
 *
 * La plusvalía latente es parcial por diseño (se calcula solo sobre las
 * posiciones con precio y lo avisa), así que basta con que haya alguna.
 */
export function summaryAvailability(input: SummaryInputs): SummaryAvailability {
  const rowsReady = !input.isLoading

  return {
    cost: rowsReady,
    liquidity: input.transactionsLoaded,
    realized: input.transactionsLoaded && input.tradesLoaded,
    unrealized: rowsReady && (input.positions === 0 || input.priced > 0),
    valuation: rowsReady && input.transactionsLoaded && input.priced === input.positions,
  }
}
