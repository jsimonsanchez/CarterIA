import { createContext, useContext } from 'react'
import type { ClosedTrade, Transaction } from '../domain/types'

/**
 * Movimientos y operaciones cerradas, leídos una sola vez para toda la app
 * (ver `PortfolioDataProvider`). `undefined` mientras la consulta no ha
 * respondido: así quien los usa distingue "aún no ha llegado" de "no hay".
 */
export interface PortfolioData {
  transactions: Transaction[] | undefined
  closedTrades: ClosedTrade[] | undefined
}

export const PortfolioDataContext = createContext<PortfolioData>({
  transactions: undefined,
  closedTrades: undefined,
})

export function useTransactions(): Transaction[] | undefined {
  return useContext(PortfolioDataContext).transactions
}

export function useClosedTrades(): ClosedTrade[] | undefined {
  return useContext(PortfolioDataContext).closedTrades
}
