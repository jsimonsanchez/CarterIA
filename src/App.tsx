import { lazy, Suspense, useState } from 'react'
import './App.css'
import { DayMoversPanel } from './components/DayMoversPanel'
import { ImportPanel } from './components/ImportPanel'
import { PositionsTable } from './components/PositionsTable'
import { RealizedGainsPanel } from './components/RealizedGainsPanel'
import { ReportsPanel } from './components/ReportsPanel'
import { SummaryCards } from './components/SummaryCards'
import { refreshPrices, usePortfolioRows } from './hooks/usePortfolioRows'

// recharts es pesado (~400 kB) y solo hace falta cuando hay datos que graficar.
const AllocationChart = lazy(() => import('./components/AllocationChart').then((m) => ({ default: m.AllocationChart })))

type Tab = 'cartera' | 'realizado'

function App() {
  const rows = usePortfolioRows()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('cartera')

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
    <div className="app">
      <header className="app-header">
        <h1>Cartera Tracker</h1>
      </header>

      <ImportPanel />

      <nav className="tabs">
        <button className={`tab ${tab === 'cartera' ? 'active' : ''}`} onClick={() => setTab('cartera')}>
          Cartera
        </button>
        <button className={`tab ${tab === 'realizado' ? 'active' : ''}`} onClick={() => setTab('realizado')}>
          Posiciones cerradas
        </button>
      </nav>

      {tab === 'cartera' ? (
        <>
          <SummaryCards rows={rows} />
          <DayMoversPanel rows={rows} />
          <div className="main-grid">
            <PositionsTable
              rows={rows}
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
