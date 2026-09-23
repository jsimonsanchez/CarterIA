export const config = { runtime: 'edge' }

/**
 * Proxy same-origin para el tipo de cambio (frankfurter.app, API del BCE).
 * Igual que con Twelve Data/Yahoo en api/price.ts: frankfurter tampoco envía
 * cabeceras CORS, así que la petición no puede salir directamente desde el
 * navegador.
 */
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  // Con `date` (AAAA-MM-DD) se pide el tipo de ESE día en vez del último: hace
  // falta para valorar una entrega de acciones al cambio que había entonces,
  // no al de hoy. El BCE no publica fines de semana ni festivos; frankfurter
  // devuelve en ese caso el del día hábil anterior, que es justo lo que se
  // quiere.
  const date = url.searchParams.get('date')

  if (!from) {
    return Response.json({ error: 'Falta el parámetro from' }, { status: 400 })
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'El parámetro date debe ser AAAA-MM-DD' }, { status: 400 })
  }
  if (from.toUpperCase() === 'EUR') {
    return Response.json({ rate: 1 })
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/${date ?? 'latest'}?from=${encodeURIComponent(from)}&to=EUR`,
    )
    if (!res.ok) {
      return Response.json({ error: `frankfurter.app respondió ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const rate = data?.rates?.EUR
    if (typeof rate !== 'number') {
      return Response.json({ error: 'Respuesta de frankfurter.app inesperada' }, { status: 502 })
    }
    return Response.json({ rate })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
