import { useEffect, useRef, useState } from 'react'
import { clearPortfolio, importXtbFile, type ImportSummary } from '../services/importPortfolio'

type ImportStatus = 'idle' | 'loading' | 'done' | 'error'

const FEEDBACK_TIMEOUT_MS = 60_000

/** Estado + lógica de importación, compartidos entre el botón (junto a las pestañas) y el panel de resultado (debajo). */
export function useXtbImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  // Borrado lanzado al confirmar el diálogo. La importación lo espera antes
  // de escribir: si no, un borrado todavía en curso podría llevarse por
  // delante los movimientos recién importados.
  const clearingRef = useRef<Promise<void>>(Promise.resolve())
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El resultado de una importación (o su error) es información puntual, no
  // algo que deba quedarse indefinidamente ocupando espacio en pantalla.
  useEffect(() => {
    if (status !== 'done' && status !== 'error') return
    const timer = setTimeout(() => setStatus('idle'), FEEDBACK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  /** Al pulsar "Importar extracto": pide confirmación antes de borrar nada. */
  function requestImport() {
    confirmRef.current?.showPopover()
  }

  function cancelImport() {
    confirmRef.current?.hidePopover()
  }

  /**
   * Confirmado: borra la cartera y abre el selector de fichero. El borrado
   * ocurre aunque luego no se elija ningún fichero — es lo que se acaba de
   * confirmar en el diálogo.
   *
   * El selector se abre sin esperar al borrado a propósito: los navegadores
   * solo dejan abrirlo dentro del mismo gesto del usuario, y un `await`
   * previo puede hacer que lo bloqueen (Safari sobre todo).
   */
  function confirmImport() {
    confirmRef.current?.hidePopover()
    clearingRef.current = clearPortfolio()
    setStatus('idle')
    inputRef.current?.click()
  }

  async function handleFile(file: File) {
    setStatus('loading')
    setError(null)
    try {
      await clearingRef.current
      const result = await importXtbFile(file)
      setSummary(result)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return { inputRef, confirmRef, status, summary, error, handleFile, requestImport, cancelImport, confirmImport }
}

type XtbImportState = ReturnType<typeof useXtbImport>

export function ImportButton({ state }: { state: XtbImportState }) {
  const { inputRef, confirmRef, status, handleFile, requestImport, cancelImport, confirmImport } = state
  const [open, setOpen] = useState(false)

  // Mismo patrón que InfoPopover: cerrar al tocar fuera o con Escape. El modo
  // manual no lo trae de serie.
  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (confirmRef.current?.contains(target)) return
      confirmRef.current?.hidePopover()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') confirmRef.current?.hidePopover()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, confirmRef])

  return (
    <>
      <button className="button button-sm" disabled={status === 'loading'} onClick={requestImport}>
        {status === 'loading' ? (
          'Importando…'
        ) : (
          <>
            Importar extracto<span className="import-btn-suffix"> de XTB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <div
        ref={confirmRef}
        popover="manual"
        className="info-popover"
        onToggle={(e) => setOpen((e as unknown as { newState: string }).newState === 'open')}
      >
        <div className="info-popover-head">
          <strong className="info-popover-title">Importar extracto</strong>
          <button type="button" className="info-close" aria-label="Cerrar" onClick={cancelImport}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <span>
          Se borrarán las posiciones, movimientos y operaciones cerradas actuales antes de importar el extracto
          nuevo. ¿Continuar?
        </span>
        <div className="confirm-actions">
          <button type="button" className="button button-sm button-ghost" onClick={cancelImport}>
            Cancelar
          </button>
          <button type="button" className="button button-sm" onClick={confirmImport}>
            Borrar e importar
          </button>
        </div>
      </div>
    </>
  )
}

export function ImportFeedback({ state }: { state: XtbImportState }) {
  const { status, summary, error } = state

  if (status !== 'error' && status !== 'done') return null

  return (
    <section className="panel import-feedback">
      {status === 'error' && <p className="error-text">{error}</p>}

      {status === 'done' && summary && (
        <>
          <p>
            {summary.imported} movimientos procesados, {summary.positions} posiciones abiertas,{' '}
            {summary.closedTrades} operaciones cerradas
            {summary.skippedRows.length > 0 && `, ${summary.skippedRows.length} filas omitidas`}.
          </p>
          {summary.warnings.length > 0 && (
            <details>
              <summary>{summary.warnings.length} avisos</summary>
              <ul>
                {summary.warnings.slice(0, 20).map((w) => (
                  <li key={w.rowId}>{w.message}</li>
                ))}
              </ul>
            </details>
          )}
          {summary.skippedRows.length > 0 && (
            <details>
              <summary>{summary.skippedRows.length} filas omitidas</summary>
              <ul>
                {summary.skippedRows.slice(0, 20).map((s) => (
                  <li key={s.row}>
                    Fila {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {summary.unresolvedSymbols.length > 0 && (
            <p className="warning-text">Sin mapeo de precio para: {summary.unresolvedSymbols.join(', ')}</p>
          )}
        </>
      )}
    </section>
  )
}
