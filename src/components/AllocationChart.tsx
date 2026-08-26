import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur } from '../utils/format'

const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8', '#fb7185', '#c084fc']
const LEGEND_LIMIT = 8

export function AllocationChart({ rows }: { rows: PortfolioRow[] }) {
  const data = rows
    .filter((r) => (r.marketValueEur ?? 0) > 0)
    .map((r) => ({ name: r.symbol, value: r.marketValueEur ?? 0 }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return <p className="empty-state">Sin datos de valor para graficar todavía.</p>
  }

  const total = data.reduce((acc, d) => acc + d.value, 0)

  const legendItems = data.slice(0, LEGEND_LIMIT)
  const rest = data.slice(LEGEND_LIMIT)
  const restValue = rest.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={30}
            outerRadius={54}
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const numericValue = Number(value)
              const pct = total > 0 ? (numericValue / total) * 100 : 0
              return [`${formatEur(numericValue)} (${pct.toFixed(1)}%)`, name]
            }}
            contentStyle={{ background: '#1e293b', border: '1px solid #2c3a52', borderRadius: 10, color: '#e7ebf3' }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        {legendItems.map((item, i) => (
          <div className="chart-legend-row" key={item.name}>
            <span className="chart-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="chart-legend-symbol">{item.name}</span>
            <span className="chart-legend-pct">{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}%</span>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="chart-legend-row">
            <span className="chart-legend-swatch" style={{ background: 'var(--border)' }} />
            <span className="chart-legend-symbol">Otros ({rest.length})</span>
            <span className="chart-legend-pct">{total > 0 ? ((restValue / total) * 100).toFixed(1) : '0.0'}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
