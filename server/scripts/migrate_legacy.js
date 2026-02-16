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
    
    // Tabla de historial de ventas legacy
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            tipo TEXT,
            info TEXT,
            total REAL DEFAULT 0,
            items_count INTEGER DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Tabla de historial de compras legacy
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            proveedor TEXT,
            producto TEXT,
            cantidad INTEGER DEFAULT 0,
            costo_unitario REAL DEFAULT 0,
            total REAL DEFAULT 0,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Tabla de historial de mermas/pérdidas legacy
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS legacy_losses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            legacy_id INTEGER,
            fecha TEXT,
            tipo TEXT,
            producto TEXT,
            cantidad INTEGER DEFAULT 0,
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
    let errors = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const prod of legacyProducts) {
            try {
                const existing = getProductByName.get(prod.name);
                if (existing) {
                    console.log(`   ⚠️  Producto ya existe: ${prod.name}`);
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
                if (migrated % 50 === 0) {
                    console.log(`   ✅ ${migrated} productos migrados...`);
                }
                
            } catch (e) {
                console.error(`   ❌ Error migrando ${prod.name}:`, e.message);
                errors++;
            }
        }
    });
    
    migrateTransaction();
    
    console.log(`\n📊 Resumen de productos:`);
    console.log(`   ✅ Migrados: ${migrated}`);
    console.log(`   ⚠️  Saltados (duplicados): ${skipped}`);
    console.log(`   ❌ Errores: ${errors}`);
    
    return { migrated, skipped, errors };
}

// Función para migrar transacciones (ventas, compras, mermas)
function migrateTransactions() {
    console.log('\n📜 Migrando historial de transacciones...');
    
    const transactions = legacyDb.prepare(`
        SELECT id, fecha, tipo, info, status
        FROM transaccion
        ORDER BY fecha DESC
    `).all();
    
    console.log(`   Encontradas ${transactions.length} transacciones`);
    
    const insertSale = targetDb.prepare(`
        INSERT INTO legacy_sales (legacy_id, fecha, tipo, info, total, items_count)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertPurchase = targetDb.prepare(`
        INSERT INTO legacy_purchases (legacy_id, fecha, proveedor, producto, cantidad, costo_unitario, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertLoss = targetDb.prepare(`
        INSERT INTO legacy_losses (legacy_id, fecha, tipo, producto, cantidad, motivo)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let salesCount = 0;
    let purchasesCount = 0;
    let lossesCount = 0;
    let errors = 0;
    
    const migrateTransaction = targetDb.transaction(() => {
        for (const trans of transactions) {
            try {
                // Parsear el campo info (JSON)
                let info = {};
                try {
                    info = JSON.parse(trans.info || '{}');
                } catch (e) {
                    info = { raw: trans.info };
                }
                
                // Clasificar por tipo
                const tipo = (trans.tipo || '').toLowerCase();
                
                if (tipo.includes('venta') || tipo.includes('sale')) {
                    // Es una venta
                    insertSale.run(
                        trans.id,
                        trans.fecha,
                        trans.tipo,
                        trans.info,
                        info.total || info.monto || 0,
                        info.items_count || info.cantidad_items || 0
                    );
                    salesCount++;
                    
                } else if (tipo.includes('compra') || tipo.includes('purchase') || tipo.includes('entrada')) {
                    // Es una compra
                    insertPurchase.run(
                        trans.id,
                        trans.fecha,
                        info.proveedor || info.proveedor_nombre || 'Sin proveedor',
                        info.producto || info.producto_nombre || 'Sin producto',
                        info.cantidad || 0,
                        info.costo_unitario || info.costo || 0,
                        info.total || info.monto || 0
                    );
                    purchasesCount++;
                    
                } else if (tipo.includes('merma') || tipo.includes('perdida') || tipo.includes('loss') || tipo.includes('daño')) {
                    // Es una merma/pérdida
                    insertLoss.run(
                        trans.id,
                        trans.fecha,
                        trans.tipo,
                        info.producto || info.producto_nombre || 'Sin producto',
                        info.cantidad || 0,
                        info.motivo || info.razon || 'Sin motivo'
                    );
                    lossesCount++;
                    
                } else {
                    // Otro tipo - guardar como venta genérica
                    insertSale.run(
                        trans.id,
                        trans.fecha,
                        trans.tipo,
                        trans.info,
                        info.total || info.monto || 0,
                        0
                    );
                    salesCount++;
                }
                
            } catch (e) {
                console.error(`   ❌ Error migrando transacción ${trans.id}:`, e.message);
                errors++;
            }
        }
    });
    
    migrateTransaction();
    
    console.log(`\n📊 Resumen de transacciones:`);
    console.log(`   💰 Ventas: ${salesCount}`);
    console.log(`   📦 Compras: ${purchasesCount}`);
    console.log(`   ⚠️  Mermas/Pérdidas: ${lossesCount}`);
    console.log(`   ❌ Errores: ${errors}`);
    
    return { salesCount, purchasesCount, lossesCount, errors };
}

// Función para generar reporte
function generateReport(productsResult, transactionsResult) {
    const report = {
        fecha: new Date().toISOString(),
        productos: {
            total: productsResult.migrated + productsResult.skipped + productsResult.errors,
            migrados: productsResult.migrated,
            saltados: productsResult.skipped,
            errores: productsResult.errors
        },
        transacciones: {
            ventas: transactionsResult.salesCount,
            compras: transactionsResult.purchasesCount,
            mermas: transactionsResult.lossesCount,
            errores: transactionsResult.errors
        }
    };
    
    const reportPath = path.join(__dirname, '../uploads/migration_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Reporte guardado en: ${reportPath}`);
}

// Ejecutar migración
try {
    console.log('='.repeat(60));
    console.log('MIGRACIÓN DE DATOS LEGACY - MISS CHULERÍAS');
    console.log('Incluye: Productos, Ventas, Compras, Mermas');
    console.log('='.repeat(60));
    
    // Crear tablas de historial
    createHistoryTables();
    
    // Migrar productos
    const productsResult = migrateProducts();
    
    // Migrar transacciones
    const transactionsResult = migrateTransactions();
    
    // Generar reporte
    generateReport(productsResult, transactionsResult);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log('\n📍 Puedes ver el historial en:');
    console.log('   - legacy_sales (ventas)');
    console.log('   - legacy_purchases (compras)');
    console.log('   - legacy_losses (mermas/pérdidas)');
    
} catch (e) {
    console.error('\n❌ Error durante la migración:', e);
    process.exit(1);
} finally {
    if (legacyDb) legacyDb.close();
    if (targetDb) targetDb.close();
    console.log('\n🔒 Conexiones cerradas');
}
