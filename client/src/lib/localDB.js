/**
 * Sistema Local IndexedDB Ligero para Catálogo y Ventas Offline
 * Garantiza que la app funcione 100% offline sin errores de VFS/SQLite
 */

const DB_NAME = 'mch_local_db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Catálogo de productos en caché
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      // Ventas pendientes de sincronizar
      if (!db.objectStoreNames.contains('pending_sales')) {
        const salesStore = db.createObjectStore('pending_sales', { keyPath: 'local_id' });
        salesStore.createIndex('sync_status', 'sync_status', { unique: false });
        salesStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Traslados pendientes de sincronizar
      if (!db.objectStoreNames.contains('pending_transfers')) {
        const trfStore = db.createObjectStore('pending_transfers', { keyPath: 'local_id' });
        trfStore.createIndex('sync_status', 'sync_status', { unique: false });
      }

      // Configuración y metadatos locales (último sync, usuario activo)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- PRODUCTOS / CATÁLOGO ---

export async function saveProductsLocal(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  const db = await openDB();
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  
  for (const product of products) {
    store.put(product);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProductsLocal(search = '') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const req = store.getAll();

    req.onsuccess = () => {
      let results = req.result || [];
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        results = results.filter(p => 
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
        );
      }
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// --- VENTAS OFFLINE PENDIENTES ---

export async function savePendingSale(saleData) {
  const db = await openDB();
  const tx = db.transaction('pending_sales', 'readwrite');
  const store = tx.objectStore('pending_sales');

  const record = {
    ...saleData,
    local_id: saleData.local_id || `offline_sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sync_status: 'pending',
    created_at: saleData.created_at || new Date().toISOString()
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_sales', 'readonly');
    const store = tx.objectStore('pending_sales');
    const req = store.getAll();

    req.onsuccess = () => {
      const items = (req.result || []).filter(s => s.sync_status === 'pending');
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markSaleSynced(localId, serverId = null) {
  const db = await openDB();
  const tx = db.transaction('pending_sales', 'readwrite');
  const store = tx.objectStore('pending_sales');
  
  const getReq = store.get(localId);
  getReq.onsuccess = () => {
    const record = getReq.result;
    if (record) {
      record.sync_status = 'synced';
      record.server_id = serverId;
      record.synced_at = new Date().toISOString();
      store.put(record);
    }
  };

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --- TRASLADOS OFFLINE PENDIENTES ---

export async function savePendingTransfer(transferData) {
  const db = await openDB();
  const tx = db.transaction('pending_transfers', 'readwrite');
  const store = tx.objectStore('pending_transfers');

  const record = {
    ...transferData,
    local_id: transferData.local_id || `offline_trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sync_status: 'pending',
    created_at: transferData.created_at || new Date().toISOString()
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingTransfers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_transfers', 'readonly');
    const store = tx.objectStore('pending_transfers');
    const req = store.getAll();

    req.onsuccess = () => {
      const items = (req.result || []).filter(t => t.sync_status === 'pending');
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markTransferSynced(localId) {
  const db = await openDB();
  const tx = db.transaction('pending_transfers', 'readwrite');
  const store = tx.objectStore('pending_transfers');
  
  const getReq = store.get(localId);
  getReq.onsuccess = () => {
    const record = getReq.result;
    if (record) {
      record.sync_status = 'synced';
      record.synced_at = new Date().toISOString();
      store.put(record);
    }
  };

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --- METADATOS Y CONTEO GLOBAL ---

export async function getPendingCounts() {
  const [sales, transfers] = await Promise.all([
    getPendingSales(),
    getPendingTransfers()
  ]);
  return {
    salesCount: sales.length,
    transfersCount: transfers.length,
    totalPending: sales.length + transfers.length
  };
}
