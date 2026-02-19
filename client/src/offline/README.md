# Sistema Offline-First - Miss Chulerías POS

## 📋 Resumen

Este módulo implementa capacidades **offline-first** para el sistema POS de Miss Chulerías, permitiendo que los vendedores trabajen sin conexión a internet y sincronicen los datos cuando vuelva la conexión.

## 🎯 Características Principales

- ✅ **Trabajo 100% Offline** - Ventas, compras, traslados y mermas funcionan sin internet
- ✅ **Base de Datos Local** - SQLite WASM con persistencia en el navegador
- ✅ **Sincronización Automática** - Los datos se sincronizan cuando hay conexión
- ✅ **Background Sync** - Sincronización en segundo plano incluso con la app cerrada
- ✅ **Instalación como App** - PWA que se instala en escritorio/móvil
- ✅ **Cola de Operaciones** - Las operaciones se encolan y se procesan en orden
- ✅ **Manejo de Conflictos** - Resolución inteligente de conflictos de sincronización

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│           NAVEGADOR (PWA)                   │
│  ┌─────────────────────────────────────┐    │
│  │  SQLite WASM (wa-sqlite)            │    │
│  │  - Products, Categories, Customers  │    │
│  │  - Sales, Purchases, Transfers      │    │
│  │  - Mermas, Inventories              │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Service Worker                     │    │
│  │  - Cache de recursos                │    │
│  │  - Background Sync                  │    │
│  │  - Push Notifications               │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                      │ Sync (cuando hay internet)
                      ▼
┌─────────────────────────────────────────────┐
│           SERVIDOR (Node.js)                │
│  ┌─────────────────────────────────────┐    │
│  │  SQLite (Base de datos central)     │    │
│  │  - Datos maestros                   │    │
│  │  - Historial completo               │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## 📦 Estructura del Módulo

```
client/src/offline/
├── database.js          # SQLite WASM - Base de datos local
├── sync.js              # Lógica de sincronización
├── provider.jsx         # React Provider para el contexto offline
├── hooks.js             # Hooks React para usar el sistema
├── usePOSOffline.js     # Hook de integración con POS
├── index.js             # Exportaciones principales
├── README.md            # Este archivo
├── components/
│   ├── OfflineStatusBar.jsx      # Barra de estado de conexión
│   ├── SyncButton.jsx            # Botón de sincronización
│   ├── PendingOperationsModal.jsx # Modal de operaciones pendientes
│   └── PWAInstallPrompt.jsx      # Prompt de instalación PWA
└── hooks/
    └── usePWAInstall.js  # Hook para instalar la PWA
```

## 🚀 Uso Rápido

### 1. Envolver la aplicación con OfflineProvider

```jsx
// main.jsx
import { OfflineProvider } from './offline';

createRoot(document.getElementById('root')).render(
  <OfflineProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </OfflineProvider>
);
```

### 2. Usar en componentes

```jsx
// En cualquier componente
import { useOffline, useProducts, useCreateSale } from './offline';

function MiComponente() {
  const { isOnline, isInitialized, syncNow } = useOffline();
  const { products, loading } = useProducts();
  const { createSale } = useCreateSale();

  const handleVenta = async () => {
    const resultado = await createSale({
      items: [...],
      total: 100,
      payment_method: 'cash'
    });
    
    if (resultado.success) {
      if (!resultado.online) {
        alert('Venta guardada offline. Se sincronizará cuando haya conexión.');
      }
    }
  };

  return (
    <div>
      <p>Estado: {isOnline ? 'Online' : 'Offline'}</p>
      {products.map(p => <div key={p.id}>{p.name}</div>)}
    </div>
  );
}
```

### 3. Integración con POS existente

```jsx
// En POSLayout o componentes de venta
import { usePOSOffline } from './offline';

function POSLayout() {
  const {
    isOnline,
    products,
    searchProducts,
    scanBarcode,
    processSale
  } = usePOSOffline();

  // Usar processSale en lugar de la API directamente
  const handleSale = async (saleData) => {
    const result = await processSale(saleData);
    // Manejar resultado...
  };
}
```

## 📊 Base de Datos Local

### Tablas Principales

| Tabla | Propósito |
|-------|-----------|
| `products` | Cache local del inventario |
| `categories` | Categorías de productos |
| `customers` | Clientes registrados |
| `inventories` | Sucursales/inventarios |
| `sales` | Ventas realizadas (offline) |
| `sale_items` | Items de cada venta |
| `purchases` | Compras realizadas (offline) |
| `transfers` | Traslados entre inventarios |
| `mermas` | Pérdidas/mermas registradas |

### Estados de Sincronización

- `synced` - Sincronizado con el servidor
- `pending` - Pendiente de sincronizar
- `syncing` - Sincronizando ahora
- `error` - Error al sincronizar

## 🔄 Flujo de Sincronización

1. **Usuario trabaja offline**
   - Ventas se guardan en `sales` con `sync_status = 'pending'`
   - Stock local se actualiza inmediatamente

2. **Se restaura la conexión**
   - Evento `online` del navegador
   - Se intenta sincronizar automáticamente

3. **Sincronización**
   - Primero: Subir operaciones locales (`uploadPendingChanges`)
   - Luego: Descargar datos actualizados (`downloadServerData`)
   - Actualizar timestamps de sincronización

4. **Background Sync**
   - Si el usuario cierra la app, el Service Worker reintenta
   - Usando la API `sync` de Service Workers

## 🛠️ Hooks Disponibles

### useOffline
Hook principal para acceder al estado del sistema offline.

```jsx
const {
  isInitialized,      // boolean - Sistema listo
  isOnline,          // boolean - Hay conexión
  isSyncing,         // boolean - Sincronizando
  pendingCount,      // number - Operaciones pendientes
  syncNow,           // function - Forzar sync
  connectionStatus   // string - Estado actual
} = useOffline();
```

### useProducts
Consulta productos de la base local.

```jsx
const {
  products,          // Array - Productos
  loading,           // boolean - Cargando
  error              // Error si ocurre
} = useProducts(searchTerm, categoryId);
```

### useCreateSale
Crea una venta (funciona offline).

```jsx
const { createSale, loading } = useCreateSale();
const result = await createSale({
  items: [{ product_id, quantity, unit_price, total_price }],
  total: 100,
  payment_method: 'cash',
  customer_id: null
});
```

### usePOSOffline
Hook de integración con el POS existente.

```jsx
const {
  isOnline,
  products,
  searchProducts,
  scanBarcode,
  processSale,
  status
} = usePOSOffline();
```

## 🔧 Configuración de Vite

El archivo `vite.config.js` incluye la configuración PWA:

```javascript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { /* ... */ },
      workbox: { /* ... */ }
    })
  ]
})
```

## 📱 Instalación de la PWA

### En PC (Chrome/Edge)
1. Abrir la URL en Chrome
2. Click en el ícono de instalación (barra de dirección)
3. Click en "Instalar"

### En Android
1. Abrir en Chrome
2. Menú → "Agregar a pantalla de inicio"
3. Confirmar instalación

### En iOS (Safari)
1. Abrir en Safari
2. Compartir → "Agregar a pantalla de inicio"

## 🧪 Testing Offline

### Chrome DevTools
1. Abrir DevTools (F12)
2. Network → Throttling → "Offline"
3. Probar funcionalidades

### Lighthouse
1. Audits → PWA
2. Verificar que pase todas las pruebas

## ⚠️ Limitaciones y Consideraciones

### Almacenamiento
- Chrome: Hasta ~80% del disco libre
- Firefox: ~2GB en desktop
- Safari: ~1GB en iOS
- Para <10,000 productos: ~50MB suficiente

### Sincronización
- Ventas se sincronizan en orden cronológico
- Si hay conflicto, gana el servidor (last-write-wins)
- Productos eliminados en servidor se desactivan localmente

### Backup
- La base de datos local se guarda en OPFS (Origin Private File System)
- Los datos persisten entre sesiones del navegador
- Si el usuario limpia datos del navegador, se pierden datos no sincronizados

## 🐛 Debugging

### Verificar Service Worker
```javascript
// En consola del navegador
navigator.serviceWorker.ready.then(reg => console.log('SW ready', reg));
```

### Verificar Base de Datos
```javascript
// En consola
import { getOfflineDatabase } from './offline/database';
const db = getOfflineDatabase();
await db.initialize();
const stats = await db.getStats();
console.log('DB Stats:', stats);
```

### Forzar Sincronización
```javascript
import { getSyncManager } from './offline/sync';
const sync = getSyncManager();
await sync.sync();
```

## 🔐 Seguridad

- Los datos se almacenan localmente en el dispositivo
- No se comparten entre navegadores/dispositivos
- Las comunicaciones con el servidor usan HTTPS
- El Service Worker valida el origen de los requests

## 📈 Performance

- IndexedDB es asíncrono (no bloquea UI)
- Las consultas usan índices para búsquedas rápidas
- El cache del Service Worker acelera carga de recursos
- Lazy loading de imágenes y datos pesados

## 📝 TODO / Mejoras Futuras

- [ ] Sincronización de imágenes de productos
- [ ] Compresión de datos para ahorrar espacio
- [ ] Encriptación de datos locales sensibles
- [ ] Sync peer-to-peer (WebRTC) para múltiples cajas
- [ ] Modo "solo lectura" cuando el espacio es limitado
- [ ] Backup automático a Google Drive/Dropbox

## 🤝 Contribución

Para agregar nuevas funcionalidades offline:

1. Agregar tabla al esquema en `database.js`
2. Crear hook en `hooks.js`
3. Agregar lógica de sync en `sync.js`
4. Actualizar UI según sea necesario

## 📚 Recursos

- [wa-sqlite](https://github.com/rhashimoto/wa-sqlite) - SQLite en WebAssembly
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) - Documentación del plugin
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) - MDN
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) - MDN
