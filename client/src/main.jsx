import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAutoSyncEngine } from './lib/autoSyncEngine'
import { recordLog, flushOfflineLogs } from './lib/telemetryLogger'

// Iniciar motor de sincronización automática y telemetría
initAutoSyncEngine();
flushOfflineLogs();

import { CartProvider } from './components/CartProvider.jsx'
import { OfflineProvider } from './offline'
import { registerSW } from 'virtual:pwa-register'

// Registrar Service Worker para PWA con recarga automática limpia ante nuevas versiones
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nueva versión disponible, actualizando Service Worker...');
    },
    onOfflineReady() {
      console.log('[PWA] Aplicación lista para operar 100% offline.');
    }
  });
}

// Capturador Global de Errores para Logging Centralizado y Offline
window.addEventListener('error', (event) => {
  recordLog('error', 'FRONTEND_UNCAUGHT', event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  recordLog('warn', 'FRONTEND_UNHANDLED_REJECTION', event.reason?.message || String(event.reason), {
    stack: event.reason?.stack
  });
});

createRoot(document.getElementById('root')).render(
  <OfflineProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </OfflineProvider>,
)
