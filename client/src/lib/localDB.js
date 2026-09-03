/**
 * Sistema Local IndexedDB Ligero para Catálogo y Ventas Offline
 * Garantiza que la app funcione 100% offline sin errores de VFS/SQLite
 */

const DB_NAME = 'mch_local_db';
const DB_VERSION = 2;

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

      // Nodos de Nexus en caché
      if (!db.objectStoreNames.contains('nexus_nodes')) {
        db.createObjectStore('nexus_nodes', { keyPath: 'id' });
      }

      // Usuarios y roles en caché
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
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

export async function getProductsLocal(search = '', inventoryId = '') {
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
      if (inventoryId) {
        results = results.map(p => {
          const invStock = p.inventory && p.inventory[inventoryId] !== undefined ? p.inventory[inventoryId] : p.quantity;
          return {
            ...p,
            quantity: Number(invStock) || 0
          };
        });
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

export async function clearAllPendingOperations() {
  const db = await openDB();
  const tx = db.transaction(['pending_sales', 'pending_transfers'], 'readwrite');
  const salesStore = tx.objectStore('pending_sales');
  const trfStore = tx.objectStore('pending_transfers');
  
  salesStore.clear();
  trfStore.clear();

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function deletePendingSale(localId) {
  const db = await openDB();
  const tx = db.transaction('pending_sales', 'readwrite');
  const store = tx.objectStore('pending_sales');
  store.delete(localId);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --- TRASLADOS OFFLINE PENDIENTES Y RECIBIDOS ---

export async function savePendingTransfer(transferData) {
  const db = await openDB();
  const tx = db.transaction('pending_transfers', 'readwrite');
  const store = tx.objectStore('pending_transfers');

  // Normalizar campos para compatibilidad completa (emisor, receptor, QR)
  const src = transferData.source_inventory || transferData.source_location || transferData.src || transferData.from_inventory || 'alm';
  const tgt = transferData.target_inventory || transferData.target_location || transferData.tgt || transferData.to_inventory || 'mch1';
  const rawItems = transferData.items || [];
  const normalizedItems = rawItems.map(item => ({
    product_id: item.product_id || item.pid || item.id,
    pid: item.product_id || item.pid || item.id,
    name: item.name || item.product_name || '',
    product_name: item.name || item.product_name || '',
    code: item.code || item.sku || '',
    sku: item.sku || item.code || '',
    quantity: Number(item.quantity || item.qty || 1),
    qty: Number(item.quantity || item.qty || 1),
    cost_price: Number(item.cost_price || item.cost || 0),
    cost: Number(item.cost_price || item.cost || 0),
    sale_price: Number(item.sale_price || item.price || 0),
    price: Number(item.sale_price || item.price || 0)
  }));

  const record = {
    ...transferData,
    id: transferData.id || transferData.local_id || `offline_trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    local_id: transferData.local_id || transferData.id || `offline_trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    source_inventory: src,
    src: src,
    target_inventory: tgt,
    tgt: tgt,
    from_inventory: src,
    to_inventory: tgt,
    items: normalizedItems,
    notes: transferData.notes || transferData.note || '',
    status: transferData.status || (transferData.is_received ? 'received' : 'pending'),
    sync_status: transferData.sync_status || 'pending',
    created_at: transferData.created_at || transferData.date || new Date().toISOString(),
    date: transferData.date || transferData.created_at || new Date().toISOString()
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Aplica el impacto de un traslado en el stock de productos local en IndexedDB (modo offline)
 */
export async function applyLocalTransferStock(transferData, isReceiving = false) {
  try {
    const db = await openDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const src = (transferData.source_inventory || transferData.src || 'alm').toLowerCase();
    const tgt = (transferData.target_inventory || transferData.tgt || 'mch1').toLowerCase();
    const items = transferData.items || [];

    for (const item of items) {
      const pid = item.product_id || item.pid || item.id;
      const qty = Number(item.quantity || item.qty || 0);
      if (!pid || qty <= 0) continue;

      const getReq = store.get(pid);
      await new Promise((resolve) => {
        getReq.onsuccess = () => {
          const prod = getReq.result;
          if (prod) {
            const inv = { ...(prod.inventory || {}) };
            
            // Garantizar claves numéricas inicializadas
            if (inv[src] === undefined) inv[src] = Number(prod.quantity) || 0;
            if (inv[tgt] === undefined) inv[tgt] = 0;

            if (isReceiving) {
              // Si estamos recibiendo en el destino: sumar a destino, restar de origen
              inv[tgt] = (Number(inv[tgt]) || 0) + qty;
              inv[src] = Math.max(0, (Number(inv[src]) || 0) - qty);
            } else {
              // Si estamos enviando desde el origen: restar del origen
              inv[src] = Math.max(0, (Number(inv[src]) || 0) - qty);
            }

            prod.inventory = inv;
            store.put(prod);
          }
          resolve();
        };
        getReq.onerror = () => resolve();
      });
    }

    await new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[LocalDB] Error aplicando stock local de traslado:', err);
  }
}

export async function getPendingTransfers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_transfers', 'readonly');
    const store = tx.objectStore('pending_transfers');
    const req = store.getAll();

    req.onsuccess = () => {
      resolve(req.result || []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markTransferSynced(localId) {
  const db = await openDB();
  const tx = db.transaction('pending_transfers', 'readwrite');
  const store = tx.objectStore('pending_transfers');
  
  store.delete(localId);

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --- NEXUS NODES OFFLINE ---

export async function saveNexusNodesLocal(nodes) {
  if (!Array.isArray(nodes)) return;
  const db = await openDB();
  const tx = db.transaction('nexus_nodes', 'readwrite');
  const store = tx.objectStore('nexus_nodes');
  store.clear();
  for (const n of nodes) {
    store.put(n);
  }
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getNexusNodesLocal() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('nexus_nodes', 'readonly');
    const store = tx.objectStore('nexus_nodes');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

// --- USUARIOS OFFLINE ---

export async function saveUsersLocal(users) {
  if (!Array.isArray(users)) return;
  const db = await openDB();
  const tx = db.transaction('users', 'readwrite');
  const store = tx.objectStore('users');
  for (const u of users) {
    store.put(u);
  }
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getUsersLocal() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

// --- METADATOS Y CONTEO GLOBAL ---

export async function getMetaLocal(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

export async function setMetaLocal(key, value) {
  const db = await openDB();
  const tx = db.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  store.put({ key, value, updated_at: new Date().toISOString() });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

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

// --- COPIA DE SEGURIDAD LOCAL MÓVIL / PWA ---

export async function exportLocalDataBackup() {
  const db = await openDB();
  const stores = ['products', 'pending_sales', 'pending_transfers', 'nexus_nodes', 'users', 'meta'];
  const exportData = {
    app: 'Miss Chulerías CRM',
    version: '2.9',
    type: 'mobile_local_backup',
    created_at: new Date().toISOString(),
    stores: {}
  };

  for (const storeName of stores) {
    if (db.objectStoreNames.contains(storeName)) {
      const records = await new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      exportData.stores[storeName] = records;
    }
  }

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mch-local-backup-${new Date().toISOString().slice(0, 10)}.mch.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return exportData;
}
