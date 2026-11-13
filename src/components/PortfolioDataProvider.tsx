import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, type ReactNode } from 'react'
import { db } from '../db/db'
import { PortfolioDataContext } from '../hooks/portfolioData'

/**
 * Una única lectura reactiva de movimientos y operaciones cerradas. Antes cada
 * panel (resumen, informe de caja, gráfico por tipo, posiciones cerradas)
 * leía la tabla completa por su cuenta, y cualquier cambio en ella disparaba
 * cuatro lecturas en vez de una.
 */
export function PortfolioDataProvider({ children }: { children: ReactNode }) {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const closedTrades = useLiveQuery(() => db.closedTrades.toArray(), [])
  const value = useMemo(() => ({ transactions, closedTrades }), [transactions, closedTrades])

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>
}
