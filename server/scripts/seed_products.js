const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../inventory.db');
const db = new Database(dbPath);

console.log('--- Force Seeding Product ---');

const insert = db.prepare('INSERT INTO products (name, cost_mx, sale_price_manual, description) VALUES (?, ?, ?, ?)');
let productId;

try {
    const info = insert.run('Producto Prueba Force', 100, 200, 'Test Product Force');
    productId = info.lastInsertRowid;
    console.log('Created: Producto Prueba Force (ID:', productId, ')');
} catch (e) {
    console.log('Error creating product (maybe exists?):', e.message);
    const existing = db.prepare("SELECT id FROM products WHERE name = 'Producto Prueba Force'").get();
    if (existing) {
        productId = existing.id;
        console.log('Found existing ID:', productId);
    }
}

if (productId) {
    console.log('--- Seeding Stock ---');
    const inventories = db.prepare('SELECT id FROM inventories').all();
    const insertStock = db.prepare('INSERT OR REPLACE INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)');

    if (inventories.length > 0) {
        // Seed in ALL inventories just in case
        inventories.forEach(inv => {
            insertStock.run(productId, inv.id, 100);
            console.log(`Seeded 100 stock for inventory ${inv.id}`);
        });
    } else {
        console.log('No inventories found!');
    }
}
