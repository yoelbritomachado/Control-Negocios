const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'server', 'inventory.db');
console.log(`🔌 Conectando para reinicio maestro: ${dbPath}`);

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);

console.log("🔥 Eliminando tablas antiguas...");
db.exec("DROP TABLE IF EXISTS product_inventory");
// Products tiene FK a inventories en esquema viejo? Sí, inventory_id.
// Product_inventory tiene FK a products y inventories.
// Borrar en orden seguro.
db.exec("DROP TABLE IF EXISTS product_inventory");
db.exec("DROP TABLE IF EXISTS product_images");
db.exec("DROP TABLE IF EXISTS products");
db.exec("DROP TABLE IF EXISTS inventories");
db.exec("DROP TABLE IF EXISTS settings");
db.exec("DROP TABLE IF EXISTS users");
db.exec("DROP TABLE IF EXISTS system_config");
db.exec("DROP TABLE IF EXISTS blacklisted_emails");

console.log("🏗️ Creando esquema MCH v2.0...");

// 1. Inventories
db.exec(`
  CREATE TABLE inventories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    icon TEXT,
    color TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. Products
db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0, -- Legacy/Global cache
    cost_mx REAL DEFAULT 0.0,
    sale_price_manual REAL DEFAULT 0.0,
    description TEXT,
    image TEXT,
    inventory_id INTEGER DEFAULT 1 -- Legacy ref
  )
`);

// 3. Product Inventory Pivot
db.exec(`
  CREATE TABLE product_inventory (
    product_id INTEGER NOT NULL,
    inventory_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (product_id, inventory_id),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
  )
`);

// 4. Product Images
db.exec(`
  CREATE TABLE product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

// 5. Users
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    pin TEXT,
    otp_code TEXT,
    otp_expires INTEGER,
    is_verified INTEGER DEFAULT 1,
    is_banned INTEGER DEFAULT 0,
    session_token TEXT,
    last_ip TEXT,
    role TEXT DEFAULT 'viewer',
    can_edit INTEGER DEFAULT 0
  )
`);

// 6. Settings & Config
db.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value REAL)`);
db.exec(`CREATE TABLE system_config (key TEXT PRIMARY KEY, value TEXT)`);
db.exec(`CREATE TABLE blacklisted_emails (email TEXT PRIMARY KEY, banned_at DATETIME DEFAULT CURRENT_TIMESTAMP, reason TEXT)`);

console.log("🌱 Sembrando datos base...");

// Seed Inventories
const insertInv = db.prepare("INSERT INTO inventories (id, name, code, icon, color, type) VALUES (?, ?, ?, ?, ?, ?)");
insertInv.run('alm', 'Almacén MCH', 'ALM', 'ph-warehouse', '#58a6ff', 'warehouse');
insertInv.run('mch1', 'MCH 1', 'MCH1', 'ph-storefront', '#3fb950', 'kiosk');
insertInv.run('mch2', 'MCH 2', 'MCH2', 'ph-shopping-bag', '#d29922', 'kiosk');

// Seed Settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
const defaultSettings = [
    { key: 'RATE_MXN_USD', value: 19 },
    { key: 'RATE_USD_MN', value: 550 },
    { key: 'RATE_EUR_MN', value: 590 },
    { key: 'RATE_MXN_MN', value: 17.30 },
    { key: 'MARGIN_MULTIPLIER', value: 3.5 }
];
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed Admin User (Optional, generic)
// db.prepare("INSERT OR IGNORE INTO users (email, role, can_edit) VALUES (?, 'admin', 1)").run('admin@mch.com');

console.log("✅ Base de datos inicializada correctamente.");
