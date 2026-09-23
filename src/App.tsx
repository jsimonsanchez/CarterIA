import { lazy, Suspense, useState } from 'react'
import './App.css'
import { AppVersionPopover } from './components/AppVersionPopover'
import { DayMoversPanel } from './components/DayMoversPanel'
import { ImportButton, ImportFeedback, useXtbImport } from './components/ImportPanel'
import { PositionsTable } from './components/PositionsTable'
import { RealizedGainsPanel } from './components/RealizedGainsPanel'
import { ReportsPanel } from './components/ReportsPanel'
import { SummaryCards } from './components/SummaryCards'
import { refreshPrices, usePortfolioRows } from './hooks/usePortfolioRows'
import { PrivacyProvider, usePrivacy } from './hooks/usePrivacy'

// recharts es pesado (~400 kB) y solo hace falta cuando hay datos que graficar.
const AllocationChart = lazy(() => import('./components/AllocationChart').then((m) => ({ default: m.AllocationChart })))
const CategoryPerformanceChart = lazy(() =>
  import('./components/CategoryPerformanceChart').then((m) => ({ default: m.CategoryPerformanceChart })),
)

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

  return (
    <PrivacyProvider>
      <div className="app">
        <header className="app-header">
          <h1>
            <AppVersionPopover />
            Cartera Tracker
          </h1>
        </header>

        <nav className="tabs">
          <div className="tabs-left">
            <button className={`tab ${tab === 'cartera' ? 'active' : ''}`} onClick={() => setTab('cartera')}>
              Cartera
            </button>
            <button className={`tab ${tab === 'realizado' ? 'active' : ''}`} onClick={() => setTab('realizado')}>
              Realizado
            </button>
          </div>
          <div className="tabs-right">
            <PrivacyToggleButton />
            <ImportButton state={importState} />
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
              <div className="sidebar-charts">
                <Suspense fallback={null}>
                  <AllocationChart rows={rows} />
                </Suspense>
                <Suspense fallback={null}>
                  <CategoryPerformanceChart rows={rows} />
                </Suspense>
              </div>
            </div>
            <ReportsPanel />
          </>
        ) : (
          <RealizedGainsPanel />
        )}
      </div>
    </PrivacyProvider>
  )
}

/**
 * Oculta/muestra los importes en € de toda la app (los % de rentabilidad y
 * la composición de la cartera siguen visibles): para poder enseñar la
 * pantalla sin revelar cuánto dinero hay detrás. Botón aparte, en vez de
 * usePrivacy() en App, porque el contexto solo existe dentro de
 * PrivacyProvider, que envuelve al propio App.
 */
function PrivacyToggleButton() {
  const { hidden, toggle } = usePrivacy()
  const label = hidden ? 'Mostrar importes' : 'Ocultar importes'

  return (
    <button
      className={`button button-sm button-ghost ${hidden ? 'active' : ''}`}
      onClick={toggle}
      aria-pressed={hidden}
      // En móvil solo queda el icono, así que el nombre de la acción tiene
      // que llegar igual a quien navegue con lector de pantalla.
      aria-label={label}
      title={label}
    >
      {hidden ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1.5 8S4 3.2 8 3.2 14.5 8 14.5 8 12 12.8 8 12.8 1.5 8 1.5 8Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1.5 8S4 3.2 8 3.2 14.5 8 14.5 8 12 12.8 8 12.8 1.5 8 1.5 8Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
      <span className="clear-btn-label">{label}</span>
    </button>
  )
}

export default App
