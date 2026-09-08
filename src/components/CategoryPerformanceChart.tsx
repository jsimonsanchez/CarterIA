import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryLabel, SIN_CATEGORIA } from '../domain/instrumentCategory'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatPct } from '../utils/format'

// Mismos colores que AllocationChart, en el mismo orden, para que una
// categoría tenga siempre el mismo color en las dos gráficas.
const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8']

interface CategoryStat {
  category: string
  pctCartera: number
  pctRendimiento?: number
}

/**
 * Compara acciones, ETF y demás categorías del extracto de XTB: la tarta es
 * el peso de cada una en la cartera (igual que AllocationChart, pero
 * agrupando por categoría en vez de por símbolo); la rentabilidad no
 * realizada de cada una solo se ve al pasar el ratón, en el tooltip — no
 * tiene una escala común con el peso (una categoría con +150% de plusvalía
 * no tiene por qué pesar lo mismo en la cartera) y meterla en el mismo
 * dibujo confundía más de lo que aclaraba.
 */
export function CategoryPerformanceChart({ rows }: { rows: PortfolioRow[] }) {
  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const totalValue = withPrice.reduce((acc, r) => acc + r.marketValueEur!, 0)

  if (totalValue <= 0) {
    return <p className="empty-state">Sin datos de valor para graficar todavía.</p>
  }

  const byCategory = new Map<string, PortfolioRow[]>()
  for (const row of withPrice) {
    const label = categoryLabel(row.category)
    const group = byCategory.get(label) ?? []
    group.push(row)
    byCategory.set(label, group)
  }

  const data: CategoryStat[] = [...byCategory.entries()]
    .map(([category, group]) => {
      const value = group.reduce((acc, r) => acc + r.marketValueEur!, 0)
      const cost = group.reduce((acc, r) => acc + r.costBasis, 0)
      return {
        category,
        pctCartera: (value / totalValue) * 100,
        pctRendimiento: cost > 0 ? ((value - cost) / cost) * 100 : undefined,
      }
    })
    .sort((a, b) => b.pctCartera - a.pctCartera)

  return (
    <section className="panel">
      <h2>Cartera por tipo de instrumento</h2>
      <div className="category-chart-row">
        <div className="category-chart-pie">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={data}
                dataKey="pctCartera"
                nameKey="category"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={1}
                isAnimationActive={false}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, item) => {
                  const rendimiento = (item.payload as CategoryStat)?.pctRendimiento
                  const rendimientoText = rendimiento !== undefined ? formatPct(rendimiento) : 'sin datos'
                  return [`${Number(value).toFixed(1)}% de la cartera · ${rendimientoText} de rendimiento`, name]
                }}
                contentStyle={{ background: '#1e293b', border: '1px solid #2c3a52', borderRadius: 10, color: '#e7ebf3' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-legend category-chart-legend">
          {data.map((d, i) => (
            <div className="chart-legend-row" key={d.category}>
              <span className="chart-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="chart-legend-symbol">{d.category}</span>
              <span className="chart-legend-pct">{d.pctCartera.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      {byCategory.has(SIN_CATEGORIA) && (
        <p className="card-hint">
          "{SIN_CATEGORIA}" son posiciones importadas antes de que la app leyera este dato — reimporta el extracto para clasificarlas.
        </p>
      )}
    </section>
  )
}
