import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { annualizedReturn } from '../domain/xirr'
import { formatDate, formatEur, formatPct } from '../utils/format'
import { InfoPopover } from './InfoPopover'

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
  const transactions = useLiveQuery(
    () => db.transactions.where('symbol').equals(symbol).sortBy('date'),
    [symbol],
  )

  if (!transactions) return null
  const ordered = [...transactions].reverse()

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
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Fecha</th>
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
              <td>{TYPE_LABELS[tx.type] ?? tx.type}</td>
              <td className="num">{tx.quantity > 0 ? tx.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : '—'}</td>
              <td className="num">{tx.price > 0 ? formatEur(tx.price) : '—'}</td>
              <td className={`num ${tx.total >= 0 ? 'positive' : 'negative'}`}>{formatEur(tx.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
