import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
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

  const totalDeposits = sum(
    transactions.filter((t) => t.type === 'deposit'),
    (t) => t.total,
  )

  const realizedPnl = sum(closedTrades, (t) => t.realizedPnlEur)
  const realizedCost = sum(closedTrades, (t) => t.purchaseValueEur)
  const realizedPct = realizedCost > 0 ? (realizedPnl / realizedCost) * 100 : undefined

  const dividends = sum(
    transactions.filter((t) => t.type === 'dividend'),
    (t) => t.total,
  )
  const interest = sum(
    transactions.filter((t) => t.type === 'interest'),
    (t) => t.total,
  )

  const total = unrealizedPnl + realizedPnl + dividends + interest
  const totalCost = costBasis + realizedCost
  const totalPct = totalCost > 0 ? (total / totalCost) * 100 : undefined

  return (
    <section className="summary-cards">
      <Card
        label="Valor Total"
        value={formatEur(marketValue + cashBalance)}
        subLines={[`Posiciones: ${formatEur(marketValue)}`, `Liquidez: ${formatEur(cashBalance)}`]}
        hint={missingPrices > 0 ? `${missingPrices} sin precio` : undefined}
      />
      <Card
        label="Coste de la cartera"
        value={formatEur(costBasis)}
        subLines={[`Cantidad ingresada al broker: ${formatEur(totalDeposits)}`]}
      />
      <div className="card">
        <PnlLine label="Plusvalía no realizada" value={unrealizedPnl} pct={unrealizedPct} />
        <PnlLine label="Plusvalías realizadas" value={realizedPnl} pct={realizedPct} />
        <PnlLine label="Total (+ dividendos e intereses)" value={total} pct={totalPct} emphasized />
      </div>
      <Card label="Posiciones abiertas" value={String(rows.length)} />
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
