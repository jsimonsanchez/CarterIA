import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { db } from '../db/db'
import { buildRealizedYears, type RealizedSymbol } from '../domain/realized'
import type { ClosedTrade } from '../domain/types'
import { cagr, MIN_DAYS_TO_ANNUALIZE } from '../domain/xirr'
import { useLogos } from '../hooks/useLogos'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatDate, formatEur, formatPct, formatQuantity } from '../utils/format'
import { SymbolLogo } from './SymbolLogo'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const NO_SYMBOLS: string[] = []

type Logos = Record<string, string | null>

export function RealizedGainsPanel() {
  const { hidden } = usePrivacy()
  const trades = useLiveQuery(() => db.closedTrades.toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const [openYear, setOpenYear] = useState<number | null>(null)
  // Clave "año|símbolo": el mismo valor puede haberse cerrado en varios
  // años, y desplegarlo en uno no debería desplegarlo en los demás.
  const [openSymbol, setOpenSymbol] = useState<string | null>(null)
  // Antes de cualquier early return: los hooks no pueden ser condicionales.
  const logos = useLogos(trades ? [...new Set(trades.map((t) => t.symbol))] : NO_SYMBOLS)

  if (!trades || !transactions) return null

  const years = buildRealizedYears(trades, transactions)

  if (years.length === 0) {
    return <p className="empty-state">Nada realizado todavía — se rellena al vender o al cobrar un dividendo.</p>
  }

  const totalRealized = years.reduce((acc, y) => acc + y.pnl, 0)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Resultado realizado por año</h2>
        <span className={`card-value ${totalRealized >= 0 ? 'positive' : 'negative'}`}>
          {formatEur(totalRealized, hidden)}
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
              const expanded = openYear === year.year

              return (
                <Fragment key={year.year}>
                  <tr className="position-row" onClick={() => setOpenYear(expanded ? null : year.year)}>
                    <td>
                      <strong>{year.year}</strong>
                    </td>
                    <td className="num">{year.tradeCount}</td>
                    <td className={`num ${year.pnl >= 0 ? 'positive' : 'negative'}`}>{formatEur(year.pnl, hidden)}</td>
                    <td className={`num ${year.pnl >= 0 ? 'positive' : 'negative'}`}>
                      {year.pct !== undefined ? formatPct(year.pct) : '—'}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="detail-row">
                      <td colSpan={4}>
                        <div className="position-detail">
                          <SymbolBreakdown
                            year={year.year}
                            symbols={year.symbols}
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

/** Los valores con resultado en un año, con su desglose desplegable. */
function SymbolBreakdown({
  year,
  symbols,
  logos,
  openSymbol,
  onToggleSymbol,
}: {
  year: number
  symbols: RealizedSymbol[]
  logos: Logos
  openSymbol: string | null
  onToggleSymbol: (key: string | null) => void
}) {
  const { hidden } = usePrivacy()

  return (
    <table className="transactions-table">
      <thead>
        <tr>
          <th>Símbolo</th>
          <th className="num">Operaciones</th>
          <th className="num">Coste</th>
          <th className="num">Venta</th>
          <th className="num">Dividendos</th>
          <th className="num">Plusvalía</th>
          <th className="num">% Plusvalía</th>
          <th className="num">% Anualizado</th>
        </tr>
      </thead>
      <tbody>
        {symbols.map((entry) => {
          const key = `${year}|${entry.symbol}`
          const expanded = openSymbol === key
          const tone = entry.pnl >= 0 ? 'positive' : 'negative'
          const annualizedPct = entry.annualizedRate !== undefined ? entry.annualizedRate * 100 : undefined

          return (
            <Fragment key={entry.symbol}>
              <tr className="position-row" onClick={() => onToggleSymbol(expanded ? null : key)}>
                <td>
                  <span className="symbol-ticker">
                    <strong>{entry.symbol}</strong>
                    {logos[entry.symbol] && <SymbolLogo url={logos[entry.symbol]!} size={16} className="symbol-logo" />}
                    <span className="sort-arrow">{expanded ? '▾' : '▸'}</span>
                  </span>
                </td>
                <td className="num">{entry.trades.length}</td>
                <td className="num">{entry.cost > 0 ? formatEur(entry.cost, hidden) : '—'}</td>
                <td className="num">{entry.sale > 0 ? formatEur(entry.sale, hidden) : '—'}</td>
                <td className="num">{entry.dividendTotal !== 0 ? formatEur(entry.dividendTotal, hidden) : '—'}</td>
                <td className={`num ${tone}`}>{formatEur(entry.pnl, hidden)}</td>
                <td className={`num ${tone}`}>{entry.pct !== undefined ? formatPct(entry.pct) : '—'}</td>
                <td
                  className={`num ${annualizedPct !== undefined ? (annualizedPct >= 0 ? 'positive' : 'negative') : ''}`}
                  title={
                    annualizedPct !== undefined
                      ? 'Rentabilidad anualizada de este valor: pondera por importe y por el tiempo que estuvo invertido cada uno, con los dividendos incluidos.'
                      : entry.trades.length === 0
                        ? 'Solo dividendos: sin compra ni venta no hay periodo que anualizar'
                        : `Menos de ${MIN_DAYS_TO_ANNUALIZE} días entre la primera compra y la última venta — no se anualiza`
                  }
                >
                  {annualizedPct !== undefined ? formatPct(annualizedPct) : '—'}
                </td>
              </tr>
              {expanded && (
                <tr className="detail-row">
                  <td colSpan={8}>
                    <div className="position-detail">
                      <EventList entry={entry} />
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

/** Las ventas y los dividendos concretos de un valor en ese año. */
function EventList({ entry }: { entry: RealizedSymbol }) {
  const { hidden } = usePrivacy()

  return (
    <table className="transactions-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Concepto</th>
          <th className="num">Cantidad</th>
          <th className="num">Coste</th>
          <th className="num">Venta</th>
          <th className="num">Importe</th>
          <th className="num">% Plusvalía</th>
          <th className="num">% Anualizado</th>
        </tr>
      </thead>
      <tbody>
        {entry.trades.map((t) => (
          <TradeRow key={t.id} trade={t} hidden={hidden} />
        ))}
        {entry.dividends.map((d) => (
          <tr key={d.id}>
            <td>{formatDate(d.date)}</td>
            <td>{d.isWithholding ? 'Retención' : 'Dividendo'}</td>
            <td className="num">—</td>
            <td className="num">—</td>
            <td className="num">—</td>
            <td className={`num ${d.amountEur >= 0 ? 'positive' : 'negative'}`}>{formatEur(d.amountEur, hidden)}</td>
            <td className="num">—</td>
            <td className="num">—</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TradeRow({ trade, hidden }: { trade: ClosedTrade; hidden: boolean }) {
  const pct = trade.purchaseValueEur > 0 ? (trade.realizedPnlEur / trade.purchaseValueEur) * 100 : undefined
  const heldDays = (new Date(trade.closeDate).getTime() - new Date(trade.openDate).getTime()) / MS_PER_DAY
  const rate = heldDays >= MIN_DAYS_TO_ANNUALIZE ? cagr(trade.purchaseValueEur, trade.saleValueEur, heldDays) : undefined
  const annualizedPct = rate !== undefined ? rate * 100 : undefined
  const tone = trade.realizedPnlEur >= 0 ? 'positive' : 'negative'

  return (
    <tr>
      <td>{formatDate(trade.closeDate)}</td>
      <td>Venta</td>
      <td className="num">{formatQuantity(trade.quantity, hidden)}</td>
      <td className="num">{formatEur(trade.purchaseValueEur, hidden)}</td>
      <td className="num">{formatEur(trade.saleValueEur, hidden)}</td>
      <td className={`num ${tone}`}>{formatEur(trade.realizedPnlEur, hidden)}</td>
      <td className={`num ${tone}`}>{pct !== undefined ? formatPct(pct) : '—'}</td>
      <td
        className={`num ${annualizedPct !== undefined ? tone : ''}`}
        title={
          annualizedPct === undefined
            ? `Menos de ${MIN_DAYS_TO_ANNUALIZE} días en cartera — no se anualiza`
            : 'Rentabilidad anualizada de esta operación, sin contar dividendos: esos van en la fila del valor.'
        }
      >
        {annualizedPct !== undefined ? formatPct(annualizedPct) : '—'}
      </td>
    </tr>
  )
}
