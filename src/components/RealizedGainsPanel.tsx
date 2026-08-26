import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { db } from '../db/db'
import type { ClosedTrade } from '../domain/types'
import { cagr, MIN_DAYS_TO_ANNUALIZE } from '../domain/xirr'
import { useLogos } from '../hooks/useLogos'
import { formatDate, formatEur, formatPct } from '../utils/format'
import { SymbolLogo } from './SymbolLogo'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const NO_SYMBOLS: string[] = []

type Logos = Record<string, string | null>

export function RealizedGainsPanel() {
  const trades = useLiveQuery(() => db.closedTrades.toArray(), [])
  const [openYear, setOpenYear] = useState<number | null>(null)
  // Clave "año|símbolo": el mismo valor puede haberse cerrado en varios
  // años, y desplegarlo en uno no debería desplegarlo en los demás.
  const [openSymbol, setOpenSymbol] = useState<string | null>(null)
  // Antes de cualquier early return: los hooks no pueden ser condicionales.
  const logos = useLogos(trades ? [...new Set(trades.map((t) => t.symbol))] : NO_SYMBOLS)

  if (!trades) return null

  if (trades.length === 0) {
    return <p className="empty-state">Sin posiciones cerradas todavía — se rellena al importar un extracto de XTB.</p>
  }

  const byYear = groupBy(trades, (t) => new Date(t.closeDate).getFullYear())
  const years = [...byYear.keys()].sort((a, b) => b - a)
  const totalRealized = sumPnl(trades)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Plusvalías realizadas por año</h2>
        <span className={`card-value ${totalRealized >= 0 ? 'positive' : 'negative'}`}>{formatEur(totalRealized)}</span>
      </div>

      <div className="scroll-thin" style={{ overflowX: 'auto' }}>
        <table className="positions-table">
          <thead>
            <tr>
              <th>Año</th>
              <th className="num">Operaciones cerradas</th>
              <th className="num">Plusvalía realizada</th>
              <th className="num">% Plusvalía</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const yearTrades = byYear.get(year)!
              const totals = aggregate(yearTrades)
              const expanded = openYear === year

              return (
                <Fragment key={year}>
                  <tr className="position-row" onClick={() => setOpenYear(expanded ? null : year)}>
                    <td>
                      <strong>{year}</strong>
                    </td>
                    <td className="num">{yearTrades.length}</td>
                    <td className={`num ${totals.pnl >= 0 ? 'positive' : 'negative'}`}>{formatEur(totals.pnl)}</td>
                    <td className={`num ${totals.pnl >= 0 ? 'positive' : 'negative'}`}>
                      {totals.pct !== undefined ? formatPct(totals.pct) : '—'}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="detail-row">
                      <td colSpan={4}>
                        <div className="position-detail">
                          <SymbolBreakdown
                            year={year}
                            trades={yearTrades}
                            logos={logos}
                            openSymbol={openSymbol}
                            onToggleSymbol={setOpenSymbol}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Los valores cerrados en un año, con sus operaciones desplegables. */
function SymbolBreakdown({
  year,
  trades,
  logos,
  openSymbol,
  onToggleSymbol,
}: {
  year: number
  trades: ClosedTrade[]
  logos: Logos
  openSymbol: string | null
  onToggleSymbol: (key: string | null) => void
}) {
  const bySymbol = groupBy(trades, (t) => t.symbol)
  // De mayor a menor aportación: lo primero que se quiere ver es qué valor
  // explica el resultado del año.
  const symbols = [...bySymbol.keys()].sort((a, b) => sumPnl(bySymbol.get(b)!) - sumPnl(bySymbol.get(a)!))

  return (
    <table className="transactions-table">
      <thead>
        <tr>
          <th>Símbolo</th>
          <th className="num">Operaciones</th>
          <th className="num">Coste</th>
          <th className="num">Venta</th>
          <th className="num">Plusvalía</th>
          <th className="num">% Plusvalía</th>
        </tr>
      </thead>
      <tbody>
        {symbols.map((symbol) => {
          const symbolTrades = bySymbol.get(symbol)!.sort((a, b) => b.closeDate.localeCompare(a.closeDate))
          const totals = aggregate(symbolTrades)
          const key = `${year}|${symbol}`
          const expanded = openSymbol === key
          const tone = totals.pnl >= 0 ? 'positive' : 'negative'

          return (
            <Fragment key={symbol}>
              <tr className="position-row" onClick={() => onToggleSymbol(expanded ? null : key)}>
                <td>
                  <span className="symbol-ticker">
                    <strong>{symbol}</strong>
                    {logos[symbol] && <SymbolLogo url={logos[symbol]!} size={16} className="symbol-logo" />}
                    <span className="sort-arrow">{expanded ? '▾' : '▸'}</span>
                  </span>
                </td>
                <td className="num">{symbolTrades.length}</td>
                <td className="num">{formatEur(totals.cost)}</td>
                <td className="num">{formatEur(totals.sale)}</td>
                <td className={`num ${tone}`}>{formatEur(totals.pnl)}</td>
                <td className={`num ${tone}`}>{totals.pct !== undefined ? formatPct(totals.pct) : '—'}</td>
              </tr>
              {expanded && (
                <tr className="detail-row">
                  <td colSpan={6}>
                    <div className="position-detail">
                      <TradeList trades={symbolTrades} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

/** Las operaciones concretas de un valor. */
function TradeList({ trades }: { trades: ClosedTrade[] }) {
  return (
    <table className="transactions-table">
      <thead>
        <tr>
          <th>Cierre</th>
          <th className="num">Cantidad</th>
          <th className="num">Coste</th>
          <th className="num">Venta</th>
          <th className="num">Plusvalía</th>
          <th className="num">% Plusvalía</th>
          <th className="num">% Anualizado</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const pct = t.purchaseValueEur > 0 ? (t.realizedPnlEur / t.purchaseValueEur) * 100 : undefined
          const heldDays = (new Date(t.closeDate).getTime() - new Date(t.openDate).getTime()) / MS_PER_DAY
          const rate = heldDays >= MIN_DAYS_TO_ANNUALIZE ? cagr(t.purchaseValueEur, t.saleValueEur, heldDays) : undefined
          const annualizedPct = rate !== undefined ? rate * 100 : undefined
          const tone = t.realizedPnlEur >= 0 ? 'positive' : 'negative'

          return (
            <tr key={t.id}>
              <td>{formatDate(t.closeDate)}</td>
              <td className="num">{t.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}</td>
              <td className="num">{formatEur(t.purchaseValueEur)}</td>
              <td className="num">{formatEur(t.saleValueEur)}</td>
              <td className={`num ${tone}`}>{formatEur(t.realizedPnlEur)}</td>
              <td className={`num ${tone}`}>{pct !== undefined ? formatPct(pct) : '—'}</td>
              <td
                className={`num ${annualizedPct !== undefined ? tone : ''}`}
                title={
                  annualizedPct === undefined ? `Menos de ${MIN_DAYS_TO_ANNUALIZE} días en cartera — no se anualiza` : undefined
                }
              >
                {annualizedPct !== undefined ? formatPct(annualizedPct) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function groupBy<K>(trades: ClosedTrade[], key: (t: ClosedTrade) => K): Map<K, ClosedTrade[]> {
  const groups = new Map<K, ClosedTrade[]>()
  for (const t of trades) {
    const k = key(t)
    const list = groups.get(k) ?? []
    list.push(t)
    groups.set(k, list)
  }
  return groups
}

function sumPnl(trades: ClosedTrade[]): number {
  return trades.reduce((acc, t) => acc + t.realizedPnlEur, 0)
}

function aggregate(trades: ClosedTrade[]): { cost: number; sale: number; pnl: number; pct: number | undefined } {
  const cost = trades.reduce((acc, t) => acc + t.purchaseValueEur, 0)
  const sale = trades.reduce((acc, t) => acc + t.saleValueEur, 0)
  const pnl = sumPnl(trades)
  return { cost, sale, pnl, pct: cost > 0 ? (pnl / cost) * 100 : undefined }
}
