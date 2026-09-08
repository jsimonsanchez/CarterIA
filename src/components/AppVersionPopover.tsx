import { useEffect, useId, useRef, useState } from 'react'

/**
 * El logo de la cabecera, ahora también botón: tocarlo enseña qué versión
 * de la app tienes delante. Mismo popover nativo en modo manual que
 * `InfoPopover`, por el mismo motivo — el `title` de HTML no se ve en
 * táctil, así que en la app instalada (PWA) tocar el logo no habría hecho
 * nada.
 *
 * `__APP_VERSION__` sale de git al compilar — ver `readAppVersion` en
 * vite.config.ts. `build` es lo único que hace falta leer para saber si dos
 * pantallas llevan la misma versión; el hash es para localizar el commit
 * exacto en GitHub si hace falta.
 */
export function AppVersionPopover() {
  const id = `version-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      popoverRef.current?.hidePopover()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') popoverRef.current?.hidePopover()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const commitDateLabel = __APP_VERSION__.commitDate
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(__APP_VERSION__.commitDate),
      )
    : undefined

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="app-logo-btn"
        aria-label={`Versión de la app: v${__APP_VERSION__.build}`}
        aria-expanded={open}
        onClick={() => popoverRef.current?.togglePopover()}
      >
        <svg className="app-logo" width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="app-logo-gradient" x1="2" y1="24" x2="28" y2="6" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--positive)" />
            </linearGradient>
          </defs>
          <rect x="3" y="16" width="6" height="11" rx="2" fill="url(#app-logo-gradient)" />
          <rect x="12" y="9" width="6" height="18" rx="2" fill="url(#app-logo-gradient)" />
          <rect x="21" y="2" width="6" height="25" rx="2" fill="url(#app-logo-gradient)" />
        </svg>
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="manual"
        className="info-popover"
        onToggle={(e) => setOpen((e as unknown as { newState: string }).newState === 'open')}
      >
        <div className="info-popover-head">
          <strong className="info-popover-title">Versión de la app</strong>
          <button
            type="button"
            className="info-close"
            aria-label="Cerrar"
            onClick={() => popoverRef.current?.hidePopover()}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <span>
          v{__APP_VERSION__.build} · <code className="version-sha">{__APP_VERSION__.sha}</code>
          {commitDateLabel && (
            <>
              <br />
              Último cambio: {commitDateLabel}
            </>
          )}
        </span>
        {__APP_VERSION__.sha !== 'dev' && (
          <a
            className="version-popover-link"
            href={`https://github.com/jsimonsanchez/CarterIA/commit/${__APP_VERSION__.sha}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver commit en GitHub ↗
          </a>
        )}
      </div>
    </>
  )
}
