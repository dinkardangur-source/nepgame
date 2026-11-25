import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function readApkVersionMeta(): { versionCode: number; versionName: string } {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'apk-version.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.versionCode === 'number' && typeof parsed.versionName === 'string') {
      return parsed;
    }
  } catch {
    // Fallback defaults
  }
  return { versionCode: 2, versionName: '1.0.1' };
}

const apkMeta = readApkVersionMeta();

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
  define: {
    __APP_VERSION__: JSON.stringify(apkMeta.versionName),
    __APK_VERSION_CODE__: JSON.stringify(apkMeta.versionCode),
  },
  plugins: [
    disableHmrWebSocketPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'boot-crest.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
      manifest: {
        id: '/',
        name: 'Empire of the Rising Towers',
        short_name: 'Rising Towers',
        description: 'UNITE THE KINGDOM · BY NEPGAME — Isometric 3D medieval kingdom strategy across the Himalayas.',
        theme_color: '#0a0e14',
        background_color: '#0a0e14',
        display: 'fullscreen',
        orientation: 'landscape',
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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__\//, /^\/api\//, /^\/download\//, /^\/android-apk\//],
        globPatterns: [
          '**/*.{js,css,html,ico,svg,woff,woff2,webp}',
          'boot-crest.png',
          'pwa-*.png',
          'apple-touch-icon.png',
          'favicon-*.png',
          'assets/models/*.glb',
        ],
        globIgnores: ['**/assets/aistudio/**', '**/assets/images/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(.*\.)?(googleapis\.com|firebaseapp\.com|firebaseio\.com|accounts\.google\.com|securetoken\.googleapis\.com|identitytoolkit\.googleapis\.com)\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'realm-api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'realm-runtime-assets',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase-vendor';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
