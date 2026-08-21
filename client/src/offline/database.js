/**
 * Miss Chulerías - Sistema de Base de Datos Local Offline
 * Usa SQLite WASM (wa-sqlite) para tener una base SQL completa en el navegador
 */

const DB_NAME = 'miss_chulerias_local';

class OfflineDatabase {
  constructor() {
    this.sqlite = null;
    this.db = null;
    this.isInitialized = false;
    this.vfs = null;
    this.SQLite = null;
    this.initializationPromise = null;
  }

  /**
   * Inicializa la base de datos SQLite en el navegador
   */
  async initialize() {
    if (this.isInitialized) return this.db;

    // React StrictMode/dev puede montar el provider dos veces y disparar
    // initialize() en paralelo. Sin este lock, el segundo intento registra
    // el mismo VFS otra vez y rompe con: "VFS 'miss_chulerias_vfs' already registered".
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._initialize();

    try {
      return await this.initializationPromise;
    } catch (error) {
      // Permitir un nuevo intento futuro si esta inicialización falló.
      this.initializationPromise = null;
      throw error;
    }
  }

  async _initialize() {
    try {
      console.log('[OfflineDB] Inicializando SQLite WASM...');
      
      // Import dinámico de wa-sqlite (para que el build no falle si no está instalado)
      let SQLiteESMFactory, IDBMinimalVFS;
      try {
        const waSqlite = await import('wa-sqlite');
        this.SQLite = waSqlite;
        SQLiteESMFactory = (await import('wa-sqlite/dist/wa-sqlite.mjs')).default;
        IDBMinimalVFS = (await import('wa-sqlite/src/examples/IDBMinimalVFS.js')).IDBMinimalVFS;
      } catch (importError) {
        console.warn('[OfflineDB] wa-sqlite no disponible:', importError.message);
        throw new Error('wa-sqlite no está instalado');
      }
      
      // Cargar el módulo WASM de SQLite
      const module = await SQLiteESMFactory();
      
      // Crear la API de sqlite3
      this.sqlite = this.SQLite.Factory(module);
      
      // Configurar VFS (Virtual File System) para persistencia
      // IDBMinimalVFS usa IndexedDB que funciona en el hilo principal
      this.vfs = new IDBMinimalVFS('miss_chulerias_vfs');
      this.sqlite.vfs_register(this.vfs, true);
      
      // Abrir + crear esquema (con reintento si el IndexedDB está corrupto)
      // El error "unable to open database file" (SQLITE_CANTOPEN) o el journal
      // colgado pueden aparecer tanto en open_v2 como en createSchema (exec).
      const tryOpenAndInit = async () => {
        this.db = await this.sqlite.open_v2(
          `${DB_NAME}.db`,
          this.SQLite.SQLITE_OPEN_CREATE | this.SQLite.SQLITE_OPEN_READWRITE,
          'miss_chulerias_vfs'
        );
        await this.createSchema();
      };

      try {
        await tryOpenAndInit();
      } catch (firstError) {
        console.warn('[OfflineDB] Apertura/esquema falló, purgando IndexedDB y reintentando...', firstError.message);
        // Cerrar lo que se haya abierto
        try { if (this.db) await this.sqlite.close(this.db); } catch (e) {}
        this.db = null;
        try { await this.vfs.close?.(); } catch (e) {}
        // Borrar el IndexedDB del navegador para que se regenere limpio
        await this._purgeIndexedDB();
        // Reintentar una sola vez usando el mismo VFS ya registrado.
        // Re-registrarlo con el mismo nombre provoca: "VFS 'miss_chulerias_vfs' already registered".
        await tryOpenAndInit();
        console.log('[OfflineDB] Base de datos recreada tras limpieza');
      }

      this.isInitialized = true;
      console.log('[OfflineDB] Base de datos inicializada correctamente');
      
      return this.db;
    } catch (error) {
      console.error('[OfflineDB] Error al inicializar:', error);
      throw error;
    }
  }

  /**
   * Borra todas las bases de datos IndexedDB del VFS de wa-sqlite.
   * wa-sqlite guarda cada archivo como una Object Store dentro de una DB
   * llamada igual que el VFS. Un journal colgado ("file not found: ...-journal")
   * indica que el estado interno quedó inconsistente y hay que purgarlo.
   */
  async _purgeIndexedDB() {
    return new Promise((resolve) => {
      const DB_NAMES = ['miss_chulerias_vfs', DB_NAME, `${DB_NAME}.db`, 'IDBMinimalVFS'];
      let remaining = DB_NAMES.length;
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };
      DB_NAMES.forEach((name) => {
        try {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => { console.log(`[OfflineDB] IndexedDB "${name}" borrada`); done(); };
          req.onerror = () => { console.warn(`[OfflineDB] No se pudo borrar "${name}"`); done(); };
          req.onblocked = () => { console.warn(`[OfflineDB] "${name}" bloqueada, reintentando`); done(); };
          req.onupgradeneeded = () => done(); // no-op, solo para algunos navegadores
        } catch (e) {
          done();
        }
      });
      // Fallback: resolver después de 2s por si los eventos no disparan
      setTimeout(resolve, 2000);
    });
  }

  /**
   * Crea el esquema de base de datos local
   * Replica las tablas críticas del servidor
   */
  async createSchema() {
    const schema = `
      -- Tabla de productos (cache local del inventario)
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT UNIQUE,
        barcode TEXT,
        purchase_price REAL DEFAULT 0,
        sale_price REAL DEFAULT 0,
        wholesale_price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        category_id INTEGER,
        category_name TEXT,
        image TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending', 'error'
        last_sync_at TEXT
      );

      -- Índices para búsquedas rápidas
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

      -- Tabla de categorías
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id INTEGER,
        is_active INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        last_sync_at TEXT
      );

      -- Tabla de inventarios/sucursales
      CREATE TABLE IF NOT EXISTS inventories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        is_active INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        last_sync_at TEXT
      );

      -- Tabla de clientes
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        tax_id TEXT,
        customer_type TEXT DEFAULT 'regular', -- 'regular', 'wholesale'
        credit_limit REAL DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        sync_status TEXT DEFAULT 'synced',
        last_sync_at TEXT
      );

      -- Tabla de ventas (offline)
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY, -- UUID generado localmente
        customer_id INTEGER,
        inventory_id INTEGER,
        user_id INTEGER,
        subtotal REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT, -- 'cash', 'card', 'transfer', 'credit'
        payment_amount REAL,
        payment_change REAL,
        status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'cancelled', 'synced'
        notes TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        server_id INTEGER, -- ID del servidor una vez sincronizado
        sync_status TEXT DEFAULT 'pending' -- 'pending', 'syncing', 'synced', 'error'
      );

      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
      CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status);
      CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

      -- Tabla de detalles de venta
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        discount_percent REAL DEFAULT 0,
        total_price REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

      -- Tabla de compras (offline)
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        supplier_id INTEGER,
        inventory_id INTEGER,
        user_id INTEGER,
        subtotal REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'paid'
        status TEXT DEFAULT 'pending', -- 'pending', 'received', 'cancelled', 'synced'
        notes TEXT,
        order_date TEXT,
        received_date TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        server_id INTEGER,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
      CREATE INDEX IF NOT EXISTS idx_purchases_sync ON purchases(sync_status);

      -- Tabla de detalles de compra
      CREATE TABLE IF NOT EXISTS purchase_items (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL,
        product_id INTEGER,
        product_name TEXT, -- En caso de producto nuevo
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        received_quantity INTEGER DEFAULT 0,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );

      -- Tabla de traslados entre inventarios
      CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        from_inventory_id INTEGER NOT NULL,
        to_inventory_id INTEGER NOT NULL,
        user_id INTEGER,
        status TEXT DEFAULT 'pending', -- 'pending', 'in_transit', 'received', 'cancelled', 'synced'
        notes TEXT,
        sent_at TEXT,
        received_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        server_id INTEGER,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
      CREATE INDEX IF NOT EXISTS idx_transfers_sync ON transfers(sync_status);

      -- Tabla de detalles de traslado
      CREATE TABLE IF NOT EXISTS transfer_items (
        id TEXT PRIMARY KEY,
        transfer_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        received_quantity INTEGER,
        notes TEXT,
        FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE CASCADE
      );

      -- Tabla de mermas/pérdidas
      CREATE TABLE IF NOT EXISTS mermas (
        id TEXT PRIMARY KEY,
        product_id INTEGER NOT NULL,
        inventory_id INTEGER,
        quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        notes TEXT,
        user_id INTEGER,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        server_id INTEGER,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_mermas_sync ON mermas(sync_status);

      -- Tabla de configuración local
      CREATE TABLE IF NOT EXISTS local_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );

      -- Tabla de log de sincronización
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL, -- 'products', 'sales', 'purchases', etc.
        entity_id TEXT,
        operation TEXT NOT NULL, -- 'create', 'update', 'delete', 'sync'
        status TEXT NOT NULL, -- 'success', 'error'
        error_message TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at);
    `;

    // Ejecutar el esquema
    await this.exec(schema);
    console.log('[OfflineDB] Esquema creado correctamente');
  }

  /**
   * Ejecuta SQL directamente
   */
  async exec(sql, params = []) {
    if (!this.db) throw new Error('Base de datos no inicializada');
    
    try {
      const results = [];
      await this.sqlite.exec(this.db, sql, params, (row, columns) => {
        const obj = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        results.push(obj);
      });
      return results;
    } catch (error) {
      console.error('[OfflineDB] Error en exec:', error, { sql, params });
      throw error;
    }
  }

  /**
   * Ejecuta una sentencia preparada
   */
  async run(sql, params = []) {
    if (!this.db) throw new Error('Base de datos no inicializada');
    
    try {
      const stmt = await this.sqlite.prepare_v2(this.db, sql);
      if (params.length > 0) {
        params.forEach((param, idx) => {
          this.sqlite.bind(stmt, idx + 1, param);
        });
      }
      await this.sqlite.step(stmt);
      await this.sqlite.finalize(stmt);
      return { success: true };
    } catch (error) {
      console.error('[OfflineDB] Error en run:', error, { sql, params });
      throw error;
    }
  }

  /**
   * Consulta que retorna un solo resultado
   */
  async get(sql, params = []) {
    const results = await this.exec(sql, params);
    return results[0] || null;
  }

  /**
   * Consulta que retorna todos los resultados
   */
  async all(sql, params = []) {
    return await this.exec(sql, params);
  }

  /**
   * Inicia una transacción
   */
  async beginTransaction() {
    await this.run('BEGIN TRANSACTION');
  }

  /**
   * Confirma una transacción
   */
  async commit() {
    await this.run('COMMIT');
  }

  /**
   * Revierte una transacción
   */
  async rollback() {
    await this.run('ROLLBACK');
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close() {
    if (this.db) {
      await this.sqlite.close(this.db);
      this.db = null;
      this.isInitialized = false;
      console.log('[OfflineDB] Conexión cerrada');
    }
  }

  /**
   * Obtiene estadísticas de la base de datos local
   */
  async getStats() {
    if (!this.isInitialized) return null;

    try {
      const tables = ['products', 'categories', 'customers', 'sales', 'purchases', 'transfers', 'mermas'];
      const stats = {};
      
      for (const table of tables) {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result?.count || 0;
      }

      // Ventas pendientes de sincronizar
      const pendingSales = await this.get("SELECT COUNT(*) as count FROM sales WHERE sync_status = 'pending'");
      stats.pendingSales = pendingSales?.count || 0;

      // Última sincronización
      const lastSync = await this.get("SELECT value FROM local_config WHERE key = 'last_full_sync'");
      stats.lastSync = lastSync?.value || null;

      return stats;
    } catch (error) {
      console.error('[OfflineDB] Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
   * Limpia todos los datos locales (usar con cuidado!)
   */
  async clearAllData() {
    if (!this.db) throw new Error('Base de datos no inicializada');
    
    try {
      await this.beginTransaction();
      
      const tables = ['products', 'categories', 'customers', 'sale_items', 'sales', 
                      'purchase_items', 'purchases', 'transfer_items', 'transfers', 'mermas'];
      
      for (const table of tables) {
        await this.run(`DELETE FROM ${table}`);
      }
      
      await this.commit();
      console.log('[OfflineDB] Todos los datos limpiados');
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

export function getOfflineDatabase() {
  if (!instance) {
    instance = new OfflineDatabase();
  }
  return instance;
}

export default OfflineDatabase;
