export interface CashFlow {
  date: Date
  amount: number
}

function xnpv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((acc, cf) => {
    const days = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24)
    return acc + cf.amount / Math.pow(1 + rate, days / 365)
  }, 0)
}

function xnpvDerivative(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((acc, cf) => {
    const days = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24)
    const years = days / 365
    if (years === 0) return acc
    return acc - (years * cf.amount) / Math.pow(1 + rate, years + 1)
  }, 0)
}

/**
 * Rentabilidad anualizada ponderada por dinero (XIRR): la tasa que hace que
 * el valor actual neto de todos los flujos de caja (fecha + importe) sea
 * cero. A diferencia de un simple "ganancia/coste", tiene en cuenta CUÁNDO
 * entró cada euro — dos aportaciones iguales en fechas distintas no pesan
 * igual en el resultado.
 *
 * No es TWR (time-weighted return): TWR necesitaría valorar la cartera en
 * cada fecha de aportación, y de momento solo se guarda el precio en vivo
 * actual, no un histórico diario — con XIRR basta la fecha/importe de cada
 * flujo y el valor de hoy.
 *
 * Newton-Raphson con bisección de respaldo si no converge (flujos raros:
 * todo el dinero fuera el mismo día, importes extremos, etc.).
 */
export function xirr(flows: CashFlow[]): number | undefined {
  if (flows.length < 2) return undefined
  const hasPositive = flows.some((f) => f.amount > 0)
  const hasNegative = flows.some((f) => f.amount < 0)
  if (!hasPositive || !hasNegative) return undefined

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date.getTime()

  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    const value = xnpv(rate, sorted, t0)
    const deriv = xnpvDerivative(rate, sorted, t0)
    if (Math.abs(deriv) < 1e-10) break
    const next = rate - value / deriv
    if (!Number.isFinite(next)) break
    if (Math.abs(next - rate) < 1e-7) return next
    rate = next
  }

  // Newton no convergió (o divergió a un valor absurdo) — bisección entre
  // límites amplios pero razonables (-99% a +1000% anual).
  let lo = -0.99
  let hi = 10
  let loVal = xnpv(lo, sorted, t0)
  const hiVal = xnpv(hi, sorted, t0)
  if (Math.sign(loVal) === Math.sign(hiVal)) return undefined

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const midVal = xnpv(mid, sorted, t0)
    if (Math.abs(midVal) < 1e-6) return mid
    if (Math.sign(midVal) === Math.sign(loVal)) {
      lo = mid
      loVal = midVal
    } else {
      hi = mid
    }
  }
  return (lo + hi) / 2
}
