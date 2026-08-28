import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
