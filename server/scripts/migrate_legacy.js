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

// Función para migrar productos
function migrateProducts() {
    console.log('\n📦 Migrando productos...');
    
    // Obtener productos del sistema legacy
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
    
    // Preparar statement - SIN la columna quantity que no existe
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
    
    // Iniciar transacción
    const migrateTransaction = targetDb.transaction(() => {
        for (const prod of legacyProducts) {
            try {
                // Verificar si ya existe
                const existing = getProductByName.get(prod.name);
                if (existing) {
                    console.log(`   ⚠️  Producto ya existe: ${prod.name}`);
                    skipped++;
                    continue;
                }
                
                // Insertar producto (solo campos que existen)
                const result = insertProduct.run(
                    prod.name,
                    prod.cost || 0,
                    prod.sale_price || 0,
                    `Migrado desde sistema legacy. ID original: ${prod.legacy_id}`
                );
                
                const newProductId = result.lastInsertRowid;
                
                // Insertar en inventario mch1 (inventario principal)
                insertInventory.run(newProductId, 'mch1', prod.stock || 0);
                
                // También en mch2 y almacen con stock 0
                insertInventory.run(newProductId, 'mch2', 0);
                insertInventory.run(newProductId, 'almacen', 0);
                
                migrated++;
                console.log(`   ✅ ${prod.name} (Stock: ${prod.stock}, Precio: $${prod.sale_price})`);
                
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

// Función para generar reporte
function generateReport(productsResult) {
    const report = {
        fecha: new Date().toISOString(),
        productos: {
            total: productsResult.migrated + productsResult.skipped + productsResult.errors,
            migrados: productsResult.migrated,
            saltados: productsResult.skipped,
            errores: productsResult.errors
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
    console.log('='.repeat(60));
    
    const productsResult = migrateProducts();
    generateReport(productsResult);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(60));
    
} catch (e) {
    console.error('\n❌ Error durante la migración:', e);
    process.exit(1);
} finally {
    // Cerrar conexiones
    if (legacyDb) legacyDb.close();
    if (targetDb) targetDb.close();
    console.log('\n🔒 Conexiones cerradas');
}
