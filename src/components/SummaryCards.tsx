import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { totalReturn } from '../domain/performance'
import { netDividends } from '../domain/realized'
import { isPriceStale } from '../domain/priceFreshness'
import { summaryAvailability } from '../domain/summaryAvailability'
import { modifiedDietzAnnualized, xirr } from '../domain/xirr'
import type { ClosedTrade, Transaction } from '../domain/types'
import type { PortfolioRow } from '../hooks/usePortfolioRows'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatEur, formatPct, formatSignedEur } from '../utils/format'
import { InfoPopover } from './InfoPopover'

// Constantes a nivel de módulo, no literales `[]` en el cuerpo del
// componente: un literal crea un array nuevo en cada render mientras la
// consulta a Dexie está resolviéndose, lo que rompería la memoización del
// XIRR de más abajo (su dependencia cambiaría siempre).
const NO_TRADES: ClosedTrade[] = []
const NO_TRANSACTIONS: Transaction[] = []

/** Lo que se enseña en lugar de una cifra que todavía no se puede calcular. */
const PENDING = '—'

export function SummaryCards({ rows, isLoading }: { rows: PortfolioRow[]; isLoading: boolean }) {
  const { hidden } = usePrivacy()
  const closedTradesQuery = useLiveQuery(() => db.closedTrades.toArray(), [])
  const transactionsQuery = useLiveQuery(() => db.transactions.toArray(), [])
  const closedTrades = closedTradesQuery ?? NO_TRADES
  const transactions = transactionsQuery ?? NO_TRANSACTIONS

  // Cada transacción ya trae su importe neto en EUR (ingresos +, compras −,
  // ventas +, dividendos +, intereses +, comisiones −), así que sumar todo
  // el histórico da directamente la liquidez disponible sin invertir.
  const cashBalance = sum(transactions, (t) => t.total)

  const costBasis = sum(rows, (r) => r.costBasis)
  const withPrice = rows.filter((r) => r.marketValueEur !== undefined)
  const marketValue = sum(withPrice, (r) => r.marketValueEur ?? 0)
  const unrealizedPnl = sum(withPrice, (r) => r.unrealizedPnlEur ?? 0)
  const missingPrices = rows.length - withPrice.length

  // El % se calcula solo sobre el coste de las posiciones QUE TIENEN precio,
  // no sobre el de todas: la ganancia del numerador tampoco incluye a las
  // que no lo tienen, así que mezclarlas metía su coste en el divisor sin su
  // ganancia en el dividendo y el porcentaje salía más bajo de lo real.
  const pricedCostBasis = sum(withPrice, (r) => r.costBasis)
  const unrealizedPct = pricedCostBasis > 0 ? (unrealizedPnl / pricedCostBasis) * 100 : undefined
  const stalePrices = withPrice.filter((r) => isPriceStale(r.priceFetchedAt)).length

  // Cada % se calcula sobre SU propia base de coste, no sobre una común: la
  // plusvalía realizada procede de operaciones ya cerradas, cuyo coste
  // (purchaseValueEur) no tiene relación con lo que hay invertido hoy.
  // Dividirla entre el coste de las posiciones abiertas daba un porcentaje
  // arbitrario — cuantas menos posiciones abiertas, más inflado — y además
  // no coincidía con el que muestra la pestaña "Posiciones cerradas".
  // Los dividendos cobrados entran aquí, netos de su retención: son dinero
  // que ya está en la cuenta, igual que la ganancia de una venta. Cuentan
  // aunque el valor siga en cartera — lo latente es la revalorización del
  // precio, no un dividendo ya pagado.
  const dividends = netDividends(transactions)
  const realizedPnl = sum(closedTrades, (t) => t.realizedPnlEur) + dividends
  const realizedCostBasis = sum(closedTrades, (t) => t.purchaseValueEur)
  const realizedPct = realizedCostBasis > 0 ? (realizedPnl / realizedCostBasis) * 100 : undefined

  // Rendimiento de todo el dinero aportado al bróker: ingresas 100.000 € y
  // hoy tienes 200.000 € entre posiciones y liquidez → 100%. No se suman
  // los conceptos por separado (plusvalías + dividendos + intereses...)
  // porque el valor de la cartera ya los recoge todos: lo que no está
  // invertido está en caja.
  const totalDeposits = sum(
    transactions.filter((t) => t.type === 'deposit'),
    (t) => t.total,
  )
  const portfolioValue = marketValue + cashBalance
  const { gain: total, pct: totalPct } = totalReturn(portfolioValue, totalDeposits)

  // XIRR: rentabilidad anualizada ponderada por dinero. Flujos = cada
  // ingreso (negativo, sale del bolsillo del inversor) + el valor actual de
  // todo hoy (positivo, como si se liquidara la cartera). Compras, ventas,
  // dividendos e intereses no son flujos aparte — ya están recogidos en el
  // valor final. No es TWR (necesitaría un histórico diario de valoración
  // que todavía no se guarda).
  //
  // Va en useMemo porque es iterativo (Newton-Raphson, con bisección de
  // respaldo) y este componente se re-renderiza con cada cambio en Dexie:
  // sin memoizar se recalculaba entero en cada render, y el console.warn del
  // respaldo se repetía indefinidamente en consola.
  const { xirrPct, usedFallback } = useMemo(() => {
    const depositFlows = transactions
      .filter((t) => t.type === 'deposit')
      .map((t) => ({ date: new Date(t.date), amount: -t.total }))
    if (depositFlows.length === 0) return { xirrPct: undefined, usedFallback: false }

    const allFlows = [...depositFlows, { date: new Date(), amount: marketValue + cashBalance }]
    // xirr() puede no converger con ciertos conjuntos de flujos (aportaciones
    // muy concentradas, correcciones con importe negativo, etc.) — si falla,
    // el método Dietz modificado (fórmula cerrada, no puede fallar por no
    // converger) sirve de respaldo para que la cifra no desaparezca sin más.
    const xirrRate = xirr(allFlows)
    const fallback = xirrRate === undefined
    if (fallback) {
      console.warn('XIRR no convergió, usando Dietz modificado como respaldo. Flujos:', allFlows)
    }
    const rate = xirrRate ?? modifiedDietzAnnualized(allFlows)
    return { xirrPct: rate !== undefined ? rate * 100 : undefined, usedFallback: fallback }
  }, [transactions, marketValue, cashBalance])

  const available = summaryAvailability({
    isLoading,
    transactionsLoaded: transactionsQuery !== undefined,
    tradesLoaded: closedTradesQuery !== undefined,
    positions: rows.length,
    priced: withPrice.length,
  })

  // Mientras se carga, "N sin precio" sería falso: los precios no han tenido
  // ocasión de llegar. Solo se avisa cuando ya se ha mirado y de verdad faltan.
  const priceHint = isLoading ? undefined : buildPriceHint(missingPrices, stalePrices)
  const missingPricesReason =
    missingPrices > 0
      ? `Faltan los precios de ${plural(missingPrices, 'posición', 'posiciones')}: pulsa "Actualizar precios". ` +
        'Con ellas valoradas a cero la cifra saldría falsa, así que no se calcula.'
      : 'Se calculará en cuanto estén cargados los precios de todas las posiciones.'

  return (
    <section className="panel summary-panel">
      <div className="summary-grid">
        <div className="summary-stat">
          <span className="card-label">Valor Total</span>
          <div className="summary-stat-body">
            <span className="card-value">{available.valuation ? formatEur(portfolioValue, hidden) : PENDING}</span>
            <span className="card-sub">
              Posiciones {available.valuation || available.unrealized ? formatEur(marketValue, hidden) : PENDING}
            </span>
            <span className="card-sub">Liquidez {available.liquidity ? formatEur(cashBalance, hidden) : PENDING}</span>
            {priceHint && <span className="card-hint">{priceHint}</span>}
          </div>
        </div>
        <Stat
          label="Coste de la cartera"
          value={available.cost ? formatEur(costBasis, hidden) : PENDING}
          sub={available.cost ? `Posiciones abiertas ${rows.length}` : undefined}
        />
        <Stat
          label="Plusvalía Latente"
          value={available.unrealized ? formatSignedEur(unrealizedPnl, hidden) : PENDING}
          sub={available.unrealized && unrealizedPct !== undefined ? formatPct(unrealizedPct) : undefined}
          tone={available.unrealized ? (unrealizedPnl >= 0 ? 'positive' : 'negative') : undefined}
          title={
            available.unrealized
              ? `Lo que aún no has vendido: ${plural(withPrice.length, 'posición', 'posiciones')}, ` +
                `de ${formatEur(pricedCostBasis, hidden)} de coste a ${formatEur(marketValue, hidden)} de valor actual.` +
                (missingPrices > 0
                  ? ` Queda fuera ${plural(missingPrices, 'posición', 'posiciones')} sin precio` +
                    ` (${formatEur(costBasis - pricedCostBasis, hidden)} de coste).`
                  : '')
              : missingPricesReason
          }
        />
        <Stat
          label="Plusvalía"
          value={available.realized ? formatSignedEur(realizedPnl, hidden) : PENDING}
          sub={available.realized && realizedPct !== undefined ? formatPct(realizedPct) : undefined}
          tone={available.realized ? (realizedPnl >= 0 ? 'positive' : 'negative') : undefined}
          title={
            available.realized
              ? `Lo que ya has cobrado: ${plural(closedTrades.length, 'operación cerrada', 'operaciones cerradas')} ` +
                `de ${formatEur(realizedCostBasis, hidden)} de coste, más ${formatEur(dividends, hidden)} de dividendos ` +
                'netos de retención — incluidos los de valores que sigues teniendo, que por eso no salen en la pestaña ' +
                'de posiciones cerradas. El porcentaje va sobre el coste de lo vendido.'
              : 'Se calculará en cuanto estén cargados los movimientos.'
          }
        />
        <Stat
          label="Total"
          value={available.valuation ? formatSignedEur(total, hidden) : PENDING}
          sub={available.valuation && totalPct !== undefined ? formatPct(totalPct) : undefined}
          tone={available.valuation ? (total >= 0 ? 'positive' : 'negative') : undefined}
          // Lo que la etiqueta ya no dice (que incluye dividendos e
          // intereses) pasa a la explicación, para no ocupar dos líneas.
          title={
            available.valuation
              ? `Rendimiento de todo lo aportado, con dividendos e intereses incluidos: ` +
                `${formatEur(portfolioValue, hidden)} de valor actual frente a ${formatEur(totalDeposits, hidden)} de ingresos de efectivo.`
              : missingPricesReason
          }
        />
        {/* Sin los precios de toda la cartera el XIRR sería el de una cartera
            que vale cero: se oculta del todo en vez de enseñar un -70 %. */}
        {available.valuation && xirrPct !== undefined && (
          <Stat
            label={usedFallback ? 'XIRR (aprox.)' : 'XIRR'}
            value={formatPct(xirrPct)}
            tone={xirrPct >= 0 ? 'positive' : 'negative'}
            title={
              usedFallback
                ? 'Rentabilidad anualizada ponderada por dinero (aproximación, método Dietz modificado — el cálculo exacto XIRR no convergió con estos flujos).'
                : 'Rentabilidad anualizada ponderada por dinero (XIRR): tiene en cuenta cuándo entró cada ingreso, no solo cuánto.'
            }
          />
        )}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
  title,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative'
  title?: string
}) {
  return (
    <div className="summary-stat" title={title}>
      <span className="card-label">
        {label}
        {title && <InfoPopover label={label} text={title} />}
      </span>
      <div className="summary-stat-body">
        <span className={`card-value ${tone ?? ''}`}>{value}</span>
        {sub && <span className={`card-sub ${tone ?? ''}`}>{sub}</span>}
      </div>
    </div>
  )
}

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0)
}

function buildPriceHint(missing: number, stale: number): string | undefined {
  const parts: string[] = []
  if (missing > 0) parts.push(`${missing} sin precio`)
  if (stale > 0) parts.push(`${stale} desactualizado${stale > 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
