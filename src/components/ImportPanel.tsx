import { useEffect, useRef, useState } from 'react'
import type { Broker } from '../domain/types'
import {
  clearBrokerData,
  importIbkrFiles,
  importJpmFile,
  importXtbFile,
  type ImportSummary,
} from '../services/importPortfolio'

type ImportStatus = 'idle' | 'loading' | 'done' | 'error'

const FEEDBACK_TIMEOUT_MS = 60_000

/**
 * Qué acepta el selector de fichero de cada bróker. IBKR admite varios
 * porque sus informes no pueden abarcar más de un año: el histórico
 * completo son varios ficheros y hay que cargarlos de una vez.
 */
const BROKER_FILES: Record<Broker, { label: string; accept: string; multiple: boolean }> = {
  // Etiquetas cortas: el texto del diálogo ya dice que se elige extracto, y
  // con los nombres largos los tres botones no caben en una fila.
  xtb: { label: 'XTB', accept: '.xlsx', multiple: false },
  ibkr: { label: 'IBKR', accept: '.xml', multiple: true },
  jpm: { label: 'JPM', accept: '.csv', multiple: false },
}

/** Estado + lógica de importación, compartidos entre el botón (junto a las pestañas) y el panel de resultado (debajo). */
export function useXtbImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  // Borrado lanzado al confirmar el diálogo. La importación lo espera antes
  // de escribir: si no, un borrado todavía en curso podría llevarse por
  // delante los movimientos recién importados.
  const clearingRef = useRef<Promise<void>>(Promise.resolve())
  const [broker, setBroker] = useState<Broker>('xtb')
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

  /** Al pulsar "Importar extracto": pide confirmación y bróker antes de borrar nada. */
  function requestImport() {
    confirmRef.current?.showPopover()
  }

  function cancelImport() {
    confirmRef.current?.hidePopover()
  }

  /**
   * Confirmado: borra los datos de ESE bróker y abre el selector de fichero.
   * El borrado ocurre aunque luego no se elija ningún fichero — es lo que se
   * acaba de confirmar en el diálogo. Lo del otro bróker no se toca.
   *
   * El selector se abre sin esperar al borrado a propósito: los navegadores
   * solo dejan abrirlo dentro del mismo gesto del usuario, y un `await`
   * previo puede hacer que lo bloqueen (Safari sobre todo).
   */
  function confirmImport(next: Broker) {
    confirmRef.current?.hidePopover()
    setBroker(next)
    clearingRef.current = clearBrokerData(next)
    setStatus('idle')
    // El input cambia de `accept`/`multiple` según el bróker: se abre en el
    // siguiente ciclo, ya rerenderizado, pero dentro del mismo gesto.
    queueMicrotask(() => inputRef.current?.click())
  }

  async function handleFiles(files: File[]) {
    setStatus('loading')
    setError(null)
    try {
      await clearingRef.current
      const result =
        broker === 'ibkr'
          ? await importIbkrFiles(files)
          : broker === 'jpm'
            ? await importJpmFile(files[0])
            : await importXtbFile(files[0])
      setSummary(result)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return { inputRef, confirmRef, broker, status, summary, error, handleFiles, requestImport, cancelImport, confirmImport }
}

type XtbImportState = ReturnType<typeof useXtbImport>

export function ImportButton({ state }: { state: XtbImportState }) {
  const { inputRef, confirmRef, broker, status, handleFiles, requestImport, cancelImport, confirmImport } = state
  const [open, setOpen] = useState(false)
  const fileConfig = BROKER_FILES[broker]

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
        {status === 'loading' ? 'Importando…' : 'Importar extracto'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={fileConfig.accept}
        multiple={fileConfig.multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length > 0) void handleFiles(files)
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
          Elige qué extracto vas a importar. Se borrarán los movimientos y las operaciones cerradas de ESE bróker
          antes de cargar el fichero nuevo; lo del otro se queda como está.
        </span>
        <div className="confirm-actions">
          <button type="button" className="button button-sm button-ghost" onClick={cancelImport}>
            Cancelar
          </button>
          <button type="button" className="button button-sm" onClick={() => confirmImport('xtb')}>
            {BROKER_FILES.xtb.label}
          </button>
          <button type="button" className="button button-sm" onClick={() => confirmImport('ibkr')}>
            {BROKER_FILES.ibkr.label}
          </button>
          <button type="button" className="button button-sm" onClick={() => confirmImport('jpm')}>
            {BROKER_FILES.jpm.label}
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
