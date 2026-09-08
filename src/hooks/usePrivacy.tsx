import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'cartera-tracker:hide-amounts'

interface PrivacyContextValue {
  /** En true, los importes en € se muestran ocultos en toda la app — los porcentajes y la composición de la cartera no. */
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined)

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Navegación privada o localStorage bloqueado: se arranca sin ocultar en
    // vez de romper la carga de la app por una preferencia que no es crítica.
    return false
  }
}

/**
 * Modo privacidad: pensado para enseñar la pantalla (compartir vídeo,
 * proyectar) sin revelar cuánto dinero hay detrás. Oculta las cifras en €
 * (`formatEur`) manteniendo visibles los porcentajes de rentabilidad y qué
 * valores componen la cartera, que es lo que de verdad se suele querer
 * mostrar.
 *
 * Se persiste en localStorage para que sobreviva a recargar la página — no
 * a un dispositivo nuevo ni a borrar datos del navegador, que es aceptable
 * para una preferencia de interfaz sin ningún dato sensible dentro.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(readInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
    } catch {
      // Sin almacenamiento disponible el toggle sigue funcionando en
      // memoria para esta sesión; solo se pierde al recargar.
    }
  }, [hidden])

  const toggle = useCallback(() => setHidden((h) => !h), [])

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) {
    throw new Error('usePrivacy debe usarse dentro de <PrivacyProvider>')
  }
  return ctx
}
