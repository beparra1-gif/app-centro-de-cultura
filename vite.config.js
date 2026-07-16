import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logos/club-logo.png'],
      workbox: {
        // El runtime WASM de onnxruntime (usado por @imgly/background-removal
        // para "quitar fondo" en la tarjeta de jugador) pesa ~24MB. No tiene
        // sentido precachearlo de entrada para todos los visitantes — se
        // sirve como asset normal bajo demanda solo cuando alguien realmente
        // usa esa función.
        globIgnores: ['**/ort*.wasm', '**/ort*.mjs', '**/ort.*.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Centro de Cultura Física Viña del Mar',
        short_name: 'CCF Viña',
        description: 'Portal oficial del Club Centro de Cultura Física Viña del Mar.',
        theme_color: '#0a4da2',
        background_color: '#0a4da2',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logos/club-logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
