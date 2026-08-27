export function formatEur(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))
}

/** Decimales por defecto de un importe monetario. */
const DEFAULT_PRICE_DECIMALS = 2
/**
 * Tope de decimales: más allá, la columna se ensancha sin aportar nada. Un
 * único valor con un decimal extra obligaría a toda la columna a llevarlo, y
 * el ancho que cuesta no compensa la precisión que aporta.
 */
export const MAX_PRICE_DECIMALS = 3

/**
 * Convierte un precio a la divisa en la que se muestra. Los proveedores
 * devuelven algunas plazas del Reino Unido en peniques ("GBp"/"GBX") en vez
 * de libras — sin normalizar, un precio parecería cien veces mayor de lo que
 * es al lado de los importes en euros. El cálculo interno (la conversión a
 * EUR) ya lo tenía en cuenta; esto es solo para presentarlo.
 */
function toDisplayPrice(price: number, currency: string): { value: number; currency: string } {
  const isPence = currency === 'GBp' || currency === 'GBX'
  return { value: isPence ? price / 100 : price, currency: isPence ? 'GBP' : currency }
}

/**
 * Formatea un precio en su divisa nativa, con un número EXACTO de decimales
 * (rellenando con ceros si hace falta) para que los importes de una misma
 * columna queden alineados por la coma.
 */
export function formatNativePrice(price: number, currency: string, decimals = DEFAULT_PRICE_DECIMALS): string {
  const display = toDisplayPrice(price, currency)
  const formatted = display.value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${formatted} ${display.currency}`
}

/**
 * Decimales que necesita un conjunto de precios para que ninguno pierda
 * precisión, entre el mínimo monetario habitual y `MAX_PRICE_DECIMALS`.
 *
 * Sirve para dar a toda una columna el mismo número de decimales: si un solo
 * valor cotiza a 0,0345 los lleva toda la columna, y si ninguno los necesita
 * se queda en dos, sin ensanchar la tabla de balde.
 */
export function priceDecimalsFor(prices: { price: number; currency: string }[]): number {
  let needed = DEFAULT_PRICE_DECIMALS
  for (const p of prices) {
    const { value } = toDisplayPrice(p.price, p.currency)
    needed = Math.max(needed, decimalsOf(value))
    if (needed >= MAX_PRICE_DECIMALS) return MAX_PRICE_DECIMALS
  }
  return needed
}

/** Decimales significativos de un número, hasta el tope. */
function decimalsOf(value: number): number {
  for (let d = 0; d < MAX_PRICE_DECIMALS; d++) {
    const scaled = value * 10 ** d
    // Tolerancia por el redondeo binario: 17.495 * 100 no da 1749.5 exacto.
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d
  }
  return MAX_PRICE_DECIMALS
}
