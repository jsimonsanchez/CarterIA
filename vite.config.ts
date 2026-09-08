import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Versión que se ve al tocar el logo (ver `AppVersionPopover`). Sale de git
 * en el momento de compilar, no de un número que haya que acordarse de subir
 * a mano en cada commit — así coincide siempre con lo que hay realmente
 * desplegado, sin depender de la disciplina de nadie.
 *
 * `commitCount` es un entero que solo sube (número total de commits): sirve
 * para ver de un vistazo si dos pantallas llevan la misma versión sin tener
 * que comparar hashes a ojo. El hash corto y la fecha son para localizar el
 * commit exacto en GitHub cuando hace falta.
 */
function readAppVersion() {
  try {
    const sha = execSync('git rev-parse HEAD').toString().trim()
    const commitDate = execSync('git log -1 --format=%cI').toString().trim()
    const commitCount = Number(execSync('git rev-list --count HEAD').toString().trim())
    return { sha: sha.slice(0, 7), commitDate, commitCount }
  } catch {
    // Sin repo git a mano (p.ej. un build desde un tarball) no se rompe la
    // build por esto: se degrada a "versión desconocida" en vez de fallar.
    return { sha: 'dev', commitDate: new Date().toISOString(), commitCount: 0 }
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cartera Tracker',
        short_name: 'Cartera',
        description: 'Tracker de cartera personal (XTB): posiciones, precios y análisis.',
        theme_color: '#0a0f1c',
        background_color: '#0a0f1c',
        display: 'standalone',
        start_url: '/',
        lang: 'es',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // ExcelJS son ~900 KB, más de la mitad de todo lo precacheado, y solo
        // hace falta al importar un extracto. Fuera del precacheo no se
        // descarga en la primera visita; se trae la primera vez que se
        // importa y a partir de ahí queda en caché.
        globIgnores: ['**/exceljs*.js'],
        runtimeCaching: [
          {
            // El nombre lleva el hash del contenido, así que nunca cambia sin
            // cambiar de URL: se puede servir de caché sin revalidar.
            urlPattern: /\/assets\/exceljs.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cartera-exceljs',
              expiration: { maxEntries: 2 },
            },
          },
        ],
      },
    }),
  ],
})
