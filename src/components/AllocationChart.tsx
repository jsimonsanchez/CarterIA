import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatEur, formatShare } from '../utils/format'
import { DonutChart } from './DonutChart'

const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8', '#fb7185', '#c084fc']
const LEGEND_LIMIT = 8

export function AllocationChart({ rows }: { rows: PortfolioRow[] }) {
  const { hidden } = usePrivacy()
  const data = rows
    .filter((r) => (r.marketValueEur ?? 0) > 0)
    .map((r) => ({ name: r.symbol, value: r.marketValueEur ?? 0 }))
    .sort((a, b) => b.value - a.value)

  // Sin mensaje propio: la tabla de al lado ya explica que no hay posiciones.
  if (data.length === 0) return null

  const total = data.reduce((acc, d) => acc + d.value, 0)
  const share = (value: number) => formatShare(total > 0 ? (value / total) * 100 : 0)

  const legendItems = data.slice(0, LEGEND_LIMIT)
  const rest = data.slice(LEGEND_LIMIT)
  const restValue = rest.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="chart-container">
      <span className="card-label chart-container-label">Cartera</span>
      <DonutChart
        ariaLabel="Reparto de la cartera por valor"
        slices={data.map((d, i) => ({
          key: d.name,
          value: d.value,
          color: COLORS[i % COLORS.length],
          label: d.name,
          detail: `${formatEur(d.value, hidden)} (${share(d.value)})`,
        }))}
      />

      <div className="chart-legend">
        {legendItems.map((item, i) => (
          <div className="chart-legend-row" key={item.name}>
            <span className="chart-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="chart-legend-symbol">{item.name}</span>
            <span className="chart-legend-pct">{share(item.value)}</span>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="chart-legend-row">
            <span className="chart-legend-swatch" style={{ background: 'var(--border)' }} />
            <span className="chart-legend-symbol">Otros ({rest.length})</span>
            <span className="chart-legend-pct">{share(restValue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
