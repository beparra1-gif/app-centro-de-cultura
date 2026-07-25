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
    // Sin esto, vitest también encuentra y corre los tests de backend/ (con
    // su propia config de Node, no jsdom) y los specs de Playwright en
    // tests/e2e/ (que "*.spec.js" también matchea) al ejecutar "npm run
    // test" en la raíz — cada suite corre con su propio comando (ver
    // backend/package.json y "test:e2e" acá). Se parte de los excludes por
    // defecto de vitest (definir "exclude" acá los reemplaza entero, no los
    // suma) y se agregan ambas carpetas a la lista.
    exclude: [
      '**/node_modules/**', '**/dist/**', '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/backend/**',
      '**/tests/e2e/**',
    ],
  },
})
