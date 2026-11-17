import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function disableHmrWebSocketPlugin(): Plugin {
  let isHmrDisabled = false;
  return {
    name: 'disable-hmr-websocket',
    apply: 'serve',
    enforce: 'post',
    configResolved(resolvedConfig) {
      isHmrDisabled = resolvedConfig.server.hmr === false || resolvedConfig.server.ws === false;
    },
    transform(code, id) {
      if (!isHmrDisabled) return null;
      const cleanId = id.split('?')[0].replace(/\\/g, '/');
      if (cleanId.endsWith('/vite/dist/client/client.mjs') && code.includes('let wsTransport = createWebSocketModuleRunnerTransport(')) {
        return {
          code: code.replace(
            /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
            'let wsTransport = { connect: async () => {}, disconnect: async () => {}, send: () => {} };'
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    disableHmrWebSocketPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: 'Himalayan Realms',
        short_name: 'Himalayan',
        description: 'Isometric Strategy Prototype set in Himalayan kingdoms',
        theme_color: '#0a0e14',
        background_color: '#0a0e14',
        display: 'fullscreen',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
    ws: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
