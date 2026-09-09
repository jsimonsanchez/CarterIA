import { useLiveQuery } from 'dexie-react-hooks'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { db } from '../db/db'
import type { Transaction } from '../domain/types'
import { categoryLabel, SIN_CATEGORIA } from '../domain/instrumentCategory'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatPct } from '../utils/format'

// Mismos colores que AllocationChart, en el mismo orden, para que una
// categoría tenga siempre el mismo color en las dos gráficas.
const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8']

const LIQUIDEZ = 'Liquidez'

// Literal a nivel de módulo, no `[]` en el cuerpo del componente: un array
// nuevo en cada render rompería la memoización de useLiveQuery mientras la
// consulta a Dexie está resolviéndose — mismo motivo que en SummaryCards.
const NO_TRANSACTIONS: Transaction[] = []

interface CategoryStat {
  category: string
  pctCartera: number
  pctRendimiento?: number
}

/**
 * Compara acciones, ETF, demás categorías del extracto de XTB y la liquidez:
 * la tarta es el peso de cada una en la cartera; la rentabilidad no
 * realizada de cada una solo se ve al pasar el ratón, en el tooltip — no
 * tiene una escala común con el peso (una categoría con +150% de plusvalía
 * no tiene por qué pesar lo mismo en la cartera) y meterla en el mismo
 * dibujo confundía más de lo que aclaraba.
 *
 * La liquidez no tiene coste de adquisición, así que no hay plusvalía que
 * calcularle — su tooltip se queda solo con el peso.
 *
 * Va justo debajo de AllocationChart, en la misma columna estrecha del
 * main-grid (ver `.sidebar-charts` en App.css) — mismo `.chart-container` y
 * `.chart-legend` que esa gráfica, para que las dos lean como una sola
 * franja lateral y no como dos paneles descoordinados.
 */
export function CategoryPerformanceChart({ rows }: { rows: PortfolioRow[] }) {
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? NO_TRANSACTIONS
  // Mismo cálculo que "Liquidez" en SummaryCards: cada transacción ya trae
  // su importe neto en EUR, así que sumar todo el histórico da la caja
  // disponible sin tener que reconstruirla a partir de las posiciones.
  const cashBalance = transactions.reduce((acc, t) => acc + t.total, 0)

  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const positionsValue = withPrice.reduce((acc, r) => acc + r.marketValueEur!, 0)
  const totalValue = positionsValue + cashBalance

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

  const data: CategoryStat[] = [...byCategory.entries()].map(([category, group]) => {
    const value = group.reduce((acc, r) => acc + r.marketValueEur!, 0)
    const cost = group.reduce((acc, r) => acc + r.costBasis, 0)
    return {
      category,
      pctCartera: (value / totalValue) * 100,
      pctRendimiento: cost > 0 ? ((value - cost) / cost) * 100 : undefined,
    }
  })

  if (cashBalance > 0) {
    data.push({ category: LIQUIDEZ, pctCartera: (cashBalance / totalValue) * 100 })
  }

  data.sort((a, b) => b.pctCartera - a.pctCartera)

  return (
    <div className="chart-container">
      <span className="card-label chart-container-label">Tipo de instrumento</span>
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie
            data={data}
            dataKey="pctCartera"
            nameKey="category"
            innerRadius={30}
            outerRadius={54}
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
              const pctText = `${Number(value).toFixed(1)}% de la cartera`
              // La liquidez (y cualquier categoría sin coste de adquisición)
              // no tiene plusvalía que mostrar — se omite la coletilla en
              // vez de decir "sin datos", que sonaría a fallo cuando en
              // realidad es que no aplica.
              const text = rendimiento !== undefined ? `${pctText} · ${formatPct(rendimiento)} de rendimiento` : pctText
              return [text, name]
            }}
            contentStyle={{ background: '#1e293b', border: '1px solid #2c3a52', borderRadius: 10, color: '#e7ebf3' }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        {data.map((d, i) => (
          <div className="chart-legend-row" key={d.category}>
            <span className="chart-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="chart-legend-symbol">{d.category}</span>
            <span className="chart-legend-pct">{d.pctCartera.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      {byCategory.has(SIN_CATEGORIA) && (
        <p className="card-hint chart-container-hint">
          "{SIN_CATEGORIA}": reimporta el extracto para clasificarlas.
        </p>
      )}
    </div>
  )
}
