import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { isTaxFee } from '../domain/fees'
import { usePrivacy } from '../hooks/usePrivacy'
import { formatEur } from '../utils/format'

export function ReportsPanel() {
  const { hidden } = usePrivacy()
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  if (!transactions || transactions.length === 0) return null

  const dividends = sumByType(transactions, 'dividend')
  const interest = sumByType(transactions, 'interest')
  const deposits = sumByType(transactions, 'deposit')

  const feeTransactions = transactions.filter((t) => t.type === 'fee')
  const taxes = sumAmount(feeTransactions.filter((t) => isTaxFee(t.rawDescription)))
  // XTB factura la comisión como un movimiento de caja aparte; IBKR la mete
  // dentro de la propia compra (campo `commission`). Se suman las dos formas
  // para que el informe no se deje fuera las de un bróker.
  const commissions =
    sumAmount(feeTransactions.filter((t) => !isTaxFee(t.rawDescription))) -
    transactions.reduce((acc, t) => acc + t.commission, 0)

  return (
    <section className="panel">
      <h2>Informe de caja (histórico completo)</h2>
      <dl className="report-list">
        <div>
          <dt>Dividendos cobrados</dt>
          <dd className={toneOf(dividends)}>{formatEur(dividends, hidden)}</dd>
        </div>
        <div>
          <dt>Comisiones</dt>
          <dd className={toneOf(commissions)}>{formatEur(commissions, hidden)}</dd>
        </div>
        <div>
          <dt>Impuestos</dt>
          <dd className={toneOf(taxes)}>{formatEur(taxes, hidden)}</dd>
        </div>
        <div>
          <dt>Intereses de efectivo</dt>
          <dd className={toneOf(interest)}>{formatEur(interest, hidden)}</dd>
        </div>
        <div>
          <dt>Ingresos de efectivo</dt>
          <dd>{formatEur(deposits, hidden)}</dd>
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

// Un 0,00 € en verde o en rojo sugiere un resultado que no existe.
function toneOf(amount: number): string | undefined {
  if (amount > 0) return 'positive'
  if (amount < 0) return 'negative'
  return undefined
}
