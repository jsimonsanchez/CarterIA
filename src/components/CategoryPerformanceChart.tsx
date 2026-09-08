import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryLabel, SIN_CATEGORIA } from '../domain/instrumentCategory'
import type { PortfolioRow } from '../hooks/usePortfolioRows'

interface CategoryStat {
  category: string
  pctCartera: number
  pctRendimiento?: number
}

const CARTERA_COLOR = '#38bdf8'
const TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid #2c3a52', borderRadius: 10, color: '#e7ebf3' }

/**
 * Compara acciones, ETF y demás categorías del extracto de XTB: qué peso
 * tiene cada una en la cartera y qué rentabilidad (no realizada) está dando.
 *
 * Dos ejes, no uno: el peso está acotado entre 0 y 100%, pero la
 * rentabilidad no — una categoría con +150% de plusvalía aplastaría en el
 * mismo eje a otra con el 20% del peso de la cartera. No lleva importes en €
 * (solo %), así que no participa del modo privacidad.
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
      <h2>Acciones vs. ETF y similares</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="cartera"
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <YAxis
            yAxisId="rendimiento"
            orientation="right"
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="cartera" dataKey="pctCartera" name="% de la cartera" fill={CARTERA_COLOR} radius={[4, 4, 0, 0]} />
          {/* fill de respaldo: sin él, la leyenda no sabe qué color pintar
              en su icono porque el color real de cada barra lo pone el
              Cell de abajo, no este atributo. */}
          <Bar
            yAxisId="rendimiento"
            dataKey="pctRendimiento"
            name="% de rendimiento"
            fill="var(--positive)"
            radius={[4, 4, 0, 0]}
          >
            {data.map((d) => (
              <Cell
                key={d.category}
                fill={d.pctRendimiento !== undefined && d.pctRendimiento < 0 ? 'var(--negative)' : 'var(--positive)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {byCategory.has(SIN_CATEGORIA) && (
        <p className="card-hint">
          "{SIN_CATEGORIA}" son posiciones importadas antes de que la app leyera este dato — reimporta el extracto para clasificarlas.
        </p>
      )}
    </section>
  )
}
