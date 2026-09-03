import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(async () => {
  // Plugin PWA opcional (solo en desarrollo o si está instalado)
  const plugins = [react()]
  
  try {
    const { VitePWA } = await import('vite-plugin-pwa')
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          id: '/',
          name: 'Miss Chulerías POS',
          short_name: 'Miss Chulerías',
          description: 'Sistema de Inventario y Punto de Venta - Miss Chulerías',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192x192.png?v=2',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512x512.png?v=2',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-192x192.png?v=2',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icons/icon-512x512.png?v=2',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json,webmanifest,wasm}'],
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^(?!\/(api|uploads)).*$/],
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'CacheFirst',
              options: {
                cacheName: 'html-cache',
                plugins: [
                  {
                    cacheWillUpdate: async ({ response }) => {
                      if (response && response.status === 200) return response;
                      return null;
                    }
                  }
                ]
              }
            },
            {
              urlPattern: /\.(?:html|js|css)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-shell',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            },
            {
              urlPattern: /^\/uploads\/.*|\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:js|css|woff2?|ttf|eot)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    )
    console.log('[Vite Config] vite-plugin-pwa cargado correctamente')
  } catch (e) {
    console.log('[Vite Config] vite-plugin-pwa no disponible, continuando sin PWA...')
  }

  return {
    plugins,
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      allowedHosts: true,
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    optimizeDeps: {
      exclude: ['wa-sqlite'],
      include: ['react', 'react-dom', 'react-router-dom']
    },
    resolve: {
      dedupe: ['react', 'react-dom']
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      rollupOptions: {
        external: ['wa-sqlite'],
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui': ['framer-motion', 'lucide-react'],
            'charts': ['recharts']
          }
        }
      }
    }
  }
})
