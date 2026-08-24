import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatEur } from '../utils/format'

export function ReportsPanel() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  if (!transactions) return null

  const dividends = sumByType(transactions, 'dividend')
  const fees = sumByType(transactions, 'fee')
  const interest = sumByType(transactions, 'interest')
  const deposits = sumByType(transactions, 'deposit')

  return (
    <section className="panel">
      <h2>Informe de caja (histórico completo)</h2>
      <dl className="report-list">
        <div>
          <dt>Dividendos cobrados</dt>
          <dd className="positive">{formatEur(dividends)}</dd>
        </div>
        <div>
          <dt>Comisiones e impuestos</dt>
          <dd className="negative">{formatEur(fees)}</dd>
        </div>
        <div>
          <dt>Intereses de efectivo</dt>
          <dd className="positive">{formatEur(interest)}</dd>
        </div>
        <div>
          <dt>Ingresos de efectivo</dt>
          <dd>{formatEur(deposits)}</dd>
        </div>
      </dl>
    </section>
  )
}

function sumByType(transactions: { type: string; total: number }[], type: string): number {
  return transactions.filter((t) => t.type === type).reduce((acc, t) => acc + t.total, 0)
}
