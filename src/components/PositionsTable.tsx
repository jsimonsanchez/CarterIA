import { useState } from 'react'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatPct } from '../utils/format'
import { PositionDetail } from './PositionDetail'

type SortKey = 'symbol' | 'quantity' | 'averageCost' | 'price' | 'value' | 'pnl' | 'pnlPct'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'symbol', label: 'Símbolo' },
  { key: 'quantity', label: 'Cantidad' },
  { key: 'averageCost', label: 'Coste medio' },
  { key: 'price', label: 'Precio actual' },
  { key: 'value', label: 'Valor' },
  { key: 'pnl', label: 'Plusvalía' },
  { key: 'pnlPct', label: '% Plusvalía' },
]

function sortValue(row: PortfolioRow, key: SortKey): number | string {
  switch (key) {
    case 'symbol':
      return row.symbol
    case 'quantity':
      return row.quantity
    case 'averageCost':
      return row.averageCost
    case 'price':
      return row.currentPriceNative ?? -Infinity
    case 'value':
      return row.marketValueEur ?? -Infinity
    case 'pnl':
      return row.unrealizedPnlEur ?? -Infinity
    case 'pnlPct':
      return row.unrealizedPnlPct ?? -Infinity
  }
}

export function PositionsTable({ rows }: { rows: PortfolioRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (rows.length === 0) {
    return <p className="empty-state">Sin posiciones — importa un extracto de XTB para empezar.</p>
  }

  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="positions-table-wrapper">
      <table className="positions-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="sortable-th" onClick={() => handleSort(col.key)}>
                {col.label}
                {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
              </th>
            ))}
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
    </div>
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
        <td className={tone}>{row.unrealizedPnlEur !== undefined ? formatEur(row.unrealizedPnlEur) : '—'}</td>
        <td className={tone}>{row.unrealizedPnlPct !== undefined ? formatPct(row.unrealizedPnlPct) : '—'}</td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={7}>
            <PositionDetail symbol={row.symbol} />
          </td>
        </tr>
      )}
    </>
  )
}
