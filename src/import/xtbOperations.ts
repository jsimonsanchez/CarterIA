import type { OperationType } from '../domain/types'

export const TYPE_MAP: Record<string, OperationType> = {
  'Stock purchase': 'buy',
  'Stock sell': 'sell',
  Dividend: 'dividend',
  'Withholding tax': 'fee',
  'SEC fee': 'fee',
  'Stamp duty': 'fee',
  'Tax IFTT': 'fee',
  Correction: 'fee',
  'Free funds interest tax': 'fee',
  'Free funds interest': 'interest',
  Deposit: 'deposit',
  // Una retirada es un ingreso con el signo cambiado: se registra como tal para
  // que los ingresos netos, el XIRR y la liquidez la tengan en cuenta sin
  // ningún caso aparte (ver `signedAmount`).
  Withdrawal: 'deposit',
}

// Ejemplos vistos en extractos reales de XTB (compra y venta pueden venir
// como fill único o parcial, con o sin el denominador "/total", y —según la
// exportación— con el ticker delante de la cantidad):
//   "OPEN BUY 6 @ 529.71"
//   "OPEN BUY 1/21 @ 108.80"
//   "CLOSE BUY 40 @ 750.00"
//   "CLOSE BUY 15/25 @ 798.20"
//   "OPEN BUY RARE.DE 60 @ 41.625"
//
// El ticker es opcional y va antes de la cantidad. Se deja que el motor
// retroceda: en "OPEN BUY 6 @ 529.71" el grupo del ticker intentaría comerse
// el "6", fallaría al buscar la cantidad que viene detrás y volvería a quedar
// vacío.
const TRADE_COMMENT_RE = /(?:OPEN|CLOSE) BUY\s+(?:\S+\s+)?([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i

/** Cantidad y precio unitario que XTB escribe en el comentario de una compra o venta. */
export function parseTradeComment(comment: string): { quantity: number; unitPrice: number } | undefined {
  const match = comment.match(TRADE_COMMENT_RE)
  if (!match) return undefined
  const quantity = Number(match[1])
  const unitPrice = Number(match[2])
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return undefined
  return { quantity, unitPrice }
}

/**
 * Importe del movimiento con el signo que le corresponde por su tipo.
 *
 * Una retirada sale como salida de dinero aunque el extracto la traiga con
 * signo positivo en alguna exportación: si no, restaría de la liquidez al
 * revés y los ingresos netos subirían en vez de bajar.
 */
export function signedAmount(rawType: string, amount: number): number {
  return rawType === 'Withdrawal' ? -Math.abs(amount) : amount
}
