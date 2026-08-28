import { lazy, Suspense, useState } from 'react'
import './App.css'
import { db } from './db/db'
import { DayMoversPanel } from './components/DayMoversPanel'
import { ImportButton, ImportFeedback, useXtbImport } from './components/ImportPanel'
import { PositionsTable } from './components/PositionsTable'
import { RealizedGainsPanel } from './components/RealizedGainsPanel'
import { ReportsPanel } from './components/ReportsPanel'
import { SummaryCards } from './components/SummaryCards'
import { refreshPrices, usePortfolioRows } from './hooks/usePortfolioRows'

// recharts es pesado (~400 kB) y solo hace falta cuando hay datos que graficar.
const AllocationChart = lazy(() => import('./components/AllocationChart').then((m) => ({ default: m.AllocationChart })))

type Tab = 'cartera' | 'realizado'

function App() {
  const { rows, isLoading } = usePortfolioRows()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('cartera')
  const importState = useXtbImport()

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const { failed } = await refreshPrices()
      if (failed.length > 0) {
        setRefreshError(`${failed.length} precios no se pudieron actualizar (se mantiene la última caché).`)
      }
    } finally {
      setRefreshing(false)
    }
  }

  async function handleClearAll() {
    const confirmed = window.confirm(
      'Se borrará tu cartera de este dispositivo: posiciones, movimientos, operaciones cerradas y precios en caché. ' +
        'Se conserva la tabla de símbolos (nombres y logos de las empresas), que no son datos tuyos y cuesta ' +
        'crédito de la API volver a descargarlos. Esta acción no se puede deshacer. ¿Continuar?',
    )
    if (!confirmed) return

    // symbolMappings se conserva a propósito: no contiene datos de la
    // cartera, solo la equivalencia de tickers entre proveedores más el
    // nombre y el logo ya descargados. Borrarla obligaría a volver a gastar
    // crédito de Twelve Data en resolver cada logo.
    await Promise.all([
      db.transactions.clear(),
      db.positions.clear(),
      db.priceCache.clear(),
      db.closedTrades.clear(),
    ])
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
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
          Cartera Tracker
        </h1>
      </header>

      <nav className="tabs">
        <div className="tabs-left">
          <button className={`tab ${tab === 'cartera' ? 'active' : ''}`} onClick={() => setTab('cartera')}>
            Cartera
          </button>
          <button className={`tab ${tab === 'realizado' ? 'active' : ''}`} onClick={() => setTab('realizado')}>
            Posiciones cerradas
          </button>
        </div>
        <div className="tabs-right">
          <ImportButton state={importState} />
          <button
            className="button button-sm button-danger"
            onClick={handleClearAll}
            // En móvil solo queda el icono, así que el nombre de la acción
            // tiene que llegar igual a quien navegue con lector de pantalla.
            aria-label="Borrar todo"
            title="Borrar todo"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="clear-btn-label">Borrar todo</span>
          </button>
        </div>
      </nav>

      <ImportFeedback state={importState} />

      {tab === 'cartera' ? (
        <>
          <SummaryCards rows={rows} />
          <DayMoversPanel rows={rows} />
          <div className="main-grid">
            <PositionsTable
              rows={rows}
              isLoading={isLoading}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              refreshError={refreshError}
            />
            <Suspense fallback={null}>
              <AllocationChart rows={rows} />
            </Suspense>
          </div>
          <ReportsPanel />
        </>
      ) : (
        <RealizedGainsPanel />
      )}
    </div>
  )
}

export default App
