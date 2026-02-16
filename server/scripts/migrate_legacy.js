const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuración
const LEGACY_DB_PATH = path.join(__dirname, '../uploads/backup_legacy.db');
const TARGET_DB_PATH = path.join(__dirname, '../inventory.db');

console.log('🚀 Iniciando migración de datos legacy...\n');

// Verificar que existe la base de datos legacy
if (!fs.existsSync(LEGACY_DB_PATH)) {
    console.error('❌ No se encontró la base de datos legacy:', LEGACY_DB_PATH);
    process.exit(1);
}

// Conectar a las bases de datos
let legacyDb, targetDb;
try {
    legacyDb = new Database(LEGACY_DB_PATH, { readonly: true });
    targetDb = new Database(TARGET_DB_PATH);
    console.log('✅ Conexiones a bases de datos establecidas');
} catch (e) {
    console.error('❌ Error al conectar a las bases de datos:', e.message);
    process.exit(1);
}

// Crear tablas de historial si no existen
function createHistoryTables() {
    console.log('\n📋 Creando tablas de historial...');
    
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            cliente TEXT,
            folio TEXT,
            total REAL DEFAULT 0,
            impuesto REAL DEFAULT 0,
            descuento REAL DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            proveedor TEXT,
            folio TEXT,
            total REAL DEFAULT 0,
            impuesto REAL DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_losses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            producto TEXT,
            cantidad INTEGER DEFAULT 0,
            costo REAL DEFAULT 0,
            motivo TEXT,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('   ✅ Tablas de historial creadas');
}

// Función para obtener fecha de transaccion relacionada
function getTransaccionFecha(tipo, id) {
    try {
        const trans = legacyDb.prepare(`
            SELECT fecha FROM transaccion 
            WHERE tipo LIKE ? AND info LIKE ?
            ORDER BY fecha DESC LIMIT 1
        `).get(`%${tipo}%`, `%"${id}"%`);
        return trans ? trans.fecha : null;
    } catch (e) {
        return null;
    }
}

// Función para calcular total de venta desde items
function calcularTotalVenta(ventaId) {
    try {
        const items = legacyDb.prepare(`
            SELECT ti.cantidad, ti.precio
            FROM transaccion_item ti
            JOIN transaccion t ON ti.transaccion_id = t.id
            WHERE t.tipo LIKE '%venta%' AND t.info LIKE ?
        `).all(`%"${ventaId}"%`);
        
        return items.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
    } catch (e) {
        return 0;
    }
}

// Función para migrar productos
function migrateProducts() {
    console.log('\n📦 Migrando productos...');
    
    const legacyProducts = legacyDb.prepare(`
        SELECT 
            i.id as legacy_id,
            i.nombre as name,
            p.precio as sale_price,
            p.costo as cost,
            p.cantidad as stock
        FROM item i
        JOIN producto p ON i.id = p.id
        WHERE i.status = 1
        ORDER BY i.id
    `).all();
    
    console.log(`   Encontrados ${legacyProducts.length} productos para migrar`);
    
    const insertProduct = targetDb.prepare(`
        INSERT INTO products (name, cost_mx, sale_price_manual, description)
        VALUES (?, ?, ?, ?)
    `);
    
    const insertInventory = targetDb.prepare(`
        INSERT OR REPLACE INTO product_inventory (product_id, inventory_id, quantity)
        VALUES (?, ?, ?)
    `);
    
    const getProductByName = targetDb.prepare(`
        SELECT id FROM products WHERE name = ?
    `);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const prod of legacyProducts) {
            try {
                const existing = getProductByName.get(prod.name);
                if (existing) {
                    skipped++;
                    continue;
                }
                
                const result = insertProduct.run(
                    prod.name,
                    prod.cost || 0,
                    prod.sale_price || 0,
                    `Migrado desde sistema legacy. ID original: ${prod.legacy_id}`
                );
                
                const newProductId = result.lastInsertRowid;
                
                insertInventory.run(newProductId, 'mch1', prod.stock || 0);
                insertInventory.run(newProductId, 'mch2', 0);
                insertInventory.run(newProductId, 'almacen', 0);
                
                migrated++;
                
            } catch (e) {
                console.error(`   ❌ Error migrando ${prod.name}:`, e.message);
                errors++;
            }
        }
    });
    
    migrateTransaction();
    
    console.log(`   ✅ Migrados: ${migrated}, Saltados: ${skipped}, Errores: ${errors}`);
    
    return { migrated, skipped, errors };
}

// Función para migrar ventas
function migrateSales() {
    console.log('\n💰 Migrando ventas...');
    
    const sales = legacyDb.prepare(`
        SELECT v.id, v.folio, v.impuesto, v.descuento, v.cliente, v.cliente_temp
        FROM venta v
        ORDER BY v.id DESC
    `).all();
    
    console.log(`   Encontradas ${sales.length} ventas`);
    
    const insertSale = targetDb.prepare(`
        INSERT INTO legacy_sales (legacy_id, folio, fecha, cliente, impuesto, descuento, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let migrated = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const sale of sales) {
            try {
                // Buscar fecha en transaccion
                const fecha = getTransaccionFecha('venta', sale.id) || new Date().toISOString();
                
                // Calcular total desde items
                const total = calcularTotalVenta(sale.id);
                
                insertSale.run(
                    sale.id,
                    sale.folio || '',
                    fecha,
                    sale.cliente || sale.cliente_temp || 'Cliente general',
                    sale.impuesto || 0,
                    sale.descuento || 0,
                    total
                );
                migrated++;
            } catch (e) {
                // Silently skip duplicates
            }
        }
    });
    
    migrateTransaction();
    console.log(`   ✅ ${migrated} ventas migradas`);
    return migrated;
}

// Función para migrar compras
function migratePurchases() {
    console.log('\n📦 Migrando compras...');
    
    const purchases = legacyDb.prepare(`
        SELECT c.id, c.folio, c.impuesto, c.proveedor
        FROM compra c
        ORDER BY c.id DESC
    `).all();
    
    console.log(`   Encontradas ${purchases.length} compras`);
    
    const insertPurchase = targetDb.prepare(`
        INSERT INTO legacy_purchases (legacy_id, folio, fecha, proveedor, impuesto, total)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let migrated = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const purchase of purchases) {
            try {
                // Buscar fecha en transaccion
                const fecha = getTransaccionFecha('compra', purchase.id) || new Date().toISOString();
                
                // Calcular total desde items de transaccion
                let total = 0;
                try {
                    const items = legacyDb.prepare(`
                        SELECT ti.cantidad, ti.precio
                        FROM transaccion_item ti
                        JOIN transaccion t ON ti.transaccion_id = t.id
                        WHERE t.tipo LIKE '%compra%' AND t.info LIKE ?
                    `).all(`%"${purchase.id}"%`);
                    total = items.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
                } catch (e) {}
                
                insertPurchase.run(
                    purchase.id,
                    purchase.folio || '',
                    fecha,
                    purchase.proveedor || 'Sin proveedor',
                    purchase.impuesto || 0,
                    total
                );
                migrated++;
            } catch (e) {
                // Silently skip duplicates
            }
        }
    });
    
    migrateTransaction();
    console.log(`   ✅ ${migrated} compras migradas`);
    return migrated;
}

// Función para migrar mermas
function migrateLosses() {
    console.log('\n⚠️  Migrando mermas...');
    
    const losses = legacyDb.prepare(`
        SELECT m.id, m.fecha, m.producto, m.cantidad, m.costo, m.info
        FROM merma m
        ORDER BY m.fecha DESC
    `).all();
    
    console.log(`   Encontradas ${losses.length} mermas`);
    
    const insertLoss = targetDb.prepare(`
        INSERT INTO legacy_losses (legacy_id, fecha, producto, cantidad, costo, motivo)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let migrated = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const loss of losses) {
            try {
                insertLoss.run(
                    loss.id,
                    loss.fecha,
                    loss.producto || 'Producto desconocido',
                    loss.cantidad || 0,
                    loss.costo || 0,
                    loss.info || 'Sin motivo'
                );
                migrated++;
            } catch (e) {
                // Silently skip duplicates
            }
        }
    });
    
    migrateTransaction();
    console.log(`   ✅ ${migrated} mermas migradas`);
    return migrated;
}

// Ejecutar migración
try {
    console.log('='.repeat(60));
    console.log('MIGRACIÓN DE DATOS LEGACY - MISS CHULERÍAS');
    console.log('='.repeat(60));
    
    createHistoryTables();
    
    const productsResult = migrateProducts();
    const salesCount = migrateSales();
    const purchasesCount = migratePurchases();
    const lossesCount = migrateLosses();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log(`\n📊 Resumen:`);
    console.log(`   📦 Productos: ${productsResult.migrated}`);
    console.log(`   💰 Ventas: ${salesCount}`);
    console.log(`   📥 Compras: ${purchasesCount}`);
    console.log(`   ⚠️  Mermas: ${lossesCount}`);
    
} catch (e) {
    console.error('\n❌ Error durante la migración:', e);
    process.exit(1);
} finally {
    if (legacyDb) legacyDb.close();
    if (targetDb) targetDb.close();
    console.log('\n🔒 Conexiones cerradas');
}
