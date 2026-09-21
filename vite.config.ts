import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const puertoApi = process.env.API_PUERTO ?? '8787';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icono.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'POS Cafetería',
        short_name: 'POS Cafetería',
        description: 'Punto de venta para la cafetería',
        lang: 'es-MX',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        theme_color: '#1E2528',
        background_color: '#F2F4F3',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        // La API nunca se cachea: la red solo la usan el motor de sync, el acceso y Reportes.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // La app completa queda precacheada por el service worker; un solo bundle grande está bien.
    chunkSizeWarningLimit: 900,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': `http://localhost:${puertoApi}` },
  },
  preview: {
    proxy: { '/api': `http://localhost:${puertoApi}` },
  },
});
