const Database = require('better-sqlite3');
const db = new Database('inventory.db');

// List users
const users = db.prepare('SELECT id, username, email, role, can_edit, is_verified, is_banned FROM users').all();
console.log('=== USERS ===');
console.log(JSON.stringify(users, null, 2));

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n=== TABLES ===');
console.log(tables.map(t => t.name).join(', '));

// Count products
const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
console.log('\n=== PRODUCT COUNT ===');
console.log(products.count + ' products');

// Sample product
const sample = db.prepare('SELECT * FROM products LIMIT 1').get();
console.log('\n=== SAMPLE PRODUCT ===');
console.log(JSON.stringify(sample, null, 2));

// Count sales
try {
    const sales = db.prepare('SELECT COUNT(*) as count FROM sales').get();
    console.log('\n=== SALES COUNT ===');
    console.log(sales.count + ' sales');
} catch(e) {
    console.log('\n=== SALES: ' + e.message);
}

// Count sessions
try {
    const sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
    console.log('\n=== SESSIONS COUNT ===');
    console.log(sessions.count + ' sessions');
} catch(e) {
    console.log('\n=== SESSIONS: ' + e.message);
}
