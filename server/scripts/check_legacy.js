const Database = require('better-sqlite3');
const path = require('path');

const LEGACY_DB_PATH = path.join(__dirname, '../../uploads/backup_legacy.db');

console.log('🔍 Verificando datos en backup legacy...\n');

try {
    const db = new Database(LEGACY_DB_PATH, { readonly: true });
    
    // Verificar tablas existentes
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📋 Tablas encontradas:');
    tables.forEach(t => console.log(`   - ${t.name}`));
    
    // Verificar productos
    const productCount = db.prepare('SELECT COUNT(*) as count FROM item').get();
    console.log(`\n📦 Productos: ${productCount.count}`);
    
    // Verificar transacciones
    try {
        const transCount = db.prepare('SELECT COUNT(*) as count FROM transaccion').get();
        console.log(`📜 Transacciones: ${transCount.count}`);
        
        if (transCount.count > 0) {
            const tipos = db.prepare('SELECT tipo, COUNT(*) as count FROM transaccion GROUP BY tipo').all();
            console.log('\n📊 Tipos de transacciones:');
            tipos.forEach(t => console.log(`   - ${t.tipo || 'N/A'}: ${t.count}`));
            
            // Mostrar algunas transacciones de ejemplo
            const ejemplos = db.prepare('SELECT * FROM transaccion LIMIT 3').all();
            console.log('\n📝 Ejemplos:');
            ejemplos.forEach((t, i) => {
                console.log(`   ${i + 1}. ID: ${t.id}, Fecha: ${t.fecha}, Tipo: ${t.tipo}`);
                console.log(`      Info: ${t.info?.substring(0, 100)}...`);
            });
        }
    } catch (e) {
        console.log(`❌ Error leyendo transacciones: ${e.message}`);
    }
    
    db.close();
    
} catch (e) {
    console.error('❌ Error:', e.message);
}
