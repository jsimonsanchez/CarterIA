import { useEffect, useId, useRef, useState } from 'react'

/**
 * Explicación de una cifra, accesible también con el dedo.
 *
 * El atributo `title` de HTML solo aparece al dejar el ratón encima, así que
 * en una pantalla táctil no se ve nunca. Aquí se usa el popover nativo del
 * navegador, que se dibuja en la capa superior: no lo recorta ningún
 * contenedor con scroll ni hay que pelearse con z-index.
 *
 * Va en modo `manual` y no con `popovertarget` a propósito. Con el cierre
 * automático del navegador (`auto`), en táctil el mismo gesto sobre el icono
 * dispara dos cosas: el cierre por "has tocado fuera" y, acto seguido, la
 * apertura del botón — con lo que el panel se reabre solo y parece que no se
 * puede cerrar. En modo manual abrimos y cerramos nosotros, así que el
 * comportamiento no depende de en qué orden resuelva cada navegador esos
 * eventos.
 */
export function InfoPopover({ label, text }: { label: string; text: string }) {
  // useId puede incluir caracteres que no valen en un id de HTML.
  const id = `info-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    // El cierre al tocar fuera lo implementamos aquí, ya que el modo manual
    // no lo trae. Se excluye el propio botón para que su pulsación la trate
    // solo el onClick, sin cerrar y reabrir en el mismo gesto.
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="info-btn"
        aria-label={`Qué significa: ${label}`}
        aria-expanded={open}
        // Varias de estas cifras viven dentro de filas que se despliegan al
        // pulsarlas: sin esto, abrir la explicación desplegaría también la fila.
        onClick={(e) => {
          e.stopPropagation()
          popoverRef.current?.togglePopover()
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
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
          <strong className="info-popover-title">{label}</strong>
          <button
            type="button"
            className="info-close"
            aria-label="Cerrar"
            onClick={(e) => {
              e.stopPropagation()
              popoverRef.current?.hidePopover()
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <span>{text}</span>
      </div>
    </>
  )
}
