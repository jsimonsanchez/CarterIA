import { useState } from 'react'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatPct } from '../utils/format'
import { PositionDetail } from './PositionDetail'

export function PositionsTable({ rows }: { rows: PortfolioRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (rows.length === 0) {
    return <p className="empty-state">Sin posiciones — importa un extracto de XTB para empezar.</p>
  }

  const sorted = [...rows].sort((a, b) => (b.marketValueEur ?? 0) - (a.marketValueEur ?? 0))

  return (
    <table className="positions-table">
      <thead>
        <tr>
          <th>Símbolo</th>
          <th>Cantidad</th>
          <th>Coste medio</th>
          <th>Precio actual</th>
          <th>Valor</th>
          <th>Plusvalía</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <PositionRow
            key={row.symbol}
            row={row}
            expanded={expanded === row.symbol}
            onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)}
          />
        ))}
      </tbody>
    </table>
  )
}

function PositionRow({ row, expanded, onToggle }: { row: PortfolioRow; expanded: boolean; onToggle: () => void }) {
  const tone = (row.unrealizedPnlEur ?? 0) >= 0 ? 'positive' : 'negative'

  return (
    <>
      <tr className="position-row" onClick={onToggle}>
        <td>
          <div className="symbol-cell">
            <strong>{row.symbol}</strong>
            {row.name && <span className="symbol-name">{row.name}</span>}
          </div>
        </td>
        <td>{row.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}</td>
        <td>{formatEur(row.averageCost)}</td>
        <td>
          {row.priceError ? (
            <span className="error-text" title={row.priceError}>
              error
            </span>
          ) : row.currentPriceNative !== undefined ? (
            <>
              {row.currentPriceNative.toLocaleString('es-ES', { maximumFractionDigits: 4 })}{' '}
              {row.currentCurrency}
            </>
          ) : (
            <span className="card-hint">sin precio</span>
          )}
        </td>
        <td>{row.marketValueEur !== undefined ? formatEur(row.marketValueEur) : '—'}</td>
        <td className={tone}>
          {row.unrealizedPnlEur !== undefined ? (
            <>
              {formatEur(row.unrealizedPnlEur)}
              {row.unrealizedPnlPct !== undefined && <span className="pnl-pct"> ({formatPct(row.unrealizedPnlPct)})</span>}
            </>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={6}>
            <PositionDetail symbol={row.symbol} />
          </td>
        </tr>
      )}
    </>
  )
}
