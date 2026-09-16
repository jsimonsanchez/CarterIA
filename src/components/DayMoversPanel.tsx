import { useEffect, useId, useRef, useState } from 'react'
import { useLogos } from '../hooks/useLogos'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatEur, formatNativePrice, formatPct } from '../utils/format'
import { SymbolLogo } from './SymbolLogo'

const MAX_MOVERS = 6

export function DayMoversPanel({ rows }: { rows: PortfolioRow[] }) {
  const { hidden } = usePrivacy()
  const movers = rows
    .filter((r) => r.dayChangePct !== undefined)
    .sort((a, b) => Math.abs(b.dayChangePct!) - Math.abs(a.dayChangePct!))
    .slice(0, MAX_MOVERS)
    // El filtro anterior se queda con los de mayor volatilidad (a favor o
    // en contra); una vez elegidos, se muestran de más positivo a más
    // negativo, no por magnitud.
    .sort((a, b) => b.dayChangePct! - a.dayChangePct!)

  const logos = useLogos(movers.map((m) => m.symbol))

  if (movers.length === 0) return null

  // Variación de hoy de toda la cartera (no solo de los valores del ranking
  // de abajo): suma de las plusvalías del día de las posiciones con dato de
  // hoy, sobre el valor que tenían ayer (valor actual menos lo ganado/perdido
  // hoy) — así el % es el peso real de cada posición, no una media simple.
  const withDayChange = rows.filter((r) => r.dayChangeEur !== undefined && r.marketValueEur !== undefined)
  const totalDayChangeEur = withDayChange.reduce((acc, r) => acc + r.dayChangeEur!, 0)
  const totalPreviousValueEur = withDayChange.reduce((acc, r) => acc + (r.marketValueEur! - r.dayChangeEur!), 0)
  const totalDayChangePct = totalPreviousValueEur > 0 ? (totalDayChangeEur / totalPreviousValueEur) * 100 : undefined
  const totalUp = totalDayChangePct !== undefined && totalDayChangePct >= 0

  return (
    <section className="panel movers-panel">
      <div className="panel-header">
        <h2>Mayor volatilidad hoy</h2>
        {totalDayChangePct !== undefined && (
          <span className={`movers-total ${totalUp ? 'positive' : 'negative'}`}>
            {totalUp ? '📈' : '📉'} {formatPct(totalDayChangePct)} ({totalDayChangeEur > 0 ? '+' : ''}
            {formatEur(totalDayChangeEur, hidden)})
          </span>
        )}
      </div>
      <div className="movers-grid">
        {movers.map((row) => (
          <MoverCard key={row.symbol} row={row} logo={logos[row.symbol]} hidden={hidden} />
        ))}
      </div>
    </section>
  )
}

/**
 * `title` sigue enseñando el nombre completo al pasar el ratón, igual que
 * antes. Además, la tarjeta entera es un disparador de popover nativo (sin
 * icono): en táctil, donde `title` no se ve nunca, pulsarla muestra el mismo
 * nombre. Con ratón, pulsar también lo abre — no estorba porque el hover ya
 * lo enseña sin necesidad de click.
 */
function MoverCard({ row, logo, hidden }: { row: PortfolioRow; logo?: string | null; hidden: boolean }) {
  const up = (row.dayChangePct ?? 0) >= 0
  const id = `mover-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const cardRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    // Igual que InfoPopover: el propio disparador (aquí, la tarjeta entera)
    // se excluye del cierre por "fuera", para que lo gestione solo el click
    // que la abre/cierra — si no, el pointerdown de ese mismo gesto la
    // cerraría justo antes de que el click la abriera.
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target) || cardRef.current?.contains(target)) return
      popoverRef.current?.hidePopover()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') popoverRef.current?.hidePopover()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      ref={cardRef}
      className={`mover-card ${up ? 'mover-up' : 'mover-down'}`}
      title={row.name}
      onClick={() => row.name && popoverRef.current?.togglePopover()}
    >
      <div className="mover-top">
        <span className="mover-symbol-group">
          {logo && <SymbolLogo url={logo} size={18} className="mover-logo" />}
          <span className="mover-symbol">{row.symbol}</span>
        </span>
        <span className="mover-arrow">{up ? '▲' : '▼'}</span>
      </div>
      <span className="mover-pct">{formatPct(row.dayChangePct!)}</span>
      <div className="mover-bottom">
        <span className="mover-price">
          {row.currentPriceNative !== undefined &&
            row.currentCurrency !== undefined &&
            formatNativePrice(row.currentPriceNative, row.currentCurrency)}
        </span>
        {row.dayChangeEur !== undefined && (
          <span className="mover-eur">
            {row.dayChangeEur > 0 ? '+' : ''}
            {formatEur(row.dayChangeEur, hidden)}
          </span>
        )}
      </div>
      {row.name && (
        <div
          ref={popoverRef}
          id={id}
          popover="manual"
          className="info-popover"
          onClick={(e) => e.stopPropagation()}
          onToggle={(e) => setOpen((e as unknown as { newState: string }).newState === 'open')}
        >
          <div className="info-popover-head">
            <strong className="info-popover-title">{row.symbol}</strong>
            <button
              type="button"
              className="info-close"
              aria-label="Cerrar"
              onClick={(e) => {
                e.stopPropagation()
                popoverRef.current?.hidePopover()
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <span>{row.name}</span>
        </div>
      )}
    </div>
  )
}
