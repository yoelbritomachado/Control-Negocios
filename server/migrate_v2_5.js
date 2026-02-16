const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'inventory.db');
const db = new Database(dbPath);

console.log("Iniciando migración MCH v2.5 en " + dbPath + "...");

try {
    // 1. Create Sessions Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sales_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            initial_cash REAL DEFAULT 0,
            
            -- Calculated at closing
            total_sales REAL DEFAULT 0,
            total_cost REAL DEFAULT 0,
            total_profit REAL DEFAULT 0,
            wage_amount REAL DEFAULT 0, -- 5% of profit
            
            declared_cash REAL DEFAULT 0,
            status TEXT DEFAULT 'open', -- open, closed, approved
            notes TEXT,
            
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `).run();
    console.log("Tabla 'sales_sessions' creada/verificada.");

    // 2. Create Expenses Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            user_id INTEGER,
            type TEXT NOT NULL, -- 'area', 'cleaning', 'other'
            amount REAL NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            
            FOREIGN KEY(session_id) REFERENCES sales_sessions(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `).run();
    console.log("Tabla 'expenses' creada/verificada.");

    // 3. Create Sales Table (Was missing)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total REAL DEFAULT 0,
            items_count INTEGER DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            date TEXT NOT NULL,
            user_id INTEGER,
            inventory_id TEXT, -- Linked to inventories.id (e.g. 'mch1')
            session_id INTEGER, -- Linked to local session
            
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(inventory_id) REFERENCES inventories(id),
            FOREIGN KEY(session_id) REFERENCES sales_sessions(id)
        )
    `).run();
    console.log("Tabla 'sales' creada/verificada.");

    // 4. Create Sale Items Table (Was missing)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            cost REAL DEFAULT 0,
            
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id) 
        )
    `).run();
    console.log("Tabla 'sale_items' creada/verificada.");

    // 5. Create Returns Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_id INTEGER,
            session_id INTEGER,
            user_id INTEGER,
            
            type TEXT NOT NULL, -- 'broken_internal', 'taste', 'broken_client'
            amount_returned REAL NOT NULL,
            stock_restored INTEGER DEFAULT 0, -- 1 if yes, 0 if no
            evidence_url TEXT, -- Path to photo
            
            date TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, approved
            
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(session_id) REFERENCES sales_sessions(id)
        )
    `).run();
    console.log("Tabla 'returns' creada/verificada.");

    // 6. Ensure session_id exists in sales (if table existed before)
    try {
        const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
        const hasSessionId = tableInfo.some(c => c.name === 'session_id');
        if (!hasSessionId) {
            db.prepare("ALTER TABLE sales ADD COLUMN session_id INTEGER REFERENCES sales_sessions(id)").run();
            console.log("Columna 'session_id' agregada a tabla 'sales'.");
        }
    } catch (e) {
        console.error("Error verificando sales.session_id:", e.message);
    }

    console.log("Migración completada con éxito. 🚀");

} catch (error) {
    console.error("Error durante la migración:", error);
} finally {
    db.close();
}
