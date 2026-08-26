import { useLogos } from '../hooks/useLogos'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { formatEur, formatNativePrice } from '../utils/format'

const MAX_MOVERS = 6

export function DayMoversPanel({ rows }: { rows: PortfolioRow[] }) {
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
            {totalUp ? '📈' : '📉'} {totalUp ? '+' : ''}
            {totalDayChangePct.toFixed(2)}% ({totalDayChangeEur >= 0 ? '+' : ''}
            {formatEur(totalDayChangeEur)})
          </span>
        )}
      </div>
      <div className="movers-grid">
        {movers.map((row) => {
          const up = (row.dayChangePct ?? 0) >= 0
          const logo = logos[row.symbol]
          return (
            <div key={row.symbol} className={`mover-card ${up ? 'mover-up' : 'mover-down'}`} title={row.name}>
              <div className="mover-top">
                <span className="mover-symbol-group">
                  {logo && (
                    <img
                      src={logo}
                      alt=""
                      className="mover-logo"
                      width={18}
                      height={18}
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span className="mover-symbol">{row.symbol}</span>
                </span>
                <span className="mover-arrow">{up ? '▲' : '▼'}</span>
              </div>
              <span className="mover-pct">
                {up ? '+' : ''}
                {row.dayChangePct!.toFixed(2)}%
              </span>
              <div className="mover-bottom">
                <span className="mover-price">
                  {row.currentPriceNative !== undefined &&
                    row.currentCurrency !== undefined &&
                    formatNativePrice(row.currentPriceNative, row.currentCurrency)}
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
