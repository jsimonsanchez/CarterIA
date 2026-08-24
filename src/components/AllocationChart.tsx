import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur } from '../utils/format'

const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8', '#fb7185', '#c084fc']

export function AllocationChart({ rows }: { rows: PortfolioRow[] }) {
  const data = rows
    .filter((r) => (r.marketValueEur ?? 0) > 0)
    .map((r) => ({ name: r.symbol, value: r.marketValueEur ?? 0 }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return <p className="empty-state">Sin datos de valor para graficar todavía.</p>
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120} paddingAngle={1}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatEur(Number(value))}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
