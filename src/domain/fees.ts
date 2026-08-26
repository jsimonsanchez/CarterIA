/**
 * Etiquetas de XTB que son un impuesto y no una comisión. El importador
 * mete todas estas operaciones bajo el tipo `fee` (ver TYPE_MAP en
 * `import/xtbImporter.ts`), que es suficiente para el cálculo de caja pero
 * no permite separarlas al informar.
 */
const TAX_LABELS = new Set([
  'Withholding tax', // retención en origen sobre dividendos
  'Stamp duty', // impuesto sobre transacciones (Reino Unido)
  'Tax IFTT', // impuesto sobre transacciones financieras
  'Free funds interest tax', // retención sobre los intereses del efectivo
])

/**
 * Distingue impuestos de comisiones a partir de la etiqueta original de
 * XTB, que el importador conserva al principio de `rawDescription`.
 *
 * Se clasifica por la etiqueta original en vez de por el tipo normalizado
 * porque ambos conceptos comparten el tipo `fee`: separarlos con tipos
 * distintos obligaría a reimportar el extracto para que los movimientos ya
 * guardados se reclasificaran.
 *
 * Lo que no esté en la lista cuenta como comisión: así una etiqueta nueva o
 * desconocida aparece en el informe en lugar de desaparecer sin dejar
 * rastro.
 */
export function isTaxFee(rawDescription: string): boolean {
  return TAX_LABELS.has(rawDescription.split(' — ')[0])
}
