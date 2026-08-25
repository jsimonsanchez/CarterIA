import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur } from '../utils/format'

const MAX_MOVERS = 6

export function DayMoversPanel({ rows }: { rows: PortfolioRow[] }) {
  const movers = rows
    .filter((r) => r.dayChangePct !== undefined)
    .sort((a, b) => Math.abs(b.dayChangePct!) - Math.abs(a.dayChangePct!))
    .slice(0, MAX_MOVERS)

  if (movers.length === 0) return null

  return (
    <section className="panel movers-panel">
      <div className="panel-header">
        <h2>Mayor volatilidad hoy</h2>
        <span className="card-hint">vs. cierre de ayer</span>
      </div>
      <div className="movers-grid">
        {movers.map((row) => {
          const up = (row.dayChangePct ?? 0) >= 0
          return (
            <div key={row.symbol} className={`mover-card ${up ? 'mover-up' : 'mover-down'}`}>
              <div className="mover-top">
                <span className="mover-symbol">{row.symbol}</span>
                <span className="mover-arrow">{up ? '▲' : '▼'}</span>
              </div>
              <span className="mover-pct">
                {up ? '+' : ''}
                {row.dayChangePct!.toFixed(2)}%
              </span>
              <div className="mover-bottom">
                <span className="mover-price">
                  {row.currentPriceNative?.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {row.currentCurrency}
                </span>
                {row.dayChangeEur !== undefined && (
                  <span className="mover-eur">
                    {row.dayChangeEur >= 0 ? '+' : ''}
                    {formatEur(row.dayChangeEur)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
