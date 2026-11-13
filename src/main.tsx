import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes servidas con la propia app en vez de desde Google: no bloquean el
// primer pintado con una conexión a otro dominio y funcionan sin red.
import '@fontsource-variable/inter/wght.css'
import '@fontsource/dancing-script/latin-700.css'
import './index.css'
import App from './App.tsx'

// Un import() dinámico (p.ej. el del importador de XTB, cargado bajo
// demanda) puede pedir un chunk con el hash de una versión anterior si el
// usuario tenía la app abierta cuando se desplegó una nueva — ese archivo ya
// no existe en el servidor. Vite dispara este evento en ese caso concreto;
// recargar trae el index.html y los chunks de la versión actual.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
