/**
 * Traduce el valor bruto de la columna "Category" del extracto de XTB a una
 * etiqueta legible.
 *
 * Verificado contra un extracto real con las cuatro clases de instrumento:
 * "STOCK" (acciones), "ETF", "ETC" (materias primas físicas, p.ej. oro) y
 * "ETN" (p.ej. bitcoin) — coincide con las etiquetas que la propia app de
 * XTB muestra junto a cada valor. Un código que no esté aquí se muestra tal
 * cual en vez de forzarlo a una de estas categorías.
 */
const CATEGORY_LABELS: Record<string, string> = {
  STOCK: 'Acción',
  ETF: 'ETF',
  ETC: 'ETC',
  ETN: 'ETN',
}

/** Sin categoría es la posición todavía no importada con esta versión de la app, o un extracto sin la columna. */
export const SIN_CATEGORIA = 'Sin categoría'

export function categoryLabel(raw: string | undefined): string {
  if (!raw) return SIN_CATEGORIA
  return CATEGORY_LABELS[raw.toUpperCase()] ?? raw
}
