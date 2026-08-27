import { useState } from 'react'
import { isPriceStale } from '../domain/priceFreshness'
import { useLogos } from '../hooks/useLogos'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatNativePrice, formatPct, priceDecimalsFor } from '../utils/format'
import { InfoPopover } from './InfoPopover'
import { PositionDetail } from './PositionDetail'
import { SymbolLogo } from './SymbolLogo'

type SortKey = 'symbol' | 'quantity' | 'averageCost' | 'price' | 'value' | 'pnl' | 'pnlPct'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'symbol', label: 'Símbolo' },
  { key: 'quantity', label: 'Cantidad', num: true },
  { key: 'averageCost', label: 'Coste medio', num: true },
  { key: 'price', label: 'Precio actual', num: true },
  { key: 'value', label: 'Valor', num: true },
  { key: 'pnl', label: 'Plusvalía', num: true },
  { key: 'pnlPct', label: '% Plusvalía', num: true },
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

interface PositionsTableProps {
  rows: PortfolioRow[]
  onRefresh: () => void
  refreshing: boolean
  refreshError: string | null
}

export function PositionsTable({ rows, onRefresh, refreshing, refreshError }: PositionsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [query, setQuery] = useState('')
  // Antes del early return: los hooks no pueden llamarse condicionalmente.
  const logos = useLogos(rows.map((r) => r.symbol))

  if (rows.length === 0) {
    return <p className="empty-state">Sin posiciones — importa un extracto de XTB para empezar.</p>
  }

  // Los mismos decimales para toda la columna, calculados sobre TODAS las
  // posiciones y no solo sobre las filtradas: así buscar no cambia el formato
  // de las filas que siguen a la vista.
  const priceDecimals = priceDecimalsFor(
    rows
      .filter((r) => r.currentPriceNative !== undefined && r.currentCurrency !== undefined)
      .map((r) => ({ price: r.currentPriceNative!, currency: r.currentCurrency! })),
  )

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? rows.filter(
        (r) => r.symbol.toLowerCase().includes(normalizedQuery) || r.name?.toLowerCase().includes(normalizedQuery),
      )
    : rows

  const sorted = [...filtered].sort((a, b) => {
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
    <div>
      <div className="table-toolbar">
        <input
          className="table-search"
          type="search"
          placeholder="Buscar por símbolo o nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button button-sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Actualizando…' : 'Actualizar precios'}
        </button>
      </div>
      {refreshError && <p className="warning-text">{refreshError}</p>}
      <div className="positions-table-wrapper scroll-thin">
        <table className="positions-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`sortable-th ${col.num ? 'num' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  Sin resultados para "{query}".
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <PositionRow
                  key={row.symbol}
                  row={row}
                  logo={logos[row.symbol]}
                  priceDecimals={priceDecimals}
                  expanded={expanded === row.symbol}
                  onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PositionRow({
  row,
  logo,
  priceDecimals,
  expanded,
  onToggle,
}: {
  row: PortfolioRow
  logo?: string | null
  priceDecimals: number
  expanded: boolean
  onToggle: () => void
}) {
  const tone = (row.unrealizedPnlEur ?? 0) >= 0 ? 'positive' : 'negative'
  const isStale = isPriceStale(row.priceFetchedAt)

  return (
    <>
      <tr className="position-row" onClick={onToggle}>
        <td>
          <div className="symbol-cell">
            <span className="symbol-ticker">
              <strong>{row.symbol}</strong>
              {logo && <SymbolLogo url={logo} size={16} className="symbol-logo" />}
            </span>
            {row.name && (
              <span className="symbol-name" title={row.name}>
                {row.name}
              </span>
            )}
          </div>
        </td>
        <td className="num">{row.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}</td>
        <td className="num">{formatEur(row.averageCost)}</td>
        <td className="num">
          {row.priceError ? (
            <span className="error-text" title={row.priceError}>
              error
            </span>
          ) : row.currentPriceNative !== undefined ? (
            <>
              {formatNativePrice(row.currentPriceNative, row.currentCurrency!, priceDecimals)}
              {isStale && (
                <span
                  className="stale-badge"
                  title={`Precio de ${new Date(row.priceFetchedAt!).toLocaleString('es-ES')} — desactualizado`}
                >
                  ⏱
                  <InfoPopover
                    label="Precio desactualizado"
                    text={`La última cotización recibida es del ${new Date(row.priceFetchedAt!).toLocaleString('es-ES')}. Pulsa "Actualizar precios" para volver a consultarla.`}
                  />
                </span>
              )}
            </>
          ) : (
            <span className="card-hint">sin precio</span>
          )}
        </td>
        <td className="num">{row.marketValueEur !== undefined ? formatEur(row.marketValueEur) : '—'}</td>
        <td className={`num ${tone}`}>{row.unrealizedPnlEur !== undefined ? formatEur(row.unrealizedPnlEur) : '—'}</td>
        <td className={`num ${tone}`}>{row.unrealizedPnlPct !== undefined ? formatPct(row.unrealizedPnlPct) : '—'}</td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={7}>
            <PositionDetail symbol={row.symbol} marketValueEur={row.marketValueEur} />
          </td>
        </tr>
      )}
    </>
  )
}
