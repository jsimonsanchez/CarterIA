import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDate, formatEur } from '../utils/format'

const TYPE_LABELS: Record<string, string> = {
  buy: 'Compra',
  sell: 'Venta',
  dividend: 'Dividendo',
  fee: 'Comisión/impuesto',
  interest: 'Interés',
  deposit: 'Ingreso',
  other: 'Otro',
}

export function PositionDetail({ symbol }: { symbol: string }) {
  const transactions = useLiveQuery(
    () => db.transactions.where('symbol').equals(symbol).sortBy('date'),
    [symbol],
  )

  if (!transactions) return null
  const ordered = [...transactions].reverse()

  return (
    <div className="position-detail">
      <h4>Movimientos de {symbol}</h4>
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Precio</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((tx) => (
            <tr key={tx.id}>
              <td>{formatDate(tx.date)}</td>
              <td>{TYPE_LABELS[tx.type] ?? tx.type}</td>
              <td>{tx.quantity > 0 ? tx.quantity.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : '—'}</td>
              <td>{tx.price > 0 ? formatEur(tx.price) : '—'}</td>
              <td>{formatEur(tx.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
