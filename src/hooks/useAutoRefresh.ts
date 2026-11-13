import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { allMarketsClosed, CLOSED_MARKETS_INTERVAL_MS } from '../domain/marketHours'

/** ¿Estaban cerradas todas las bolsas de las posiciones actuales en la última consulta? */
async function portfolioMarketsClosed(): Promise<boolean> {
  const positions = await db.positions.toArray()
  const prices = await db.priceCache.bulkGet(positions.map((p) => p.symbol))
  return allMarketsClosed(prices)
}

const STORAGE_KEY = 'cartera-tracker:auto-refresh'
export const AUTO_REFRESH_INTERVAL_MS = 60_000

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Actualización automática de precios: con el interruptor activo, llama a
 * `refresh` al activarlo y después cada minuto. La preferencia se recuerda
 * entre sesiones.
 *
 * Reglas para no malgastar peticiones:
 * - No se solapa con una actualización en curso (manual o automática).
 * - Con la pestaña oculta no se actualiza: nadie está mirando los precios. Al
 *   volver a verla se refresca enseguida si ha pasado más de un intervalo.
 * - Si en la última consulta todas las bolsas de la cartera estaban cerradas
 *   (noches, fines de semana, festivos), se espacia a cada 15 minutos: los
 *   precios no cambian, pero hay que seguir mirando para notar la apertura.
 */
export function useAutoRefresh(refresh: () => void, refreshing: boolean) {
  const [enabled, setEnabled] = useState(readStored)

  // Siempre la última versión, sin reiniciar el temporizador en cada render:
  // `refresh` y `refreshing` cambian con cada actualización.
  const refreshRef = useRef(refresh)
  const refreshingRef = useRef(refreshing)
  const lastRunRef = useRef(0)
  useEffect(() => {
    refreshRef.current = refresh
    refreshingRef.current = refreshing
  })

  const run = useCallback(() => {
    // Los 2 s también frenan el doble disparo del modo estricto de React en
    // desarrollo, que monta el efecto dos veces seguidas.
    if (refreshingRef.current || Date.now() - lastRunRef.current < 2000) return
    lastRunRef.current = Date.now()
    refreshRef.current()
  }, [])

  useEffect(() => {
    if (!enabled) return

    run()
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void portfolioMarketsClosed().then((closed) => {
        if (closed && Date.now() - lastRunRef.current < CLOSED_MARKETS_INTERVAL_MS) return
        run()
      })
    }, AUTO_REFRESH_INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - lastRunRef.current >= AUTO_REFRESH_INTERVAL_MS) {
        run()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, run])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Sin almacenamiento la preferencia solo dura mientras la app esté abierta.
      }
      return next
    })
  }, [])

  return { enabled, toggle }
}
