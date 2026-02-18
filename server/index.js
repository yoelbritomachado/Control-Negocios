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

// Initialize Database FIRST (before any middleware that uses it)
const db = new Database(dbPath);
console.log('Database initialized at:', dbPath);

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || process.env.FRONTEND_URL === '*') {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(null, true); // Allow all in development
        }
    },
    credentials: true
}));
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

// --- PERMISSION HELPERS (defined before routes) ---
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

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Requiere permisos de administrador o dueño.' });
    }
    next();
};

const requireEditor = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.can_edit !== 1) {
        return res.status(403).json({ error: 'No tienes permisos para editar.' });
    }
    next();
};

// --- AUTHENTICATION MIDDLEWARE ---
const authenticate = (req, res, next) => {
    // Allow public access to login/register/auth
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || req.path.startsWith('/api/auth')) {
        return next();
    }
    // Allow public access to uploads
    if (req.path.startsWith('/uploads')) {
        return next();
    }

    // If req.user ya existe, usarlo
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

// Apply authentication middleware
app.use(authenticate);

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
            session_id: session.id,
            wage: wage,
            summary: {
                sales: {
                    total: salesData.total_sales,
                    cash: cashSales,
                    transfer: transferSales
                },
                cost: {
                    total: salesData.total_cost
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

// Send Session for Review (Seller)
app.post('/api/sessions/send-for-review', (req, res) => {
    try {
        const { declared_cash, notes } = req.body;
        const userId = req.user.id;
        const username = req.user.username || 'Vendedor';

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
        const wage = totalProfit > 0 ? (totalProfit * 0.05) : 0;

        const cashSales = salesByMethod.find(s => s.payment_method === 'cash')?.total || 0;
        const transferSales = salesByMethod.find(s => s.payment_method === 'transfer')?.total || 0;
        const cashExpenses = expensesByMethod.find(e => e.payment_method === 'cash')?.total || 0;
        const transferExpenses = expensesByMethod.find(e => e.payment_method === 'transfer')?.total || 0;
        
        const finalCash = cashSales - cashExpenses;
        const finalTransfer = transferSales - transferExpenses;

        // Update session status to 'pending_review'
        db.prepare(`
            UPDATE sales_sessions 
            SET end_time = ?, 
                declared_cash = ?, 
                total_sales = ?, 
                total_cost = ?, 
                total_profit = ?, 
                wage_amount = ?, 
                status = 'pending_review',
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

        // Create notification for all admins
        const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' OR role = 'owner'").all();
        const notificationData = JSON.stringify({
            session_id: session.id,
            seller_id: userId,
            seller_name: username,
            total_sales: salesData.total_sales,
            wage: wage
        });

        const insertNotification = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'session_pending', ?, ?, ?)
        `);

        for (const admin of admins) {
            insertNotification.run(
                admin.id,
                'Sesión pendiente de revisión',
                `${username} ha enviado la sesión #${session.id} para revisión. Total: $${salesData.total_sales.toFixed(2)}`,
                notificationData
            );
        }

        res.json({ 
            success: true, 
            message: 'Sesión enviada para revisión',
            session_id: session.id,
            wage: wage,
            summary: {
                sales: {
                    total: salesData.total_sales,
                    cash: cashSales,
                    transfer: transferSales
                },
                cost: {
                    total: salesData.total_cost
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
        logError("Send Session for Review", e);
        res.status(500).json({ error: e.message });
    }
});

// Approve Session (Admin/Owner)
app.post('/api/sessions/:id/approve', checkAdmin, (req, res) => {
    try {
        const sessionId = req.params.id;
        const adminId = req.user.id;
        const adminName = req.user.username || 'Administrador';

        const session = db.prepare("SELECT * FROM sales_sessions WHERE id = ?").get(sessionId);
        if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
        if (session.status !== 'pending_review') return res.status(400).json({ error: "La sesión no está pendiente de revisión." });

        // Update session to closed
        db.prepare("UPDATE sales_sessions SET status = 'closed', approved_by = ? WHERE id = ?")
            .run(adminId, sessionId);

        // Create notification for seller
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'session_approved', ?, ?, ?)
        `).run(
            session.user_id,
            'Sesión aprobada',
            `Tu sesión #${sessionId} ha sido revisada y aprobada por ${adminName}`,
            JSON.stringify({ session_id: sessionId, approved_by: adminId })
        );

        res.json({ success: true, message: 'Sesión aprobada correctamente' });

    } catch (e) {
        logError("Approve Session", e);
        res.status(500).json({ error: e.message });
    }
});

// --- WAGE/SALARY ENDPOINTS ---

// Get seller's wage summary (current accumulated)
app.get('/api/wages/my-summary', (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get all sessions with pending or paid wages for this seller
        const sessions = db.prepare(`
            SELECT 
                id,
                start_time,
                end_time,
                total_sales,
                total_cost,
                total_profit,
                wage_amount,
                status,
                wage_payment_id
            FROM sales_sessions 
            WHERE user_id = ? AND wage_amount > 0
            ORDER BY start_time DESC
        `).all(userId);

        // Calculate totals
        const totalEarned = sessions.reduce((sum, s) => sum + (s.wage_amount || 0), 0);
        const totalPaid = sessions.filter(s => s.wage_payment_id).reduce((sum, s) => sum + (s.wage_amount || 0), 0);
        const pendingAmount = totalEarned - totalPaid;

        // Get pending payment requests
        const pendingRequests = db.prepare(`
            SELECT * FROM wage_payments 
            WHERE user_id = ? AND status = 'pending'
            ORDER BY requested_at DESC
        `).all(userId);

        res.json({
            sessions: sessions,
            summary: {
                total_earned: totalEarned,
                total_paid: totalPaid,
                pending_amount: pendingAmount,
                pending_requests: pendingRequests.length
            }
        });

    } catch (e) {
        logError("Get Wage Summary", e);
        res.status(500).json({ error: e.message });
    }
});

// Request wage payment (Seller)
app.post('/api/wages/request', (req, res) => {
    try {
        const userId = req.user.id;
        const { session_id, amount, payment_method } = req.body;

        // Verify the session belongs to this user and has wage
        const session = db.prepare(`
            SELECT * FROM sales_sessions 
            WHERE id = ? AND user_id = ? AND wage_amount > 0
        `).get(session_id, userId);

        if (!session) {
            return res.status(400).json({ error: "Sesión no válida o sin salario pendiente." });
        }

        // Check if already requested
        if (session.wage_payment_id) {
            return res.status(400).json({ error: "El salario de esta sesión ya fue solicitado." });
        }

        // Create payment request
        const result = db.prepare(`
            INSERT INTO wage_payments (user_id, session_id, amount, payment_method, status)
            VALUES (?, ?, ?, ?, 'pending')
        `).run(userId, session_id, amount || session.wage_amount, payment_method || 'cash');

        // Link payment to session
        db.prepare(`
            UPDATE sales_sessions SET wage_payment_id = ? WHERE id = ?
        `).run(result.lastInsertRowid, session_id);

        // Create notification for admins
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
        const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' OR role = 'owner'").all();
        
        const insertNotification = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'wage_request', ?, ?, ?)
        `);

        for (const admin of admins) {
            insertNotification.run(
                admin.id,
                'Solicitud de pago de salario',
                `${user?.username || 'Vendedor'} solicita pago de $${(amount || session.wage_amount).toFixed(2)}`,
                JSON.stringify({ 
                    wage_payment_id: result.lastInsertRowid,
                    session_id: session_id,
                    seller_id: userId,
                    amount: amount || session.wage_amount
                })
            );
        }

        res.json({ 
            success: true, 
            message: 'Solicitud de pago enviada',
            wage_payment_id: result.lastInsertRowid
        });

    } catch (e) {
        logError("Request Wage Payment", e);
        res.status(500).json({ error: e.message });
    }
});

// Process wage payment (Admin/Owner)
app.post('/api/wages/:id/pay', checkAdmin, (req, res) => {
    try {
        const paymentId = req.params.id;
        const adminId = req.user.id;
        const adminName = req.user.username || 'Administrador';
        const { notes } = req.body;

        const payment = db.prepare('SELECT * FROM wage_payments WHERE id = ?').get(paymentId);
        if (!payment) return res.status(404).json({ error: "Solicitud de pago no encontrada." });
        if (payment.status !== 'pending') return res.status(400).json({ error: "Esta solicitud ya fue procesada." });

        // Update payment status
        db.prepare(`
            UPDATE wage_payments 
            SET status = 'paid', paid_at = ?, paid_by = ?, notes = ?
            WHERE id = ?
        `).run(new Date().toISOString(), adminId, notes || '', paymentId);

        // Create notification for seller
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'wage_paid', ?, ?, ?)
        `).run(
            payment.user_id,
            'Pago de salario realizado',
            `Se te ha pagado $${payment.amount.toFixed(2)} - ${payment.payment_method === 'cash' ? 'Efectivo' : 'Transferencia'}`,
            JSON.stringify({ 
                wage_payment_id: paymentId,
                amount: payment.amount,
                paid_by: adminId
            })
        );

        res.json({ success: true, message: 'Pago procesado correctamente' });

    } catch (e) {
        logError("Process Wage Payment", e);
        res.status(500).json({ error: e.message });
    }
});

// Get all pending wage payments (Admin/Owner)
app.get('/api/wages/pending', checkAdmin, (req, res) => {
    try {
        const payments = db.prepare(`
            SELECT 
                wp.*,
                u.username as seller_name,
                ss.start_time as session_date
            FROM wage_payments wp
            JOIN users u ON wp.user_id = u.id
            LEFT JOIN sales_sessions ss ON wp.session_id = ss.id
            WHERE wp.status = 'pending'
            ORDER BY wp.requested_at DESC
        `).all();

        res.json({ payments });

    } catch (e) {
        logError("Get Pending Wages", e);
        res.status(500).json({ error: e.message });
    }
});

// --- NOTIFICATIONS ENDPOINTS ---

// Get notifications for current user
app.get('/api/notifications', (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = db.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY created_at DESC
            LIMIT 50
        `).all(userId);

        // Parse JSON data field
        const parsedNotifications = notifications.map(n => ({
            ...n,
            data: n.data ? JSON.parse(n.data) : null,
            is_read: !!n.is_read
        }));

        // Get unread count
        const unreadCount = db.prepare(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
        `).get(userId);

        res.json({ 
            notifications: parsedNotifications, 
            unread_count: unreadCount.count 
        });
    } catch (e) {
        logError("Get Notifications", e);
        res.status(500).json({ error: e.message });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        db.prepare(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        `).run(notificationId, userId);

        res.json({ success: true });
    } catch (e) {
        logError("Mark Notification Read", e);
        res.status(500).json({ error: e.message });
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', (req, res) => {
    try {
        const userId = req.user.id;

        db.prepare(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
        `).run(userId);

        res.json({ success: true });
    } catch (e) {
        logError("Mark All Notifications Read", e);
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

// Get detailed session metrics (for close modal)
app.get('/api/sessions/metrics', (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get current open session
        const session = db.prepare("SELECT * FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(userId);
        if (!session) {
            return res.status(400).json({ error: "No hay sesión abierta." });
        }

        // Calculate Sales Totals with COSTS
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

        // Current session calculations
        const totalProfit = salesData.total_sales - salesData.total_cost;
        const currentWage = totalProfit > 0 ? (totalProfit * 0.05) : 0;

        const cashSales = salesByMethod.find(s => s.payment_method === 'cash')?.total || 0;
        const transferSales = salesByMethod.find(s => s.payment_method === 'transfer')?.total || 0;
        const otherSales = salesByMethod.find(s => s.payment_method !== 'cash' && s.payment_method !== 'transfer')?.total || 0;
        const cashExpenses = expensesByMethod.find(e => e.payment_method === 'cash')?.total || 0;
        const transferExpenses = expensesByMethod.find(e => e.payment_method === 'transfer')?.total || 0;
        
        const finalCash = cashSales - cashExpenses;
        const finalTransfer = transferSales - transferExpenses;

        // Calculate ACCUMULATED WAGE (all unpaid sessions)
        const accumulatedWages = db.prepare(`
            SELECT 
                COALESCE(SUM(wage_amount), 0) as total_pending_wage,
                COUNT(*) as pending_sessions
            FROM sales_sessions 
            WHERE user_id = ? 
                AND (status = 'closed' OR status = 'pending_review')
                AND wage_payment_id IS NULL
        `).get(userId);

        res.json({
            session: {
                id: session.id,
                start_time: session.start_time,
                initial_cash: session.initial_cash
            },
            current: {
                sales: {
                    total: salesData.total_sales,
                    cash: cashSales,
                    transfer: transferSales,
                    other: otherSales
                },
                cost: {
                    total: salesData.total_cost
                },
                expenses: {
                    total: expensesData.total_expenses,
                    cash: cashExpenses,
                    transfer: transferExpenses
                },
                profit: totalProfit,
                wage: currentWage
            },
            final: {
                cash: finalCash,
                transfer: finalTransfer,
                total: finalCash + finalTransfer
            },
            accumulated: {
                current_session_wage: currentWage,
                previous_sessions_wage: accumulatedWages.total_pending_wage - currentWage,
                total_pending_wage: accumulatedWages.total_pending_wage,
                pending_sessions_count: accumulatedWages.pending_sessions
            }
        });

    } catch (e) {
        logError("Get Session Metrics", e);
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

// Permission helpers are now defined at the top of MIDDLEWARE section

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

// Notifications table
console.log("Creating notifications table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Create index for faster queries
try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)');
} catch (e) { console.log("Index creation (notifications):", e.message); }

// Migration: Add approved_by to sales_sessions if not exists
try {
    const sessionCols = db.prepare("PRAGMA table_info(sales_sessions)").all();
    const hasApprovedBy = sessionCols.some(c => c.name === 'approved_by');
    if (!hasApprovedBy) {
        console.log("Migrating: Adding approved_by to sales_sessions...");
        db.exec("ALTER TABLE sales_sessions ADD COLUMN approved_by INTEGER REFERENCES users(id)");
    }
} catch (e) { console.log("Migration check (sales_sessions approved_by):", e.message); }

// Wage payments table (for tracking salary payments to sellers)
console.log("Creating wage_payments table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS wage_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    paid_by INTEGER,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(session_id) REFERENCES sales_sessions(id),
    FOREIGN KEY(paid_by) REFERENCES users(id)
  )
`);

// Migration: Add wage_payment_id to sales_sessions
try {
    const sessionCols = db.prepare("PRAGMA table_info(sales_sessions)").all();
    const hasWagePaymentId = sessionCols.some(c => c.name === 'wage_payment_id');
    if (!hasWagePaymentId) {
        console.log("Migrating: Adding wage_payment_id to sales_sessions...");
        db.exec("ALTER TABLE sales_sessions ADD COLUMN wage_payment_id INTEGER REFERENCES wage_payments(id)");
    }
} catch (e) { console.log("Migration check (sales_sessions wage_payment_id):", e.message); }

// Transfers table
console.log("Creating transfers table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_inventory TEXT NOT NULL,
    target_inventory TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME,
    received_by INTEGER,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(received_by) REFERENCES users(id)
  )
`);

// Transfer items table
console.log("Creating transfer_items table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS transfer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(transfer_id) REFERENCES transfers(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
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

// --- TRANSFERS ENDPOINTS ---

// Get all transfers
app.get('/api/transfers', authenticate, (req, res) => {
    try {
        const { inventory } = req.query;
        let query = `
            SELECT t.*, 
                   creator.username as created_by_name,
                   receiver.username as received_by_name
            FROM transfers t
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users receiver ON t.received_by = receiver.id
            WHERE 1=1
        `;
        const params = [];
        
        if (inventory) {
            query += ' AND (t.source_inventory = ? OR t.target_inventory = ?)';
            params.push(inventory, inventory);
        }
        
        query += ' ORDER BY t.created_at DESC';
        
        const transfers = db.prepare(query).all(...params);
        
        // Get items for each transfer
        for (const transfer of transfers) {
            const items = db.prepare(`
                SELECT ti.*, p.name as product_name, p.image as product_image
                FROM transfer_items ti
                JOIN products p ON ti.product_id = p.id
                WHERE ti.transfer_id = ?
            `).all(transfer.id);
            transfer.items = items;
        }
        
        res.json(transfers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create new transfer (admin/owner only)
app.post('/api/transfers', authenticate, requireAdmin, (req, res) => {
    try {
        const { source_inventory, target_inventory, items, notes } = req.body;
        
        if (!source_inventory || !target_inventory || !items || items.length === 0) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        if (source_inventory === target_inventory) {
            return res.status(400).json({ error: 'Origen y destino no pueden ser iguales' });
        }
        
        // Start transaction
        const transaction = db.transaction(() => {
            // Create transfer
            const transferResult = db.prepare(`
                INSERT INTO transfers (source_inventory, target_inventory, created_by, status, notes)
                VALUES (?, ?, ?, 'pending', ?)
            `).run(source_inventory, target_inventory, req.user.id, notes || '');
            
            const transferId = transferResult.lastInsertRowid;
            
            // Add items
            const insertItem = db.prepare(`
                INSERT INTO transfer_items (transfer_id, product_id, quantity)
                VALUES (?, ?, ?)
            `);
            
            for (const item of items) {
                insertItem.run(transferId, item.product_id, item.quantity);
                
                // Deduct stock from source inventory
                const currentStock = db.prepare(`
                    SELECT quantity FROM product_inventory 
                    WHERE product_id = ? AND inventory_id = ?
                `).get(item.product_id, source_inventory);
                
                if (currentStock && currentStock.quantity >= item.quantity) {
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity - ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(item.quantity, item.product_id, source_inventory);
                } else {
                    throw new Error(`Stock insuficiente para el producto ${item.product_id}`);
                }
            }
            
            return transferId;
        });
        
        const transferId = transaction();
        
        // Create notifications based on rules
        const sourceType = source_inventory === 'alm' ? 'Almacén' : 'Punto de Venta';
        const targetType = target_inventory === 'alm' ? 'Almacén' : 'Punto de Venta';
        
        // 1. If admin created, notify owner
        if (req.user.role === 'admin') {
            const owner = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
            if (owner) {
                db.prepare(`
                    INSERT INTO notifications (user_id, type, title, message, data)
                    VALUES (?, 'transfer_created', ?, ?, ?)
                `).run(
                    owner.id,
                    'Nuevo traslado creado',
                    `El administrador ${req.user.username} ha creado un traslado de ${source_inventory} a ${target_inventory}`,
                    JSON.stringify({ transfer_id: transferId })
                );
            }
        }
        
        // 2. If target is a Point of Sale, notify sellers there
        if (target_inventory !== 'alm') {
            const sellers = db.prepare(`
                SELECT id FROM users 
                WHERE role = 'seller' AND inventory_id = ?
            `).all(target_inventory);
            
            for (const seller of sellers) {
                db.prepare(`
                    INSERT INTO notifications (user_id, type, title, message, data)
                    VALUES (?, 'transfer_incoming', ?, ?, ?)
                `).run(
                    seller.id,
                    'Traslado entrante',
                    `Se ha enviado mercancía desde ${source_inventory} hacia tu punto de venta`,
                    JSON.stringify({ transfer_id: transferId })
                );
            }
        }
        
        res.json({ success: true, id: transferId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Receive transfer (update status and add stock to target)
app.post('/api/transfers/:id/receive', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        
        const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }
        
        if (transfer.status !== 'pending') {
            return res.status(400).json({ error: 'El traslado ya fue procesado' });
        }
        
        // Start transaction
        const transaction = db.transaction(() => {
            // Update transfer status
            db.prepare(`
                UPDATE transfers 
                SET status = 'received', received_at = datetime('now'), received_by = ?
                WHERE id = ?
            `).run(req.user.id, id);
            
            // Add stock to target inventory
            const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
            
            for (const item of items) {
                // Check if product_inventory row exists
                const exists = db.prepare(`
                    SELECT 1 FROM product_inventory 
                    WHERE product_id = ? AND inventory_id = ?
                `).get(item.product_id, transfer.target_inventory);
                
                if (exists) {
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity + ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(item.quantity, item.product_id, transfer.target_inventory);
                } else {
                    db.prepare(`
                        INSERT INTO product_inventory (product_id, inventory_id, quantity)
                        VALUES (?, ?, ?)
                    `).run(item.product_id, transfer.target_inventory, item.quantity);
                }
            }
        });
        
        transaction();
        
        // Notify creator that transfer was received
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'transfer_received', ?, ?, ?)
        `).run(
            transfer.created_by,
            'Traslado recibido',
            `El traslado #${id} ha sido recibido en ${transfer.target_inventory}`,
            JSON.stringify({ transfer_id: id })
        );
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Reject transfer
app.post('/api/transfers/:id/reject', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }
        
        if (transfer.status !== 'pending') {
            return res.status(400).json({ error: 'El traslado ya fue procesado' });
        }
        
        // Start transaction
        const transaction = db.transaction(() => {
            // Update transfer status
            db.prepare(`
                UPDATE transfers 
                SET status = 'rejected', notes = COALESCE(notes, '') || ' | Rechazado: ' || ?
                WHERE id = ?
            `).run(reason || 'Sin motivo', id);
            
            // Return stock to source inventory
            const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
            
            for (const item of items) {
                db.prepare(`
                    UPDATE product_inventory 
                    SET quantity = quantity + ? 
                    WHERE product_id = ? AND inventory_id = ?
                `).run(item.quantity, item.product_id, transfer.source_inventory);
            }
        });
        
        transaction();
        
        // Notify creator
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'transfer_rejected', ?, ?, ?)
        `).run(
            transfer.created_by,
            'Traslado rechazado',
            `El traslado #${id} fue rechazado en ${transfer.target_inventory}. Motivo: ${reason || 'Sin motivo'}`,
            JSON.stringify({ transfer_id: id })
        );
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
