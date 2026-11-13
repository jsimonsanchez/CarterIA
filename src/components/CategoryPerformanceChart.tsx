import type { Transaction } from '../domain/types'
import { categoryLabel, SIN_CATEGORIA } from '../domain/instrumentCategory'
import { useTransactions } from '../hooks/portfolioData'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatPct, formatShare } from '../utils/format'
import { DonutChart } from './DonutChart'

// Mismos colores que AllocationChart, en el mismo orden, para que una
// categoría tenga siempre el mismo color en las dos gráficas.
const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#818cf8']

const LIQUIDEZ = 'Liquidez'

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
  const transactionsQuery = useTransactions()
  const transactions = transactionsQuery ?? NO_TRANSACTIONS
  // Mismo cálculo que "Liquidez" en SummaryCards: cada transacción ya trae
  // su importe neto en EUR, así que sumar todo el histórico da la caja
  // disponible sin tener que reconstruirla a partir de las posiciones.
  const cashBalance = transactions.reduce((acc, t) => acc + t.total, 0)

  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const positionsValue = withPrice.reduce((acc, r) => acc + r.marketValueEur!, 0)
  const totalValue = positionsValue + cashBalance

  // Los pesos se reparten sobre el valor de TODA la cartera: con la caja sin
  // cargar o algún precio sin llegar, las posiciones que faltan cuentan cero
  // y la tarta sale con la liquidez (o lo poco que haya) al 100 %.
  if (!transactionsQuery || withPrice.length !== rows.length) return null

  if (totalValue <= 0) return null

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
      <DonutChart
        ariaLabel="Reparto de la cartera por tipo de instrumento"
        slices={data.map((d, i) => {
          const pctText = `${formatShare(d.pctCartera)} de la cartera`
          return {
            key: d.category,
            value: d.pctCartera,
            color: COLORS[i % COLORS.length],
            label: d.category,
            // La liquidez (y cualquier categoría sin coste de adquisición) no
            // tiene plusvalía que mostrar — se omite la coletilla en vez de
            // decir "sin datos", que sonaría a fallo cuando es que no aplica.
            detail:
              d.pctRendimiento !== undefined ? `${pctText} · ${formatPct(d.pctRendimiento)} de rendimiento` : pctText,
          }
        })}
      />

      <div className="chart-legend">
        {data.map((d, i) => (
          <div className="chart-legend-row" key={d.category}>
            <span className="chart-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="chart-legend-symbol">{d.category}</span>
            <span className="chart-legend-pct">{formatShare(d.pctCartera)}</span>
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
