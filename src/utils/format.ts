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

/**
 * Formatea un precio en su divisa nativa para mostrar en pantalla. Los
 * proveedores de precios devuelven algunas plazas del Reino Unido en
 * peniques ("GBp"/"GBX") en vez de libras — sin normalizar, un precio como
 * "1749,5 GBp" parece disparatado al lado de valores en EUR, aunque el
 * cálculo interno (conversión a EUR) ya lo tiene en cuenta correctamente.
 *
 * `maxDecimals` sube a 4 en la tabla de posiciones: con solo 2 decimales, un
 * instrumento de precio bajo (un ETP a 0,0345 €) se mostraría como "0,03 €".
 */
export function formatNativePrice(price: number, currency: string, maxDecimals = 2): string {
  const isPence = currency === 'GBp' || currency === 'GBX'
  const value = isPence ? price / 100 : price
  const displayCurrency = isPence ? 'GBP' : currency
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: maxDecimals })} ${displayCurrency}`
}
