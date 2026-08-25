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
