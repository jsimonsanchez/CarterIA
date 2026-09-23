import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { annualizedReturn } from '../domain/xirr'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatDate, formatEur, formatQuantity, formatPct } from '../utils/format'
import { InfoPopover } from './InfoPopover'

/** Nombre corto de cada bróker, igual que en la tabla de posiciones. */
const BROKER_LABELS: Record<string, string> = { xtb: 'XTB', ibkr: 'IBKR' }

const TYPE_LABELS: Record<string, string> = {
  buy: 'Compra',
  sell: 'Venta',
  dividend: 'Dividendo',
  fee: 'Comisión/impuesto',
  interest: 'Interés',
  deposit: 'Ingreso',
  other: 'Otro',
}

export function PositionDetail({ symbol, marketValueEur }: { symbol: string; marketValueEur?: number }) {
  const { hidden } = usePrivacy()
  const transactions = useLiveQuery(
    () => db.transactions.where('symbol').equals(symbol).sortBy('date'),
    [symbol],
  )

  if (!transactions) return null
  const ordered = [...transactions].reverse()

  // Cuántas participaciones pone cada bróker. Una posición puede venir de
  // los dos y en la tabla se ven sumadas, así que aquí es donde se puede
  // comprobar contra lo que dice cada plataforma.
  const quantityByBroker = new Map<string, number>()
  for (const tx of transactions) {
    const signo = tx.type === 'buy' ? 1 : tx.type === 'sell' ? -1 : 0
    if (signo === 0) continue
    quantityByBroker.set(tx.broker, (quantityByBroker.get(tx.broker) ?? 0) + signo * tx.quantity)
  }
  const brokers = [...quantityByBroker].filter(([, q]) => Math.abs(q) > 1e-9)

  const flows = transactions.map((t) => ({ date: new Date(t.date), amount: t.total }))
  if (marketValueEur !== undefined) {
    flows.push({ date: new Date(), amount: marketValueEur })
  }
  const annualizedPct = (() => {
    const rate = annualizedReturn(flows)
    return rate !== undefined ? rate * 100 : undefined
  })()

  return (
    <div className="position-detail">
      <div className="position-detail-header">
        <h4>Movimientos de {symbol}</h4>
        {annualizedPct !== undefined && (
          <span
            className={`annualized-badge ${annualizedPct >= 0 ? 'positive' : 'negative'}`}
            title="Rentabilidad anualizada de esta posición (tiene en cuenta cuándo se compró cada lote, dividendos incluidos)."
          >
            {formatPct(annualizedPct)} anualizado
            <InfoPopover
              label="Rentabilidad anualizada"
              text="Rentabilidad anualizada de esta posición: tiene en cuenta cuándo se compró cada lote, con los dividendos incluidos."
            />
          </span>
        )}
      </div>
      {brokers.length > 1 && (
        <p className="card-hint">
          {brokers.map(([broker, q]) => `${BROKER_LABELS[broker] ?? broker} ${formatQuantity(q, hidden)}`).join(' · ')}
        </p>
      )}
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Fecha</th>
            {brokers.length > 1 && <th>Bróker</th>}
            <th>Tipo</th>
            <th className="num">Cantidad</th>
            <th className="num">Precio</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((tx) => (
            <tr key={tx.id}>
              <td>{formatDate(tx.date)}</td>
              {brokers.length > 1 && <td>{BROKER_LABELS[tx.broker] ?? tx.broker}</td>}
              <td>{TYPE_LABELS[tx.type] ?? tx.type}</td>
              <td className="num">{tx.quantity > 0 ? formatQuantity(tx.quantity, hidden) : '—'}</td>
              <td className="num">{tx.price > 0 ? formatEur(tx.price, hidden) : '—'}</td>
              <td className={`num ${tx.total >= 0 ? 'positive' : 'negative'}`}>{formatEur(tx.total, hidden)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
