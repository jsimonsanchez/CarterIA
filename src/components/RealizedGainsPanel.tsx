import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { db } from '../db/db'
import { formatDate, formatEur, formatPct } from '../utils/format'

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

      <table className="positions-table">
        <thead>
          <tr>
            <th>Año</th>
            <th>Operaciones cerradas</th>
            <th>Plusvalía realizada</th>
            <th>% Plusvalía</th>
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
                  <td>{yearTrades.length}</td>
                  <td className={yearTotal >= 0 ? 'positive' : 'negative'}>{formatEur(yearTotal)}</td>
                  <td className={yearTotal >= 0 ? 'positive' : 'negative'}>
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
                              <th>Cantidad</th>
                              <th>Coste</th>
                              <th>Venta</th>
                              <th>Plusvalía</th>
                              <th>% Plusvalía</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearTrades.map((t) => {
                              const pct = t.purchaseValueEur > 0 ? (t.realizedPnlEur / t.purchaseValueEur) * 100 : undefined
                              return (
                                <tr key={t.id}>
                                  <td>{formatDate(t.closeDate)}</td>
                                  <td>{t.symbol}</td>
                                  <td>{t.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}</td>
                                  <td>{formatEur(t.purchaseValueEur)}</td>
                                  <td>{formatEur(t.saleValueEur)}</td>
                                  <td className={t.realizedPnlEur >= 0 ? 'positive' : 'negative'}>
                                    {formatEur(t.realizedPnlEur)}
                                  </td>
                                  <td className={t.realizedPnlEur >= 0 ? 'positive' : 'negative'}>
                                    {pct !== undefined ? formatPct(pct) : '—'}
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
    </section>
  )
}
