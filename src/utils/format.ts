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
 */
export function formatNativePrice(price: number, currency: string): string {
  const isPence = currency === 'GBp' || currency === 'GBX'
  const value = isPence ? price / 100 : price
  const displayCurrency = isPence ? 'GBP' : currency
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${displayCurrency}`
}
