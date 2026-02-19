/**
 * Miss Chulerías - Sistema de Sincronización Offline-First
 * Maneja la sincronización bidireccional entre la base local y el servidor
 */

import { getOfflineDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

// API URL - usa el proxy de Vite en desarrollo
const API_URL = '';

class SyncManager {
  constructor() {
    this.db = null;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.syncCallbacks = [];
    this.offlineCallbacks = [];
    this.onlineCallbacks = [];
    this.setupNetworkListeners();
  }

  /**
   * Inicializa el sync manager
   */
  async initialize() {
    this.db = getOfflineDatabase();
    await this.db.initialize();
    console.log('[SyncManager] Inicializado');
    
    // Intentar sincronizar al iniciar si hay conexión
    if (this.isOnline) {
      this.sync();
    }
  }

  /**
   * Configura listeners para cambios de conectividad
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[SyncManager] Conexión restaurada');
      this.isOnline = true;
      this.onlineCallbacks.forEach(cb => cb());
      // Intentar sincronizar automáticamente
      this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncManager] Conexión perdida');
      this.isOnline = false;
      this.offlineCallbacks.forEach(cb => cb());
    });
  }

  /**
   * Registra callbacks para eventos
   */
  onSync(callback) {
    this.syncCallbacks.push(callback);
  }

  onOnline(callback) {
    this.onlineCallbacks.push(callback);
  }

  onOffline(callback) {
    this.offlineCallbacks.push(callback);
  }

  /**
   * Notifica a los listeners de sincronización
   */
  notifySync(status, data = {}) {
    this.syncCallbacks.forEach(cb => cb({ status, ...data }));
  }

  /**
   * Sincronización completa: sube cambios locales y descarga datos del servidor
   */
  async sync() {
    if (this.isSyncing || !this.isOnline) {
      console.log('[SyncManager] Sincronización omitida:', this.isSyncing ? 'ya en progreso' : 'sin conexión');
      return { success: false, reason: this.isSyncing ? 'sync_in_progress' : 'offline' };
    }

    this.isSyncing = true;
    this.notifySync('started');

    try {
      // 1. Primero subir cambios locales (operaciones offline)
      const uploadResults = await this.uploadPendingChanges();
      
      // 2. Luego descargar datos actualizados del servidor
      const downloadResults = await this.downloadServerData();

      // 3. Registrar sincronización exitosa
      await this.db.run(
        `INSERT OR REPLACE INTO local_config (key, value, updated_at) 
         VALUES ('last_full_sync', ?, ?)`,
        [new Date().toISOString(), new Date().toISOString()]
      );

      const result = {
        success: true,
        uploaded: uploadResults,
        downloaded: downloadResults
      };

      this.notifySync('completed', result);
      console.log('[SyncManager] Sincronización completada:', result);
      
      return result;
    } catch (error) {
      console.error('[SyncManager] Error en sincronización:', error);
      this.notifySync('error', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sube los cambios pendientes al servidor
   */
  async uploadPendingChanges() {
    const results = {
      sales: { uploaded: 0, errors: 0 },
      purchases: { uploaded: 0, errors: 0 },
      transfers: { uploaded: 0, errors: 0 },
      mermas: { uploaded: 0, errors: 0 }
    };

    // Subir ventas pendientes
    const pendingSales = await this.db.all(
      "SELECT * FROM sales WHERE sync_status = 'pending' ORDER BY created_at ASC"
    );

    for (const sale of pendingSales) {
      try {
        const items = await this.db.all(
          "SELECT * FROM sale_items WHERE sale_id = ?",
          [sale.id]
        );

        const response = await fetch(`${API_URL}/api/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...sale,
            items: items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent,
              total_price: item.total_price
            })),
            isOfflineSync: true,
            offlineId: sale.id
          })
        });

        if (response.ok) {
          const serverSale = await response.json();
          await this.db.run(
            `UPDATE sales SET sync_status = 'synced', server_id = ?, synced_at = ? WHERE id = ?`,
            [serverSale.id, new Date().toISOString(), sale.id]
          );
          results.sales.uploaded++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`[SyncManager] Error subiendo venta ${sale.id}:`, error);
        await this.db.run(
          `UPDATE sales SET sync_status = 'error' WHERE id = ?`,
          [sale.id]
        );
        results.sales.errors++;
      }
    }

    // Subir compras pendientes
    const pendingPurchases = await this.db.all(
      "SELECT * FROM purchases WHERE sync_status = 'pending' ORDER BY created_at ASC"
    );

    for (const purchase of pendingPurchases) {
      try {
        const items = await this.db.all(
          "SELECT * FROM purchase_items WHERE purchase_id = ?",
          [purchase.id]
        );

        const response = await fetch(`${API_URL}/api/purchases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...purchase,
            items: items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price
            })),
            isOfflineSync: true,
            offlineId: purchase.id
          })
        });

        if (response.ok) {
          const serverPurchase = await response.json();
          await this.db.run(
            `UPDATE purchases SET sync_status = 'synced', server_id = ?, synced_at = ? WHERE id = ?`,
            [serverPurchase.id, new Date().toISOString(), purchase.id]
          );
          results.purchases.uploaded++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`[SyncManager] Error subiendo compra ${purchase.id}:`, error);
        await this.db.run(
          `UPDATE purchases SET sync_status = 'error' WHERE id = ?`,
          [purchase.id]
        );
        results.purchases.errors++;
      }
    }

    // Subir traslados pendientes
    const pendingTransfers = await this.db.all(
      "SELECT * FROM transfers WHERE sync_status = 'pending' ORDER BY created_at ASC"
    );

    for (const transfer of pendingTransfers) {
      try {
        const items = await this.db.all(
          "SELECT * FROM transfer_items WHERE transfer_id = ?",
          [transfer.id]
        );

        const response = await fetch(`${API_URL}/api/transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...transfer,
            items: items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              received_quantity: item.received_quantity,
              notes: item.notes
            })),
            isOfflineSync: true,
            offlineId: transfer.id
          })
        });

        if (response.ok) {
          const serverTransfer = await response.json();
          await this.db.run(
            `UPDATE transfers SET sync_status = 'synced', server_id = ?, synced_at = ? WHERE id = ?`,
            [serverTransfer.id, new Date().toISOString(), transfer.id]
          );
          results.transfers.uploaded++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`[SyncManager] Error subiendo traslado ${transfer.id}:`, error);
        await this.db.run(
          `UPDATE transfers SET sync_status = 'error' WHERE id = ?`,
          [transfer.id]
        );
        results.transfers.errors++;
      }
    }

    // Subir mermas pendientes
    const pendingMermas = await this.db.all(
      "SELECT * FROM mermas WHERE sync_status = 'pending' ORDER BY created_at ASC"
    );

    for (const merma of pendingMermas) {
      try {
        const response = await fetch(`${API_URL}/api/mermas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...merma,
            isOfflineSync: true,
            offlineId: merma.id
          })
        });

        if (response.ok) {
          const serverMerma = await response.json();
          await this.db.run(
            `UPDATE mermas SET sync_status = 'synced', server_id = ?, synced_at = ? WHERE id = ?`,
            [serverMerma.id, new Date().toISOString(), merma.id]
          );
          results.mermas.uploaded++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`[SyncManager] Error subiendo merma ${merma.id}:`, error);
        await this.db.run(
          `UPDATE mermas SET sync_status = 'error' WHERE id = ?`,
          [merma.id]
        );
        results.mermas.errors++;
      }
    }

    return results;
  }

  /**
   * Descarga los datos actualizados del servidor
   */
  async downloadServerData() {
    const results = {
      products: { added: 0, updated: 0 },
      categories: { added: 0, updated: 0 },
      customers: { added: 0, updated: 0 },
      inventories: { added: 0, updated: 0 }
    };

    try {
      // Obtener fecha de última sincronización
      const lastSync = await this.db.get(
        "SELECT value FROM local_config WHERE key = 'last_full_sync'"
      );
      const lastSyncDate = lastSync?.value || '1970-01-01T00:00:00Z';

      // Descargar productos actualizados
      const productsResponse = await fetch(
        `${API_URL}/api/products/sync?since=${encodeURIComponent(lastSyncDate)}`
      );
      
      if (productsResponse.ok) {
        const products = await productsResponse.json();
        
        for (const product of products) {
          const existing = await this.db.get(
            "SELECT id FROM products WHERE id = ?",
            [product.id]
          );

          if (existing) {
            // Actualizar
            await this.db.run(
              `UPDATE products SET 
                name = ?, description = ?, sku = ?, barcode = ?,
                purchase_price = ?, sale_price = ?, wholesale_price = ?,
                stock = ?, min_stock = ?, category_id = ?, category_name = ?,
                image = ?, is_active = ?, updated_at = ?, last_sync_at = ?
              WHERE id = ?`,
              [
                product.name, product.description, product.sku, product.barcode,
                product.purchase_price, product.sale_price, product.wholesale_price,
                product.stock, product.min_stock, product.category_id, product.category_name,
                product.image, product.is_active ? 1 : 0, product.updated_at, 
                new Date().toISOString(), product.id
              ]
            );
            results.products.updated++;
          } else {
            // Insertar nuevo
            await this.db.run(
              `INSERT INTO products (
                id, name, description, sku, barcode, purchase_price, sale_price,
                wholesale_price, stock, min_stock, category_id, category_name,
                image, is_active, created_at, updated_at, last_sync_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                product.id, product.name, product.description, product.sku, product.barcode,
                product.purchase_price, product.sale_price, product.wholesale_price,
                product.stock, product.min_stock, product.category_id, product.category_name,
                product.image, product.is_active ? 1 : 0, product.created_at, 
                product.updated_at, new Date().toISOString()
              ]
            );
            results.products.added++;
          }
        }
      }

      // Descargar categorías
      const categoriesResponse = await fetch(`${API_URL}/api/categories`);
      if (categoriesResponse.ok) {
        const categories = await categoriesResponse.json();
        
        for (const category of categories) {
          const existing = await this.db.get(
            "SELECT id FROM categories WHERE id = ?",
            [category.id]
          );

          if (existing) {
            await this.db.run(
              `UPDATE categories SET 
                name = ?, description = ?, parent_id = ?, is_active = ?, last_sync_at = ?
              WHERE id = ?`,
              [category.name, category.description, category.parent_id, 
               category.is_active ? 1 : 0, new Date().toISOString(), category.id]
            );
            results.categories.updated++;
          } else {
            await this.db.run(
              `INSERT INTO categories (id, name, description, parent_id, is_active, last_sync_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [category.id, category.name, category.description, category.parent_id,
               category.is_active ? 1 : 0, new Date().toISOString()]
            );
            results.categories.added++;
          }
        }
      }

      // Descargar clientes
      const customersResponse = await fetch(`${API_URL}/api/customers`);
      if (customersResponse.ok) {
        const customers = await customersResponse.json();
        
        for (const customer of customers) {
          const existing = await this.db.get(
            "SELECT id FROM customers WHERE id = ?",
            [customer.id]
          );

          if (existing) {
            await this.db.run(
              `UPDATE customers SET 
                name = ?, email = ?, phone = ?, address = ?, tax_id = ?,
                customer_type = ?, credit_limit = ?, notes = ?, is_active = ?, last_sync_at = ?
              WHERE id = ?`,
              [customer.name, customer.email, customer.phone, customer.address, 
               customer.tax_id, customer.customer_type, customer.credit_limit,
               customer.notes, customer.is_active ? 1 : 0, new Date().toISOString(), customer.id]
            );
            results.customers.updated++;
          } else {
            await this.db.run(
              `INSERT INTO customers (
                id, name, email, phone, address, tax_id, customer_type,
                credit_limit, notes, is_active, created_at, last_sync_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [customer.id, customer.name, customer.email, customer.phone, 
               customer.address, customer.tax_id, customer.customer_type,
               customer.credit_limit, customer.notes, customer.is_active ? 1 : 0,
               customer.created_at, new Date().toISOString()]
            );
            results.customers.added++;
          }
        }
      }

      // Descargar inventarios
      const inventoriesResponse = await fetch(`${API_URL}/api/inventories`);
      if (inventoriesResponse.ok) {
        const inventories = await inventoriesResponse.json();
        
        for (const inventory of inventories) {
          const existing = await this.db.get(
            "SELECT id FROM inventories WHERE id = ?",
            [inventory.id]
          );

          if (existing) {
            await this.db.run(
              `UPDATE inventories SET 
                name = ?, location = ?, is_active = ?, last_sync_at = ?
              WHERE id = ?`,
              [inventory.name, inventory.location, inventory.is_active ? 1 : 0,
               new Date().toISOString(), inventory.id]
            );
            results.inventories.updated++;
          } else {
            await this.db.run(
              `INSERT INTO inventories (id, name, location, is_active, last_sync_at)
               VALUES (?, ?, ?, ?, ?)`,
              [inventory.id, inventory.name, inventory.location,
               inventory.is_active ? 1 : 0, new Date().toISOString()]
            );
            results.inventories.added++;
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[SyncManager] Error descargando datos:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de sincronización
   */
  async getSyncStats() {
    if (!this.db) return null;

    const pendingSales = await this.db.get(
      "SELECT COUNT(*) as count FROM sales WHERE sync_status = 'pending'"
    );
    const pendingPurchases = await this.db.get(
      "SELECT COUNT(*) as count FROM purchases WHERE sync_status = 'pending'"
    );
    const pendingTransfers = await this.db.get(
      "SELECT COUNT(*) as count FROM transfers WHERE sync_status = 'pending'"
    );
    const pendingMermas = await this.db.get(
      "SELECT COUNT(*) as count FROM mermas WHERE sync_status = 'pending'"
    );

    const lastSync = await this.db.get(
      "SELECT value FROM local_config WHERE key = 'last_full_sync'"
    );

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pending: {
        sales: pendingSales?.count || 0,
        purchases: pendingPurchases?.count || 0,
        transfers: pendingTransfers?.count || 0,
        mermas: pendingMermas?.count || 0,
        total: (pendingSales?.count || 0) + (pendingPurchases?.count || 0) + 
               (pendingTransfers?.count || 0) + (pendingMermas?.count || 0)
      },
      lastSync: lastSync?.value || null
    };
  }

  /**
   * Fuerza una sincronización manual
   */
  async forceSync() {
    if (!this.isOnline) {
      return { success: false, reason: 'offline' };
    }
    return await this.sync();
  }
}

// Singleton
let instance = null;

export function getSyncManager() {
  if (!instance) {
    instance = new SyncManager();
  }
  return instance;
}

export default SyncManager;
