/** Hash estable (SHA-256 hex) de los campos crudos de una línea del CSV, usado como id de la transacción para deduplicar reimportaciones. */
export async function hashTransactionLine(fields: string[]): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(fields.join('|'))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
