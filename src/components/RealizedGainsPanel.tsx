import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { db } from '../db/db'
import { cagr, MIN_DAYS_TO_ANNUALIZE } from '../domain/xirr'
import { formatDate, formatEur, formatPct } from '../utils/format'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function RealizedGainsPanel() {
  const trades = useLiveQuery(() => db.closedTrades.toArray(), [])
  const [openYear, setOpenYear] = useState<number | null>(null)

  if (!trades) return null

  if (trades.length === 0) {
    return <p className="empty-state">Sin posiciones cerradas todavía — se rellena al importar un extracto de XTB.</p>
  }

  const byYear = new Map<number, typeof trades>()
  for (const t of trades) {
    const year = new Date(t.closeDate).getFullYear()
    const list = byYear.get(year) ?? []
    list.push(t)
    byYear.set(year, list)
  }

  const years = [...byYear.keys()].sort((a, b) => b - a)
  const totalRealized = trades.reduce((acc, t) => acc + t.realizedPnlEur, 0)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Plusvalías realizadas por año</h2>
        <span className={`card-value ${totalRealized >= 0 ? 'positive' : 'negative'}`}>
          {formatEur(totalRealized)}
        </span>
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
              const yearTrades = byYear.get(year)!.sort((a, b) => b.closeDate.localeCompare(a.closeDate))
              const yearTotal = yearTrades.reduce((acc, t) => acc + t.realizedPnlEur, 0)
              const yearCost = yearTrades.reduce((acc, t) => acc + t.purchaseValueEur, 0)
              const yearPct = yearCost > 0 ? (yearTotal / yearCost) * 100 : undefined
              const expanded = openYear === year

              return (
                <Fragment key={year}>
                  <tr className="position-row" onClick={() => setOpenYear(expanded ? null : year)}>
                    <td>
                      <strong>{year}</strong>
                    </td>
                    <td className="num">{yearTrades.length}</td>
                    <td className={`num ${yearTotal >= 0 ? 'positive' : 'negative'}`}>{formatEur(yearTotal)}</td>
                    <td className={`num ${yearTotal >= 0 ? 'positive' : 'negative'}`}>
                      {yearPct !== undefined ? formatPct(yearPct) : '—'}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="detail-row">
                      <td colSpan={4}>
                        <div className="position-detail">
                          <table className="transactions-table">
                            <thead>
                              <tr>
                                <th>Cierre</th>
                                <th>Símbolo</th>
                                <th className="num">Cantidad</th>
                                <th className="num">Coste</th>
                                <th className="num">Venta</th>
                                <th className="num">Plusvalía</th>
                                <th className="num">% Plusvalía</th>
                                <th className="num">% Anualizado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {yearTrades.map((t) => {
                                const pct = t.purchaseValueEur > 0 ? (t.realizedPnlEur / t.purchaseValueEur) * 100 : undefined
                                const heldDays = (new Date(t.closeDate).getTime() - new Date(t.openDate).getTime()) / MS_PER_DAY
                                const annualizedPct =
                                  heldDays >= MIN_DAYS_TO_ANNUALIZE
                                    ? (() => {
                                        const rate = cagr(t.purchaseValueEur, t.saleValueEur, heldDays)
                                        return rate !== undefined ? rate * 100 : undefined
                                      })()
                                    : undefined
                                return (
                                  <tr key={t.id}>
                                    <td>{formatDate(t.closeDate)}</td>
                                    <td>{t.symbol}</td>
                                    <td className="num">{t.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}</td>
                                    <td className="num">{formatEur(t.purchaseValueEur)}</td>
                                    <td className="num">{formatEur(t.saleValueEur)}</td>
                                    <td className={`num ${t.realizedPnlEur >= 0 ? 'positive' : 'negative'}`}>
                                      {formatEur(t.realizedPnlEur)}
                                    </td>
                                    <td className={`num ${t.realizedPnlEur >= 0 ? 'positive' : 'negative'}`}>
                                      {pct !== undefined ? formatPct(pct) : '—'}
                                    </td>
                                    <td
                                      className={`num ${annualizedPct !== undefined ? (annualizedPct >= 0 ? 'positive' : 'negative') : ''}`}
                                      title={annualizedPct === undefined ? `Menos de ${MIN_DAYS_TO_ANNUALIZE} días en cartera — no se anualiza` : undefined}
                                    >
                                      {annualizedPct !== undefined ? formatPct(annualizedPct) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
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
