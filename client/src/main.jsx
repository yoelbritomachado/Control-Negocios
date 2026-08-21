import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CartProvider } from './components/CartProvider.jsx'
import { OfflineProvider } from './offline'

// Capturador Global de Errores para Logging Centralizado
window.addEventListener('error', (event) => {
  try {
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        context: 'FRONTEND_UNCAUGHT',
        message: event.message,
        details: { filename: event.filename, lineno: event.lineno, colno: event.colno, stack: event.error?.stack }
      })
    }).catch(() => {});
  } catch (_) {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'warn',
        context: 'FRONTEND_UNHANDLED_REJECTION',
        message: event.reason?.message || String(event.reason),
        details: { stack: event.reason?.stack }
      })
    }).catch(() => {});
  } catch (_) {}
});

createRoot(document.getElementById('root')).render(
  <OfflineProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </OfflineProvider>,
)
