import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { isPriceStale } from '../domain/priceFreshness'
import { modifiedDietzAnnualized, xirr } from '../domain/xirr'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatPct } from '../utils/format'

export function SummaryCards({ rows }: { rows: PortfolioRow[] }) {
  const closedTrades = useLiveQuery(() => db.closedTrades.toArray(), []) ?? []
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []

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

  const realizedPnl = sum(closedTrades, (t) => t.realizedPnlEur)
  const realizedPct = costBasis > 0 ? (realizedPnl / costBasis) * 100 : undefined

  const dividends = sum(
    transactions.filter((t) => t.type === 'dividend'),
    (t) => t.total,
  )
  const interest = sum(
    transactions.filter((t) => t.type === 'interest'),
    (t) => t.total,
  )

  // Los tres % se calculan sobre el mismo "coste de la cartera" (posiciones
  // abiertas) para que sean directamente comparables entre sí, en vez de
  // cada uno respecto a una base distinta.
  const total = unrealizedPnl + realizedPnl + dividends + interest
  const totalPct = costBasis > 0 ? (total / costBasis) * 100 : undefined

  // XIRR: rentabilidad anualizada ponderada por dinero. Flujos = cada
  // ingreso (negativo, sale del bolsillo del inversor) + el valor actual de
  // todo hoy (positivo, como si se liquidara la cartera). Compras, ventas,
  // dividendos e intereses no son flujos aparte — ya están recogidos en el
  // valor final. No es TWR (necesitaría un histórico diario de valoración
  // que todavía no se guarda).
  const depositFlows = transactions
    .filter((t) => t.type === 'deposit')
    .map((t) => ({ date: new Date(t.date), amount: -t.total }))
  const allFlows = depositFlows.length > 0 ? [...depositFlows, { date: new Date(), amount: marketValue + cashBalance }] : []
  // xirr() puede no converger con ciertos conjuntos de flujos (aportaciones
  // muy concentradas, correcciones con importe negativo, etc.) — si falla,
  // el método Dietz modificado (fórmula cerrada, no puede fallar por no
  // converger) sirve de respaldo para que la cifra no desaparezca sin más.
  const xirrRate = allFlows.length > 0 ? xirr(allFlows) : undefined
  const usedFallback = xirrRate === undefined && allFlows.length > 0
  if (usedFallback) {
    console.warn('XIRR no convergió, usando Dietz modificado como respaldo. Flujos:', allFlows)
  }
  const annualizedRate = xirrRate ?? (usedFallback ? modifiedDietzAnnualized(allFlows) : undefined)
  const xirrPct = annualizedRate !== undefined ? annualizedRate * 100 : undefined

  return (
    <section className="summary-cards">
      <Card
        label="Valor Total"
        value={formatEur(marketValue + cashBalance)}
        subLines={[
          `Coste de la cartera: ${formatEur(costBasis)}`,
          `Posiciones: ${formatEur(marketValue)}`,
          `Liquidez: ${formatEur(cashBalance)}`,
        ]}
        hint={buildPriceHint(missingPrices, stalePrices)}
      />
      <div className="card">
        <PnlLine label="Plusvalía no realizada" value={unrealizedPnl} pct={unrealizedPct} />
        <PnlLine label="Plusvalías realizadas" value={realizedPnl} pct={realizedPct} />
        <PnlLine label="Total (+ dividendos e intereses)" value={total} pct={totalPct} emphasized />
        {xirrPct !== undefined && (
          <div
            className="pnl-line xirr-line"
            title={
              usedFallback
                ? 'Rentabilidad anualizada ponderada por dinero (aproximación, método Dietz modificado — el cálculo exacto XIRR no convergió con estos flujos).'
                : 'Rentabilidad anualizada ponderada por dinero (XIRR): tiene en cuenta cuándo entró cada ingreso, no solo cuánto.'
            }
          >
            <span className="card-label">Rentabilidad anualizada {usedFallback ? '(aprox.)' : '(XIRR)'}</span>
            <span className={`card-value ${xirrPct >= 0 ? 'positive' : 'negative'}`}>{formatPct(xirrPct)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function PnlLine({
  label,
  value,
  pct,
  emphasized,
}: {
  label: string
  value: number
  pct?: number
  emphasized?: boolean
}) {
  const tone = value >= 0 ? 'positive' : 'negative'
  return (
    <div className={`pnl-line ${emphasized ? 'pnl-line-total' : ''}`}>
      <span className="card-label">{label}</span>
      <span className={`card-value ${tone}`}>{formatEur(value)}</span>
      {pct !== undefined && <span className={`card-sub ${tone}`}>{formatPct(pct)}</span>}
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  subLines,
  hint,
  tone,
}: {
  label: string
  value: string
  sub?: string
  subLines?: string[]
  hint?: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <span className={`card-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className={`card-sub ${tone ?? ''}`}>{sub}</span>}
      {subLines?.map((line) => (
        <span key={line} className={`card-sub ${tone ?? ''}`}>
          {line}
        </span>
      ))}
      {hint && <span className="card-hint">{hint}</span>}
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
