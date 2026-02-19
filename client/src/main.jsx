import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CartProvider } from './components/CartProvider.jsx'
import { OfflineProvider } from './offline'

createRoot(document.getElementById('root')).render(
  <OfflineProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </OfflineProvider>,
)
