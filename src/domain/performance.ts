import type { CashFlow } from './xirr'
import { annualizedReturn } from './xirr'

/** Lo mínimo que hace falta de una operación cerrada para anualizarla. */
interface TradeFlow {
  openDate: string
  closeDate: string
  purchaseValueEur: number
  saleValueEur: number
}

/**
 * Rentabilidad anualizada de un conjunto de operaciones cerradas, tratando
 * cada una como dos flujos de caja: lo que costó el día que se abrió y lo
 * que se obtuvo el día que se cerró.
 *
 * No es la media de los porcentajes de cada operación: eso daría el mismo
 * peso a una de 100 € que a una de 10.000 €, y no tendría en cuenta cuánto
 * tiempo estuvo invertido cada importe. Con los flujos y sus fechas, un
 * acierto grande y rápido pesa lo que le corresponde.
 *
 * Los dividendos cobrados de ese valor entran como un flujo más, en su
 * fecha: son parte del rendimiento que dio el dinero invertido, igual que la
 * venta.
 *
 * `undefined` cuando el recorrido entre la primera compra y la última venta
 * es demasiado corto para anualizar sin dar una cifra absurda, o cuando no
 * hay ninguna compra que anualizar (un valor que ese año solo repartió
 * dividendos y sigue en cartera).
 */
export function annualizedReturnOfTrades(trades: TradeFlow[], dividends: CashFlow[] = []): number | undefined {
  if (trades.length === 0) return undefined

  const flows = trades.flatMap((t) => [
    { date: new Date(t.openDate), amount: -t.purchaseValueEur },
    { date: new Date(t.closeDate), amount: t.saleValueEur },
  ])
  return annualizedReturn([...flows, ...dividends])
}

/**
 * Rendimiento total de la cartera: cuánto ha crecido TODO el dinero que se
 * ha metido en el broker. Si se ingresan 100.000 € y hoy entre posiciones y
 * liquidez hay 200.000 €, el rendimiento es del 100%.
 *
 * Se mide contra los ingresos de efectivo, no contra el coste de las
 * posiciones: el coste solo refleja lo que hay invertido en un momento
 * dado, mientras que los ingresos son lo que realmente ha salido del
 * bolsillo del inversor. Y como `portfolioValue` ya incluye la liquidez —y
 * la liquidez arrastra ventas, dividendos, intereses y comisiones— no hay
 * que sumar cada concepto por separado: lo que no está invertido está en
 * caja, así que nada se cuenta dos veces ni se queda fuera.
 *
 * `netDeposits` debe ser la suma de los ingresos de efectivo. Si el bróker
 * registra las retiradas como ingresos con importe negativo, la suma ya
 * queda neta por sí sola.
 */
export function totalReturn(
  portfolioValue: number,
  netDeposits: number,
): { gain: number; pct: number | undefined } {
  const gain = portfolioValue - netDeposits
  return {
    gain,
    pct: netDeposits > 0 ? (gain / netDeposits) * 100 : undefined,
  }
}
