import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatPct } from '../utils/format'

export function SummaryCards({ rows }: { rows: PortfolioRow[] }) {
  const costBasis = sum(rows, (r) => r.costBasis)
  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const marketValue = sum(withPrice, (r) => r.marketValueEur ?? 0)
  const unrealizedPnl = sum(withPrice, (r) => r.unrealizedPnlEur ?? 0)
  const pnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : undefined
  const missingPrices = rows.length - withPrice.length

  return (
    <section className="summary-cards">
      <Card label="Valor de mercado" value={formatEur(marketValue)} hint={missingPrices > 0 ? `${missingPrices} sin precio` : undefined} />
      <Card label="Coste de la cartera" value={formatEur(costBasis)} />
      <Card
        label="Plusvalía no realizada"
        value={formatEur(unrealizedPnl)}
        sub={pnlPct !== undefined ? formatPct(pnlPct) : undefined}
        tone={unrealizedPnl >= 0 ? 'positive' : 'negative'}
      />
      <Card label="Posiciones abiertas" value={String(rows.length)} />
    </section>
  )
}

function Card({
  label,
  value,
  sub,
  hint,
  tone,
}: {
  label: string
  value: string
  sub?: string
  hint?: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <span className={`card-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className={`card-sub ${tone ?? ''}`}>{sub}</span>}
      {hint && <span className="card-hint">{hint}</span>}
    </div>
  )
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0)
}
