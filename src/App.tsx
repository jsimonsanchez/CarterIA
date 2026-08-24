import { lazy, Suspense, useState } from 'react'
import './App.css'
import { ImportPanel } from './components/ImportPanel'
import { PositionsTable } from './components/PositionsTable'
import { ReportsPanel } from './components/ReportsPanel'
import { SummaryCards } from './components/SummaryCards'
import { refreshPrices, usePortfolioRows } from './hooks/usePortfolioRows'

// recharts es pesado (~400 kB) y solo hace falta cuando hay datos que graficar.
const AllocationChart = lazy(() => import('./components/AllocationChart').then((m) => ({ default: m.AllocationChart })))

function App() {
  const rows = usePortfolioRows()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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
        <button className="button" onClick={handleRefresh} disabled={refreshing || rows.length === 0}>
          {refreshing ? 'Actualizando…' : 'Actualizar precios'}
        </button>
      </header>

      {refreshError && <p className="warning-text">{refreshError}</p>}

      <ImportPanel />
      <SummaryCards rows={rows} />

      <div className="main-grid">
        <PositionsTable rows={rows} />
        <Suspense fallback={null}>
          <AllocationChart rows={rows} />
        </Suspense>
      </div>

      <ReportsPanel />
    </div>
  )
}

export default App
