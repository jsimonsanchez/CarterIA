/**
 * Rendimiento total de la cartera: cuánto ha crecido TODO el dinero que se
 * ha metido en el broker. Si se ingresan 100.000 € y hoy entre posiciones y
 * liquidez hay 200.000 €, el rendimiento es del 100%.
 *
 * Se mide contra los ingresos de efectivo, no contra el coste de las
 * posiciones: el coste solo refleja lo que hay invertido en un momento
 * dado, mientras que los ingresos son lo que realmente ha salido del
 * bolsillo del inversor. Y como `portfolioValue` ya incluye la liquidez —y
 * la liquidez arrastra ventas, dividendos, intereses y comisiones— no hay
 * que sumar cada concepto por separado: lo que no está invertido está en
 * caja, así que nada se cuenta dos veces ni se queda fuera.
 *
 * `netDeposits` debe ser la suma de los ingresos de efectivo. Si el bróker
 * registra las retiradas como ingresos con importe negativo, la suma ya
 * queda neta por sí sola.
 */
export function totalReturn(
  portfolioValue: number,
  netDeposits: number,
): { gain: number; pct: number | undefined } {
  const gain = portfolioValue - netDeposits
  return {
    gain,
    pct: netDeposits > 0 ? (gain / netDeposits) * 100 : undefined,
  }
}
