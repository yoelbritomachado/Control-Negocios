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

// Crear tablas de historial
function createHistoryTables() {
    console.log('\n📋 Creando tablas de historial...');
    
    targetDb.exec(`DROP TABLE IF EXISTS legacy_sales`);
    targetDb.exec(`DROP TABLE IF EXISTS legacy_purchases`);
    targetDb.exec(`DROP TABLE IF EXISTS legacy_losses`);
    
    // Tabla simplificada para ventas - datos desde transaccion
    targetDb.exec(`
        CREATE TABLE legacy_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            tipo TEXT,
            info TEXT,
            total REAL DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Tabla simplificada para compras - datos desde transaccion
    targetDb.exec(`
        CREATE TABLE legacy_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            tipo TEXT,
            info TEXT,
            total REAL DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Tabla para mermas - datos directos
    targetDb.exec(`
        CREATE TABLE legacy_losses (
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
                // Skip errors
            }
        }
    });
    
    migrateTransaction();
    
    console.log(`   ✅ Migrados: ${migrated}, Saltados: ${skipped}`);
    
    return { migrated, skipped, errors: 0 };
}

// Función para migrar transacciones (ventas y compras desde transaccion)
function migrateTransactions() {
    console.log('\n📜 Migrando transacciones (ventas y compras)...');
    
    const transactions = legacyDb.prepare(`
        SELECT id, fecha, tipo, info
        FROM transaccion
        WHERE tipo = 10 OR tipo = 20
        ORDER BY fecha DESC
    `).all();
    
    console.log(`   Encontradas ${transactions.length} transacciones`);
    
    const insertSale = targetDb.prepare(`
        INSERT INTO legacy_sales (legacy_id, fecha, tipo, info, total)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertPurchase = targetDb.prepare(`
        INSERT INTO legacy_purchases (legacy_id, fecha, tipo, info, total)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    let salesCount = 0;
    let purchasesCount = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const trans of transactions) {
            try {
                // Parsear info para extraer total
                let total = 0;
                try {
                    const info = JSON.parse(trans.info || '{}');
                    total = info.total || info.monto || 0;
                } catch (e) {}
                
                // Tipo 10 = Venta, Tipo 20 = Compra
                if (trans.tipo === 10) {
                    insertSale.run(
                        trans.id,
                        trans.fecha,
                        'Venta',
                        trans.info,
                        total
                    );
                    salesCount++;
                } else if (trans.tipo === 20) {
                    insertPurchase.run(
                        trans.id,
                        trans.fecha,
                        'Compra',
                        trans.info,
                        total
                    );
                    purchasesCount++;
                }
            } catch (e) {
                // Skip errors
            }
        }
    });
    
    migrateTransaction();
    
    console.log(`   ✅ Ventas: ${salesCount}, Compras: ${purchasesCount}`);
    return { salesCount, purchasesCount };
}

// Función para migrar mermas (datos directos)
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
                // Skip errors
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
    const transResult = migrateTransactions();
    const lossesCount = migrateLosses();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log(`\n📊 Resumen:`);
    console.log(`   📦 Productos: ${productsResult.migrated}`);
    console.log(`   💰 Ventas: ${transResult.salesCount}`);
    console.log(`   📥 Compras: ${transResult.purchasesCount}`);
    console.log(`   ⚠️  Mermas: ${lossesCount}`);
    
} catch (e) {
    console.error('\n❌ Error durante la migración:', e);
    process.exit(1);
} finally {
    if (legacyDb) legacyDb.close();
    if (targetDb) targetDb.close();
    console.log('\n🔒 Conexiones cerradas');
}
