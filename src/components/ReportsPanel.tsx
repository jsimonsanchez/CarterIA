import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { isTaxFee } from '../domain/fees'
import { formatEur } from '../utils/format'

export function ReportsPanel() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  if (!transactions) return null

  const dividends = sumByType(transactions, 'dividend')
  const interest = sumByType(transactions, 'interest')
  const deposits = sumByType(transactions, 'deposit')

  const feeTransactions = transactions.filter((t) => t.type === 'fee')
  const taxes = sumAmount(feeTransactions.filter((t) => isTaxFee(t.rawDescription)))
  const commissions = sumAmount(feeTransactions.filter((t) => !isTaxFee(t.rawDescription)))

  return (
    <section className="panel">
      <h2>Informe de caja (histórico completo)</h2>
      <dl className="report-list">
        <div>
          <dt>Dividendos cobrados</dt>
          <dd className="positive">{formatEur(dividends)}</dd>
        </div>
        <div>
          <dt>Comisiones</dt>
          <dd className="negative">{formatEur(commissions)}</dd>
        </div>
        <div>
          <dt>Impuestos</dt>
          <dd className="negative">{formatEur(taxes)}</dd>
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
  return sumAmount(transactions.filter((t) => t.type === type))
}

function sumAmount(transactions: { total: number }[]): number {
  return transactions.reduce((acc, t) => acc + t.total, 0)
}
