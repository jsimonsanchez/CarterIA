import { useId } from 'react'

/**
 * Explicación de una cifra, accesible también con el dedo.
 *
 * El atributo `title` de HTML solo aparece al dejar el ratón encima, así que
 * en una pantalla táctil no se ve nunca. Esto usa el popover nativo del
 * navegador: se abre al pulsar, se cierra al tocar fuera y se dibuja en la
 * capa superior, de modo que no lo recorta ningún contenedor con scroll ni
 * hay que pelearse con z-index.
 *
 * El `title` de la tarjeta se mantiene aparte, así que en escritorio se
 * sigue viendo al pasar el ratón sin necesidad de pulsar nada.
 */
export function InfoPopover({ label, text }: { label: string; text: string }) {
  // useId puede incluir caracteres que no valen en un id de HTML; se limpian
  // porque `popoverTarget` empareja por id.
  const id = `info-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <>
      <button
        type="button"
        className="info-btn"
        popoverTarget={id}
        aria-label={`Qué significa: ${label}`}
        // Varias de estas cifras viven dentro de filas que se despliegan al
        // pulsarlas: sin esto, abrir la explicación desplegaría también la fila.
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
        </svg>
      </button>
      <div id={id} popover="auto" className="info-popover">
        <strong className="info-popover-title">{label}</strong>
        <span>{text}</span>
      </div>
    </>
  )
}
