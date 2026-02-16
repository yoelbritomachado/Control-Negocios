const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const archiver = require('archiver');
const nodemailer = require('nodemailer'); // Added

const app = express();
const port = 3001;
const ADMIN_EMAIL = 'yoelbritomachado@gmail.com';

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large backups
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.post('/api/admin/upload-mnx', mnxUpload.single('file'), (req, res) => {
    // Only admin can upload
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Solo administradores pueden subir archivos' });
    }

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
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Solo administradores pueden acceder' });
    }

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
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Solo administradores pueden ejecutar esto' });
    }

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

        // Calculate Totals
        const salesData = db.prepare(`
            SELECT 
                COALESCE(SUM(s.total), 0) as total_sales,
                COALESCE(SUM(si.quantity * si.cost), 0) as total_cost
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.session_id = ?
        `).get(session.id);

        const totalProfit = salesData.total_sales - salesData.total_cost;
        const wage = totalProfit > 0 ? (totalProfit * 0.05) : 0; // 5% of profit

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

        res.json({ success: true, wage: wage });

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
        const { type, amount, description } = req.body;
        // type: area ($3000), cleaning ($100), other (manual)

        // Optional: Link to session
        const session = db.prepare("SELECT id FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);
        const sessionId = session ? session.id : null;

        db.prepare(`
            INSERT INTO expenses (session_id, user_id, type, amount, description, date)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(sessionId, req.user.id, type, amount, description, new Date().toISOString());

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

// Helper for Permissions
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
const db = new Database(path.join(__dirname, 'inventory.db')); // Use absolute path

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
    quantity INTEGER DEFAULT 0,
    cost_mx REAL DEFAULT 0.0,
    sale_price_manual REAL DEFAULT 0.0,
    description TEXT,
    image TEXT,
    inventory_id INTEGER DEFAULT 1
  )
`);

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

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token faltante.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
    if (!user) return res.status(403).json({ error: 'Token inválido o expirado.' });

    req.user = user;
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Requiere permisos de administrador.' });
    }
    next();
};

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
            query += " WHERE lower(name) LIKE ?";
            params.push(`%${search.trim().toLowerCase()}%`);
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

// Start Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
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
