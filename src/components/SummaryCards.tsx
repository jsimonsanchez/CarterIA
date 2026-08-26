import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { totalReturn } from '../domain/performance'
import { isPriceStale } from '../domain/priceFreshness'
import { modifiedDietzAnnualized, xirr } from '../domain/xirr'
import type { ClosedTrade, Transaction } from '../domain/types'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatPct } from '../utils/format'

// Constantes a nivel de módulo, no literales `[]` en el cuerpo del
// componente: un literal crea un array nuevo en cada render mientras la
// consulta a Dexie está resolviéndose, lo que rompería la memoización del
// XIRR de más abajo (su dependencia cambiaría siempre).
const NO_TRADES: ClosedTrade[] = []
const NO_TRANSACTIONS: Transaction[] = []

export function SummaryCards({ rows }: { rows: PortfolioRow[] }) {
  const closedTrades = useLiveQuery(() => db.closedTrades.toArray(), []) ?? NO_TRADES
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? NO_TRANSACTIONS

  // Cada transacción ya trae su importe neto en EUR (ingresos +, compras −,
  // ventas +, dividendos +, intereses +, comisiones −), así que sumar todo
  // el histórico da directamente la liquidez disponible sin invertir.
  const cashBalance = sum(transactions, (t) => t.total)

  const costBasis = sum(rows, (r) => r.costBasis)
  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const marketValue = sum(withPrice, (r) => r.marketValueEur ?? 0)
  const unrealizedPnl = sum(withPrice, (r) => r.unrealizedPnlEur ?? 0)
  const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : undefined
  const missingPrices = rows.length - withPrice.length
  const stalePrices = withPrice.filter((r) => isPriceStale(r.priceFetchedAt)).length

  // Cada % se calcula sobre SU propia base de coste, no sobre una común: la
  // plusvalía realizada procede de operaciones ya cerradas, cuyo coste
  // (purchaseValueEur) no tiene relación con lo que hay invertido hoy.
  // Dividirla entre el coste de las posiciones abiertas daba un porcentaje
  // arbitrario — cuantas menos posiciones abiertas, más inflado — y además
  // no coincidía con el que muestra la pestaña "Posiciones cerradas".
  const realizedPnl = sum(closedTrades, (t) => t.realizedPnlEur)
  const realizedCostBasis = sum(closedTrades, (t) => t.purchaseValueEur)
  const realizedPct = realizedCostBasis > 0 ? (realizedPnl / realizedCostBasis) * 100 : undefined

  // Rendimiento de todo el dinero aportado al bróker: ingresas 100.000 € y
  // hoy tienes 200.000 € entre posiciones y liquidez → 100%. No se suman
  // los conceptos por separado (plusvalías + dividendos + intereses...)
  // porque el valor de la cartera ya los recoge todos: lo que no está
  // invertido está en caja.
  const totalDeposits = sum(
    transactions.filter((t) => t.type === 'deposit'),
    (t) => t.total,
  )
  const portfolioValue = marketValue + cashBalance
  const { gain: total, pct: totalPct } = totalReturn(portfolioValue, totalDeposits)

  // XIRR: rentabilidad anualizada ponderada por dinero. Flujos = cada
  // ingreso (negativo, sale del bolsillo del inversor) + el valor actual de
  // todo hoy (positivo, como si se liquidara la cartera). Compras, ventas,
  // dividendos e intereses no son flujos aparte — ya están recogidos en el
  // valor final. No es TWR (necesitaría un histórico diario de valoración
  // que todavía no se guarda).
  //
  // Va en useMemo porque es iterativo (Newton-Raphson, con bisección de
  // respaldo) y este componente se re-renderiza con cada cambio en Dexie:
  // sin memoizar se recalculaba entero en cada render, y el console.warn del
  // respaldo se repetía indefinidamente en consola.
  const { xirrPct, usedFallback } = useMemo(() => {
    const depositFlows = transactions
      .filter((t) => t.type === 'deposit')
      .map((t) => ({ date: new Date(t.date), amount: -t.total }))
    if (depositFlows.length === 0) return { xirrPct: undefined, usedFallback: false }

    const allFlows = [...depositFlows, { date: new Date(), amount: marketValue + cashBalance }]
    // xirr() puede no converger con ciertos conjuntos de flujos (aportaciones
    // muy concentradas, correcciones con importe negativo, etc.) — si falla,
    // el método Dietz modificado (fórmula cerrada, no puede fallar por no
    // converger) sirve de respaldo para que la cifra no desaparezca sin más.
    const xirrRate = xirr(allFlows)
    const fallback = xirrRate === undefined
    if (fallback) {
      console.warn('XIRR no convergió, usando Dietz modificado como respaldo. Flujos:', allFlows)
    }
    const rate = xirrRate ?? modifiedDietzAnnualized(allFlows)
    return { xirrPct: rate !== undefined ? rate * 100 : undefined, usedFallback: fallback }
  }, [transactions, marketValue, cashBalance])

  const priceHint = buildPriceHint(missingPrices, stalePrices)

  return (
    <section className="panel summary-panel">
      <div className="summary-grid">
        <div className="summary-stat">
          <span className="card-label">Valor Total</span>
          <span className="card-value">{formatEur(portfolioValue)}</span>
          <span className="card-sub">
            Posiciones {formatEur(marketValue)} · Liquidez {formatEur(cashBalance)}
          </span>
          {priceHint && <span className="card-hint">{priceHint}</span>}
        </div>
        <Stat
          label="Coste de la cartera"
          value={formatEur(costBasis)}
          sub={`Posiciones abiertas ${rows.length}`}
        />
        <Stat
          label="Plusvalía Latente"
          value={formatEur(unrealizedPnl)}
          sub={unrealizedPct !== undefined ? formatPct(unrealizedPct) : undefined}
          tone={unrealizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <Stat
          label="Plusvalía"
          value={formatEur(realizedPnl)}
          sub={realizedPct !== undefined ? formatPct(realizedPct) : undefined}
          tone={realizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <Stat
          label="Total (+ dividendos e intereses)"
          value={formatEur(total)}
          sub={totalPct !== undefined ? formatPct(totalPct) : undefined}
          tone={total >= 0 ? 'positive' : 'negative'}
          title={`Rendimiento de todo lo aportado: ${formatEur(portfolioValue)} de valor actual frente a ${formatEur(totalDeposits)} de ingresos de efectivo.`}
        />
        {xirrPct !== undefined && (
          <Stat
            label={`Rentabilidad anualizada ${usedFallback ? '(aprox.)' : '(XIRR)'}`}
            value={formatPct(xirrPct)}
            tone={xirrPct >= 0 ? 'positive' : 'negative'}
            title={
              usedFallback
                ? 'Rentabilidad anualizada ponderada por dinero (aproximación, método Dietz modificado — el cálculo exacto XIRR no convergió con estos flujos).'
                : 'Rentabilidad anualizada ponderada por dinero (XIRR): tiene en cuenta cuándo entró cada ingreso, no solo cuánto.'
            }
          />
        )}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
  title,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative'
  title?: string
}) {
  return (
    <div className="summary-stat" title={title}>
      <span className="card-label">{label}</span>
      <span className={`card-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className={`card-sub ${tone ?? ''}`}>{sub}</span>}
    </div>
  )
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0)
}

function buildPriceHint(missing: number, stale: number): string | undefined {
  const parts: string[] = []
  if (missing > 0) parts.push(`${missing} sin precio`)
  if (stale > 0) parts.push(`${stale} desactualizado${stale > 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
