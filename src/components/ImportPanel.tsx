import { useRef, useState } from 'react'
import { importXtbFile, type ImportSummary } from '../services/importPortfolio'

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section className="import-bar">
      <div className="import-bar-row">
        <span className="import-bar-label">Importar extracto de XTB</span>
        <button
          className="button button-sm"
          disabled={status === 'loading'}
          onClick={() => inputRef.current?.click()}
        >
          {status === 'loading' ? 'Importando…' : 'Elegir archivo .xlsx'}
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
      </div>

      {status === 'error' && <p className="error-text">{error}</p>}

      {status === 'done' && summary && (
        <div className="import-summary">
          <p>
            {summary.imported} movimientos procesados, {summary.positions} posiciones abiertas,{' '}
            {summary.closedTrades} operaciones cerradas
            {summary.skipped > 0 && `, ${summary.skipped} filas omitidas`}.
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
          {summary.unresolvedSymbols.length > 0 && (
            <p className="warning-text">
              Sin mapeo de precio para: {summary.unresolvedSymbols.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
