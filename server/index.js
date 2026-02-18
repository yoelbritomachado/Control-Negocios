const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const archiver = require('archiver');
const nodemailer = require('nodemailer'); // Added

const app = express();
const port = process.env.PORT || 3001;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yoelbritomachado@gmail.com';

// Database path - use Railway's persistent storage or local
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'inventory.db')
    : path.join(__dirname, 'inventory.db');

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large backups
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Custom middleware for /uploads with fallback placeholder
app.use('/uploads', (req, res, next) => {
    const filePath = path.join(__dirname, 'uploads', decodeURIComponent(req.path));
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        return next(); // Continue to static middleware
    }
    
    // File doesn't exist - serve dynamic SVG placeholder
    const fileName = path.basename(req.path, path.extname(req.path));
    const initials = fileName.substring(0, 2).toUpperCase();
    
    // Generate SVG placeholder with gradient background
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#grad)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          font-family="system-ui, -apple-system, sans-serif" font-size="120" font-weight="bold" fill="#475569">
        ${initials}
    </text>
    <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" 
          font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#64748b">
        Sin imagen
    </text>
</svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(svg);
}, express.static(path.join(__dirname, 'uploads')));

// Global middleware to set default user if no authentication
// This allows the system to work without login
app.use((req, res, next) => {
    // Skip for login/register/auth endpoints
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || req.path.startsWith('/api/auth')) {
        return next();
    }

    // If req.user is not set (no auth middleware applied yet), set default user
    if (!req.user) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // No token - use default user with full permissions
            req.user = {
                id: 1,
                username: 'default',
                role: 'admin',
                email: 'default@system.local',
                can_edit: 1
            };
        } else {
            // Try to get user from token
            const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
            if (user) {
                req.user = user;
            } else {
                // Invalid token - use default user with full permissions
                req.user = {
                    id: 1,
                    username: 'default',
                    role: 'admin',
                    email: 'default@system.local',
                    can_edit: 1
                };
            }
        }
    }
    next();
});

// Multer Storage for MNX files
const mnxStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'backup_upload_' + Date.now() + '.mnx');
    }
});
const mnxUpload = multer({ storage: mnxStorage });

// --- MNX UPLOAD AND EXTRACTION ---
// Helper to authenticate admin requests (for routes defined before auth middleware)
const authenticateAdmin = (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Acceso denegado. Token faltante.' });
        return null;
    }

    const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
    if (!user) {
        res.status(403).json({ error: 'Token inválido o expirado.' });
        return null;
    }

    if (user.role !== 'admin' && user.role !== 'owner') {
        res.status(403).json({ error: 'Solo administradores pueden acceder.' });
        return null;
    }

    return user;
};

app.post('/api/admin/upload-mnx', mnxUpload.single('file'), (req, res) => {
    // Authenticate manually
    const user = authenticateAdmin(req, res);
    if (!user) return;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const mnxPath = req.file.path;
        const extractDir = path.join(__dirname, 'uploads', 'temp_mnx');

        // Clean and create extraction directory
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });

        // Extract ZIP (MNX is a renamed ZIP)
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(mnxPath);
        zip.extractAllTo(extractDir, true);

        // Find the database file (usually named like bd_*.db)
        const files = fs.readdirSync(extractDir);
        const dbFile = files.find(f => f.endsWith('.db') && f.startsWith('bd_'));

        if (!dbFile) {
            return res.status(400).json({ error: 'No se encontró base de datos en el archivo' });
        }

        // Rename to backup_legacy.db
        const dbPath = path.join(extractDir, dbFile);
        const legacyPath = path.join(__dirname, 'uploads', 'backup_legacy.db');
        fs.copyFileSync(dbPath, legacyPath);

        // Clean up uploaded MNX file
        fs.unlinkSync(mnxPath);

        console.log(`MNX extracted successfully. DB: ${dbFile}, Images: ${files.filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length}`);

        res.json({
            success: true,
            message: 'Archivo extraído correctamente',
            dbFile: dbFile,
            totalFiles: files.length
        });

    } catch (e) {
        console.error('MNX Upload Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Check if local MNX file exists
app.get('/api/admin/check-mnx', (req, res) => {
    // Authenticate manually
    const user = authenticateAdmin(req, res);
    if (!user) return;

    try {
        // Check multiple possible locations
        const possiblePaths = [
            path.join(__dirname, '..', 'backup.mnx'),  // Repo root
            path.join(__dirname, 'backup.mnx'),        // Server folder
            path.join(__dirname, 'uploads', 'backup.mnx'), // Uploads folder
        ];

        for (const mnxPath of possiblePaths) {
            if (fs.existsSync(mnxPath)) {
                const stats = fs.statSync(mnxPath);
                return res.json({
                    exists: true,
                    filename: 'backup.mnx',
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    path: mnxPath
                });
            }
        }

        res.json({ exists: false });

    } catch (e) {
        console.error('Check MNX Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Extract local MNX file
app.post('/api/admin/extract-local-mnx', (req, res) => {
    // Authenticate manually
    const user = authenticateAdmin(req, res);
    if (!user) return;

    try {
        // Find the MNX file
        const possiblePaths = [
            path.join(__dirname, '..', 'backup.mnx'),
            path.join(__dirname, 'backup.mnx'),
            path.join(__dirname, 'uploads', 'backup.mnx'),
        ];

        let mnxPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                mnxPath = p;
                break;
            }
        }

        if (!mnxPath) {
            return res.status(404).json({ error: 'No se encontró backup.mnx' });
        }

        const extractDir = path.join(__dirname, 'uploads', 'temp_mnx');

        // Clean and create extraction directory
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });

        // Extract ZIP
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(mnxPath);
        zip.extractAllTo(extractDir, true);

        // Find the database file
        const files = fs.readdirSync(extractDir);
        const dbFile = files.find(f => f.endsWith('.db') && f.startsWith('bd_'));

        if (!dbFile) {
            return res.status(400).json({ error: 'No se encontró base de datos en el archivo' });
        }

        // Copy to backup_legacy.db
        const dbPath = path.join(extractDir, dbFile);
        const legacyPath = path.join(__dirname, 'uploads', 'backup_legacy.db');
        fs.copyFileSync(dbPath, legacyPath);

        console.log(`Local MNX extracted. DB: ${dbFile}, Images: ${files.filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length}`);

        res.json({
            success: true,
            message: 'Archivo extraído correctamente',
            dbFile: dbFile,
            totalFiles: files.length
        });

    } catch (e) {
        console.error('Extract Local MNX Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Multer Storage for Returns/Evidence
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/returns');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- AUTH MIDDLEWARE ---
app.use((req, res, next) => {
    // Allow static uploads
    if (req.path.startsWith('/uploads')) return next();

    // Allow auth endpoints
    if (req.path.startsWith('/api/login') ||
        req.path.startsWith('/api/register') ||
        req.path.startsWith('/api/auth')) {
        return next();
    }

    // Only check /api routes
    if (!req.path.startsWith('/api')) return next();

    // If a user is already set (e.g. by default user middleware), allow access
    if (req.user) return next();

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token faltante.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
        if (!user) return res.status(403).json({ error: 'Token inválido o expirado.' });

        req.user = user;
        next();
    } catch (e) {
        return res.status(500).json({ error: 'Database error in auth middleware' });
    }
});

// 3. Create Sale (Checkout) - Updated for Sessions
app.post('/api/sales', (req, res) => { // Auth checked by middleware
    try {
        const { items, total, paymentMethod, inventoryId } = req.body;

        if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

        // VERIFY SESSION
        const session = db.prepare("SELECT id FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);
        if (!session) {
            return res.status(403).json({ error: "No hay sesión de venta abierta. Por favor inicie turno." });
        }

        const saleDate = new Date().toISOString();

        // Transaction
        const transaction = db.transaction(() => {
            // 1. Insert Sale Record
            const sale = db.prepare(`
                INSERT INTO sales (total, items_count, payment_method, date, user_id, inventory_id, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(total, items.length, paymentMethod || 'cash', saleDate, req.user.id, inventoryId || 'mch1', session.id);

            const saleId = sale.lastInsertRowid;

            // 2. Process Items & Update Stock
            const insertItem = db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, quantity, price, cost)
                VALUES (?, ?, ?, ?, ?)
            `);

            const updateStock = db.prepare(`
                UPDATE product_inventory 
                SET quantity = quantity - ? 
                WHERE product_id = ? AND inventory_id = ?
            `);

            const checkStock = db.prepare(`
                SELECT quantity FROM product_inventory WHERE product_id = ? AND inventory_id = ?
            `);

            items.forEach(item => {
                const targetInv = inventoryId || 'mch1';
                const current = checkStock.get(item.id, targetInv);
                if (!current || current.quantity < item.quantity) {
                    throw new Error(`Stock insuficiente para producto ID ${item.id}`);
                }

                updateStock.run(item.quantity, item.id, targetInv);
                insertItem.run(saleId, item.id, item.quantity, item.sale_price_manual || 0, item.cost_mn || 0);
            });

            return saleId;
        });

        const newSaleId = transaction();
        console.log(`Sale #${newSaleId} completed in Session #${session.id}`);

        // Fetch the complete sale with items for the response
        const saleItems = db.prepare(`
            SELECT si.product_id, si.quantity, si.price, si.cost, p.name, p.code
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `).all(newSaleId);

        res.json({
            success: true,
            saleId: newSaleId,
            items: saleItems
        });

    } catch (e) {
        console.error("Sale Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- SESSION MANAGEMENT ---

// Open Session
app.post('/api/sessions/open', (req, res) => {
    try {
        const { initial_cash } = req.body;
        const userId = req.user.id;

        const existing = db.prepare("SELECT id FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(userId);
        if (existing) return res.status(400).json({ error: "Ya tienes una sesión abierta." });

        const info = db.prepare(`
            INSERT INTO sales_sessions (user_id, start_time, initial_cash, status)
            VALUES (?, ?, ?, 'open')
        `).run(userId, new Date().toISOString(), initial_cash || 0);

        res.json({ success: true, sessionId: info.lastInsertRowid });
    } catch (e) {
        logError("Open Session", e);
        res.status(500).json({ error: e.message });
    }
});

// Close Session & Calculate Wages
app.post('/api/sessions/close', (req, res) => {
    try {
        const { declared_cash, notes } = req.body;
        const userId = req.user.id;

        const session = db.prepare("SELECT * FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(userId);
        if (!session) return res.status(400).json({ error: "No hay sesión abierta." });

        // Calculate Sales Totals
        const salesData = db.prepare(`
            SELECT 
                COALESCE(SUM(s.total), 0) as total_sales,
                COALESCE(SUM(si.quantity * si.cost), 0) as total_cost
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.session_id = ?
        `).get(session.id);

        // Calculate Sales by Payment Method
        const salesByMethod = db.prepare(`
            SELECT 
                payment_method,
                COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE session_id = ?
            GROUP BY payment_method
        `).all(session.id);

        // Calculate Expenses Totals
        const expensesData = db.prepare(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE session_id = ?
        `).get(session.id);

        // Calculate Expenses by Payment Method
        const expensesByMethod = db.prepare(`
            SELECT 
                payment_method,
                COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE session_id = ?
            GROUP BY payment_method
        `).all(session.id);

        const totalProfit = salesData.total_sales - salesData.total_cost;
        const wage = totalProfit > 0 ? (totalProfit * 0.05) : 0; // 5% of profit

        // Calculate final cash to deliver
        // Efectivo en ventas - Gastos en efectivo
        const cashSales = salesByMethod.find(s => s.payment_method === 'cash')?.total || 0;
        const transferSales = salesByMethod.find(s => s.payment_method === 'transfer')?.total || 0;
        const cashExpenses = expensesByMethod.find(e => e.payment_method === 'cash')?.total || 0;
        const transferExpenses = expensesByMethod.find(e => e.payment_method === 'transfer')?.total || 0;
        
        const finalCash = cashSales - cashExpenses;
        const finalTransfer = transferSales - transferExpenses;

        db.prepare(`
            UPDATE sales_sessions 
            SET end_time = ?, 
                declared_cash = ?, 
                total_sales = ?, 
                total_cost = ?, 
                total_profit = ?, 
                wage_amount = ?, 
                status = 'closed',
                notes = ?
            WHERE id = ?
        `).run(
            new Date().toISOString(),
            declared_cash || 0,
            salesData.total_sales,
            salesData.total_cost,
            totalProfit,
            wage,
            notes || '',
            session.id
        );

        res.json({ 
            success: true, 
            wage: wage,
            summary: {
                sales: {
                    total: salesData.total_sales,
                    cash: cashSales,
                    transfer: transferSales
                },
                expenses: {
                    total: expensesData.total_expenses,
                    cash: cashExpenses,
                    transfer: transferExpenses
                },
                final: {
                    cash: finalCash,
                    transfer: finalTransfer,
                    total: finalCash + finalTransfer
                }
            }
        });

    } catch (e) {
        logError("Close Session", e);
        res.status(500).json({ error: e.message });
    }
});

// Get Session Status
app.get('/api/sessions/status', (req, res) => {
    try {
        const session = db.prepare("SELECT * FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);
        if (session) {
            // Get current totals
            const sales = db.prepare("SELECT COALESCE(SUM(total), 0) as current_sales FROM sales WHERE session_id = ?").get(session.id);
            res.json({ isOpen: true, session, currentSales: sales.current_sales });
        } else {
            res.json({ isOpen: false });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- EXPENSES & RETURNS ---

// Create Expense
app.post('/api/expenses', (req, res) => {
    try {
        const { type, amount, description, payment_method } = req.body;
        // type: area ($3000), cleaning ($100), other (manual)

        // Optional: Link to session
        const session = db.prepare("SELECT id FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);
        const sessionId = session ? session.id : null;

        db.prepare(`
            INSERT INTO expenses (session_id, user_id, type, amount, description, payment_method, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(sessionId, req.user.id, type, amount, description || '', payment_method || 'cash', new Date().toISOString());

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create Return (with Image)
app.post('/api/returns', upload.single('evidence'), (req, res) => {
    try {
        const { type, amount, product_id, sale_id, reason, action } = req.body;
        // type: 'broken_business', 'taste', 'broken_client'
        // action: 'restock', 'discard'

        if (!req.file) return res.status(400).json({ error: "La evidencia (foto) es obligatoria." });

        const session = db.prepare("SELECT id FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);

        const returnInfo = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO returns (sale_id, product_id, session_id, user_id, type, amount_returned, stock_restored, evidence_url, date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `).run(
                sale_id || null,
                product_id,
                session ? session.id : null,
                req.user.id,
                type,
                amount || 0,
                action === 'restock' ? 1 : 0,
                '/uploads/returns/' + req.file.filename,
                new Date().toISOString()
            );

            // Restock if applicable
            if (action === 'restock' && product_id) {
                // Return to Main Inventory (or origin?) Assuming default inventory for now
                db.prepare(`
                    UPDATE product_inventory 
                    SET quantity = quantity + 1 
                    WHERE product_id = ? AND inventory_id = 'mch1'
                `).run(product_id); // Fixed to mch1 for now, ideally passed in
            }

            return result;
        })();

        res.json({ success: true, id: returnInfo.lastInsertRowid });

    } catch (e) {
        logError("Return", e);
        res.status(500).json({ error: e.message });
    }
});

// --- EXPENSE TYPES MANAGEMENT ---

// Helper for Permissions - MOVED HERE before use
const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Requiere permisos de administrador.' });
    }
    next();
};

const checkEditor = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.email !== ADMIN_EMAIL && req.user.can_edit !== 1) {
        return res.status(403).json({ error: 'No tienes permisos para editar el inventario.' });
    }
    next();
};

// Database setup
const db = new Database(dbPath); // Use absolute path

// Helper for error logging
const logError = (context, error) => {
    try {
        const fs = require('fs');
        const logPath = path.join(__dirname, 'error_log.txt');
        const msg = `[${new Date().toISOString()}] ${context}: ${error.stack || error.message}\n`;
        fs.appendFileSync(logPath, msg);
        console.error(msg);
    } catch (e) { console.error("Logging failed:", e); }
};

// Products table
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    quantity INTEGER DEFAULT 0,
    cost_mx REAL DEFAULT 0.0,
    sale_price_manual REAL DEFAULT 0.0,
    description TEXT,
    image TEXT,
    inventory_id INTEGER DEFAULT 1
  )
`);

// Add code column if it doesn't exist (migration)
try {
    db.exec(`ALTER TABLE products ADD COLUMN code TEXT`);
    console.log('Added code column to products table');
} catch (e) {
    // Column already exists, ignore error
}

// Inventories table (Modified for MCH Multi-site)
db.exec(`
  CREATE TABLE IF NOT EXISTS inventories (
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

// Product Inventory Pivot Table (N:N Relationship)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_inventory (
    product_id INTEGER NOT NULL,
    inventory_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (product_id, inventory_id),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
  )
`);

// MIGRATION & TRIGGERS
try {
    const pragma = db.prepare("PRAGMA table_info(inventories)").all();
    const columns = pragma.map(c => c.name);
    if (!columns.includes('updated_at')) {
        console.log("Migrating: Adding updated_at to inventories...");
        // SQLite doesn't support ADD COLUMN with non-constant default (CURRENT_TIMESTAMP) in some versions
        db.exec("ALTER TABLE inventories ADD COLUMN updated_at DATETIME");
        db.exec("UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
    }

    // TRIGGER 1: Auto-update updated_at when inventory itself changes
    db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_inventory_timestamp 
    AFTER UPDATE ON inventories
    BEGIN
      UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);

    // TRIGGER 2: Auto-update inventory.updated_at when a PRODUCT in it changes (Insert/Update/Delete)
    db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_inventory_on_product_insert
    AFTER INSERT ON products
    BEGIN
      UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.inventory_id;
    END;
  `);

    db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_inventory_on_product_update
    AFTER UPDATE ON products
    BEGIN
      UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.inventory_id;
       -- Also touch old inventory if moved
      UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.inventory_id AND OLD.inventory_id != NEW.inventory_id;
    END;
  `);

    db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_inventory_on_product_delete
    AFTER DELETE ON products
    BEGIN
      UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.inventory_id;
    END;
  `);

} catch (e) { console.error("Database setup error:", e); }

// Product Images table (New for Multi-image support)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

// Migration: Move existing single images to new table
const checkMigration = db.prepare("SELECT count(*) as count FROM product_images").get();
if (checkMigration.count === 0) {
    console.log("Checking for legacy images to migrate...");
    const legacyProducts = db.prepare("SELECT id, image FROM products WHERE image IS NOT NULL").all();
    const insertImage = db.prepare("INSERT INTO product_images (product_id, url) VALUES (?, ?)");

    let migrated = 0;
    db.transaction(() => {
        legacyProducts.forEach(p => {
            if (p.image) {
                insertImage.run(p.id, p.image);
                migrated++;
            }
        });
    })();

    if (migrated > 0) console.log(`Migrated ${migrated} legacy images to product_images table.`);
}

// Settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value REAL
  )
`);

// System Config table (for string values like SMTP)
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Users table (RESTORING MISSING DEFINITION)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
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

// Migration: Add last_ip, role, and can_edit to users if they don't exist
try {
    const userTableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columns = userTableInfo.map(c => c.name);

    if (!columns.includes('last_ip')) {
        console.log("Migrating: Adding last_ip to users table...");
        db.exec("ALTER TABLE users ADD COLUMN last_ip TEXT");
    }

    if (!columns.includes('role')) {
        console.log("Migrating: Adding role to users table...");
        db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'");
    }

    if (!columns.includes('can_edit')) {
        console.log("Migrating: Adding can_edit to users table...");
        db.exec("ALTER TABLE users ADD COLUMN can_edit INTEGER DEFAULT 0");
    }

    // Set Admin role
    const updatedInfo = db.prepare("PRAGMA table_info(users)").all();
    const updatedCols = updatedInfo.map(c => c.name);

    if (updatedCols.includes('role') && updatedCols.includes('can_edit')) {
        db.prepare("UPDATE users SET role = 'admin', can_edit = 1 WHERE email = ?").run(ADMIN_EMAIL);
    }

} catch (e) { console.error("Migration error (users):", e); }

// Blacklist table
console.log("Checking blacklist table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS blacklisted_emails (
    email TEXT PRIMARY KEY,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
  )
`);

// Historial Nativo - Tablas para compras y mermas
console.log("Creating native history tables...");
db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier TEXT,
    total REAL DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS losses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    reason TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Eliminar tablas legacy si existen (ya no se usan)
db.exec(`DROP TABLE IF EXISTS legacy_sales`);
db.exec(`DROP TABLE IF EXISTS legacy_purchases`);
db.exec(`DROP TABLE IF EXISTS legacy_losses`);

console.log("Native history tables ready");

// Sales table
console.log("Creating sales table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    items_count INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    inventory_id TEXT DEFAULT 'mch1',
    session_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(session_id) REFERENCES sales_sessions(id)
  )
`);

// Sale Items table
console.log("Creating sale_items table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )
`);

// Sales Sessions table (for POS session management)
console.log("Creating sales_sessions table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS sales_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    initial_cash REAL DEFAULT 0,
    declared_cash REAL,
    total_sales REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    total_profit REAL DEFAULT 0,
    wage_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Expense Types table for predefined expenses
console.log("Creating expense types table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS expense_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add payment_method to expense_types if not exists
try {
    const expenseTypeCols = db.prepare("PRAGMA table_info(expense_types)").all();
    const hasPaymentMethod = expenseTypeCols.some(c => c.name === 'payment_method');
    if (!hasPaymentMethod) {
        console.log("Migrating: Adding payment_method to expense_types...");
        db.exec("ALTER TABLE expense_types ADD COLUMN payment_method TEXT DEFAULT 'cash'");
    }
} catch (e) { console.log("Migration check (expense_types):", e.message); }

// Migration: Add payment_method to expenses if not exists
try {
    const expenseCols = db.prepare("PRAGMA table_info(expenses)").all();
    const hasPaymentMethod = expenseCols.some(c => c.name === 'payment_method');
    if (!hasPaymentMethod) {
        console.log("Migrating: Adding payment_method to expenses...");
        db.exec("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash'");
    }
} catch (e) { console.log("Migration check (expenses):", e.message); }

// Insert default expense types if none exist
const expenseTypesCount = db.prepare('SELECT COUNT(*) as count FROM expense_types').get();
if (expenseTypesCount.count === 0) {
    console.log("Inserting default expense types...");
    const defaultTypes = [
        { name: 'Área', amount: 3000, payment_method: 'cash' },
        { name: 'Limpieza', amount: 100, payment_method: 'cash' },
        { name: 'Otros', amount: 0, payment_method: 'cash' }
    ];
    const insertExpenseType = db.prepare('INSERT INTO expense_types (name, amount, payment_method) VALUES (?, ?, ?)');
    for (const type of defaultTypes) {
        insertExpenseType.run(type.name, type.amount, type.payment_method);
    }
}

// Migrate losses table to add new columns
try {
    const lossCols = db.prepare("PRAGMA table_info(losses)").all();
    const hasType = lossCols.some(c => c.name === 'type');
    const hasEvidence = lossCols.some(c => c.name === 'evidence');
    const hasInventory = lossCols.some(c => c.name === 'inventory');
    
    if (!hasType) {
        console.log("Migrating: Adding type to losses...");
        db.exec("ALTER TABLE losses ADD COLUMN type TEXT DEFAULT 'rotura_interna'");
    }
    if (!hasEvidence) {
        console.log("Migrating: Adding evidence to losses...");
        db.exec("ALTER TABLE losses ADD COLUMN evidence TEXT");
    }
    if (!hasInventory) {
        console.log("Migrating: Adding inventory to losses...");
        db.exec("ALTER TABLE losses ADD COLUMN inventory TEXT DEFAULT 'mch1'");
    }
} catch (e) { console.log("Migration check (losses):", e.message); }

// Helper to get system config safely
const getSystemConfig = (key) => {
    try {
        const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
        return row ? row.value : null;
    } catch (e) {
        return null;
    }
};

// --- MIDDLEWARE ---
const authenticate = (req, res, next) => {
    // Allow public access to login/register/verify
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || req.path.startsWith('/api/auth')) {
        return next();
    }
    // Allow public access to uploads
    if (req.path.startsWith('/uploads')) {
        return next();
    }

    // Si req.user ya existe (establecido por middleware global), usarlo
    if (req.user && req.user.id) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // If no token, create a default user (system works without login)
    if (!token) {
        req.user = {
            id: 1,
            username: 'default',
            role: 'admin',
            email: 'default@system.local',
            can_edit: 1
        };
        return next();
    }

    const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
    if (!user) {
        // If token is invalid, also use default user instead of failing
        req.user = {
            id: 1,
            username: 'default',
            role: 'admin',
            email: 'default@system.local',
            can_edit: 1
        };
        return next();
    }

    req.user = user;
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Requiere permisos de administrador.' });
    }
    next();
};

// --- EXPENSE TYPES ENDPOINTS ---

// Get all expense types
app.get('/api/expense-types', authenticate, (req, res) => {
    try {
        const types = db.prepare('SELECT * FROM expense_types WHERE is_active = 1 ORDER BY name').all();
        res.json(types);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create new expense type (admin only)
app.post('/api/expense-types', authenticate, requireAdmin, (req, res) => {
    try {
        const { name, amount, payment_method } = req.body;
        if (!name || amount === undefined) {
            return res.status(400).json({ error: 'Nombre y monto son requeridos' });
        }
        const result = db.prepare('INSERT INTO expense_types (name, amount, payment_method) VALUES (?, ?, ?)').run(name, amount, payment_method || 'cash');
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update expense type (admin only)
app.put('/api/expense-types/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { name, amount, is_active, payment_method } = req.body;
        const { id } = req.params;
        db.prepare('UPDATE expense_types SET name = ?, amount = ?, is_active = ?, payment_method = ? WHERE id = ?')
            .run(name, amount, is_active, payment_method || 'cash', id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete expense type (admin only)
app.delete('/api/expense-types/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('UPDATE expense_types SET is_active = 0 WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MERMAS (LOSSES) ENDPOINTS ---

// Get all mermas
app.get('/api/mermas', authenticate, (req, res) => {
    try {
        const { inventory } = req.query;
        let query = `
            SELECT l.*, p.name as product_name, p.image as product_image
            FROM losses l
            JOIN products p ON l.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (inventory) {
            query += ' AND l.inventory = ?';
            params.push(inventory);
        }
        
        query += ' ORDER BY l.date DESC';
        
        const mermas = db.prepare(query).all(...params);
        res.json(mermas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create new merma
app.post('/api/mermas', authenticate, (req, res) => {
    try {
        const { type, product_id, quantity, reason, inventory } = req.body;
        
        if (!type || !product_id || !quantity) {
            return res.status(400).json({ error: 'Tipo, producto y cantidad son requeridos' });
        }
        
        // Insertar la merma
        const result = db.prepare(`
            INSERT INTO losses (product_id, quantity, reason, type, inventory, user_id, date)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(product_id, quantity, reason || '', type, inventory || 'mch1', req.user.id);
        
        // Actualizar stock según el tipo de merma
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (product) {
            let newQuantity = product.quantity;
            
            switch(type) {
                case 'rotura_interna':
                    // Disminuye stock
                    newQuantity = Math.max(0, product.quantity - parseInt(quantity));
                    break;
                case 'devolucion_nuevo':
                    // Aumenta stock
                    newQuantity = product.quantity + parseInt(quantity);
                    break;
                case 'devolucion_danado':
                    // Stock neutral (no cambia)
                    break;
            }
            
            db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQuantity, product_id);
        }
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete merma (admin only) - restaura el stock
app.delete('/api/mermas/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener la merma antes de eliminar
        const merma = db.prepare('SELECT * FROM losses WHERE id = ?').get(id);
        if (!merma) {
            return res.status(404).json({ error: 'Merma no encontrada' });
        }
        
        // Restaurar stock según el tipo
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(merma.product_id);
        if (product) {
            let newQuantity = product.quantity;
            
            switch(merma.type) {
                case 'rotura_interna':
                    // Restaurar stock (sumar de vuelta)
                    newQuantity = product.quantity + merma.quantity;
                    break;
                case 'devolucion_nuevo':
                    // Quitar stock (restar de vuelta)
                    newQuantity = Math.max(0, product.quantity - merma.quantity);
                    break;
                case 'devolucion_danado':
                    // Stock neutral (no cambia)
                    break;
            }
            
            db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQuantity, merma.product_id);
        }
        
        // Eliminar la merma
        db.prepare('DELETE FROM losses WHERE id = ?').run(id);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const requireEditor = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.email !== ADMIN_EMAIL && req.user.can_edit !== 1) {
        return res.status(403).json({ error: 'No tienes permisos para editar el inventario.' });
    }
    next();
};
// ------------------

// Login endpoint
app.post('/api/login', (req, res) => {
    try {
        const { username, pin } = req.body;
        if (!username || !pin) {
            return res.status(400).json({ error: 'Faltan credenciales (usuario o PIN)' });
        }

        const lowerUsername = username.trim().toLowerCase();
        const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(lowerUsername, lowerUsername);

        if (!user) {
            const isOwner = lowerUsername === ADMIN_EMAIL.toLowerCase();
            const errorMsg = isOwner
                ? "Su cuenta de administrador no existe. Por favor, regístrese con su correo para activarla."
                : "El usuario no existe.";
            return res.status(404).json({ success: false, error: errorMsg });
        }

        const cleanPin = pin.trim();
        if (user.pin !== cleanPin) {
            console.log(`Login Failed: PIN Mismatch. User: ${lowerUsername}`);
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        console.log(`Login Success: ${lowerUsername}`);
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const isOwner = user.email && (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

        if (isOwner) {
            if (user.role !== 'admin' || user.can_edit !== 1) {
                db.prepare("UPDATE users SET role = 'admin', can_edit = 1 WHERE id = ?").run(user.id);
                user.role = 'admin';
                user.can_edit = 1;
            }
            if (user.is_verified === 0) {
                db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);
                user.is_verified = 1;
            }
        }

        if (user.is_verified === 0) {
            return res.status(403).json({ error: 'Tu cuenta no ha sido verificada.', needsVerification: true, email: user.email });
        }
        if (user.is_banned === 1) {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida.' });
        }

        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        db.prepare('UPDATE users SET session_token = ?, last_ip = ? WHERE id = ?').run(token, clientIp, user.id);

        const userRole = isOwner ? 'admin' : (user.role || 'viewer');
        const userCanEdit = isOwner ? 1 : (user.can_edit || 0);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: userRole,
                can_edit: userCanEdit
            }
        });

    } catch (error) {
        logError("LOGIN CRITICAL ERROR", error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

// Register Endpoint
app.post('/api/register', async (req, res) => {
    try {
        const isOwner = req.body.email === ADMIN_EMAIL;
        const allowed = getSystemConfig('allow_registration') !== 'false';

        if (!allowed && !isOwner) {
            return res.status(403).json({ error: 'El registro de nuevos usuarios está cerrado por el administrador.' });
        }

        const { username, email, pin } = req.body;
        if (!username || !email || !pin) return res.status(400).json({ error: 'Todos los campos son obligatorios' });

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPin = pin.trim();

        const isBlacklisted = db.prepare('SELECT * FROM blacklisted_emails WHERE email = ?').get(cleanEmail);
        if (isBlacklisted) {
            return res.status(403).json({ error: 'Este correo ha sido bloqueado permanentemente por el administrador.' });
        }

        const existing = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanUsername.toLowerCase(), cleanEmail);
        if (existing) return res.status(400).json({ error: 'El usuario o correo ya existe' });

        console.log("Attempting to insert user:", { cleanUsername, cleanEmail, isOwner });
        const verifiedStatus = isOwner ? 1 : 0;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        try {
            const info = db.prepare('INSERT INTO users (username, email, pin, is_verified, last_ip) VALUES (?, ?, ?, ?, ?)').run(cleanUsername, cleanEmail, cleanPin, verifiedStatus, clientIp);
            const userId = info.lastInsertRowid;
            console.log("User inserted with ID:", userId);

            if (isOwner) {
                return res.json({ success: true, message: 'Cuenta de administrador creada y autorizada automáticamente.' });
            }

            // Skip email for now in dev
            res.json({ success: true, requireVerification: false, email, warning: 'Modo dev: verificado auto' });

        } catch (dbError) {
            console.error("Registration Error:", dbError);
            return res.status(500).json({ error: 'Error al registrar: ' + dbError.message });
        }
    } catch (outerError) {
        console.error("Registration Critical Error:", outerError);
        res.status(500).json({ error: 'Error crítico en registro: ' + outerError.message });
    }
});

// --- REST API ENDPOINTS ---

// 1. Get All Inventories (Sedes)
app.get('/api/inventories', authenticate, (req, res) => {
    try {
        const inventories = db.prepare("SELECT * FROM inventories ORDER BY id").all();
        res.json(inventories);
    } catch (e) {
        logError("GET /api/inventories", e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Get Products (With Stock Aggregation)
app.get('/api/products', authenticate, (req, res) => {
    try {
        const { search, inventoryId } = req.query;
        let query = "SELECT * FROM products";
        const params = [];

        if (search) {
            const cleanSearch = search.trim();
            // Si la búsqueda son solo números, buscar por precio
            const isNumberSearch = /^\d+$/.test(cleanSearch);
            
            if (isNumberSearch) {
                // Buscar productos con precio que contenga esos números
                query += " WHERE CAST(sale_price_manual AS TEXT) LIKE ? OR CAST(cost_mx AS TEXT) LIKE ?";
                params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
            } else {
                // Búsqueda normal por nombre o código
                query += " WHERE lower(name) LIKE ? OR lower(code) LIKE ?";
                params.push(`%${cleanSearch.toLowerCase()}%`, `%${cleanSearch.toLowerCase()}%`);
            }
        }

        query += " ORDER BY name ASC";
        const productsList = db.prepare(query).all(params);

        // Attach stock levels per inventory
        const getStocks = db.prepare("SELECT inventory_id, quantity FROM product_inventory WHERE product_id = ?");

        const productsWithStock = productsList.map(p => {
            const stocks = getStocks.all(p.id);
            const inventoryMap = {};
            let totalStock = 0;
            let specificStock = 0;

            stocks.forEach(s => {
                inventoryMap[s.inventory_id] = s.quantity;
                totalStock += s.quantity;
                if (inventoryId && (s.inventory_id == inventoryId || s.inventory_id === inventoryId)) {
                    specificStock = s.quantity;
                }
            });

            // Compatibility: MCH v2 POS uses 'inventory' map. Entradas uses 'quantity'.
            // If inventoryId specific requested, quantity = that stock. Else total?
            // POS expects 'total_quantity' or looks inside 'inventory' map.

            return {
                ...p,
                inventory: inventoryMap,
                total_quantity: totalStock,
                quantity: inventoryId ? specificStock : totalStock // Dynamic mapping for frontend compatibility
            };
        });

        res.json(productsWithStock);

    } catch (e) {
        logError("GET /api/products", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Create Product
app.post('/api/products', authenticate, requireEditor, (req, res) => {
    try {
        const { name, cost_mx, sale_price_manual, description, image } = req.body;

        if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

        const info = db.prepare(`
            INSERT INTO products (name, cost_mx, sale_price_manual, description, image)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, cost_mx || 0, sale_price_manual || 0, description || '', image || '');

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        logError("POST /api/products", e);
        res.status(500).json({ error: e.message });
    }
});

// 3.5 Update Product
app.put('/api/products/:id', authenticate, requireEditor, (req, res) => {
    try {
        const { id } = req.params;
        const { name, cost_mx, sale_price_manual, description, label_color, deletedImages } = req.body;

        // Check if product exists
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Update product fields
        db.prepare(`
            UPDATE products 
            SET name = ?, cost_mx = ?, sale_price_manual = ?, description = ?, label_color = ?
            WHERE id = ?
        `).run(
            name || existing.name,
            cost_mx !== undefined ? cost_mx : existing.cost_mx,
            sale_price_manual !== undefined ? sale_price_manual : existing.sale_price_manual,
            description !== undefined ? description : existing.description,
            label_color || existing.label_color,
            id
        );

        // Handle deleted images
        if (deletedImages) {
            try {
                const imagesToDelete = JSON.parse(deletedImages);
                if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
                    // Get current images
                    const product = db.prepare('SELECT images FROM products WHERE id = ?').get(id);
                    let currentImages = [];
                    try {
                        currentImages = JSON.parse(product.images) || [];
                    } catch (e) {
                        currentImages = [];
                    }

                    // Remove deleted images from array
                    const updatedImages = currentImages.filter(img => {
                        const imgPath = img.startsWith('/') ? img : `/${img}`;
                        const shouldDelete = imagesToDelete.some(del => {
                            const delPath = del.startsWith('/') ? del : `/${del}`;
                            return imgPath === delPath || imgPath.endsWith(delPath);
                        });
                        
                        // Delete physical file if it exists
                        if (shouldDelete) {
                            const filename = path.basename(img);
                            const filePath = path.join(__dirname, 'uploads', filename);
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                                console.log(`Deleted image file: ${filename}`);
                            }
                        }
                        
                        return !shouldDelete;
                    });

                    // Update database
                    db.prepare('UPDATE products SET images = ? WHERE id = ?').run(
                        JSON.stringify(updatedImages),
                        id
                    );
                }
            } catch (e) {
                console.error('Error handling deleted images:', e);
            }
        }

        res.json({ success: true, message: 'Producto actualizado correctamente' });
    } catch (e) {
        logError("PUT /api/products/:id", e);
        res.status(500).json({ error: e.message });
    }
});

// 3.6 Delete Product
app.delete('/api/products/:id', authenticate, requireEditor, (req, res) => {
    try {
        const { id } = req.params;

        // Check if product exists
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Delete associated image files
        try {
            const images = JSON.parse(existing.images) || [];
            images.forEach(img => {
                const filename = path.basename(img);
                const filePath = path.join(__dirname, 'uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted image file: ${filename}`);
                }
            });
        } catch (e) {
            console.error('Error deleting product images:', e);
        }

        // Delete product (cascade will handle inventory records)
        db.prepare('DELETE FROM products WHERE id = ?').run(id);

        res.json({ success: true, message: 'Producto eliminado correctamente' });
    } catch (e) {
        logError("DELETE /api/products/:id", e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Update Stock (Move/Set)
app.post('/api/inventory/adjustment', authenticate, requireEditor, (req, res) => {
    try {
        const { product_id, inventory_id, quantity, type } = req.body; // type: 'set', 'add', 'subtract'

        if (!product_id || !inventory_id) return res.status(400).json({ error: 'Faltan datos' });

        const current = db.prepare("SELECT quantity FROM product_inventory WHERE product_id = ? AND inventory_id = ?").get(product_id, inventory_id);
        let newQty = current ? current.quantity : 0;
        let qtyVal = parseInt(quantity || 0);

        if (type === 'set') newQty = qtyVal;
        else if (type === 'add') newQty += qtyVal;
        else if (type === 'subtract') newQty -= qtyVal;

        if (newQty < 0) newQty = 0; // Prevent negative stock? Or allow? Assuming prevent for now

        db.prepare(`
            INSERT INTO product_inventory (product_id, inventory_id, quantity)
            VALUES (?, ?, ?)
            ON CONFLICT(product_id, inventory_id) DO UPDATE SET quantity = excluded.quantity
        `).run(product_id, inventory_id, newQty);

        res.json({ success: true, new_quantity: newQty });

    } catch (e) {
        logError("POST /api/inventory/adjustment", e);
        res.status(500).json({ error: e.message });
    }
});

// Settings & Config Endpoints
app.get('/api/settings', authenticate, (req, res) => {
    const settings = db.prepare("SELECT key, value FROM settings").all();
    const config = settings.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json(config);
});

const defaultSettings = [
    { key: 'RATE_MXN_USD', value: 19 },
    { key: 'RATE_USD_MN', value: 550 },
    { key: 'RATE_EUR_MN', value: 590 },
    { key: 'RATE_MXN_MN', value: 17.30 },
    { key: 'MARGIN_MULTIPLIER', value: 3.5 }
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed default inventory
// Seed default inventories (MCH Architecture)
const resetInventories = db.prepare('SELECT count(*) as count FROM inventories').get();
if (resetInventories.count === 0) {
    const insertInv = db.prepare("INSERT INTO inventories (id, name, code, icon, color, type) VALUES (?, ?, ?, ?, ?, ?)");
    insertInv.run('alm', 'Almacén MCH', 'ALM', 'ph-warehouse', '#58a6ff', 'warehouse');
    insertInv.run('mch1', 'MCH 1', 'MCH1', 'ph-storefront', '#3fb950', 'kiosk');
    insertInv.run('mch2', 'MCH 2', 'MCH2', 'ph-shopping-bag', '#d29922', 'kiosk');
    console.log("Seeded MCH inventories: ALM, MCH1, MCH2");
}

// --- HISTORY ENDPOINTS ---
app.get('/api/history/sales', authenticate, (req, res) => {
    try {
        const sales = db.prepare(`
            SELECT s.id, s.total, s.date, s.user_id, COUNT(si.id) as items_count
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            GROUP BY s.id
            ORDER BY s.date DESC
            LIMIT 1000
        `).all();
        res.json(sales);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history/purchases', authenticate, (req, res) => {
    try {
        const purchases = db.prepare(`
            SELECT p.id, p.supplier, p.total, p.date, p.notes
            FROM purchases p
            ORDER BY p.date DESC
            LIMIT 1000
        `).all();
        res.json(purchases);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history/losses', authenticate, (req, res) => {
    try {
        const losses = db.prepare(`
            SELECT l.id, l.product_id, l.quantity, l.reason, l.date, p.name as product_name
            FROM losses l
            LEFT JOIN products p ON l.product_id = p.id
            ORDER BY l.date DESC
            LIMIT 1000
        `).all();
        res.json(losses);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MIGRATION ENDPOINT (Legacy Data) ---
app.post('/api/admin/migrate-legacy', (req, res) => {
    // Only admin can run migration
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Solo administradores pueden ejecutar migraciones' });
    }

    try {
        const { exec } = require('child_process');
        const scriptPath = path.join(__dirname, 'scripts', 'migrate_legacy.js');

        // Check if legacy database exists
        const legacyDbPath = path.join(__dirname, 'uploads', 'backup_legacy.db');
        if (!fs.existsSync(legacyDbPath)) {
            return res.status(400).json({
                error: 'No se encontró la base de datos legacy',
                message: 'Asegúrate de haber subido y descomprimido el archivo .mnx'
            });
        }

        // Run migration script
        exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Migration error:', error);
                return res.status(500).json({
                    error: 'Error en la migración',
                    details: stderr
                });
            }

            console.log('Migration output:', stdout);
            res.json({
                success: true,
                message: 'Migración completada',
                output: stdout
            });
        });

    } catch (e) {
        logError("POST /api/admin/migrate-legacy", e);
        res.status(500).json({ error: e.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from client/dist (for Railway deployment)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
console.log('Checking for client build at:', clientDistPath);
console.log('Exists:', fs.existsSync(clientDistPath));

if (fs.existsSync(clientDistPath)) {
    console.log('Serving static files from:', clientDistPath);
    app.use(express.static(clientDistPath));
    
    // Serve index.html for all non-API routes (SPA support)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }
        const indexPath = path.join(clientDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            next();
        }
    });
} else {
    console.log('Client dist not found. Running in API-only mode.');
    console.log('To enable full app, run: cd client && npm run build');
}

// Start Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
