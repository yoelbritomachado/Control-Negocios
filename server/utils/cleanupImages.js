/**
 * Image Cleanup Utility
 * 
 * Este script limpia la base de datos de referencias a imágenes que no existen
 * físicamente en el servidor. Útil para mantenimiento periódico.
 * 
 * Uso: node cleanupImages.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'inventory.db')
    : path.join(__dirname, '..', 'inventory.db');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const dryRun = process.argv.includes('--dry-run');

console.log(`📁 Database: ${dbPath}`);
console.log(`📁 Uploads dir: ${uploadsDir}`);
console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log('');

// Connect to database
const db = new Database(dbPath);

// Get all products with images
const products = db.prepare('SELECT id, name, images FROM products WHERE images IS NOT NULL AND images != ""').all();

let cleanedProducts = 0;
let removedImages = 0;

console.log(`🔍 Checking ${products.length} products with images...\n`);

products.forEach(product => {
    try {
        const images = JSON.parse(product.images);
        if (!Array.isArray(images) || images.length === 0) return;

        const originalCount = images.length;
        const validImages = images.filter(imgPath => {
            // Extract filename from path
            const filename = path.basename(imgPath);
            const fullPath = path.join(uploadsDir, filename);
            const exists = fs.existsSync(fullPath);
            
            if (!exists) {
                console.log(`  ❌ Missing: ${filename} (product: ${product.name})`);
                removedImages++;
            }
            
            return exists;
        });

        if (validImages.length !== originalCount) {
            cleanedProducts++;
            
            if (!dryRun) {
                // Update database with only valid images
                const newImages = validImages.length > 0 ? JSON.stringify(validImages) : null;
                db.prepare('UPDATE products SET images = ? WHERE id = ?').run(newImages, product.id);
                console.log(`  ✅ Cleaned: ${product.name} (${originalCount - validImages.length} removed)`);
            } else {
                console.log(`  ⚠️  Would clean: ${product.name} (${originalCount - validImages.length} removed)`);
            }
        }
    } catch (e) {
        console.error(`  ⚠️  Error parsing images for product ${product.id}:`, e.message);
    }
});

console.log('\n' + '='.repeat(50));
console.log('📊 Summary:');
console.log(`   Products checked: ${products.length}`);
console.log(`   Products cleaned: ${cleanedProducts}`);
console.log(`   Images removed: ${removedImages}`);
console.log('='.repeat(50));

if (dryRun) {
    console.log('\n💡 This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
}

db.close();
console.log('\n✨ Done!');
