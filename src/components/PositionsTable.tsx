import { useEffect, useRef, useState } from 'react'
import { categoryLabel } from '../domain/instrumentCategory'
import { isPriceStale } from '../domain/priceFreshness'
import { useLogos } from '../hooks/useLogos'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatEur, formatNativePrice, formatPct, priceDecimalsFor } from '../utils/format'
import { InfoPopover } from './InfoPopover'
import { PositionDetail } from './PositionDetail'
import { SymbolLogo } from './SymbolLogo'

type SortKey = 'symbol' | 'quantity' | 'averageCost' | 'price' | 'dayChangePct' | 'value' | 'pnl' | 'pnlPct'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'symbol', label: 'Símbolo' },
  { key: 'quantity', label: 'Cantidad', num: true },
  { key: 'averageCost', label: 'Coste medio', num: true },
  { key: 'price', label: 'Precio actual', num: true },
  { key: 'dayChangePct', label: '% 24h', num: true },
  { key: 'value', label: 'Valor', num: true },
  { key: 'pnl', label: 'Plusvalía', num: true },
  { key: 'pnlPct', label: '% Plusvalía', num: true },
]

const COLUMN_BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]))
const DEFAULT_ORDER = COLUMNS.map((c) => c.key)
const COLUMN_ORDER_STORAGE_KEY = 'cartera-tracker:columns-order-v1'

/** Lee el orden de columnas guardado; si no hay nada o ya no coincide con las
 * columnas actuales (versión antigua), se usa el orden por defecto. */
function loadColumnOrder(): SortKey[] {
  try {
    const raw = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)
    if (!raw) return DEFAULT_ORDER
    const parsed = JSON.parse(raw) as unknown
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every((key) => parsed.includes(key))
    ) {
      return parsed as SortKey[]
    }
  } catch {
    // localStorage inaccesible o JSON corrupto: se ignora y se usa el orden por defecto.
  }
  return DEFAULT_ORDER
}

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
    case 'dayChangePct':
      return row.dayChangePct ?? -Infinity
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
  isLoading: boolean
  onRefresh: () => void
  refreshing: boolean
  refreshError: string | null
}

export function PositionsTable({ rows, isLoading, onRefresh, refreshing, refreshError }: PositionsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [query, setQuery] = useState('')
  const [columnOrder, setColumnOrder] = useState<SortKey[]>(loadColumnOrder)
  const [dragOverKey, setDragOverKey] = useState<SortKey | null>(null)
  // Ref y no estado: durante el arrastre no hace falta volver a renderizar,
  // solo saber qué columna se soltó al final.
  const draggedKeyRef = useRef<SortKey | null>(null)
  // Antes del early return: los hooks no pueden llamarse condicionalmente.
  const logos = useLogos(rows.map((r) => r.symbol))

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
    } catch {
      // Almacenamiento no disponible (privado, cuota agotada…): el orden
      // simplemente no persiste entre sesiones.
    }
  }, [columnOrder])

  if (rows.length === 0) {
    // Mientras se leen los datos no se puede afirmar que no haya posiciones:
    // decirlo sería anunciar una cartera vacía a quien sí tiene valores.
    return isLoading ? (
      <p className="empty-state">Cargando tu cartera…</p>
    ) : (
      <p className="empty-state">Sin posiciones — importa un extracto de XTB para empezar.</p>
    )
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

  function handleColumnDrop(targetKey: SortKey) {
    const draggedKey = draggedKeyRef.current
    if (!draggedKey || draggedKey === targetKey) return
    setColumnOrder((prev) => {
      const next = prev.filter((k) => k !== draggedKey)
      next.splice(next.indexOf(targetKey), 0, draggedKey)
      return next
    })
  }

  const orderedColumns = columnOrder.map((key) => COLUMN_BY_KEY.get(key)!)

  return (
    // Dos hijos exactamente —barra y contenido— porque la columna se acopla
    // a las filas del grid padre para que el gráfico de al lado empiece a la
    // altura de la tabla y no de la barra de búsqueda.
    <div className="positions-column">
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
      <div className="positions-column-content">
        {refreshError && <p className="warning-text">{refreshError}</p>}
        <div className="positions-table-wrapper scroll-thin">
        <table className="positions-table">
          <thead>
            <tr>
              {orderedColumns.map((col) => (
                <th
                  key={col.key}
                  className={`sortable-th ${col.num ? 'num' : ''} ${dragOverKey === col.key ? 'col-drag-over' : ''}`}
                  draggable
                  onClick={() => handleSort(col.key)}
                  onDragStart={(e) => {
                    draggedKeyRef.current = col.key
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverKey !== col.key) setDragOverKey(col.key)
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === col.key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleColumnDrop(col.key)
                    setDragOverKey(null)
                  }}
                  onDragEnd={() => {
                    draggedKeyRef.current = null
                    setDragOverKey(null)
                  }}
                  title="Arrastra para reordenar la columna"
                >
                  <span className="th-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  {col.label}
                  {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  Sin resultados para "{query}".
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <PositionRow
                  key={row.symbol}
                  row={row}
                  order={columnOrder}
                  logo={logos[row.symbol]}
                  priceDecimals={priceDecimals}
                  isLoading={isLoading}
                  expanded={expanded === row.symbol}
                  onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)}
                />
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PositionRow({
  row,
  order,
  logo,
  priceDecimals,
  isLoading,
  expanded,
  onToggle,
}: {
  row: PortfolioRow
  order: SortKey[]
  logo?: string | null
  priceDecimals: number
  isLoading: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { hidden } = usePrivacy()
  const tone = (row.unrealizedPnlEur ?? 0) >= 0 ? 'positive' : 'negative'
  // Aparte de `tone`: es la plusvalía sobre el coste, no la variación de
  // hoy, así que puede tener signo contrario un día que el precio baja pero
  // la posición sigue en verde desde que se compró.
  const dayTone = row.dayChangePct !== undefined ? (row.dayChangePct >= 0 ? 'positive' : 'negative') : ''
  const isStale = isPriceStale(row.priceFetchedAt)

  function renderCell(key: SortKey) {
    switch (key) {
      case 'symbol':
        return (
          <td key={key}>
            <div className="symbol-cell">
              <span className="symbol-ticker">
                <strong>{row.symbol}</strong>
                {logo && <SymbolLogo url={logo} size={16} className="symbol-logo" />}
                {/* Sin categoría cuando la posición se importó antes de esta
                    versión: se omite en vez de anunciar "Sin categoría" en
                    cada fila, hasta que se reimporte el extracto. */}
                {row.category && <span className="category-badge">{categoryLabel(row.category)}</span>}
              </span>
              {row.name && (
                <span className="symbol-name" title={row.name}>
                  {row.name}
                </span>
              )}
            </div>
          </td>
        )
      case 'quantity':
        return (
          <td key={key} className="num">
            {row.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 })}
          </td>
        )
      case 'averageCost':
        return (
          <td key={key} className="num">
            {formatEur(row.averageCost, hidden)}
          </td>
        )
      case 'price':
        return (
          <td key={key} className="num">
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
              // Aún convirtiendo divisas: no es que falte el precio, es que
              // todavía no está listo.
              <span className="card-hint">{isLoading ? '…' : 'sin precio'}</span>
            )}
          </td>
        )
      case 'dayChangePct':
        return (
          <td key={key} className={`num ${dayTone}`}>
            {row.dayChangePct !== undefined ? formatPct(row.dayChangePct) : '—'}
          </td>
        )
      case 'value':
        return (
          <td key={key} className="num">
            {row.marketValueEur !== undefined ? formatEur(row.marketValueEur, hidden) : '—'}
          </td>
        )
      case 'pnl':
        return (
          <td key={key} className={`num ${tone}`}>
            {row.unrealizedPnlEur !== undefined ? formatEur(row.unrealizedPnlEur, hidden) : '—'}
          </td>
        )
      case 'pnlPct':
        return (
          <td key={key} className={`num ${tone}`}>
            {row.unrealizedPnlPct !== undefined ? formatPct(row.unrealizedPnlPct) : '—'}
          </td>
        )
    }
  }

  return (
    <>
      <tr className="position-row" onClick={onToggle}>
        {order.map((key) => renderCell(key))}
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={8}>
            <PositionDetail symbol={row.symbol} marketValueEur={row.marketValueEur} />
          </td>
        </tr>
      )}
    </>
  )
}
