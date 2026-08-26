import { useEffect, useRef, useState } from 'react'
import { importXtbFile, type ImportSummary } from '../services/importPortfolio'

type ImportStatus = 'idle' | 'loading' | 'done' | 'error'

const FEEDBACK_TIMEOUT_MS = 60_000

/** Estado + lógica de importación, compartidos entre el botón (junto a las pestañas) y el panel de resultado (debajo). */
export function useXtbImport() {
  const inputRef = useRef<HTMLInputElement>(null)
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

  async function handleFile(file: File) {
    setStatus('loading')
    setError(null)
    try {
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

  return { inputRef, status, summary, error, handleFile }
}

type XtbImportState = ReturnType<typeof useXtbImport>

export function ImportButton({ state }: { state: XtbImportState }) {
  const { inputRef, status, handleFile } = state

  return (
    <>
      <button className="button button-sm" disabled={status === 'loading'} onClick={() => inputRef.current?.click()}>
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
