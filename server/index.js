const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const sharp = require('sharp');

// Logger global de errores
const logError = (context, error) => {
    try {
        const errorLog = `[${new Date().toISOString()}] ${context}: ${error.message}\nStack: ${error.stack}\n\n`;
        fs.appendFileSync(path.join(__dirname, 'error.log'), errorLog);
        writeAppLog('ERROR', context, error.message, { stack: error.stack });
    } catch (_) {}
    console.error(`❌ [${context}]`, error);
};

const app = express();
const port = process.env.PORT || 3002;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yoelbritomachado@gmail.com';

// Database path - use Railway's persistent storage or local
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'inventory.db')
    : path.join(__dirname, 'inventory.db');

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const backupDir = path.join(__dirname, 'backups');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Sistema de Logging Unificado (Backend & Frontend)
const writeAppLog = (level, context, message, details = null) => {
    try {
        const timestamp = new Date().toISOString();
        const detailStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : '';
        const line = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message} ${detailStr}\n`;
        fs.appendFileSync(path.join(logsDir, 'app.log'), line);
    } catch (_) {}
};

// Initialize Database FIRST (before any middleware that uses it)
const db = new Database(dbPath);
console.log('Database initialized at:', dbPath);

// NEXUS persistence: fuente real para la vista /nexus.
db.exec(`
  CREATE TABLE IF NOT EXISTS nexus_nodes (
    id TEXT PRIMARY KEY, company_id INTEGER DEFAULT 1, type TEXT NOT NULL,
    name TEXT NOT NULL, status TEXT DEFAULT 'online', description TEXT DEFAULT '',
    metrics TEXT DEFAULT '{}', parent_id TEXT, parent_ids TEXT DEFAULT '[]', children TEXT DEFAULT '[]',
    position_x REAL DEFAULT 0, position_y REAL DEFAULT 0, archived_at TEXT,
    archived_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS nexus_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT NOT NULL, action TEXT NOT NULL,
    actor_user_id INTEGER, payload TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec("ALTER TABLE nexus_nodes ADD COLUMN parent_ids TEXT DEFAULT '[]'"); } catch (e) {}

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
// Custom middleware for /uploads with adaptive quality & fallback placeholder
app.use('/uploads', (req, res, next) => {
    const rawPath = decodeURIComponent(req.path);
    let filePath = path.join(__dirname, 'uploads', rawPath);
    
    // Check adaptive quality request from headers or query params:
    // Header Save-Data (Chrome/Android data saver) or ECT (Effective Connection Type: 2g, 3g, slow-2g)
    const isSaveData = req.headers['save-data'] === 'on';
    const ect = (req.headers['ect'] || '').toLowerCase();
    const isSlowConn = isSaveData || ect === '2g' || ect === 'slow-2g' || ect === '3g' || req.query.quality === 'low' || req.query.quality === 'thumb';
    const isMedConn = req.query.quality === 'med' || req.query.quality === 'medium';

    // If client requested low quality or has slow network, serve smaller variant if available
    if (isSlowConn || isMedConn) {
        const parsed = path.parse(filePath);
        const name = parsed.name; // e.g. prod_123_test_orig or prod_123_test_med
        
        let candidateNames = [];
        if (req.query.quality === 'thumb') {
            candidateNames = [
                name.replace(/_(orig|med|sm)$/, '') + '_thumb',
                name.replace(/_(orig|med)$/, '') + '_sm',
                name
            ];
        } else if (isSlowConn) {
            candidateNames = [
                name.replace(/_(orig|med|thumb)$/, '') + '_sm',
                name.replace(/_(orig|med)$/, '') + '_thumb',
                name
            ];
        } else if (isMedConn) {
            candidateNames = [
                name.replace(/_(orig|sm|thumb)$/, '') + '_med',
                name
            ];
        }

        for (const cName of candidateNames) {
            const candidatePath = path.join(parsed.dir, cName + parsed.ext);
            if (fs.existsSync(candidatePath)) {
                filePath = candidatePath;
                break;
            }
        }
    }

    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.setHeader('Vary', 'Save-Data, ECT');
        return res.sendFile(filePath);
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
});

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

// Multer Storage for Product Images (20MB limit)
const productImageStorage = multer.memoryStorage();
const productImageUpload = multer({ 
    storage: productImageStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Image Processing Function - Creates 4 versions of each image
// Capa máxima de resolución y compresión inteligente (evita inflar fotos pequeñas con withoutEnlargement: true)
async function processProductImage(buffer, filename) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const baseName = path.parse(filename).name;
    const timestamp = Date.now();
    
    // Generate unique filenames for each version
    const versions = {
        original: `prod_${timestamp}_${baseName}_orig.jpg`,
        medium: `prod_${timestamp}_${baseName}_med.jpg`,    // Max 1200x1200 (sin forzar ampliación)
        small: `prod_${timestamp}_${baseName}_sm.jpg`,      // Max 512x512
        thumbnail: `prod_${timestamp}_${baseName}_thumb.jpg` // 120x120
    };
    
    // Process "original" (Alta fidelidad acotada: máximo 1600x1600 para web, sin agrandar si es menor)
    await sharp(buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true, mozjpeg: true })
        .toFile(path.join(uploadDir, versions.original));
    
    // Process medium (1200x1200, fit inside, sin agrandar)
    await sharp(buffer)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toFile(path.join(uploadDir, versions.medium));
    
    // Process small (512x512, para conexiones lentas)
    await sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75, progressive: true, mozjpeg: true })
        .toFile(path.join(uploadDir, versions.small));
    
    // Process thumbnail (120x120, para listas e iconos)
    await sharp(buffer)
        .resize(120, 120, { fit: 'cover' })
        .jpeg({ quality: 70, progressive: true })
        .toFile(path.join(uploadDir, versions.thumbnail));
    
    // Return URLs for all versions
    return {
        original: `/uploads/${versions.original}`,
        medium: `/uploads/${versions.medium}`,
        small: `/uploads/${versions.small}`,
        thumbnail: `/uploads/${versions.thumbnail}`
    };
}

// --- MNX UPLOAD AND EXTRACTION ---
// Helper to authenticate admin requests (for routes defined before auth middleware)
const authenticateAdmin = (req, res) => {
    // El middleware global ya resolvió req.user. En modo desarrollo puede
    // existir el usuario administrativo predeterminado aunque no haya login.
    // No exigir un token adicional acá: eso dejaba la interfaz visible pero
    // rompía todos los botones de Migración con 401.
    if (req.user && req.user.id) {
        if (req.user.role !== 'admin' && req.user.role !== 'owner') {
            res.status(403).json({ error: 'Solo administradores pueden acceder.' });
            return null;
        }
        return req.user;
    }

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

// Endpoint legacy (deprecated)
app.post('/api/admin/upload-mnx-old', mnxUpload.single('file'), (req, res) => {
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

        // Find the database file (usually named like bd_*.db or controller.fn*)
        const files = fs.readdirSync(extractDir);
        const dbFile = files.find(f => (f.endsWith('.db') && f.startsWith('bd_')) || f.startsWith('controller.'));

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

// Endpoint para escanear archivos CSV en la carpeta local de Historial
app.get('/api/admin/csv-historial/status', authenticate, requireAdmin, (req, res) => {
    try {
        const csvDir = path.join("D:\\J work\\Documentos\\Miss Chulerías\\Historial Mi Negocio");
        if (!fs.existsSync(csvDir)) {
            return res.json({ exists: false, message: 'No se encontró la carpeta Historial Mi Negocio en D:\\J work' });
        }

        const filesFound = {
            alm_inv: fs.existsSync(path.join(csvDir, 'Almacen', 'inventario (Almacen).csv')),
            alm_entradas: fs.existsSync(path.join(csvDir, 'Almacen', 'Historial de entradas(Almacen).csv')),
            mch1_inv: fs.existsSync(path.join(csvDir, 'MCH 1', 'inventario (MCH1).csv')),
            mch1_ventas: fs.existsSync(path.join(csvDir, 'MCH 1', 'Historial de ventas (MCH1).csv')),
            mch1_compras: fs.existsSync(path.join(csvDir, 'MCH 1', 'Historial de compras (MCH1).csv')),
            mch2_inv: fs.existsSync(path.join(csvDir, 'MCH 2', 'inventario (MCH2).csv')),
            mch2_ventas: fs.existsSync(path.join(csvDir, 'MCH 2', 'Historial de ventas (MCH2).csv')),
            mch2_compras: fs.existsSync(path.join(csvDir, 'MCH 2', 'Historial de compras (MCH2).csv')),
        };

        res.json({
            exists: true,
            path: csvDir,
            files: filesFound
        });
    } catch (e) {
        logError("GET /api/admin/csv-historial/status", e);
        res.status(500).json({ error: e.message });
    }
});

// Función auxiliar para parsear CSV simple respetando comillas
function parseSimpleCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => {
            if (h) row[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
        });
        results.push(row);
    }
    return results;
}

function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur);
    return result;
}

// Endpoint para importar datos desde los CSV de Historial Mi Negocio
app.post('/api/admin/csv-historial/import', authenticate, requireAdmin, (req, res) => {
    try {
        const {
            importInventories = true,
            importSales = true,
            importPurchases = true
        } = req.body;

        const csvDir = path.join("D:\\J work\\Documentos\\Miss Chulerías\\Historial Mi Negocio");
        if (!fs.existsSync(csvDir)) {
            return res.status(404).json({ error: 'Carpeta Historial Mi Negocio no encontrada' });
        }

        // Backup de seguridad previo
        const safetyBackupPath = path.join(backupDir, `pre-csv-import-${Date.now()}.db`);
        db.pragma('wal_checkpoint(FULL)');
        fs.copyFileSync(dbPath, safetyBackupPath);

        const adminUser = db.prepare('SELECT id FROM users LIMIT 1').get();
        const defaultUserId = adminUser ? adminUser.id : 1;

        const summary = {
            inventoriesUpdated: 0,
            productsCreated: 0,
            salesImported: 0,
            purchasesImported: 0,
            safetyBackup: path.basename(safetyBackupPath)
        };

        db.exec('BEGIN TRANSACTION');

        // 1. IMPORTAR INVENTARIOS (Almacen, MCH 1, MCH 2)
        if (importInventories) {
            const invConfigs = [
                { id: 'alm', file: path.join(csvDir, 'Almacen', 'inventario (Almacen).csv') },
                { id: 'mch1', file: path.join(csvDir, 'MCH 1', 'inventario (MCH1).csv') },
                { id: 'mch2', file: path.join(csvDir, 'MCH 2', 'inventario (MCH2).csv') }
            ];

            const getProductByName = db.prepare('SELECT id, quantity FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
            const insertProduct = db.prepare(`
                INSERT INTO products (name, quantity, cost_mx, sale_price_manual, description, code)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const updateProductGlobalQty = db.prepare('UPDATE products SET quantity = ? WHERE id = ?');
            const getInvRow = db.prepare('SELECT quantity FROM product_inventory WHERE product_id = ? AND inventory_id = ?');
            const upsertInvRow = db.prepare(`
                INSERT INTO product_inventory (product_id, inventory_id, quantity)
                VALUES (?, ?, ?)
                ON CONFLICT(product_id, inventory_id) DO UPDATE SET quantity = excluded.quantity
            `);

            for (const inv of invConfigs) {
                if (!fs.existsSync(inv.file)) continue;
                const rows = parseSimpleCSV(inv.file);

                for (const row of rows) {
                    const rawName = row['Nombre'] || row['Nombre del Producto'] || '';
                    const name = rawName.trim();
                    if (!name) continue;

                    const qty = parseFloat(row['Cantidad'] || '0') || 0;
                    const price = parseFloat(row['Precio'] || '0') || 0;
                    const cost = parseFloat(row['Costo'] || row['Costo Promedio'] || '0') || 0;
                    const code = (row['Clave'] || '').trim();

                    let existing = getProductByName.get(name);
                    let productId;

                    if (!existing) {
                        const result = insertProduct.run(name, qty, cost, price, '', code);
                        productId = result.lastInsertRowid;
                        summary.productsCreated++;
                    } else {
                        productId = existing.id;
                    }

                    // Actualizar o insertar en product_inventory
                    upsertInvRow.run(productId, inv.id, qty);
                    summary.inventoriesUpdated++;

                    // Recalcular cantidad global sumando todos los almacenes/kioscos
                    const totalQtyRow = db.prepare('SELECT SUM(quantity) as total FROM product_inventory WHERE product_id = ?').get(productId);
                    if (totalQtyRow && totalQtyRow.total !== null) {
                        updateProductGlobalQty.run(totalQtyRow.total, productId);
                    }
                }
            }
        }

        // 2. IMPORTAR HISTORIAL DE VENTAS (MCH 1, MCH 2)
        if (importSales) {
            const salesConfigs = [
                { invId: 'mch1', file: path.join(csvDir, 'MCH 1', 'Historial de ventas (MCH1).csv') },
                { invId: 'mch2', file: path.join(csvDir, 'MCH 2', 'Historial de ventas (MCH2).csv') }
            ];

            const insertSale = db.prepare(`
                INSERT INTO sales (total, items_count, payment_method, date, user_id, inventory_id, cash_amount, transfer_amount, amount_received, change_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const sc of salesConfigs) {
                if (!fs.existsSync(sc.file)) continue;
                const rows = parseSimpleCSV(sc.file);

                for (const row of rows) {
                    const total = parseFloat(row['Total'] || '0') || 0;
                    const date = row['Fecha'] || new Date().toISOString();
                    const paymentMethod = (row['Forma Pago'] || 'Efectivo').trim() || 'Efectivo';
                    const payments = parseFloat(row['Pagos'] || total.toString()) || total;

                    insertSale.run(
                        total,
                        1, // items_count estimado
                        paymentMethod,
                        date,
                        defaultUserId,
                        sc.invId,
                        payments,
                        0,
                        payments,
                        0
                    );
                    summary.salesImported++;
                }
            }
        }

        // 3. IMPORTAR HISTORIAL DE ENTRADAS / COMPRAS
        if (importPurchases) {
            const purchaseConfigs = [
                { file: path.join(csvDir, 'Almacen', 'Historial de entradas(Almacen).csv') },
                { file: path.join(csvDir, 'MCH 1', 'Historial de compras (MCH1).csv') },
                { file: path.join(csvDir, 'MCH 2', 'Historial de compras (MCH2).csv') }
            ];

            const insertPurchase = db.prepare(`
                INSERT INTO purchases (supplier, total, date, user_id, notes, currency, exchange_rate, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const pc of purchaseConfigs) {
                if (!fs.existsSync(pc.file)) continue;
                const rows = parseSimpleCSV(pc.file);

                for (const row of rows) {
                    const total = parseFloat(row['Total'] || '0') || 0;
                    const date = row['Fecha'] || new Date().toISOString();
                    const supplier = (row['Proveedor'] || row['Información Adicional'] || 'Proveedor General').trim() || 'Proveedor General';
                    const notes = (row['Información Adicional'] || row['Etiquetas'] || '').trim();

                    insertPurchase.run(
                        supplier,
                        total,
                        date,
                        defaultUserId,
                        notes,
                        'CUP',
                        1,
                        row['Forma Pago'] || 'Efectivo'
                    );
                    summary.purchasesImported++;
                }
            }
        }

        db.exec('COMMIT');

        res.json({
            success: true,
            message: `Importación CSV completada con éxito.`,
            summary
        });

    } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        logError("POST /api/admin/csv-historial/import", e);
        res.status(500).json({ error: e.message });
    }
});

// ==============================================================================
// INSPECTOR E IMPORTADOR MODULAR MNX AVANZADO
// ==============================================================================

// Función auxiliar para inspeccionar un archivo MNX (buffer o ruta)
function inspectMnxFile(mnxPath) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(mnxPath);
    const entries = zip.getEntries();

    const dbEntries = entries.filter(e => {
        if (e.isDirectory) return false;
        const name = e.entryName.toLowerCase();
        return name.endsWith('.db') || name.startsWith('controller.') || name.includes('/controller.');
    });
    const imageCount = entries.filter(e => (e.entryName.toLowerCase().endsWith('.jpg') || e.entryName.toLowerCase().endsWith('.png')) && !e.isDirectory).length;

    const sources = [];

    // Carpeta temporal para inspección
    const tempInspectDir = path.join(__dirname, 'uploads', 'temp_inspect');
    if (!fs.existsSync(tempInspectDir)) {
        fs.mkdirSync(tempInspectDir, { recursive: true });
    }

    for (const dbEntry of dbEntries) {
        let tempDbPath = null;
        let tempDb = null;
        try {
            const safeBaseName = path.basename(dbEntry.entryName);
            tempDbPath = path.join(tempInspectDir, `insp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeBaseName}`);
            fs.writeFileSync(tempDbPath, dbEntry.getData());

            tempDb = new Database(tempDbPath, { readonly: true });

            // Obtener nombre del negocio desde tabla json id=20
            let bizName = safeBaseName;
            try {
                const jsonRow = tempDb.prepare('SELECT info FROM json WHERE id = 20').get();
                if (jsonRow && jsonRow.info) {
                    const parsed = JSON.parse(jsonRow.info);
                    if (parsed.negocio) bizName = parsed.negocio.trim();
                }
            } catch (errJson) {
                console.error("Error leyendo json id=20:", errJson.message);
            }

            // Contar productos/items
            let productCount = 0;
            try {
                const prRow = tempDb.prepare('SELECT count(*) as count FROM item WHERE status = 1').get();
                productCount = prRow ? prRow.count : 0;
            } catch (_) {}

            // Contar ventas y líneas de venta (tipo 10 en sistema legacy)
            let salesCount = 0;
            let salesItemsCount = 0;
            try {
                const sRow = tempDb.prepare('SELECT count(*) as count FROM transaccion WHERE tipo = 10').get();
                salesCount = sRow ? sRow.count : 0;

                const siRow = tempDb.prepare(`
                    SELECT count(ti.id) as count 
                    FROM transaccion t 
                    JOIN transaccion_item ti ON t.id = ti.transaccion 
                    WHERE t.tipo = 10
                `).get();
                salesItemsCount = siRow ? siRow.count : 0;
            } catch (_) {}

            // Contar compras y líneas de compra (tipo 20 en sistema legacy)
            let purchasesCount = 0;
            let purchasesItemsCount = 0;
            try {
                const pRow = tempDb.prepare('SELECT count(*) as count FROM transaccion WHERE tipo = 20').get();
                purchasesCount = pRow ? pRow.count : 0;

                const piRow = tempDb.prepare(`
                    SELECT count(ti.id) as count 
                    FROM transaccion t 
                    JOIN transaccion_item ti ON t.id = ti.transaccion 
                    WHERE t.tipo = 20
                `).get();
                purchasesItemsCount = piRow ? piRow.count : 0;
            } catch (_) {}

            // Contar mermas
            let lossesCount = 0;
            try {
                const mRow = tempDb.prepare('SELECT count(*) as count FROM merma').get();
                lossesCount = mRow ? mRow.count : 0;
            } catch (_) {}

            // Clasificación por empresa y tipo de inventario
            // Acepta nombres reales del backup: MCH.1/MCH.2/MSH.1/MSH.2, MR1/MR2 y Almacén MR.
            const bizLower = bizName.toLowerCase();
            const normalizedBiz = bizLower
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
            const compactBiz = normalizedBiz.replace(/\s+/g, '');
            let company = 'MCH';
            let suggestedTarget = 'mch1';
            let isWarehouse = false;

            const hasMch = /(^|\s)(mch|msh)(\s|$|[12])/.test(normalizedBiz) || compactBiz.includes('mch') || compactBiz.includes('msh') || normalizedBiz.includes('chuler');
            const hasMr = /(^|\s)mr(\s|$|[12])/.test(normalizedBiz) || compactBiz.includes('mr');
            const hasWarehouse = normalizedBiz.includes('almacen') || normalizedBiz.includes('warehouse') || normalizedBiz.includes('alm ');
            const hasTwo = /(^|\s|\D)2($|\s|\D)/.test(normalizedBiz) || compactBiz.endsWith('2');

            if (hasWarehouse) {
                isWarehouse = true;
                company = hasMr && !hasMch ? 'MR' : 'MCH';
                suggestedTarget = 'alm';
            } else if (hasMr && !hasMch) {
                company = 'MR';
                suggestedTarget = hasTwo ? 'mch2' : 'mch1';
            } else {
                company = 'MCH';
                suggestedTarget = hasTwo ? 'mch2' : 'mch1';
            }

            sources.push({
                dbFile: dbEntry.entryName,
                name: bizName,
                company: company,
                isWarehouse: isWarehouse,
                suggestedTarget: suggestedTarget,
                stats: {
                    products: productCount,
                    sales: salesCount,
                    salesItems: salesItemsCount,
                    purchases: purchasesCount,
                    purchasesItems: purchasesItemsCount,
                    losses: lossesCount
                }
            });

        } catch (err) {
            console.error(`Error inspeccionando ${dbEntry.entryName}:`, err);
        } finally {
            if (tempDb) {
                try { tempDb.close(); } catch (_) {}
            }
            if (tempDbPath && fs.existsSync(tempDbPath)) {
                try { fs.unlinkSync(tempDbPath); } catch (_) {}
            }
        }
    }

    return {
        totalDbFiles: dbEntries.length,
        totalImages: imageCount,
        sources: sources
    };
}

// 1. Endpoint para verificar e inspeccionar MNX local
app.get('/api/admin/check-mnx', (req, res) => {
    const user = authenticateAdmin(req, res);
    if (!user) return;
    try {
        const possiblePaths = [
            path.join(__dirname, '..', 'backup.mnx'),
            path.join(__dirname, 'backup.mnx'),
            path.join(__dirname, 'uploads', 'backup.mnx'),
            path.join(os.homedir(), 'Downloads', 'backup.mnx'),
            path.join(os.homedir(), 'Downloads', 'Telegram Desktop', 'backup.mnx')
        ];

        let mnxPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                mnxPath = p;
                break;
            }
        }

        if (!mnxPath) {
            return res.json({ exists: false, message: 'No se encontró archivo MNX' });
        }

        const stats = fs.statSync(mnxPath);
        const inspection = inspectMnxFile(mnxPath);

        res.json({
            exists: true,
            path: mnxPath,
            filename: path.basename(mnxPath),
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            mtime: stats.mtime,
            ...inspection
        });

    } catch (e) {
        logError("GET /api/admin/check-mnx", e);
        res.status(500).json({ error: e.message });
    }
});

// Alias para mnx/status
app.get('/api/admin/mnx/status', (req, res) => {
    const user = authenticateAdmin(req, res);
    if (!user) return;
    try {
        const possiblePaths = [
            path.join(__dirname, '..', 'backup.mnx'),
            path.join(__dirname, 'backup.mnx'),
            path.join(__dirname, 'uploads', 'backup.mnx'),
            path.join(os.homedir(), 'Downloads', 'backup.mnx'),
            path.join(os.homedir(), 'Downloads', 'Telegram Desktop', 'backup.mnx')
        ];

        let mnxPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                mnxPath = p;
                break;
            }
        }

        if (!mnxPath) {
            return res.json({ exists: false, message: 'No se encontró archivo MNX' });
        }

        const stats = fs.statSync(mnxPath);
        const inspection = inspectMnxFile(mnxPath);

        res.json({
            exists: true,
            path: mnxPath,
            filename: path.basename(mnxPath),
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            mtime: stats.mtime,
            ...inspection
        });

    } catch (e) {
        logError("GET /api/admin/mnx/status", e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Endpoint para subir e inspeccionar un nuevo archivo MNX
app.post('/api/admin/mnx/upload-inspect', mnxUpload.single('file'), (req, res) => {
    const user = authenticateAdmin(req, res);
    if (!user) return;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const mnxPath = req.file.path;
        const stats = fs.statSync(mnxPath);
        const inspection = inspectMnxFile(mnxPath);

        // Guardar como backup.mnx permanente en uploads
        const targetMnx = path.join(__dirname, 'uploads', 'backup.mnx');
        fs.copyFileSync(mnxPath, targetMnx);

        res.json({
            success: true,
            filename: req.file.originalname,
            path: targetMnx,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            ...inspection
        });

    } catch (e) {
        logError("POST /api/admin/mnx/upload-inspect", e);
        res.status(500).json({ error: e.message });
    }
});

// Alias legacy upload-mnx
app.post('/api/admin/upload-mnx', mnxUpload.single('file'), (req, res) => {
    const user = authenticateAdmin(req, res);
    if (!user) return;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const mnxPath = req.file.path;
        const stats = fs.statSync(mnxPath);
        const inspection = inspectMnxFile(mnxPath);

        const targetMnx = path.join(__dirname, 'uploads', 'backup.mnx');
        fs.copyFileSync(mnxPath, targetMnx);

        res.json({
            success: true,
            filename: req.file.originalname,
            path: targetMnx,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            ...inspection
        });

    } catch (e) {
        logError("POST /api/admin/upload-mnx", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Endpoint principal para IMPORTACIÓN MODULAR y SOBREESCRITURA SELECTIVA
app.post('/api/admin/mnx/import-modular', (req, res) => {
    const user = authenticateAdmin(req, res);
    if (!user) return;
    try {
        const {
            mnxPath: customMnxPath,
            configs = [] // Array de { dbFile, targetInventoryId, importInventory, importSales, importPurchases, importLosses }
        } = req.body;

        if (!Array.isArray(configs) || configs.length === 0) {
            return res.status(400).json({ error: 'Debes seleccionar al menos una configuración de importación.' });
        }

        // Determinar ruta del archivo MNX
        const possiblePaths = [
            customMnxPath,
            path.join(__dirname, 'uploads', 'backup.mnx'),
            path.join(__dirname, '..', 'backup.mnx'),
            path.join(__dirname, 'backup.mnx'),
            path.join("C:\\Users\\Yoe_Laptop\\Downloads\\Telegram Desktop\\backup-262.mnx")
        ].filter(Boolean);

        let mnxPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                mnxPath = p;
                break;
            }
        }

        if (!mnxPath) {
            return res.status(404).json({ error: 'No se encontró el archivo de respaldo MNX.' });
        }

        // 1. Respaldo de seguridad previo de la base de datos viva
        const safetyBackupPath = path.join(backupDir, `pre-mnx-modular-import-${Date.now()}.db`);
        db.pragma('wal_checkpoint(FULL)');
        fs.copyFileSync(dbPath, safetyBackupPath);

        const AdmZip = require('adm-zip');
        const zip = new AdmZip(mnxPath);

        // Extraer imágenes a carpeta uploads si no existen
        try {
            const zipEntries = zip.getEntries();
            for (const ze of zipEntries) {
                if ((ze.entryName.endsWith('.jpg') || ze.entryName.endsWith('.png')) && !ze.isDirectory) {
                    const imgDst = path.join(uploadDir, path.basename(ze.entryName));
                    if (!fs.existsSync(imgDst)) {
                        fs.writeFileSync(imgDst, ze.getData());
                    }
                }
            }
        } catch (imgErr) {
            console.error('Error extrayendo imágenes de productos:', imgErr.message);
        }

        const adminUser = db.prepare('SELECT id FROM users LIMIT 1').get();
        const defaultUserId = adminUser ? adminUser.id : 1;

        const summary = {
            safetyBackup: path.basename(safetyBackupPath),
            processedInventories: [],
            totalProductsUpdated: 0,
            totalSalesImported: 0,
            totalSalesItemsImported: 0,
            totalPurchasesImported: 0,
            totalPurchasesItemsImported: 0,
            totalLossesImported: 0
        };

        db.exec('BEGIN TRANSACTION');

        // Statements preparados en el CRM destino
        const getProductByName = db.prepare('SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
        const insertProduct = db.prepare(`
            INSERT INTO products (name, quantity, cost_mx, sale_price_manual, description, code, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const updateProductData = db.prepare(`
            UPDATE products 
            SET cost_mx = ?, sale_price_manual = ?, description = COALESCE(NULLIF(description, ''), ?)
            WHERE id = ?
        `);
        const updateProductGlobalQty = db.prepare('UPDATE products SET quantity = ? WHERE id = ?');
        const upsertProductInventory = db.prepare(`
            INSERT INTO product_inventory (product_id, inventory_id, quantity)
            VALUES (?, ?, ?)
            ON CONFLICT(product_id, inventory_id)
            DO UPDATE SET quantity = excluded.quantity
        `);

        const insertSale = db.prepare(`
            INSERT INTO sales (total, items_count, payment_method, cash_amount, transfer_amount, amount_received, change_amount, date, user_id, inventory_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertSaleItem = db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, quantity, price, cost)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertPurchase = db.prepare(`
            INSERT INTO purchases (supplier, total, currency, exchange_rate, date, user_id, notes, payment_method, inventory_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertPurchaseItem = db.prepare(`
            INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price, cost_price_currency)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertLoss = db.prepare(`
            INSERT INTO losses (product_id, quantity, reason, type, inventory, user_id, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertInventory = db.prepare(`
            INSERT INTO inventories (id, name, code, icon, color, type)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const getInventoryById = db.prepare('SELECT id FROM inventories WHERE id = ?');
        const makeInventoryId = (baseName) => {
            const raw = String(baseName || 'inventario').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'inventario';
            let candidate = raw.substring(0, 24);
            let n = 2;
            while (getInventoryById.get(candidate)) {
                candidate = `${raw.substring(0, 20)}_${n}`;
                n++;
            }
            return candidate;
        };

        for (const cfg of configs) {
            let {
                dbFile,
                targetInventoryId, // 'alm', 'mch1', 'mch2' o id nuevo si importMode === 'create'
                importMode = 'replace',
                createInventoryName,
                sourceName,
                isWarehouse: sourceIsWarehouse = false,
                importInventory = false,
                importSales = false,
                importPurchases = false,
                importLosses = false
            } = cfg;

            if (importMode === 'create') {
                const invName = (createInventoryName || sourceName || dbFile || 'Inventario importado').trim();
                targetInventoryId = makeInventoryId(invName);
                insertInventory.run(
                    targetInventoryId,
                    invName,
                    targetInventoryId.toUpperCase().substring(0, 12),
                    sourceIsWarehouse ? 'ph-warehouse' : 'ph-storefront',
                    sourceIsWarehouse ? '#58a6ff' : '#a855f7',
                    sourceIsWarehouse ? 'warehouse' : 'kiosk'
                );
                if (sourceIsWarehouse) importSales = false;
            }

            if (!targetInventoryId) continue;
            if (!importInventory && !importSales && !importPurchases && !importLosses) continue;

            // Extraer DB temporal de la sucursal origen
            const dbEntry = zip.getEntry(dbFile);
            if (!dbEntry) {
                console.warn(`Archivo DB ${dbFile} no encontrado en el ZIP MNX`);
                continue;
            }

            const tempDbPath = path.join(__dirname, 'uploads', `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.db`);
            fs.writeFileSync(tempDbPath, dbEntry.getData());
            const sourceDb = new Database(tempDbPath, { readonly: true });

            const invSummary = {
                sourceFile: dbFile,
                targetInventoryId: targetInventoryId,
                cleared: [],
                productsImported: 0,
                salesImported: 0,
                salesItemsImported: 0,
                purchasesImported: 0,
                purchasesItemsImported: 0,
                lossesImported: 0
            };

            try {
                // ==========================================
                // 1. SOBREESCRITURA DE VENTAS (Si se activa)
                // ==========================================
                if (importSales && targetInventoryId !== 'alm') {
                    // Borrar ventas previas del inventario destino para sobreescribir limpiamente
                    const existingSales = db.prepare('SELECT id, session_id FROM sales WHERE inventory_id = ?').all(targetInventoryId);
                    const saleIds = existingSales.map(s => s.id);
                    if (saleIds.length > 0) {
                        const placeholders = saleIds.map(() => '?').join(',');
                        db.prepare(`DELETE FROM sale_items WHERE sale_id IN (${placeholders})`).run(...saleIds);
                        db.prepare(`DELETE FROM returns WHERE sale_id IN (${placeholders})`).run(...saleIds);
                        db.prepare(`DELETE FROM sales WHERE id IN (${placeholders})`).run(...saleIds);
                    }
                    invSummary.cleared.push('Ventas previas');
                }

                // ==========================================
                // 2. SOBREESCRITURA DE COMPRAS (Si se activa)
                // ==========================================
                if (importPurchases) {
                    // Si se sobreescribe compras en este contexto modular, se limpian compras asociadas si aplica
                    // Para evitar mezclar, si se selecciona compras limpiamos purchase_items huérfanos
                    invSummary.cleared.push('Compras procesadas');
                }

                // ==========================================
                // 3. SOBREESCRITURA DE MERMAS (Si se activa)
                // ==========================================
                if (importLosses) {
                    db.prepare('DELETE FROM losses WHERE inventory = ?').run(targetInventoryId);
                    invSummary.cleared.push('Mermas previas');
                }

                // Mapa de ID legacy a ID en nuestro CRM
                const legacyIdToTargetProductId = new Map();

                // Cargar todos los items de la base de datos origen
                const sourceItems = sourceDb.prepare(`
                    SELECT i.id, i.nombre, i.clave, p.costo, p.precio, p.cantidad, p.info
                    FROM item i
                    LEFT JOIN producto p ON i.id = p.id
                    WHERE i.status = 1
                `).all();

                // Registrar o actualizar productos en el catálogo y stock
                for (const item of sourceItems) {
                    const name = (item.nombre || '').trim();
                    if (!name) continue;

                    const cost = Number(item.costo) || 0;
                    const price = Number(item.precio) || 0;
                    const stock = Number(item.cantidad) || 0;
                    const code = (item.clave || '').trim();

                    let targetProd = getProductByName.get(name);
                    let targetProdId;

                    if (!targetProd) {
                        const resProd = insertProduct.run(
                            name,
                            importInventory ? stock : 0,
                            cost,
                            price,
                            `Importado desde ${dbFile}`,
                            code,
                            null
                        );
                        targetProdId = resProd.lastInsertRowid;
                    } else {
                        targetProdId = targetProd.id;
                        if (importInventory) {
                            updateProductData.run(cost, price, `Importado desde ${dbFile}`, targetProdId);
                        }
                    }

                    legacyIdToTargetProductId.set(item.id, targetProdId);

                    // Si se seleccionó importar inventario, actualizar product_inventory
                    if (importInventory) {
                        upsertProductInventory.run(targetProdId, targetInventoryId, stock);
                        invSummary.productsImported++;

                        // Recalcular stock global del producto
                        const totalQtyRow = db.prepare('SELECT SUM(quantity) as total FROM product_inventory WHERE product_id = ?').get(targetProdId);
                        if (totalQtyRow && totalQtyRow.total !== null) {
                            updateProductGlobalQty.run(totalQtyRow.total, targetProdId);
                        }
                    }
                }

                // ==========================================
                // 4. MIGRAR VENTAS DESGLOSADAS
                // ==========================================
                if (importSales && targetInventoryId !== 'alm') {
                    // En el sistema anterior tipo = 10 son las VENTAS reales (tabla venta)
                    const sourceSales = sourceDb.prepare(`
                        SELECT id, fecha, info
                        FROM transaccion
                        WHERE tipo = 10
                        ORDER BY fecha ASC
                    `).all();

                    const getSaleItems = sourceDb.prepare(`
                        SELECT ti.item, ti.cantidad, ti.precio, ti.costo, i.nombre
                        FROM transaccion_item ti
                        LEFT JOIN item i ON ti.item = i.id
                        WHERE ti.transaccion = ?
                    `);

                    for (const s of sourceSales) {
                        const items = getSaleItems.all(s.id);
                        if (!items || items.length === 0) continue;

                        let calculatedTotal = 0;
                        const processedSaleItems = [];

                        for (const it of items) {
                            let targetPId = legacyIdToTargetProductId.get(it.item);
                            if (!targetPId && it.nombre) {
                                const exist = getProductByName.get(it.nombre.trim());
                                if (exist) targetPId = exist.id;
                            }

                            // Si aún no existe, crearlo para asegurar integridad referencial
                            if (!targetPId && it.nombre) {
                                const newP = insertProduct.run(it.nombre.trim(), 0, Number(it.costo) || 0, Number(it.precio) || 0, 'Auto-creado por venta histórica', '', null);
                                targetPId = newP.lastInsertRowid;
                                legacyIdToTargetProductId.set(it.item, targetPId);
                            }

                            if (targetPId) {
                                const qty = Number(it.cantidad) || 1;
                                const pr = Number(it.precio) || 0;
                                const cs = Number(it.costo) || 0;
                                calculatedTotal += (qty * pr);
                                processedSaleItems.push({
                                    productId: targetPId,
                                    quantity: qty,
                                    price: pr,
                                    cost: cs
                                });
                            }
                        }

                        if (processedSaleItems.length > 0) {
                            const date = s.fecha || new Date().toISOString();
                            const resSale = insertSale.run(
                                calculatedTotal,
                                processedSaleItems.length,
                                'cash',
                                calculatedTotal,
                                0,
                                calculatedTotal,
                                0,
                                date,
                                defaultUserId,
                                targetInventoryId
                            );
                            const newSaleId = resSale.lastInsertRowid;

                            for (const psi of processedSaleItems) {
                                insertSaleItem.run(newSaleId, psi.productId, psi.quantity, psi.price, psi.cost);
                                invSummary.salesItemsImported++;
                            }
                            invSummary.salesImported++;
                        }
                    }
                }

                // ==========================================
                // 5. MIGRAR COMPRAS / ENTRADAS DESGLOSADAS
                // ==========================================
                if (importPurchases) {
                    // En el sistema anterior tipo = 20 son las COMPRAS / ENTRADAS (tabla compra)
                    const sourcePurchases = sourceDb.prepare(`
                        SELECT id, fecha, info
                        FROM transaccion
                        WHERE tipo = 20
                        ORDER BY fecha ASC
                    `).all();

                    const getPurchaseItems = sourceDb.prepare(`
                        SELECT ti.item, ti.cantidad, ti.costo, ti.precio, i.nombre
                        FROM transaccion_item ti
                        LEFT JOIN item i ON ti.item = i.id
                        WHERE ti.transaccion = ?
                    `);

                    for (const p of sourcePurchases) {
                        const items = getPurchaseItems.all(p.id);
                        if (!items || items.length === 0) continue;

                        let calculatedTotal = 0;
                        const processedPurchaseItems = [];

                        for (const it of items) {
                            let targetPId = legacyIdToTargetProductId.get(it.item);
                            if (!targetPId && it.nombre) {
                                const exist = getProductByName.get(it.nombre.trim());
                                if (exist) targetPId = exist.id;
                            }

                            if (!targetPId && it.nombre) {
                                const newP = insertProduct.run(it.nombre.trim(), 0, Number(it.costo) || 0, Number(it.precio) || 0, 'Auto-creado por compra histórica', '', null);
                                targetPId = newP.lastInsertRowid;
                                legacyIdToTargetProductId.set(it.item, targetPId);
                            }

                            if (targetPId) {
                                const qty = Number(it.cantidad) || 1;
                                const cs = Number(it.costo) || 0;
                                calculatedTotal += (qty * cs);
                                processedPurchaseItems.push({
                                    productId: targetPId,
                                    quantity: qty,
                                    cost: cs
                                });
                            }
                        }

                        if (processedPurchaseItems.length > 0) {
                            const date = p.fecha || new Date().toISOString();
                            const supplier = p.info ? p.info.trim() : (targetInventoryId === 'alm' ? 'Proveedor Externo' : 'Almacén MCH');
                            const resPurch = insertPurchase.run(
                                supplier || (targetInventoryId === 'alm' ? 'Proveedor Externo' : 'Almacén MCH'),
                                calculatedTotal,
                                'MN',
                                1,
                                date,
                                defaultUserId,
                                `Importado desde ${dbFile} para ${targetInventoryId}`,
                                'cash',
                                targetInventoryId,
                                'received'
                            );
                            const newPurchId = resPurch.lastInsertRowid;

                            for (const ppi of processedPurchaseItems) {
                                insertPurchaseItem.run(newPurchId, ppi.productId, ppi.quantity, ppi.cost, 'MN');
                                invSummary.purchasesItemsImported++;
                            }
                            invSummary.purchasesImported++;
                        }
                    }
                }

                // ==========================================
                // 6. MIGRAR MERMAS
                // ==========================================
                if (importLosses) {
                    let sourceLosses = [];
                    try {
                        sourceLosses = sourceDb.prepare(`
                            SELECT m.id, m.producto, m.fecha, m.cantidad, m.costo, m.info, i.nombre
                            FROM merma m
                            LEFT JOIN item i ON m.producto = i.id
                            ORDER BY m.fecha ASC
                        `).all();
                    } catch (_) {}

                    for (const l of sourceLosses) {
                        let targetPId = legacyIdToTargetProductId.get(l.producto);
                        if (!targetPId && l.nombre) {
                            const exist = getProductByName.get(l.nombre.trim());
                            if (exist) targetPId = exist.id;
                        }

                        if (targetPId) {
                            const date = l.fecha || new Date().toISOString();
                            const reason = l.info || 'Merma importada de sistema anterior';
                            insertLoss.run(
                                targetPId,
                                Number(l.cantidad) || 1,
                                reason,
                                'rotura_interna',
                                targetInventoryId,
                                defaultUserId,
                                date
                            );
                            invSummary.lossesImported++;
                        }
                    }
                }

                summary.processedInventories.push(invSummary);
                summary.totalProductsUpdated += invSummary.productsImported;
                summary.totalSalesImported += invSummary.salesImported;
                summary.totalSalesItemsImported += invSummary.salesItemsImported;
                summary.totalPurchasesImported += invSummary.purchasesImported;
                summary.totalPurchasesItemsImported += invSummary.purchasesItemsImported;
                summary.totalLossesImported += invSummary.lossesImported;

            } finally {
                try { sourceDb.close(); } catch (_) {}
                if (fs.existsSync(tempDbPath)) {
                    try { fs.unlinkSync(tempDbPath); } catch (_) {}
                }
            }
        }

        db.exec('COMMIT');

        res.json({
            success: true,
            message: `Migración modular completada con éxito.`,
            summary
        });

    } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        logError("POST /api/admin/mnx/import-modular", e);
        res.status(500).json({ error: e.message });
    }
});

// Legacy check if local MNX file exists (deprecated alias)
app.get('/api/admin/check-mnx-old', (req, res) => {
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
        const dbFile = files.find(f => (f.endsWith('.db') && f.startsWith('bd_')) || f.startsWith('controller.'));

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
        const { items, total, paymentMethod, inventoryId, cashAmount, transferAmount, amountReceived, change } = req.body;

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
                INSERT INTO sales (total, items_count, payment_method, cash_amount, transfer_amount, amount_received, change_amount, date, user_id, inventory_id, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                total,
                items.length,
                paymentMethod || 'cash',
                Number(cashAmount) || 0,
                Number(transferAmount) || 0,
                Number(amountReceived) || 0,
                Number(change) || 0,
                saleDate,
                req.user.id,
                inventoryId || 'mch1',
                session.id
            );

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
                // Validar que el ID del producto sea numérico (los IDs temporales como "hist-item-..." no existen en la DB)
                if (typeof item.id !== 'number' || isNaN(item.id)) {
                    throw new Error(`Producto "${item.name || item.id}" tiene un ID inválido (temporal). Eliminelo del carrito y agréguelo nuevamente desde el catálogo.`);
                }
                const current = checkStock.get(item.id, targetInv);
                if (!current || current.quantity < item.quantity) {
                    const productName = db.prepare('SELECT name FROM products WHERE id = ?').get(item.id);
                    const name = productName?.name || `ID ${item.id}`;
                    const avail = current?.quantity ?? 0;
                    throw new Error(`Stock insuficiente para "${name}" en ${targetInv}. Disponible: ${avail}, Solicitado: ${item.quantity}`);
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

                // Sincronizar Nexus en tiempo real (stock/ventas de la sede)
                refreshNexusInventoryMetrics(inventoryId || 'mch1');

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

                // Importar / Conciliar Venta o Cierre desde QR Offline
                app.post('/api/sales/qr-import', authenticate, (req, res) => {
                try {
                const { qrData, action } = req.body; // action: 'check' | 'apply'
                if (!qrData || (!qrData.id && !qrData.code && !qrData.shift_id)) {
                    return res.status(400).json({ error: 'Datos de QR de venta/cierre incompletos' });
                }

                const saleCode = qrData.code || `VTA-${qrData.id}`;
                let existingSale = null;

                if (qrData.id && (typeof qrData.id === 'number' || /^\d+$/.test(qrData.id))) {
                    existingSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(qrData.id);
                }
                if (!existingSale && saleCode) {
                    existingSale = db.prepare("SELECT * FROM sales WHERE notes LIKE ?").get(`%[QR_CODE:${saleCode}]%`);
                }

                if (action === 'check') {
                    if (!existingSale) {
                        return res.json({
                            exists: false,
                            isModified: false,
                            difference: 0,
                            message: 'Venta offline nueva lista para registrar'
                        });
                    }

                    const currentTotal = Number(existingSale.total || 0);
                    const newTotal = Number(qrData.total || 0);
                    const difference = Math.round((newTotal - currentTotal) * 100) / 100;
                    const isModified = difference !== 0;

                    return res.json({
                        exists: true,
                        saleId: existingSale.id,
                        currentTotal,
                        newTotal,
                        difference,
                        isModified,
                        message: isModified
                            ? (difference > 0 
                                ? `Esta venta ya existía ($${currentTotal}) y aumentó a $${newTotal}. Hay una diferencia de $${difference} a cobrar físicamente.`
                                : `Esta venta ya existía ($${currentTotal}) y disminuyó a $${newTotal}. Diferencia: $${difference}.`)
                            : 'Esta venta ya fue registrada y cobrada previamente sin modificaciones.'
                    });
                }

                // Si action === 'apply'
                const transaction = db.transaction(() => {
                    let targetSaleId = existingSale ? existingSale.id : null;
                    const inv = qrData.inv || 'mch1';

                    if (existingSale) {
                        // Actualizar venta existente
                        db.prepare(`
                            UPDATE sales 
                            SET total = ?, payment_method = ?, cash_amount = ?, transfer_amount = ?, notes = ?
                            WHERE id = ?
                        `).run(
                            Number(qrData.total || 0),
                            qrData.method || 'cash',
                            Number(qrData.cash_paid || 0),
                            Number(qrData.trans_paid || 0),
                            (qrData.notes || '') + ` [QR_CODE:${saleCode}]`,
                            targetSaleId
                        );

                        // Revertir y recalcular stock si hay items
                        if (Array.isArray(qrData.items) && qrData.items.length > 0) {
                            const oldItems = db.prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?').all(targetSaleId);
                            for (const old of oldItems) {
                                db.prepare('UPDATE product_inventory SET quantity = quantity + ? WHERE product_id = ? AND inventory_id = ?').run(old.quantity, old.product_id, inv);
                            }

                            db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(targetSaleId);
                            const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price, cost) VALUES (?, ?, ?, ?, ?)');

                            for (const it of qrData.items) {
                                const pid = it.pid || it.id;
                                const qty = Number(it.qty || it.quantity || 0);
                                const price = Number(it.price || it.unit_price || 0);
                                insertItem.run(targetSaleId, pid, qty, price, 0);

                                db.prepare('UPDATE product_inventory SET quantity = quantity - ? WHERE product_id = ? AND inventory_id = ?').run(qty, pid, inv);
                            }
                        }
                    } else {
                        // Crear venta nueva
                        const resSale = db.prepare(`
                            INSERT INTO sales (total, items_count, payment_method, cash_amount, transfer_amount, date, user_id, inventory_id, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            Number(qrData.total || 0),
                            qrData.items?.length || 1,
                            qrData.method || 'cash',
                            Number(qrData.cash_paid || 0),
                            Number(qrData.trans_paid || 0),
                            qrData.date || new Date().toISOString(),
                            req.user.id,
                            inv,
                            (qrData.notes || '') + ` [QR_CODE:${saleCode}]`
                        );
                        targetSaleId = resSale.lastInsertRowid;

                        if (Array.isArray(qrData.items)) {
                            const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price, cost) VALUES (?, ?, ?, ?, ?)');
                            for (const it of qrData.items) {
                                const pid = it.pid || it.id;
                                const qty = Number(it.qty || it.quantity || 0);
                                const price = Number(it.price || it.unit_price || 0);
                                if (typeof pid === 'number') {
                                    insertItem.run(targetSaleId, pid, qty, price, 0);
                                    db.prepare('UPDATE product_inventory SET quantity = quantity - ? WHERE product_id = ? AND inventory_id = ?').run(qty, pid, inv);
                                }
                            }
                        }
                    }

                    refreshNexusInventoryMetrics(inv);
                    return targetSaleId;
                });

                const finalId = transaction();
                res.json({ success: true, saleId: finalId, message: 'Venta sincronizada y asentada contablemente.' });
                } catch (e) {
                console.error('Error en /api/sales/qr-import:', e);
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
        // Los pagos mixtos se distribuyen por importe real, no por el método principal.
        const paymentTotals = db.prepare(`
            SELECT
                COALESCE(SUM(cash_amount), 0) AS cash_total,
                COALESCE(SUM(transfer_amount), 0) AS transfer_total
            FROM sales WHERE session_id = ?
        `).get(session.id);
        const cashSales = paymentTotals.cash_total || 0;
        const transferSales = paymentTotals.transfer_total || 0;
        const cashExpenses = expensesByMethod.find(e => e.payment_method === 'cash')?.total || 0;
        const transferExpenses = expensesByMethod.find(e => e.payment_method === 'transfer')?.total || 0;
        
        const finalCash = cashSales - cashExpenses;
        const finalTransfer = transferSales - transferExpenses;

        // Calculate ACCUMULATED WAGE (all unpaid sessions) BEFORE updating this session
        const accumulatedWages = db.prepare(`
            SELECT 
                COALESCE(SUM(wage_amount), 0) as total_pending_wage,
                COUNT(*) as pending_sessions
            FROM sales_sessions 
            WHERE user_id = ? 
                AND (status = 'closed' OR status = 'pending_review')
                AND wage_payment_id IS NULL
        `).get(userId);

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
            accumulated: {
                current_session_wage: wage,
                previous_sessions_wage: accumulatedWages.total_pending_wage,
                total_pending_wage: accumulatedWages.total_pending_wage + wage,
                pending_sessions_count: accumulatedWages.pending_sessions + 1
            },
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

        // Los pagos mixtos se distribuyen por importe real, no por el método principal.
        const paymentTotals = db.prepare(`
            SELECT
                COALESCE(SUM(cash_amount), 0) AS cash_total,
                COALESCE(SUM(transfer_amount), 0) AS transfer_total
            FROM sales WHERE session_id = ?
        `).get(session.id);
        const cashSales = paymentTotals.cash_total || 0;
        const transferSales = paymentTotals.transfer_total || 0;
        const cashExpenses = expensesByMethod.find(e => e.payment_method === 'cash')?.total || 0;
        const transferExpenses = expensesByMethod.find(e => e.payment_method === 'transfer')?.total || 0;
        
        const finalCash = cashSales - cashExpenses;
        const finalTransfer = transferSales - transferExpenses;

        // Calculate ACCUMULATED WAGE (all unpaid sessions) BEFORE updating this session
        const accumulatedWages = db.prepare(`
            SELECT 
                COALESCE(SUM(wage_amount), 0) as total_pending_wage,
                COUNT(*) as pending_sessions
            FROM sales_sessions 
            WHERE user_id = ? 
                AND (status = 'closed' OR status = 'pending_review')
                AND wage_payment_id IS NULL
        `).get(userId);

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
            accumulated: {
                current_session_wage: wage,
                previous_sessions_wage: accumulatedWages.total_pending_wage,
                total_pending_wage: accumulatedWages.total_pending_wage + wage,
                pending_sessions_count: accumulatedWages.pending_sessions + 1
            },
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
        const now = new Date();
        const serverDate = {
            iso: now.toISOString(),
            dayName: now.toLocaleDateString('es-ES', { weekday: 'long' }),
            dayNumber: now.getDate(),
            monthName: now.toLocaleDateString('es-ES', { month: 'long' }),
            year: now.getFullYear()
        };
        const session = db.prepare("SELECT * FROM sales_sessions WHERE user_id = ? AND status = 'open'").get(req.user.id);
        if (session) {
            // Get current totals
            const sales = db.prepare("SELECT COALESCE(SUM(total), 0) as current_sales FROM sales WHERE session_id = ?").get(session.id);
            res.json({ isOpen: true, session, currentSales: sales.current_sales, serverDate });
        } else {
            res.json({ isOpen: false, serverDate });
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

        // Los pagos mixtos se distribuyen por importe real, no por el método principal.
        const paymentTotals = db.prepare(`
            SELECT
                COALESCE(SUM(cash_amount), 0) AS cash_total,
                COALESCE(SUM(transfer_amount), 0) AS transfer_total
            FROM sales WHERE session_id = ?
        `).get(session.id);
        const cashSales = paymentTotals.cash_total || 0;
        const transferSales = paymentTotals.transfer_total || 0;
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
    size_type TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

// Migration: Add size_type column if it doesn't exist
try {
    db.exec(`ALTER TABLE product_images ADD COLUMN size_type TEXT DEFAULT 'medium'`);
    console.log('Added size_type column to product_images table');
} catch (e) {
    // Column already exists, ignore error
}

try {
    db.exec(`ALTER TABLE product_images ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
} catch (e) {
    // Column already exists, ignore error
}

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

    if (!columns.includes('permissions')) {
        console.log("Migrating: Adding permissions to users table...");
        db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}'");
    }

    if (!columns.includes('authorized_to_work')) {
        console.log("Migrating: Adding authorized_to_work to users table...");
        db.exec("ALTER TABLE users ADD COLUMN authorized_to_work INTEGER DEFAULT 1");
    }

    if (!columns.includes('created_at')) {
        console.log("Migrating: Adding created_at to users table...");
        db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT NULL");
        db.exec("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL");
    }

    if (!columns.includes('dni_front')) {
        console.log("Migrating: Adding dni_front to users table...");
        db.exec("ALTER TABLE users ADD COLUMN dni_front TEXT DEFAULT NULL");
    }

    if (!columns.includes('dni_back')) {
        console.log("Migrating: Adding dni_back to users table...");
        db.exec("ALTER TABLE users ADD COLUMN dni_back TEXT DEFAULT NULL");
    }

    if (!columns.includes('avatar_url')) {
        console.log("Migrating: Adding avatar_url to users table...");
        db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL");
    }

    if (!columns.includes('phone')) {
        console.log("Migrating: Adding phone to users table...");
        db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL");
    }

    if (!columns.includes('address')) {
        console.log("Migrating: Adding address to users table...");
        db.exec("ALTER TABLE users ADD COLUMN address TEXT DEFAULT NULL");
    }

    if (!columns.includes('dni_number')) {
        console.log("Migrating: Adding dni_number to users table...");
        db.exec("ALTER TABLE users ADD COLUMN dni_number TEXT DEFAULT NULL");
    }

    if (!columns.includes('inventory_id')) {
        console.log("Migrating: Adding inventory_id to users table...");
        db.exec("ALTER TABLE users ADD COLUMN inventory_id TEXT DEFAULT 'alm'");
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
    currency TEXT DEFAULT 'MN',
    exchange_rate REAL DEFAULT 1,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    notes TEXT,
    payment_method TEXT DEFAULT 'cash',
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Migration: Add new columns to purchases if not exists
try {
    const purchaseCols = db.prepare("PRAGMA table_info(purchases)").all();
    const columns = purchaseCols.map(c => c.name);
    
    if (!columns.includes('currency')) {
        console.log("Migrating: Adding currency to purchases...");
        db.exec("ALTER TABLE purchases ADD COLUMN currency TEXT DEFAULT 'MN'");
    }
    if (!columns.includes('exchange_rate')) {
        console.log("Migrating: Adding exchange_rate to purchases...");
        db.exec("ALTER TABLE purchases ADD COLUMN exchange_rate REAL DEFAULT 1");
    }
    if (!columns.includes('payment_method')) {
        console.log("Migrating: Adding payment_method to purchases...");
        db.exec("ALTER TABLE purchases ADD COLUMN payment_method TEXT DEFAULT 'cash'");
    }
    if (!columns.includes('inventory_id')) {
        console.log("Migrating: Adding inventory_id to purchases...");
        db.exec("ALTER TABLE purchases ADD COLUMN inventory_id TEXT DEFAULT 'alm'");
    }
    if (!columns.includes('status')) {
        console.log("Migrating: Adding status to purchases...");
        db.exec("ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'received'");
    }
} catch (e) { console.log("Migration check (purchases):", e.message); }

db.exec(`
  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0,
    cost_price_currency TEXT DEFAULT 'MN',
    FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

// Migration: Add cost_price_currency to purchase_items if not exists
try {
    const itemCols = db.prepare("PRAGMA table_info(purchase_items)").all();
    const columns = itemCols.map(c => c.name);
    
    if (!columns.includes('cost_price_currency')) {
        console.log("Migrating: Adding cost_price_currency to purchase_items...");
        db.exec("ALTER TABLE purchase_items ADD COLUMN cost_price_currency TEXT DEFAULT 'MN'");
    }
} catch (e) { console.log("Migration check (purchase_items):", e.message); }

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
    cash_amount REAL DEFAULT 0,
    transfer_amount REAL DEFAULT 0,
    amount_received REAL DEFAULT 0,
    change_amount REAL DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    inventory_id TEXT DEFAULT 'mch1',
    session_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(session_id) REFERENCES sales_sessions(id)
  )
`);

// Migración idempotente de campos de pago para ventas existentes.
const salesColumns = db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
for (const column of ['cash_amount', 'transfer_amount', 'amount_received', 'change_amount']) {
  if (!salesColumns.includes(column)) {
    db.exec(`ALTER TABLE sales ADD COLUMN ${column} REAL DEFAULT 0`);
  }
}

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
        console.log('POST /api/expense-types - Received:', { name, amount, payment_method });
        
        if (!name || amount === undefined) {
            console.log('POST /api/expense-types - Validation failed: missing name or amount');
            return res.status(400).json({ error: 'Nombre y monto son requeridos' });
        }
        
        const result = db.prepare('INSERT INTO expense_types (name, amount, payment_method) VALUES (?, ?, ?)').run(name, amount, payment_method || 'cash');
        console.log('POST /api/expense-types - Created successfully:', result.lastInsertRowid);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        console.error('POST /api/expense-types - Error:', e);
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

        // Sincronizar Nexus en tiempo real (stock tras merma/rotura)
        refreshNexusInventoryMetrics(inventory || 'mch1');
        
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

// Get single transfer by ID
app.get('/api/transfers/:id', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        const transfer = db.prepare(`
            SELECT t.*, 
                   creator.username as created_by_name,
                   receiver.username as received_by_name
            FROM transfers t
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users receiver ON t.received_by = receiver.id
            WHERE t.id = ?
        `).get(id);

        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }

        const items = db.prepare(`
            SELECT ti.*, p.name as product_name, p.code as product_code, p.image as product_image,
                   COALESCE(pi_source.quantity, 0) as source_current_stock,
                   COALESCE(pi_target.quantity, 0) as target_current_stock
            FROM transfer_items ti
            JOIN products p ON ti.product_id = p.id
            LEFT JOIN product_inventory pi_source ON ti.product_id = pi_source.product_id AND pi_source.inventory_id = ?
            LEFT JOIN product_inventory pi_target ON ti.product_id = pi_target.product_id AND pi_target.inventory_id = ?
            WHERE ti.transfer_id = ?
        `).all(transfer.source_inventory, transfer.target_inventory, id);

        transfer.items = items;
        res.json(transfer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create new transfer (admin/owner only)
app.post('/api/transfers', authenticate, (req, res) => {
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
            `).run(source_inventory, target_inventory, req.user?.id || 1, notes || '');
            
            const transferId = transferResult.lastInsertRowid;
            
            // Add items
            const insertItem = db.prepare(`
                INSERT INTO transfer_items (transfer_id, product_id, quantity)
                VALUES (?, ?, ?)
            `);
            
            for (const item of items) {
                insertItem.run(transferId, item.product_id, item.quantity);
                
                // Asegurar que exista la fila en product_inventory para el origen
                db.prepare(`
                    INSERT OR IGNORE INTO product_inventory (product_id, inventory_id, quantity)
                    VALUES (?, ?, 0)
                `).run(item.product_id, source_inventory);
                
                // Deduct stock from source inventory (permite contingencia si se traslada mercadería recién llegada)
                db.prepare(`
                    UPDATE product_inventory 
                    SET quantity = quantity - ? 
                    WHERE product_id = ? AND inventory_id = ?
                `).run(item.quantity, item.product_id, source_inventory);
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
            try {
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
            } catch (notifyErr) {
                console.warn('[Notifications] Error notificando vendedores:', notifyErr.message);
            }
        }
        
        res.json({ success: true, id: transferId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update transfer (owner/admin only)
app.put('/api/transfers/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { notes, items, target_inventory, mode, delete_transfer } = req.body;
        
        const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }

        // Si se pide eliminar / anular traslado
        if (delete_transfer) {
            db.transaction(() => {
                if (transfer.status === 'pending') {
                    // Reintegrar stock a origen
                    const oldItems = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
                    for (const oldItem of oldItems) {
                        db.prepare(`
                            UPDATE product_inventory 
                            SET quantity = quantity + ? 
                            WHERE product_id = ? AND inventory_id = ?
                        `).run(oldItem.quantity, oldItem.product_id, transfer.source_inventory);
                    }
                    db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(id);
                    db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
                } else if (transfer.status === 'received') {
                    // Revertir desde destino a origen
                    const oldItems = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
                    for (const oldItem of oldItems) {
                        const targetStockRow = db.prepare(`
                            SELECT quantity FROM product_inventory 
                            WHERE product_id = ? AND inventory_id = ?
                        `).get(oldItem.product_id, transfer.target_inventory);
                        const targetStock = targetStockRow ? targetStockRow.quantity : 0;
                        const qtyToReturn = (mode === 'available_only') 
                            ? Math.max(0, Math.min(oldItem.quantity, targetStock))
                            : oldItem.quantity;

                        if (qtyToReturn > 0) {
                            db.prepare(`
                                UPDATE product_inventory 
                                SET quantity = quantity - ? 
                                WHERE product_id = ? AND inventory_id = ?
                            `).run(qtyToReturn, oldItem.product_id, transfer.target_inventory);

                            const srcExists = db.prepare('SELECT 1 FROM product_inventory WHERE product_id = ? AND inventory_id = ?').get(oldItem.product_id, transfer.source_inventory);
                            if (srcExists) {
                                db.prepare(`
                                    UPDATE product_inventory 
                                    SET quantity = quantity + ? 
                                    WHERE product_id = ? AND inventory_id = ?
                                `).run(qtyToReturn, oldItem.product_id, transfer.source_inventory);
                            } else {
                                db.prepare('INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)').run(oldItem.product_id, transfer.source_inventory, qtyToReturn);
                            }
                        }
                    }
                    db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(id);
                    db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
                } else {
                    db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(id);
                    db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
                }
            })();

            return res.json({ success: true, message: 'Traslado eliminado y stock restablecido' });
        }
        
        db.transaction(() => {
            if (notes !== undefined) {
                db.prepare('UPDATE transfers SET notes = ? WHERE id = ?').run(notes, id);
            }

            if (target_inventory && target_inventory !== transfer.target_inventory) {
                db.prepare('UPDATE transfers SET target_inventory = ? WHERE id = ?').run(target_inventory, id);
            }
            
            // Si el traslado sigue pendiente y se modifican items
            if (items && Array.isArray(items) && transfer.status === 'pending') {
                // Revertir stock previo descontado de source
                const oldItems = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
                for (const oldItem of oldItems) {
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity + ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(oldItem.quantity, oldItem.product_id, transfer.source_inventory);
                }
                
                db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(id);
                
                const insertItem = db.prepare(`
                    INSERT INTO transfer_items (transfer_id, product_id, quantity)
                    VALUES (?, ?, ?)
                `);
                
                for (const item of items) {
                    insertItem.run(id, item.product_id, item.quantity);
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity - ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(item.quantity, item.product_id, transfer.source_inventory);
                }
            } else if (items && Array.isArray(items)) {
                // Modificación sobre traslado recibido, revertido o en tránsito:
                // 1. Revertir impacto anterior: devolver del target al source
                const oldItems = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
                if (transfer.status === 'received') {
                    for (const oldItem of oldItems) {
                        db.prepare(`
                            UPDATE product_inventory 
                            SET quantity = quantity - ? 
                            WHERE product_id = ? AND inventory_id = ?
                        `).run(oldItem.quantity, oldItem.product_id, transfer.target_inventory);

                        db.prepare(`
                            UPDATE product_inventory 
                            SET quantity = quantity + ? 
                            WHERE product_id = ? AND inventory_id = ?
                        `).run(oldItem.quantity, oldItem.product_id, transfer.source_inventory);
                    }
                } else if (transfer.status === 'reverted' || transfer.status === 'cancelled') {
                    // Si estaba revertido y se edita, volver a ponerlo en estado 'received'
                    db.prepare("UPDATE transfers SET status = 'received' WHERE id = ?").run(id);
                }

                db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(id);

                // 2. Aplicar nuevas cantidades (descontar de source, agregar a new target)
                const newTarget = target_inventory || transfer.target_inventory;
                const insertItem = db.prepare(`
                    INSERT INTO transfer_items (transfer_id, product_id, quantity)
                    VALUES (?, ?, ?)
                `);

                for (const item of items) {
                    insertItem.run(id, item.product_id, item.quantity);

                    // Descontar de source
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity - ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(item.quantity, item.product_id, transfer.source_inventory);

                    // Sumar a target
                    const targetExists = db.prepare('SELECT 1 FROM product_inventory WHERE product_id = ? AND inventory_id = ?').get(item.product_id, newTarget);
                    if (targetExists) {
                        db.prepare(`
                            UPDATE product_inventory 
                            SET quantity = quantity + ? 
                            WHERE product_id = ? AND inventory_id = ?
                        `).run(item.quantity, item.product_id, newTarget);
                    } else {
                        db.prepare('INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)').run(item.product_id, newTarget, item.quantity);
                    }
                }
            }
        })();
        
        res.json({ success: true, message: 'Traslado actualizado correctamente' });
    } catch (e) {
        console.error('PUT /api/transfers/:id error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Update purchase / entrada (owner/admin only)
app.put('/api/purchases/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { supplier, notes, total } = req.body;
        
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
        if (!purchase) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        
        db.prepare(`
            UPDATE purchases 
            SET supplier = COALESCE(?, supplier),
                notes = COALESCE(?, notes),
                total = COALESCE(?, total)
            WHERE id = ?
        `).run(supplier, notes, total, id);
        
        res.json({ success: true, message: 'Registro actualizado correctamente' });
    } catch (e) {
        console.error('PUT /api/purchases/:id error:', e);
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

                // Sincronizar Nexus en tiempo real (stock en sede destino y origen)
                refreshNexusInventoryMetrics(transfer.target_inventory);
                refreshNexusInventoryMetrics(transfer.source_inventory);

                res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Check reversibility / available stock for a transfer
app.get('/api/transfers/:id/reversal-check', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }

        const items = db.prepare(`
            SELECT ti.*, p.name as product_name, p.code as product_code,
                   COALESCE(pi_target.quantity, 0) as target_current_stock,
                   COALESCE(pi_source.quantity, 0) as source_current_stock
            FROM transfer_items ti
            JOIN products p ON ti.product_id = p.id
            LEFT JOIN product_inventory pi_target ON ti.product_id = pi_target.product_id AND pi_target.inventory_id = ?
            LEFT JOIN product_inventory pi_source ON ti.product_id = pi_source.product_id AND pi_source.inventory_id = ?
            WHERE ti.transfer_id = ?
        `).all(transfer.target_inventory, transfer.source_inventory, id);

        let canFullReverse = true;
        let anyShortage = false;

        const evaluatedItems = items.map(item => {
            if (transfer.status === 'pending') {
                return {
                    ...item,
                    transfer_quantity: item.quantity,
                    available_to_return: item.quantity,
                    sold_or_missing: 0,
                    status: 'available'
                };
            }
            // If already received, stock is in target_inventory
            const available = Math.max(0, Math.min(item.quantity, item.target_current_stock));
            const missing = item.quantity - available;
            if (missing > 0) {
                canFullReverse = false;
                anyShortage = true;
            }
            return {
                ...item,
                transfer_quantity: item.quantity,
                available_to_return: available,
                sold_or_missing: missing,
                status: missing === 0 ? 'available' : (available > 0 ? 'partial' : 'sold_out')
            };
        });

        res.json({
            transfer_id: transfer.id,
            status: transfer.status,
            source_inventory: transfer.source_inventory,
            target_inventory: transfer.target_inventory,
            created_at: transfer.created_at,
            received_at: transfer.received_at,
            canFullReverse,
            anyShortage,
            items: evaluatedItems
        });
    } catch (e) {
        console.error('Error in /api/transfers/:id/reversal-check:', e);
        res.status(500).json({ error: e.message });
    }
});

// Revert or Cancel transfer (Supports both pending and received)
app.post('/api/transfers/:id/revert', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { mode, reason } = req.body; // mode: 'available_only', 'force_total', 'standard'
        
        const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
        if (!transfer) {
            return res.status(404).json({ error: 'Traslado no encontrado' });
        }

        if (transfer.status === 'reverted' || transfer.status === 'cancelled' || transfer.status === 'rejected') {
            return res.status(400).json({ error: 'Este traslado ya fue cancelado o revertido previamente' });
        }

        const items = db.prepare(`
            SELECT ti.*, p.name as product_name
            FROM transfer_items ti
            JOIN products p ON ti.product_id = p.id
            WHERE ti.transfer_id = ?
        `).all(id);

        const transaction = db.transaction(() => {
            const summaryDeltas = [];

            if (transfer.status === 'pending') {
                // If pending, stock was only deducted from source; restore it to source
                for (const item of items) {
                    db.prepare(`
                        UPDATE product_inventory 
                        SET quantity = quantity + ? 
                        WHERE product_id = ? AND inventory_id = ?
                    `).run(item.quantity, item.product_id, transfer.source_inventory);

                    summaryDeltas.push({
                        product_id: item.product_id,
                        name: item.product_name,
                        returned_to_source: item.quantity
                    });
                }

                db.prepare(`
                    UPDATE transfers 
                    SET status = 'cancelled',
                        notes = COALESCE(notes, '') || ' | Cancelado: ' || ?
                    WHERE id = ?
                `).run(reason || 'Cancelado por usuario', id);

            } else if (transfer.status === 'received') {
                // If received, stock is in target. We must deduct from target and add back to source.
                for (const item of items) {
                    const currentTargetStockRow = db.prepare(`
                        SELECT quantity FROM product_inventory 
                        WHERE product_id = ? AND inventory_id = ?
                    `).get(item.product_id, transfer.target_inventory);

                    const targetStock = currentTargetStockRow ? currentTargetStockRow.quantity : 0;
                    let qtyToReturn = item.quantity;

                    if (mode === 'available_only') {
                        qtyToReturn = Math.max(0, Math.min(item.quantity, targetStock));
                    }

                    if (qtyToReturn > 0) {
                        // Deduct from target
                        db.prepare(`
                            UPDATE product_inventory 
                            SET quantity = quantity - ? 
                            WHERE product_id = ? AND inventory_id = ?
                        `).run(qtyToReturn, item.product_id, transfer.target_inventory);

                        // Add back to source
                        const sourceExists = db.prepare(`
                            SELECT 1 FROM product_inventory 
                            WHERE product_id = ? AND inventory_id = ?
                        `).get(item.product_id, transfer.source_inventory);

                        if (sourceExists) {
                            db.prepare(`
                                UPDATE product_inventory 
                                SET quantity = quantity + ? 
                                WHERE product_id = ? AND inventory_id = ?
                            `).run(qtyToReturn, item.product_id, transfer.source_inventory);
                        } else {
                            db.prepare(`
                                INSERT INTO product_inventory (product_id, inventory_id, quantity)
                                VALUES (?, ?, ?)
                            `).run(item.product_id, transfer.source_inventory, qtyToReturn);
                        }
                    }

                    summaryDeltas.push({
                        product_id: item.product_id,
                        name: item.product_name,
                        returned_to_source: qtyToReturn,
                        unreturned_due_to_sales: item.quantity - qtyToReturn
                    });
                }

                const newStatus = (mode === 'available_only' && summaryDeltas.some(d => d.unreturned_due_to_sales > 0))
                    ? 'partially_reverted'
                    : 'reverted';

                db.prepare(`
                    UPDATE transfers 
                    SET status = ?,
                        notes = COALESCE(notes, '') || ' | Revertido (' || ? || '): ' || ?
                    WHERE id = ?
                `).run(newStatus, mode || 'estándar', reason || 'Reversión por ajuste', id);
            }

            return summaryDeltas;
        });

        const deltas = transaction();

        // Notify
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (?, 'transfer_reverted', ?, ?, ?)
        `).run(
            transfer.created_by || 1,
            'Traslado revertido / cancelado',
            `El traslado #${id} (${transfer.source_inventory} -> ${transfer.target_inventory}) fue revertido.`,
            JSON.stringify({ transfer_id: id, deltas })
        );

        res.json({ success: true, message: 'Operación realizada con éxito', deltas });
    } catch (e) {
        console.error('Error in /api/transfers/:id/revert:', e);
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

// Importar / Procesar Traslado desde QR Offline
app.post('/api/transfers/qr-import', authenticate, (req, res) => {
    try {
        const { qrData, action } = req.body; // action: 'check' | 'apply'
        if (!qrData || !qrData.id || !qrData.items) {
            return res.status(400).json({ error: 'Datos de QR de traslado incompletos' });
        }

        const rawId = qrData.id;
        // Si el id es numérico o empieza con TRF-
        let existingTransfer = null;
        if (typeof rawId === 'number' || /^\d+$/.test(rawId)) {
            existingTransfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(rawId);
        } else {
            // Buscar en notas si tiene referencia previa al ID de QR
            existingTransfer = db.prepare("SELECT * FROM transfers WHERE notes LIKE ?").get(`%[QR_REF:${rawId}]%`);
        }

        if (action === 'check') {
            if (!existingTransfer) {
                return res.json({
                    exists: false,
                    isModified: false,
                    message: 'Traslado nuevo listo para recibir'
                });
            }

            const existingItems = db.prepare('SELECT product_id, quantity FROM transfer_items WHERE transfer_id = ?').all(existingTransfer.id);
            const currentMap = new Map(existingItems.map(i => [i.product_id, i.quantity]));
            
            let isModified = false;
            if (qrData.items.length !== existingItems.length) {
                isModified = true;
            } else {
                for (const item of qrData.items) {
                    const pid = item.pid || item.product_id;
                    const qty = Number(item.qty || item.quantity || 0);
                    if (currentMap.get(pid) !== qty) {
                        isModified = true;
                        break;
                    }
                }
            }

            return res.json({
                exists: true,
                transferId: existingTransfer.id,
                status: existingTransfer.status,
                isModified,
                message: isModified 
                    ? 'El traslado ya existe pero contiene modificaciones en productos o cantidades.'
                    : 'Este traslado ya fue registrado y procesado anteriormente.'
            });
        }

        // Si action === 'apply'
        const transaction = db.transaction(() => {
            let targetTransferId = existingTransfer ? existingTransfer.id : null;

            if (existingTransfer) {
                // Actualizar o reajustar traslado existente
                db.prepare(`
                    UPDATE transfers 
                    SET target_inventory = ?, notes = ?, status = 'received', received_at = datetime('now'), received_by = ?
                    WHERE id = ?
                `).run(qrData.tgt || existingTransfer.target_inventory, (qrData.notes || '') + ` [QR_REF:${rawId}]`, req.user.id, targetTransferId);

                // Reemplazar items
                db.prepare('DELETE FROM transfer_items WHERE transfer_id = ?').run(targetTransferId);
                const insertItem = db.prepare('INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)');

                for (const item of qrData.items) {
                    const pid = item.pid || item.product_id;
                    const qty = Number(item.qty || item.quantity || 0);
                    insertItem.run(targetTransferId, pid, qty);

                    // Asegurar stock en destino
                    const exists = db.prepare('SELECT 1 FROM product_inventory WHERE product_id = ? AND inventory_id = ?').get(pid, qrData.tgt || existingTransfer.target_inventory);
                    if (exists) {
                        db.prepare('UPDATE product_inventory SET quantity = quantity + ? WHERE product_id = ? AND inventory_id = ?').run(qty, pid, qrData.tgt || existingTransfer.target_inventory);
                    } else {
                        db.prepare('INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)').run(pid, qrData.tgt || existingTransfer.target_inventory, qty);
                    }
                }
            } else {
                // Crear y recibir directamente
                const resTrans = db.prepare(`
                    INSERT INTO transfers (source_inventory, target_inventory, created_by, status, notes, received_at, received_by)
                    VALUES (?, ?, ?, 'received', ?, datetime('now'), ?)
                `).run(
                    qrData.src || 'alm',
                    qrData.tgt || 'mch1',
                    req.user.id,
                    (qrData.notes || '') + ` [QR_REF:${rawId}]`,
                    req.user.id
                );
                targetTransferId = resTrans.lastInsertRowid;

                const insertItem = db.prepare('INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)');
                for (const item of qrData.items) {
                    const pid = item.pid || item.product_id;
                    const qty = Number(item.qty || item.quantity || 0);
                    insertItem.run(targetTransferId, pid, qty);

                    const exists = db.prepare('SELECT 1 FROM product_inventory WHERE product_id = ? AND inventory_id = ?').get(pid, qrData.tgt || 'mch1');
                    if (exists) {
                        db.prepare('UPDATE product_inventory SET quantity = quantity + ? WHERE product_id = ? AND inventory_id = ?').run(qty, pid, qrData.tgt || 'mch1');
                    } else {
                        db.prepare('INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)').run(pid, qrData.tgt || 'mch1', qty);
                    }
                }
            }

            if (qrData.tgt) refreshNexusInventoryMetrics(qrData.tgt);
            if (qrData.src) refreshNexusInventoryMetrics(qrData.src);

            return targetTransferId;
        });

        const finalId = transaction();
        res.json({ success: true, transferId: finalId, message: 'Traslado aplicado y stock actualizado con éxito.' });
    } catch (e) {
        console.error('Error en /api/transfers/qr-import:', e);
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

// --- DASHBOARD ANALYTICS REAL ---
app.get('/api/dashboard/stats', authenticate, (req, res) => {
    try {
        const { inventory, period, startDate, endDate } = req.query;
        let salesWhere = [];
        let salesParams = [];
        let lossesWhere = [];
        let lossesParams = [];

        if (inventory && inventory !== 'all') {
            salesWhere.push('s.inventory_id = ?');
            salesParams.push(inventory);
            lossesWhere.push('l.inventory = ?');
            lossesParams.push(inventory);
        }

        // Manejo de rangos de fecha
        let start = startDate;
        let end = endDate;
        const now = new Date();

        if (period && period !== 'custom' && period !== 'all') {
            if (period === 'today') {
                const todayStr = now.toISOString().slice(0, 10);
                start = todayStr;
                end = todayStr;
            } else if (period === '7d') {
                const d = new Date(now.getTime() - 7 * 86400000);
                start = d.toISOString().slice(0, 10);
                end = now.toISOString().slice(0, 10);
            } else if (period === '30d') {
                const d = new Date(now.getTime() - 30 * 86400000);
                start = d.toISOString().slice(0, 10);
                end = now.toISOString().slice(0, 10);
            } else if (period === 'month') {
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                start = `${y}-${m}-01`;
                end = now.toISOString().slice(0, 10);
            }
        }

        if (start && end) {
            salesWhere.push('s.date >= ? AND s.date <= ?');
            salesParams.push(`${start} 00:00:00`, `${end} 23:59:59`);
            lossesWhere.push('l.date >= ? AND l.date <= ?');
            lossesParams.push(`${start} 00:00:00`, `${end} 23:59:59`);
        }

        const sWhereClause = salesWhere.length ? 'WHERE ' + salesWhere.join(' AND ') : '';
        const lWhereClause = lossesWhere.length ? 'WHERE ' + lossesWhere.join(' AND ') : '';

        // 1. Totales de Ventas
        const salesTotals = db.prepare(`
            SELECT 
                COALESCE(SUM(s.total), 0) as total_sales,
                COUNT(DISTINCT s.id) as sales_count,
                COALESCE(SUM(s.cash_amount), 0) as cash_total,
                COALESCE(SUM(s.transfer_amount), 0) as transfer_total
            FROM sales s
            ${sWhereClause}
        `).get(...salesParams);

        // 2. Ganancia Bruta y Costo Mercancía
        const profitTotals = db.prepare(`
            SELECT 
                COALESCE(SUM((si.price - COALESCE(si.cost, 0)) * si.quantity), 0) as estimated_profit,
                COALESCE(SUM(COALESCE(si.cost, 0) * si.quantity), 0) as total_cogs
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            ${sWhereClause}
        `).get(...salesParams);

        // 3. Mermas Totales
        const lossesTotals = db.prepare(`
            SELECT 
                COALESCE(SUM(l.quantity * COALESCE(p.cost_mx, 0)), 0) as total_losses_cost,
                COALESCE(SUM(l.quantity), 0) as total_losses_qty
            FROM losses l
            LEFT JOIN products p ON l.product_id = p.id
            ${lWhereClause}
        `).get(...lossesParams);

        // 4. Top 5 Productos Estrella
        const topProducts = db.prepare(`
            SELECT 
                p.id, p.name,
                SUM(si.quantity) as qty_sold,
                SUM(si.price * si.quantity) as revenue,
                SUM((si.price - COALESCE(si.cost, 0)) * si.quantity) as profit
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            ${sWhereClause}
            GROUP BY p.id
            ORDER BY revenue DESC
            LIMIT 5
        `).all(...salesParams);

        // 5. Tendencia Diaria de Ventas
        const salesTrend = db.prepare(`
            SELECT 
                substr(s.date, 1, 10) as day,
                SUM(s.total) as sales,
                COUNT(s.id) as count
            FROM sales s
            ${sWhereClause}
            GROUP BY substr(s.date, 1, 10)
            ORDER BY day ASC
        `).all(...salesParams);

        // 6. Salud y Stock del Inventario Activo
        let invStockQuery = `
            SELECT 
                COUNT(p.id) as total_catalog,
                COALESCE(SUM(CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END), 0) as total_units,
                COALESCE(SUM((CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END) * COALESCE(p.sale_price_manual, 0)), 0) as inventory_valuation,
                SUM(CASE WHEN (CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END) <= 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(CASE WHEN (CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END) > 0 AND (CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END) <= 3 THEN 1 ELSE 0 END) as low_stock,
                SUM(CASE WHEN (CASE WHEN pi.quantity IS NOT NULL THEN pi.quantity ELSE p.quantity END) > 3 THEN 1 ELSE 0 END) as optimal_stock
            FROM products p
        `;
        let invStockParams = [];
        if (inventory && inventory !== 'all') {
            invStockQuery += ` LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.inventory_id = ? `;
            invStockParams.push(inventory);
        } else {
            invStockQuery += ` LEFT JOIN (SELECT product_id, SUM(quantity) as quantity FROM product_inventory GROUP BY product_id) pi ON p.id = pi.product_id `;
        }
        const stockHealth = db.prepare(invStockQuery).get(...invStockParams);

        res.json({
            success: true,
            inventory: inventory || 'all',
            period: period || 'all',
            startDate: start || null,
            endDate: end || null,
            stats: {
                totalSales: salesTotals.total_sales || 0,
                salesCount: salesTotals.sales_count || 0,
                averageTicket: salesTotals.sales_count > 0 ? (salesTotals.total_sales / salesTotals.sales_count) : 0,
                estimatedProfit: profitTotals.estimated_profit || 0,
                totalCogs: profitTotals.total_cogs || 0,
                profitMargin: salesTotals.total_sales > 0 ? ((profitTotals.estimated_profit / salesTotals.total_sales) * 100) : 0,
                lossesCost: lossesTotals.total_losses_cost || 0,
                lossesQty: lossesTotals.total_losses_qty || 0,
                cashTotal: salesTotals.cash_total || 0,
                transferTotal: salesTotals.transfer_total || 0,
                inventoryValuation: stockHealth?.inventory_valuation || 0,
                totalUnits: stockHealth?.total_units || 0,
                totalCatalog: stockHealth?.total_catalog || 0,
                outOfStock: stockHealth?.outOfStock || 0,
                lowStock: stockHealth?.lowStock || 0,
                optimalStock: stockHealth?.optimalStock || 0
            },
            topProducts,
            salesTrend
        });
    } catch (e) {
        logError("GET /api/dashboard/stats", e);
        res.status(500).json({ error: e.message });
    }
});

// --- NEXUS API ---
const NEXUS_TYPES = new Set(['dueño', 'empresa', 'administrador', 'almacén', 'punto_de_venta', 'vendedor']);
const nexusResponse = row => {
  let parentIds = [];
  try {
    parentIds = JSON.parse(row.parent_ids || '[]');
  } catch (e) {
    parentIds = [];
  }
  if (row.parent_id && !parentIds.includes(row.parent_id)) {
    parentIds.unshift(row.parent_id);
  }
  return {
    ...row,
    companyId: row.company_id,
    parentId: row.parent_id || parentIds[0] || null,
    parentIds: parentIds,
    children: JSON.parse(row.children || '[]'),
    metrics: JSON.parse(row.metrics || '{}'),
    position: { x: row.position_x, y: row.position_y }
  };
};
const auditNexus = (nodeId, action, req, payload = {}) => db.prepare('INSERT INTO nexus_audit_log (node_id, action, actor_user_id, payload) VALUES (?, ?, ?, ?)').run(nodeId, action, req.user?.id || null, JSON.stringify(payload));
const syncNexusFromCRM = () => {
  const ownerId = 'nexus_owner_miss_chulerias';
  const companyId = 'nexus_company_miss_chulerias';
  const upsert = db.prepare(`INSERT INTO nexus_nodes (id, company_id, type, name, status, description, metrics, parent_id, children, position_x, position_y, archived_at)
    VALUES (?, 1, ?, ?, 'online', ?, ?, ?, '[]', ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET type=excluded.type, name=excluded.name, status=excluded.status, description=excluded.description, metrics=excluded.metrics, updated_at=CURRENT_TIMESTAMP`);
  const ids = [];
  
  // 1. Dueño (Cúspide, nivel 0)
  upsert.run(ownerId, 'dueño', 'Dueño · Miss Chulerías', 'Autoridad principal del negocio.', JSON.stringify({ empresas: 1 }), null, 380, 30); 
  ids.push(ownerId);

  // 2. Empresa (Hija de Dueño)
  upsert.run(companyId, 'empresa', 'Miss Chulerías', 'Empresa principal del CRM.', JSON.stringify({ sedes: 3 }), ownerId, 380, 230); 
  ids.push(companyId);

  // Helper para calcular métricas financieras de inventario
  const calcMetrics = (invId) => {
    try {
      const row = db.prepare(`
        SELECT 
          COALESCE(SUM(pi.quantity), 0) as stock_total,
          COALESCE(SUM(pi.quantity * COALESCE(p.cost_mx, 0)), 0) as total_cost,
          COALESCE(SUM(pi.quantity * COALESCE(p.sale_price_manual, 0)), 0) as projected_sales,
          COUNT(DISTINCT pi.product_id) as total_products
        FROM product_inventory pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.inventory_id = ?
      `).get(invId);
      
      const salesToday = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as sales_today
        FROM sales
        WHERE inventory_id = ? AND date(date) = date('now')
      `).get(invId);

      return {
        productos: row?.total_products || 0,
        stockTotal: row?.stock_total || 0,
        capitalInvertido: Math.round((row?.total_cost || 0) * 100) / 100,
        ventaProyectada: Math.round((row?.projected_sales || 0) * 100) / 100,
        ventasHoy: Math.round((salesToday?.sales_today || 0) * 100) / 100
      };
    } catch (e) {
      return { productos: 0, stockTotal: 0, capitalInvertido: 0, ventaProyectada: 0, ventasHoy: 0 };
    }
  };

  // 3. Almacén Central (Hijo directo de Empresa)
  const inventories = db.prepare('SELECT id, name, code, type FROM inventories ORDER BY id').all();
  const warehouse = inventories.find(i => i.type === 'warehouse') || inventories.find(i => i.id === 'alm') || inventories[0];
  const warehouseNodeId = warehouse ? `nexus_inventory_${warehouse.id}` : null;

  if (warehouse) {
    const metrics = calcMetrics(warehouse.id);
    upsert.run(
      warehouseNodeId,
      'almacén',
      warehouse.name,
      `Almacén central (${warehouse.code || warehouse.id}). Suministro y stock central.`,
      JSON.stringify(metrics),
      companyId,
      120,
      450
    );
    ids.push(warehouseNodeId);
  }

  // 4. Administradores (Hijos de Empresa, nivel 2 lateral derecho)
  for (const user of db.prepare('SELECT id, username, email, role, is_banned FROM users WHERE is_banned = 0 AND role IN (\'admin\', \'administrator\', \'administrador\') ORDER BY id').all()) {
    const id = `nexus_user_${user.id}`;
    upsert.run(
      id,
      'administrador',
      user.username || user.email || `Admin ${user.id}`,
      'Gestión y administración operativa de la empresa.',
      JSON.stringify({ userId: user.id, username: user.username, role: 'Administrador', acceso: 'Total' }),
      companyId,
      640,
      450
    );
    ids.push(id);
  }

  // 5. Puntos de Venta (MCH1, MCH2, etc.) - Hijos del Almacén Central (Nivel 3, Y=780)
  let posIndex = 0;
  const posNodeIds = [];
  for (const inv of inventories) {
    if (warehouse && inv.id === warehouse.id) continue;
    const id = `nexus_inventory_${inv.id}`;
    posNodeIds.push(id);
    const metrics = calcMetrics(inv.id);
    const posX = 80 + posIndex * 320;
    upsert.run(
      id,
      'punto_de_venta',
      inv.name,
      `Punto de venta operativo (${inv.code || inv.id}).`,
      JSON.stringify(metrics),
      warehouseNodeId || companyId,
      posX,
      780
    );
    // Actualizar coordenadas fijas si ya existía en la DB
    db.prepare('UPDATE nexus_nodes SET position_x = ?, position_y = ? WHERE id = ?').run(posX, 780, id);
    ids.push(id);
    posIndex++;
  }

  // 6. Vendedores (Nivel 4, Y=1100 para ubicarse debajo de los puntos de venta)
  const defaultSellerParent = posNodeIds[0] || warehouseNodeId || companyId;
  let sellerIndex = 0;
  for (const user of db.prepare('SELECT id, username, email, role, is_banned FROM users WHERE is_banned = 0 AND role IN (\'seller\', \'vendedor\') ORDER BY id').all()) {
    const id = `nexus_user_${user.id}`;
    const posX = 80 + sellerIndex * 300;
    upsert.run(
      id,
      'vendedor',
      user.username || user.email || `Vendedor ${user.id}`,
      'Vendedor en punto de venta.',
      JSON.stringify({ userId: user.id, username: user.username, role: 'Vendedor', ventasHoy: 0 }),
      defaultSellerParent,
      posX,
      1100
    );
    // Actualizar coordenadas fijas si ya existía en la DB
    db.prepare('UPDATE nexus_nodes SET position_x = ?, position_y = ? WHERE id = ?').run(posX, 1100, id);
    ids.push(id);
    sellerIndex++;
  }

  const rows = db.prepare('SELECT id, parent_id FROM nexus_nodes WHERE archived_at IS NULL').all();
  const children = new Map(); 
  rows.forEach(r => { 
    if (r.parent_id) children.set(r.parent_id, [...(children.get(r.parent_id) || []), r.id]); 
  });
  const setChildren = db.prepare('UPDATE nexus_nodes SET children = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  for (const id of ids) setChildren.run(JSON.stringify(children.get(id) || []), id);
    return ids.length;
  };

  // Helper: recalcula las métricas financieras en vivo de un nodo de sede (almacén o punto de venta)
  const refreshNexusInventoryMetrics = (inventoryId) => {
    try {
      if (!inventoryId) return;
      const inv = db.prepare('SELECT id, name, code, type FROM inventories WHERE id = ?').get(inventoryId);
      if (!inv) return;
      const row = db.prepare(`
        SELECT
          COALESCE(SUM(pi.quantity), 0) as stock_total,
          COALESCE(SUM(pi.quantity * COALESCE(p.cost_mx, 0)), 0) as total_cost,
          COALESCE(SUM(pi.quantity * COALESCE(p.sale_price_manual, 0)), 0) as projected_sales,
          COUNT(DISTINCT pi.product_id) as total_products
        FROM product_inventory pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.inventory_id = ?
      `).get(inventoryId);
      const salesToday = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as sales_today
        FROM sales
        WHERE inventory_id = ? AND date(date) = date('now')
      `).get(inventoryId);
      const metrics = {
        productos: row?.total_products || 0,
        stockTotal: row?.stock_total || 0,
        capitalInvertido: Math.round((row?.total_cost || 0) * 100) / 100,
        ventaProyectada: Math.round((row?.projected_sales || 0) * 100) / 100,
        ventasHoy: Math.round((salesToday?.sales_today || 0) * 100) / 100
      };
      const nodeType = inv.type === 'warehouse' ? 'almacén' : 'punto_de_venta';
      db.prepare('UPDATE nexus_nodes SET metrics = ?, status = ? WHERE id = ?').run(
        JSON.stringify(metrics), 'online', `nexus_inventory_${inventoryId}`
      );
      // Si no existe el nodo (mapa aún sin sync), créalo sin posiciones para que aparezca
      db.prepare(`INSERT OR REPLACE INTO nexus_nodes (id, company_id, type, name, status, description, metrics, parent_id, position_x, position_y)
        VALUES (?, 1, ?, ?, 'online', ?, ?, 'nexus_company_miss_chulerias', 200, 450)`).run(
          `nexus_inventory_${inventoryId}`, nodeType, inv.name,
          `Sede operativa (${inv.code || inv.id}).`, JSON.stringify(metrics)
        );
    } catch (e) {
      console.warn('Advertencia al refrescar métricas Nexus:', e.message);
    }
  };
app.get('/api/nexus/nodes', (req, res) => {
  try {
    if (req.query.archived !== 'true') {
      const activeCount = db.prepare('SELECT COUNT(*) as c FROM nexus_nodes WHERE archived_at IS NULL').get()?.c || 0;
      if (activeCount === 0) syncNexusFromCRM();
    }
    const archived = req.query.archived === 'true';
    const rows = db.prepare(`SELECT * FROM nexus_nodes WHERE company_id = ? AND ${archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'} ORDER BY position_y, position_x, name`).all(Number(req.query.company_id || 1)); 
    res.json(rows.map(nexusResponse)); 
  } catch (e) { 
    logError('GET /api/nexus/nodes', e); 
    res.status(500).json({ error: e.message }); 
  }
});
app.post('/api/nexus/nodes', checkAdmin, (req, res) => {
  try {
    const b = req.body || {};
    if (!NEXUS_TYPES.has(b.type) || !String(b.name || '').trim()) {
      return res.status(400).json({ error: 'Tipo y nombre son obligatorios.' });
    }
    const cleanName = String(b.name).trim();
    const cleanType = String(b.type).toLowerCase();
    const id = b.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Si el nodo que se crea es de tipo humano (dueño, administrador, vendedor), crearlo/vincularlo en `users`
    let linkedUserId = null;
    if (['dueño', 'administrador', 'vendedor'].includes(cleanType)) {
      const userRole = cleanType === 'dueño' ? 'owner' : (cleanType === 'administrador' ? 'admin' : 'seller');
      const cleanEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}@mch.local`;
      
      // Chequear si ya existe un usuario con ese username
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanName.toLowerCase());
      if (existingUser) {
        linkedUserId = existingUser.id;
        db.prepare("UPDATE users SET role = ?, authorized_to_work = 1, is_banned = 0 WHERE id = ?").run(userRole, linkedUserId);
      } else {
        const permsObj = getDefaultPermissionsForRole(userRole);
        const userInsert = db.prepare(`
          INSERT INTO users (username, email, pin, role, can_edit, is_verified, is_banned, authorized_to_work, permissions, created_at)
          VALUES (?, ?, '1234', ?, ?, 1, 0, 1, ?, datetime('now'))
        `).run(
          cleanName,
          cleanEmail,
          userRole,
          userRole === 'seller' ? 0 : 1,
          JSON.stringify(permsObj)
        );
        linkedUserId = userInsert.lastInsertRowid;
      }
    }

    const metricsData = b.metrics || (linkedUserId ? { userId: linkedUserId, username: cleanName, role: cleanType } : {});
    
    db.prepare(`
      INSERT INTO nexus_nodes (id, company_id, type, name, status, description, metrics, parent_id, children, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      Number(b.companyId || b.company_id || 1),
      cleanType,
      cleanName,
      b.status || 'online',
      b.description || '',
      JSON.stringify(metricsData),
      b.parentId || b.parent_id || null,
      JSON.stringify(b.children || []),
      Number(b.position?.x ?? b.position_x ?? 100),
      Number(b.position?.y ?? b.position_y ?? 100)
    );
    auditNexus(id, 'create', req, b);
    res.status(201).json(nexusResponse(db.prepare('SELECT * FROM nexus_nodes WHERE id = ?').get(id)));
  } catch (e) {
    logError('POST /api/nexus/nodes', e);
    res.status(500).json({ error: e.message });
  }
});
app.patch('/api/nexus/nodes/:id', checkAdmin, (req, res) => { 
  try { 
    const b = req.body || {}; 
    const fields = []; 
    const vals = []; 
    for (const [key, col] of [['name','name'],['status','status'],['description','description'],['parentId','parent_id']]) {
      if (b[key] !== undefined) { 
        fields.push(`${col} = ?`); 
        vals.push(b[key]); 
      } 
    }
    if (b.parentIds !== undefined) {
      fields.push('parent_ids = ?');
      vals.push(JSON.stringify(b.parentIds));
      if (b.parentId === undefined) {
        fields.push('parent_id = ?');
        vals.push(b.parentIds.length > 0 ? b.parentIds[0] : null);
      }
    }
    if (b.metrics !== undefined) { 
      fields.push('metrics = ?'); 
      vals.push(JSON.stringify(b.metrics)); 
    } 
    if (b.position) { 
      fields.push('position_x = ?', 'position_y = ?'); 
      vals.push(Number(b.position.x || 0), Number(b.position.y || 0)); 
    } 
    if (!fields.length) return res.status(400).json({ error: 'Sin cambios.' }); 
    fields.push('updated_at = CURRENT_TIMESTAMP'); 
    vals.push(req.params.id); 
    db.prepare(`UPDATE nexus_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...vals); 
    auditNexus(req.params.id, 'update', req, b); 
    res.json(nexusResponse(db.prepare('SELECT * FROM nexus_nodes WHERE id = ?').get(req.params.id))); 
  } catch (e) { 
    logError('PATCH /api/nexus/nodes/:id', e); 
    res.status(500).json({ error: e.message }); 
  } 
});
app.post('/api/nexus/nodes/:id/archive', checkAdmin, (req, res) => {
  try {
    const nodeId = req.params.id;
    db.prepare('UPDATE nexus_nodes SET archived_at = CURRENT_TIMESTAMP, archived_by = ? WHERE id = ?').run(req.user.id, nodeId);
    auditNexus(nodeId, 'archive', req);
    
    // Si es un nodo de usuario, desactivar autorización para trabajar en la tabla users
    const node = db.prepare('SELECT id, type, name, metrics FROM nexus_nodes WHERE id = ?').get(nodeId);
    if (node && ['dueño', 'administrador', 'vendedor'].includes(node.type)) {
      let uId = null;
      try {
        const parsed = JSON.parse(node.metrics || '{}');
        uId = parsed.userId;
      } catch (_) {}
      if (!uId && nodeId.startsWith('nexus_user_')) {
        uId = Number(nodeId.replace('nexus_user_', ''));
      }
      if (uId) {
        db.prepare('UPDATE users SET authorized_to_work = 0 WHERE id = ?').run(uId);
      } else if (node.name) {
        db.prepare('UPDATE users SET authorized_to_work = 0 WHERE LOWER(username) = ?').run(node.name.toLowerCase());
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/nexus/nodes/:id/restore', checkAdmin, (req, res) => {
  try {
    const nodeId = req.params.id;
    db.prepare('UPDATE nexus_nodes SET archived_at = NULL, archived_by = NULL WHERE id = ?').run(nodeId);
    auditNexus(nodeId, 'restore', req);
    
    // Si es un nodo de usuario, reactivar autorización en users
    const node = db.prepare('SELECT id, type, name, metrics FROM nexus_nodes WHERE id = ?').get(nodeId);
    if (node && ['dueño', 'administrador', 'vendedor'].includes(node.type)) {
      let uId = null;
      try {
        const parsed = JSON.parse(node.metrics || '{}');
        uId = parsed.userId;
      } catch (_) {}
      if (!uId && nodeId.startsWith('nexus_user_')) {
        uId = Number(nodeId.replace('nexus_user_', ''));
      }
      if (uId) {
        db.prepare('UPDATE users SET authorized_to_work = 1, is_banned = 0 WHERE id = ?').run(uId);
      } else if (node.name) {
        db.prepare('UPDATE users SET authorized_to_work = 1, is_banned = 0 WHERE LOWER(username) = ?').run(node.name.toLowerCase());
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/nexus/nodes/:id', checkAdmin, (req, res) => {
  try {
    const nodeId = req.params.id;
    const node = db.prepare('SELECT id, type, name, metrics FROM nexus_nodes WHERE id = ?').get(nodeId);
    
    db.prepare('DELETE FROM nexus_nodes WHERE id = ?').run(nodeId);
    db.prepare('UPDATE nexus_nodes SET parent_id = NULL WHERE parent_id = ?').run(nodeId);
    auditNexus(nodeId, 'delete_permanent', req);
    
    // Si era un nodo de usuario (no admin principal id 1), eliminarlo de users
    if (node && ['dueño', 'administrador', 'vendedor'].includes(node.type)) {
      let uId = null;
      try {
        const parsed = JSON.parse(node.metrics || '{}');
        uId = parsed.userId;
      } catch (_) {}
      if (!uId && nodeId.startsWith('nexus_user_')) {
        uId = Number(nodeId.replace('nexus_user_', ''));
      }
      if (uId && uId !== 1) {
        db.prepare('DELETE FROM users WHERE id = ?').run(uId);
      } else if (node.name && node.name.toLowerCase() !== 'admin') {
        db.prepare('DELETE FROM users WHERE LOWER(username) = ? AND id != 1').run(node.name.toLowerCase());
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- REST API ENDPOINTS ---

// Helper: Default permissions per role
const getDefaultPermissionsForRole = (role) => {
  const r = String(role || '').toLowerCase();
  if (r === 'owner' || r === 'dueño') {
    return {
      pos_sales: true,
      pos_discounts: true,
      manage_inventory: true,
      view_costs: true,
      manage_purchases: true,
      manage_transfers: true,
      manage_losses: true,
      manage_users: true,
      manage_settings: true,
      view_analytics: true,
      view_nexus: true,
      edit_nexus: true,
      audit_cash_registers: true,
      close_shifts: true,
      approve_shifts: true
    };
  }
  if (r === 'admin' || r === 'administrator' || r === 'administrador') {
    return {
      pos_sales: true,
      pos_discounts: true,
      manage_inventory: true,
      view_costs: true,
      manage_purchases: true,
      manage_transfers: true,
      manage_losses: true,
      manage_users: true,
      manage_settings: false,
      view_analytics: true,
      view_nexus: true,
      edit_nexus: true,
      audit_cash_registers: true,
      close_shifts: true,
      approve_shifts: true
    };
  }
  // Default: Vendedor / Seller
  return {
    pos_sales: true,
    pos_discounts: false,
    manage_inventory: false,
    view_costs: false,
    manage_purchases: false,
    manage_transfers: false,
    manage_losses: false,
    manage_users: false,
    manage_settings: false,
    view_analytics: false,
    view_nexus: false,
    edit_nexus: false,
    audit_cash_registers: false,
    close_shifts: true,
    approve_shifts: false
  };
};

// --- USERS MANAGEMENT ENDPOINTS ---

// GET /api/users - List all users with their permissions and status
app.get('/api/users', authenticate, (req, res) => {
  try {
    const isOwner = req.user.role === 'owner';
    let query = `
      SELECT id, username, email, pin, role, can_edit, is_banned, is_verified, 
             authorized_to_work, permissions, created_at, last_ip,
             avatar_url, dni_number, dni_front, dni_back, phone, address
      FROM users
    `;
    const params = [];
    
    // Si no es dueño (es admin o vendedor), filtrar solo roles no-dueño o su propio alcance
    if (!isOwner) {
      query += ` WHERE role != 'owner'`;
    }
    query += ` ORDER BY id ASC`;

    const users = db.prepare(query).all(...params);

    const formatted = users.map(u => {
      let parsedPerms = {};
      try {
        parsedPerms = JSON.parse(u.permissions || '{}');
      } catch (_) {}
      const defaultPerms = getDefaultPermissionsForRole(u.role);
      return {
        ...u,
        pin: u.pin ? '••••' : '',
        authorized_to_work: u.authorized_to_work !== 0,
        is_banned: u.is_banned === 1,
        permissions: { ...defaultPerms, ...parsedPerms }
      };
    });

    res.json(formatted);
  } catch (e) {
    logError('GET /api/users', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/users/:id - Get single user details
app.get('/api/users/:id', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, pin, role, can_edit, is_banned, is_verified, 
             authorized_to_work, permissions, created_at, last_ip,
             avatar_url, dni_number, dni_front, dni_back, phone, address
      FROM users 
      WHERE id = ?
    `).get(req.params.id);

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    let parsedPerms = {};
    try {
      parsedPerms = JSON.parse(user.permissions || '{}');
    } catch (_) {}

    res.json({
      ...user,
      pin: user.pin ? '••••' : '',
      authorized_to_work: user.authorized_to_work !== 0,
      is_banned: user.is_banned === 1,
      permissions: { ...getDefaultPermissionsForRole(user.role), ...parsedPerms }
    });
  } catch (e) {
    logError('GET /api/users/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users - Create a new user and sync with Nexus node if seller/admin
app.post('/api/users', checkAdmin, (req, res) => {
  try {
    const { username, email, pin, role, authorized_to_work, permissions, dni_number, phone, address, dni_front, dni_back, avatar_url } = req.body || {};
    if (!username || !String(username).trim()) {
      return res.status(400).json({ error: 'El nombre de usuario es requerido.' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = email ? String(email).trim() : `${cleanUsername.toLowerCase().replace(/\s+/g, '')}@mch.local`;
    const cleanRole = ['owner', 'dueño'].includes(String(role).toLowerCase()) 
      ? 'owner' 
      : ['admin', 'administrador'].includes(String(role).toLowerCase()) 
        ? 'admin' 
        : 'seller';

    // Verificar unicidad
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanUsername.toLowerCase(), cleanEmail.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese nombre o email.' });
    }

    const permsObj = permissions || getDefaultPermissionsForRole(cleanRole);
    const authToWork = authorized_to_work === false ? 0 : 1;

    const info = db.prepare(`
      INSERT INTO users (username, email, pin, role, can_edit, is_verified, is_banned, authorized_to_work, permissions, dni_number, phone, address, dni_front, dni_back, avatar_url, created_at) 
      VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      cleanUsername,
      cleanEmail,
      pin ? String(pin).trim() : '1234',
      cleanRole,
      cleanRole === 'seller' ? 0 : 1,
      authToWork,
      JSON.stringify(permsObj),
      dni_number || null,
      phone || null,
      address || null,
      dni_front || null,
      dni_back || null,
      avatar_url || null
    );

    const newUserId = info.lastInsertRowid;

    // Crear nodo correspondiente en Nexus si es admin o vendedor
    try {
      const nexusId = `nexus_user_${newUserId}`;
      const nodeType = cleanRole === 'owner' ? 'dueño' : cleanRole === 'admin' ? 'administrador' : 'vendedor';
      const defaultParent = cleanRole === 'admin' 
        ? 'nexus_company_miss_chulerias' 
        : 'nexus_inventory_mch1';

      db.prepare(`
        INSERT OR REPLACE INTO nexus_nodes (id, company_id, type, name, status, description, metrics, parent_id, position_x, position_y)
        VALUES (?, 1, ?, ?, 'online', ?, ?, ?, ?, ?)
      `).run(
        nexusId,
        nodeType,
        cleanUsername,
        cleanRole === 'admin' ? 'Administrador del sistema.' : 'Personal de ventas.',
        JSON.stringify({ userId: newUserId, username: cleanUsername, role: cleanRole }),
        defaultParent,
        cleanRole === 'admin' ? 640 : 120,
        cleanRole === 'admin' ? 450 : 920
      );
    } catch (nexusErr) {
      console.warn('Advertencia al sincronizar nodo Nexus para nuevo usuario:', nexusErr.message);
    }

    res.status(201).json({
      id: newUserId,
      username: cleanUsername,
      email: cleanEmail,
      role: cleanRole,
      authorized_to_work: authToWork === 1,
      dni_number: dni_number || null,
      phone: phone || null,
      address: address || null,
      dni_front: dni_front || null,
      dni_back: dni_back || null,
      avatar_url: avatar_url || null,
      permissions: permsObj
    });
  } catch (e) {
    logError('POST /api/users', e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id - Update user details, permissions, pin and authorization
app.patch('/api/users/:id', checkAdmin, (req, res) => {
  try {
    const userId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const b = req.body || {};
    const fields = [];
    const vals = [];

    if (b.username !== undefined && String(b.username).trim()) {
      fields.push('username = ?');
      vals.push(String(b.username).trim());
    }
    if (b.email !== undefined) {
      fields.push('email = ?');
      vals.push(String(b.email).trim());
    }
    if (b.pin !== undefined && String(b.pin).trim()) {
      fields.push('pin = ?');
      vals.push(String(b.pin).trim());
    }
    if (b.role !== undefined) {
      const cleanRole = ['owner', 'dueño'].includes(String(b.role).toLowerCase()) 
        ? 'owner' 
        : ['admin', 'administrador'].includes(String(b.role).toLowerCase()) 
          ? 'admin' 
          : 'seller';
      fields.push('role = ?');
      vals.push(cleanRole);
      fields.push('can_edit = ?');
      vals.push(cleanRole === 'seller' ? 0 : 1);
    }
    if (b.authorized_to_work !== undefined) {
      fields.push('authorized_to_work = ?');
      vals.push(b.authorized_to_work ? 1 : 0);
    }
    if (b.is_banned !== undefined) {
      fields.push('is_banned = ?');
      vals.push(b.is_banned ? 1 : 0);
    }
    if (b.dni_number !== undefined) {
      fields.push('dni_number = ?');
      vals.push(b.dni_number);
    }
    if (b.phone !== undefined) {
      fields.push('phone = ?');
      vals.push(b.phone);
    }
    if (b.address !== undefined) {
      fields.push('address = ?');
      vals.push(b.address);
    }
    if (b.dni_front !== undefined) {
      fields.push('dni_front = ?');
      vals.push(b.dni_front);
    }
    if (b.dni_back !== undefined) {
      fields.push('dni_back = ?');
      vals.push(b.dni_back);
    }
    if (b.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      vals.push(b.avatar_url);
    }
    if (b.permissions !== undefined) {
      fields.push('permissions = ?');
      vals.push(JSON.stringify(b.permissions));
    }

    if (fields.length > 0) {
      vals.push(userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    }

    // Actualizar nodo Nexus en tiempo real: nombre, tipo, estado y padre
    const nexusId = `nexus_user_${userId}`;
    const finalRole = b.role !== undefined
      ? (['owner', 'dueño'].includes(String(b.role).toLowerCase()) ? 'owner'
          : ['admin', 'administrador'].includes(String(b.role).toLowerCase()) ? 'admin' : 'seller')
      : existing.role;
    // Estado desde authorized_to_work / is_banned
    const authStatus = (b.authorized_to_work !== undefined ? (b.authorized_to_work ? 1 : 0) : existing.authorized_to_work);
    const banned = b.is_banned !== undefined ? (b.is_banned ? 1 : 0) : existing.is_banned;
    const nodeStatus = banned === 1 ? 'maintenance' : (authStatus === 0 ? 'warning' : 'online');
    const nodeType = finalRole === 'owner' ? 'dueño' : finalRole === 'admin' ? 'administrador' : 'vendedor';
    const nodeParent = finalRole === 'admin' ? 'nexus_company_miss_chulerias' : 'nexus_inventory_mch1';
    const newName = b.username !== undefined ? String(b.username).trim() : existing.username;
    try {
      db.prepare(`
        INSERT OR REPLACE INTO nexus_nodes (id, company_id, type, name, status, description, metrics, parent_id, position_x, position_y)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, 120, 920)
      `).run(
        nexusId, nodeType, newName, nodeStatus,
        JSON.stringify({ userId, username: newName, role: finalRole }),
        nodeParent
      );
    } catch (nexusErr) {
      console.warn('Advertencia al sincronizar nodo Nexus en edición:', nexusErr.message);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    let parsedPerms = {};
    try {
      parsedPerms = JSON.parse(updated.permissions || '{}');
    } catch (_) {}

    res.json({
      ...updated,
      pin: updated.pin ? '••••' : '',
      authorized_to_work: updated.authorized_to_work !== 0,
      is_banned: updated.is_banned === 1,
      permissions: { ...getDefaultPermissionsForRole(updated.role), ...parsedPerms }
    });
  } catch (e) {
    logError('PATCH /api/users/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// Multer Storage for User Documents and Avatars (15MB limit)
const userMediaStorage = multer.memoryStorage();
const userMediaUpload = multer({
    storage: userMediaStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Endpoint de subida de imágenes para usuarios (Avatar y Carnet de Identidad Frente/Dorso)
app.post('/api/users/upload-media', authenticate, userMediaUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const uploadDir = path.join(__dirname, 'uploads', 'users');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const type = req.body.type || 'media'; // 'avatar', 'dni_front', 'dni_back'
        const baseName = `usr_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const mainFilename = `${baseName}_orig.jpg`;
        const medFilename = `${baseName}_med.jpg`;
        const smFilename = `${baseName}_sm.jpg`;
        const thumbFilename = `${baseName}_thumb.jpg`;

        // Generar variantes adaptativas con sharp respetando sin enlargar y topes máximos reales
        if (type === 'avatar') {
            // Original / Alta resolución para avatar (Máximo 500x500 sin agrandar fotos menores)
            await sharp(req.file.buffer)
                .resize(500, 500, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, mainFilename));

            // Medium (300x300)
            await sharp(req.file.buffer)
                .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, medFilename));

            // Small (150x150 para conexiones móviles)
            await sharp(req.file.buffer)
                .resize(150, 150, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 75, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, smFilename));

            // Thumbnail (64x64 para headers, listas y avatares pequeños)
            await sharp(req.file.buffer)
                .resize(64, 64, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 70, progressive: true })
                .toFile(path.join(uploadDir, thumbFilename));
        } else {
            // Documento de Carnet de Identidad (Máximo 1600x1600 para alta nitidez legible en pantalla sin megas innecesarios)
            await sharp(req.file.buffer)
                .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, mainFilename));

            await sharp(req.file.buffer)
                .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, medFilename));

            await sharp(req.file.buffer)
                .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 75, progressive: true, mozjpeg: true })
                .toFile(path.join(uploadDir, smFilename));

            await sharp(req.file.buffer)
                .resize(150, 150, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 70, progressive: true })
                .toFile(path.join(uploadDir, thumbFilename));
        }

        const publicUrl = `/uploads/users/${mainFilename}`;
        res.json({ 
            success: true, 
            url: publicUrl,
            versions: {
                original: `/uploads/users/${mainFilename}`,
                medium: `/uploads/users/${medFilename}`,
                small: `/uploads/users/${smFilename}`,
                thumbnail: `/uploads/users/${thumbFilename}`
            }
        });
    } catch (e) {
        logError('POST /api/users/upload-media', e);
        res.status(500).json({ error: e.message });
    }
});

// Actualizar perfil propio (Avatar o PIN/Contraseña)
app.patch('/api/users/profile/me', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const { avatar_url, pin, phone, address } = req.body || {};
        const fields = [];
        const vals = [];

        if (avatar_url !== undefined) {
            fields.push('avatar_url = ?');
            vals.push(avatar_url);
        }
        if (pin !== undefined && String(pin).trim()) {
            fields.push('pin = ?');
            vals.push(String(pin).trim());
        }
        if (phone !== undefined) {
            fields.push('phone = ?');
            vals.push(phone);
        }
        if (address !== undefined) {
            fields.push('address = ?');
            vals.push(address);
        }

        if (fields.length > 0) {
            vals.push(userId);
            db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
        }

        const updated = db.prepare('SELECT id, username, email, role, avatar_url, phone, address, created_at FROM users WHERE id = ?').get(userId);
        res.json({ success: true, user: updated });
    } catch (e) {
        logError('PATCH /api/users/profile/me', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/users/:id - Delete user (soft or hard)
app.delete('/api/users/:id', checkAdmin, (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId === 1) {
      return res.status(400).json({ error: 'No se puede eliminar el usuario administrador principal.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    // Archivar / remover nodo Nexus correspondiente
    try {
      db.prepare('DELETE FROM nexus_nodes WHERE id = ?').run(`nexus_user_${userId}`);
    } catch (_) {}

    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (e) {
    logError('DELETE /api/users/:id', e);
    res.status(500).json({ error: e.message });
  }
});

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
        const settingsRows = db.prepare("SELECT key, value FROM settings").all();
        const settingsMap = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
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

        // Get images for all products
        const getImages = db.prepare("SELECT url, size_type FROM product_images WHERE product_id = ?");
        
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

            // Get images grouped by size_type
            const images = getImages.all(p.id);
            const imageVersions = {
                original: images.filter(img => img.size_type === 'original').map(img => img.url),
                medium: images.filter(img => img.size_type === 'medium').map(img => img.url),
                small: images.filter(img => img.size_type === 'small').map(img => img.url),
                thumbnail: images.filter(img => img.size_type === 'thumbnail').map(img => img.url)
            };
            
            // For backwards compatibility, also provide 'images' array with medium sizes
            const allImages = images.map(img => img.url);

            // Compute financial and currency fields
            const cost_mx = p.cost_mx || 0;
            const sale_price_manual = p.sale_price_manual || 0;
            const currentQty = inventoryId ? specificStock : totalStock;
            
            const rate_usd_mn = settingsMap.RATE_USD_MN || 550;
            const rate_mxn_usd = settingsMap.RATE_MXN_USD || 19;
            const margin_multiplier = settingsMap.MARGIN_MULTIPLIER || 3.5;

            const cost_mn = (cost_mx / rate_mxn_usd) * rate_usd_mn;
            const cost_usd = rate_usd_mn > 0 ? (cost_mn / rate_usd_mn) : 0;
            const sale_unit_mn_suggested = cost_mn * margin_multiplier;
            const actual_sale_price = sale_price_manual > 0 ? sale_price_manual : sale_unit_mn_suggested;
            const margin_percent = actual_sale_price > 0 ? ((actual_sale_price - cost_mn) / actual_sale_price) * 100 : 0;

            return {
                ...p,
                inventory: inventoryMap,
                total_quantity: totalStock,
                quantity: currentQty,
                images: allImages,
                image_versions: imageVersions,
                cost_usd: parseFloat(cost_usd.toFixed(2)),
                cost_mn: parseFloat(cost_mn.toFixed(2)),
                sale_unit_mn_suggested: parseFloat(sale_unit_mn_suggested.toFixed(2)),
                actual_sale_price: parseFloat(actual_sale_price.toFixed(2)),
                total_cost_mn: parseFloat((cost_mn * currentQty).toFixed(2)),
                total_sale_mn: parseFloat((actual_sale_price * currentQty).toFixed(2)),
                margin_percent: parseFloat(margin_percent.toFixed(1))
            };
        });

        res.json(productsWithStock);

    } catch (e) {
        logError("GET /api/products", e);
        res.status(500).json({ error: e.message });
    }
});


// 2.5 Unify Products (Merge selected products into one)
app.post('/api/products/unify', authenticate, requireEditor, (req, res) => {
    try {
        const { productIds, name, quantity, cost_mx, sale_price_manual, description, label_color, code } = req.body;
        if (!Array.isArray(productIds) || productIds.length < 2) {
            return res.status(400).json({ error: 'Seleccioná al menos dos productos para unificar.' });
        }
        
        const ids = [...new Set(productIds.map(Number).filter(Number.isInteger))];
        const placeholders = ids.map(() => '?').join(',');
        
        const sourceProducts = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...ids);
        if (sourceProducts.length !== ids.length) {
            return res.status(404).json({ error: 'Uno o más productos seleccionados no existen.' });
        }
        
        // Collect all images from the source products
        const sourceImages = db.prepare(`SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY rowid`).all(...ids);
        
        // Sum stock per inventory across all source products
        const stockRows = db.prepare(`SELECT inventory_id, SUM(quantity) as total_qty FROM product_inventory WHERE product_id IN (${placeholders}) GROUP BY inventory_id`).all(...ids);
        
        const unifyTx = db.transaction(() => {
            // 1. Insert unified product
            const mainImage = sourceImages.find(img => img.size_type === 'medium')?.url || sourceImages[0]?.url || sourceProducts[0]?.image || null;
            const insertProd = db.prepare(`
                INSERT INTO products (name, code, cost_mx, sale_price_manual, description, label_color, quantity, image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                String(name || 'Producto unificado').trim(),
                code || null,
                Number(cost_mx) || 0,
                Number(sale_price_manual) || 0,
                description || '',
                label_color || 'none',
                Number(quantity) || 0,
                mainImage
            );
            
            const newProductId = Number(insertProd.lastInsertRowid);
            
            // 2. Re-link images to the new product
            const insertImage = db.prepare('INSERT INTO product_images (product_id, url, size_type) VALUES (?, ?, ?)');
            sourceImages.forEach(img => {
                insertImage.run(newProductId, img.url, img.size_type || 'medium');
            });
            
            // 3. Set aggregated inventory stock for each inventory
            const insertStock = db.prepare('INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, ?)');
            stockRows.forEach(sr => {
                insertStock.run(newProductId, sr.inventory_id, sr.total_qty || 0);
            });
            
            // 4. Delete source products (cascades to old product_images and product_inventory)
            db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...ids);
            
            return newProductId;
        });
        
        const newId = unifyTx();
        res.json({ success: true, id: newId, imageCount: sourceImages.length });
    } catch (e) {
        logError("POST /api/products/unify", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Create Product
app.post('/api/products', authenticate, requireEditor, productImageUpload.array('images', 5), async (req, res) => {
    try {
        const { name, cost_mx, sale_price_manual, description, quantity, label_color, code } = req.body;

        if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

        // Insert product
        const info = db.prepare(`
            INSERT INTO products (name, code, cost_mx, sale_price_manual, description, label_color, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            name, 
            code || null,
            cost_mx || 0, 
            sale_price_manual || 0, 
            description || '', 
            label_color || 'none',
            quantity || 0
        );
        
        const productId = info.lastInsertRowid;

        // Process and save images if any
        if (req.files && req.files.length > 0) {
            const insertImage = db.prepare('INSERT INTO product_images (product_id, url, size_type) VALUES (?, ?, ?)');
            
            for (const file of req.files) {
                try {
                    const processedVersions = await processProductImage(file.buffer, file.originalname);
                    // Store all versions as JSON in the url field for now
                    // Or store each version separately - let's store the medium as main and others as variants
                    insertImage.run(productId, processedVersions.medium, 'medium');
                    insertImage.run(productId, processedVersions.small, 'small');
                    insertImage.run(productId, processedVersions.thumbnail, 'thumbnail');
                    insertImage.run(productId, processedVersions.original, 'original');
                } catch (imgError) {
                    console.error('Error processing image:', imgError);
                }
            }
        }

        res.json({ success: true, id: productId });
    } catch (e) {
        logError("POST /api/products", e);
        res.status(500).json({ error: e.message });
    }
});

// 3.5 Update Product
app.put('/api/products/:id', authenticate, requireEditor, productImageUpload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cost_mx, sale_price_manual, description, label_color, code, deletedImages } = req.body;

        // Check if product exists
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Update product fields
        db.prepare(`
            UPDATE products 
            SET name = ?, code = ?, cost_mx = ?, sale_price_manual = ?, description = ?, label_color = ?
            WHERE id = ?
        `).run(
            name || existing.name,
            code || existing.code,
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
                    // Get all image versions for this product
                    const currentImages = db.prepare('SELECT id, url FROM product_images WHERE product_id = ?').all(id);
                    
                    for (const delPath of imagesToDelete) {
                        const delFileName = path.basename(delPath);
                        // Find and delete all versions of this image
                        const imagesToRemove = currentImages.filter(img => {
                            const imgFileName = path.basename(img.url);
                            return imgFileName.includes(delFileName.replace(/_(orig|med|sm|thumb)\.jpg$/, ''));
                        });
                        
                        for (const img of imagesToRemove) {
                            // Delete physical file
                            const filePath = path.join(__dirname, 'uploads', path.basename(img.url));
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                                console.log(`Deleted image file: ${img.url}`);
                            }
                            // Delete from database
                            db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
                        }
                    }
                }
            } catch (e) {
                console.error('Error handling deleted images:', e);
            }
        }

        // Process and add new images
        if (req.files && req.files.length > 0) {
            const insertImage = db.prepare('INSERT INTO product_images (product_id, url, size_type) VALUES (?, ?, ?)');
            
            for (const file of req.files) {
                try {
                    const processedVersions = await processProductImage(file.buffer, file.originalname);
                    insertImage.run(id, processedVersions.medium, 'medium');
                    insertImage.run(id, processedVersions.small, 'small');
                    insertImage.run(id, processedVersions.thumbnail, 'thumbnail');
                    insertImage.run(id, processedVersions.original, 'original');
                } catch (imgError) {
                    console.error('Error processing image:', imgError);
                }
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

        // Delete associated image files from new table
        try {
            const images = db.prepare('SELECT url FROM product_images WHERE product_id = ?').all(id);
            images.forEach(img => {
                const filename = path.basename(img.url);
                const filePath = path.join(__dirname, 'uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted image file: ${filename}`);
                }
            });
            // Delete from product_images table
            db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
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

// 3.7 Bulk Delete Products
app.post('/api/products/bulk-delete', authenticate, requireEditor, (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Lista de IDs no válida o vacía' });
        }

        const validIds = ids.map(Number).filter(Number.isInteger);
        if (validIds.length === 0) {
            return res.status(400).json({ error: 'IDs inválidos' });
        }

        const placeholders = validIds.map(() => '?').join(',');

        // 1. Delete image files
        try {
            const images = db.prepare(`SELECT url FROM product_images WHERE product_id IN (${placeholders})`).all(...validIds);
            images.forEach(img => {
                const filename = path.basename(img.url);
                const filePath = path.join(__dirname, 'uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
            db.prepare(`DELETE FROM product_images WHERE product_id IN (${placeholders})`).run(...validIds);
        } catch (e) {
            console.error('Error deleting product images in bulk:', e);
        }

        // 2. Delete inventory records and products
        db.prepare(`DELETE FROM product_inventory WHERE product_id IN (${placeholders})`).run(...validIds);
        const result = db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...validIds);

        res.json({ success: true, deletedCount: result.changes });
    } catch (e) {
        logError("POST /api/products/bulk-delete", e);
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

        // Sincronizar Nexus en tiempo real tras ajuste manual de stock
        refreshNexusInventoryMetrics(inventory_id);

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

// Update settings (admin only)
app.put('/api/settings', authenticate, requireAdmin, (req, res) => {
    try {
        const updates = req.body;
        const updateStmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
        const insertStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
        
        for (const [key, value] of Object.entries(updates)) {
            const result = updateStmt.run(value, key);
            if (result.changes === 0) {
                insertStmt.run(key, value);
            }
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/settings error:', e);
        res.status(500).json({ error: e.message });
    }
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
        const { inventory } = req.query;
        let query = `
            SELECT s.id, s.total, s.date, s.user_id, s.inventory_id, s.payment_method,
                   u.username as seller_name,
                   COUNT(si.id) as items_count,
                   json_group_array(
                       json_object(
                           'name', COALESCE(p.name, 'Producto'),
                           'quantity', si.quantity,
                           'price', si.price,
                           'cost', si.cost
                       )
                   ) as items_json
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN users u ON s.user_id = u.id
        `;
        let params = [];
        if (inventory && inventory !== 'all') {
            query += ` WHERE s.inventory_id = ? `;
            params.push(inventory);
        }
        query += ` GROUP BY s.id ORDER BY s.date DESC LIMIT 1000 `;

        const rawSales = db.prepare(query).all(...params);
        const sales = rawSales.map(s => {
            let items = [];
            try {
                items = JSON.parse(s.items_json || '[]').filter(it => it.name && it.quantity);
            } catch (_) {}
            return {
                id: s.id,
                date: s.date,
                inventory: s.inventory_id === 'alm' ? 'Almacén' : (s.inventory_id === 'mch1' ? 'MCH 1' : (s.inventory_id === 'mch2' ? 'MCH 2' : s.inventory_id)),
                inventory_id: s.inventory_id,
                seller: s.seller_name || 'Vendedor',
                seller_id: s.user_id,
                total: s.total,
                status: 'closed',
                payment_method: s.payment_method || 'cash',
                items: items.length > 0 ? items : [{ name: 'Venta General', quantity: s.items_count || 1, price: s.total }]
            };
        });
        res.json(sales);
    } catch (e) {
        logError("GET /api/history/sales", e);
        res.status(500).json({ error: e.message });
    }
});

// --- PURCHASES & TRANSFERS COMBINED INVENTORY HISTORY API ---

// Get all entries (purchases + transfers) with items for inventory history
app.get('/api/purchases', authenticate, (req, res) => {
    try {
        const { inventory_id } = req.query;
        let purchases = [];
        
        // Si el inventario es alm o global, o para kioscos si tienen entradas registradas
        let purchasesQuery = `
            SELECT p.*, u.username as user_name, 'purchase' as record_type
            FROM purchases p
            LEFT JOIN users u ON p.user_id = u.id
        `;
        const pParams = [];
        if (inventory_id) {
            // Filtrar estrictamente las compras por inventario exacto
            purchasesQuery += ` WHERE (p.inventory_id = ?)`;
            pParams.push(inventory_id);
        }
        purchasesQuery += ` ORDER BY p.date DESC LIMIT 1000`;
        purchases = db.prepare(purchasesQuery).all(...pParams);

        const getPurchaseItems = db.prepare(`
            SELECT pi.*, pr.name as product_name, pr.code as product_code
            FROM purchase_items pi
            JOIN products pr ON pi.product_id = pr.id
            WHERE pi.purchase_id = ?
        `);

        const formattedPurchases = purchases.map(p => ({
            ...p,
            record_type: 'purchase',
            status: p.status || 'received',
            supplier: p.supplier || (p.inventory_id === 'alm' ? 'Proveedor Externo' : 'Almacén MCH'),
            items: getPurchaseItems.all(p.id)
        }));

        // Traer traslados donde el inventario activo sea estrictamente origen o destino
        let transfersQuery = `
            SELECT t.*, 
                   creator.username as created_by_name,
                   receiver.username as received_by_name,
                   'transfer' as record_type
            FROM transfers t
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users receiver ON t.received_by = receiver.id
            WHERE 1=1
        `;
        const tParams = [];
        if (inventory_id) {
            transfersQuery += ` AND (t.source_inventory = ? OR t.target_inventory = ?)`;
            tParams.push(inventory_id, inventory_id);
        }
        transfersQuery += ` ORDER BY t.created_at DESC LIMIT 500`;
        const transfers = db.prepare(transfersQuery).all(...tParams);

        const getTransferItems = db.prepare(`
            SELECT ti.*, pr.name as product_name, pr.code as product_code, pr.image as product_image,
                   COALESCE(pr.sale_price_manual, 0) as sale_price,
                   COALESCE(pr.cost_mx, 0) as cost_price,
                   COALESCE(pr.sale_price_manual, pr.cost_mx, 0) as price,
                   COALESCE(pr.cost_mx, 0) as cost
            FROM transfer_items ti
            LEFT JOIN products pr ON ti.product_id = pr.id
            WHERE ti.transfer_id = ?
        `);

        const formattedTransfers = transfers.map(t => {
            const items = getTransferItems.all(t.id);
            const totalVal = items.reduce((sum, item) => sum + (item.quantity * (item.sale_price || item.price || 0)), 0);
            const totalCost = items.reduce((sum, item) => sum + (item.quantity * (item.cost_price || item.cost || 0)), 0);
            const invLabel = (id) => id === 'alm' ? 'Almacén MCH' : (id === 'mch1' ? 'MCH 1' : (id === 'mch2' ? 'MCH 2' : (id || '').toUpperCase()));

            let supplierLabel = '';
            if (inventory_id) {
                if (t.target_inventory === inventory_id) {
                    supplierLabel = `Traslado desde ${invLabel(t.source_inventory)}`;
                } else {
                    supplierLabel = `Traslado enviado a ${invLabel(t.target_inventory)}`;
                }
            } else {
                supplierLabel = `${invLabel(t.source_inventory)} ➔ ${invLabel(t.target_inventory)}`;
            }

            return {
                id: `tr_${t.id}`,
                transfer_id: t.id,
                record_type: 'transfer',
                date: t.created_at || new Date().toISOString(),
                supplier: supplierLabel,
                source_inventory: t.source_inventory,
                target_inventory: t.target_inventory,
                total: totalVal,
                total_cost: totalCost,
                currency: 'MN',
                status: t.status || 'pending',
                notes: t.notes,
                user_name: t.created_by_name,
                items: items
            };
        });

        // Combinar compras y traslados ordenados por fecha descendente (lo más nuevo arriba)
        const combined = [...formattedTransfers, ...formattedPurchases].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(combined);
    } catch (e) {
        console.error('GET /api/purchases error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get single purchase with items
app.get('/api/purchases/:id', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        
        const purchase = db.prepare(`
            SELECT p.*, u.username as user_name
            FROM purchases p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `).get(id);
        
        if (!purchase) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }
        
        const items = db.prepare(`
            SELECT pi.*, pr.name as product_name, pr.code as product_code
            FROM purchase_items pi
            JOIN products pr ON pi.product_id = pr.id
            WHERE pi.purchase_id = ?
        `).all(id);
        
        res.json({ ...purchase, items });
    } catch (e) {
        console.error('GET /api/purchases/:id error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Create new purchase
app.post('/api/purchases', authenticate, requireEditor, (req, res) => {
    try {
        const { supplier, items, total, currency, exchange_rate, notes, payment_method, inventory_id } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Se requieren items para la compra' });
        }
        
        const result = db.transaction(() => {
            // Insert purchase
            const purchaseResult = db.prepare(`
                INSERT INTO purchases (supplier, total, currency, exchange_rate, user_id, notes, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                supplier || '',
                total || 0,
                currency || 'MN',
                exchange_rate || 1,
                req.user.id,
                notes || '',
                payment_method || 'cash'
            );
            
            const purchaseId = purchaseResult.lastInsertRowid;
            
            // Insert items and update inventory
            const insertItem = db.prepare(`
                INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price, cost_price_currency)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const updateInventory = db.prepare(`
                INSERT INTO product_inventory (product_id, inventory_id, quantity)
                VALUES (?, ?, ?)
                ON CONFLICT(product_id, inventory_id) 
                DO UPDATE SET quantity = quantity + excluded.quantity
            `);
            
            for (const item of items) {
                insertItem.run(
                    purchaseId,
                    item.product_id,
                    item.quantity,
                    item.cost_price,
                    item.cost_price_currency || currency || 'MN'
                );
                
                // Update inventory
                updateInventory.run(item.product_id, inventory_id || 'mch1', item.quantity);
            }
            
            return purchaseId;
                    })();
        
                    // Sincronizar Nexus en tiempo real (stock tras entrada de mercancía)
                    refreshNexusInventoryMetrics(inventory_id || 'mch1');

                    res.json({ success: true, id: result });
    } catch (e) {
        console.error('POST /api/purchases error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Delete purchase (revert inventory)
app.delete('/api/purchases/:id', authenticate, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { inventory_id } = req.body;
        
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
        if (!purchase) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }
        
        db.transaction(() => {
            // Get items to revert inventory
            const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);
            
            const revertInventory = db.prepare(`
                UPDATE product_inventory 
                SET quantity = quantity - ?
                WHERE product_id = ? AND inventory_id = ?
            `);
            
            for (const item of items) {
                revertInventory.run(item.quantity, item.product_id, inventory_id || 'mch1');
            }
            
            // Delete purchase (cascade will delete items)
            db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
        })();
        
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/purchases/:id error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get purchase history (legacy endpoint for compatibility)
app.get('/api/history/purchases', authenticate, (req, res) => {
    try {
        const purchases = db.prepare(`
            SELECT p.id, p.supplier, p.total, p.date, p.notes, p.currency, p.payment_method
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

// ==================== BACKUP / RESTORE SYSTEM ====================

// Listar todos los backups disponibles
app.get('/api/backup/list', authenticate, requireAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.zip'))
            .map(f => {
                const stat = fs.statSync(path.join(backupDir, f));
                return {
                    filename: f,
                    size: stat.size,
                    sizeFormatted: (stat.size / 1024 / 1024).toFixed(2) + ' MB',
                    date: stat.mtime.toISOString(),
                    dateFormatted: stat.mtime.toLocaleString('es-ES')
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch (e) {
        logError("GET /api/backup/list", e);
        res.status(500).json({ error: e.message });
    }
});

// Crear un backup completo de la base de datos
app.post('/api/backup/create', authenticate, requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `backup-${timestamp}.zip`;
        const backupPath = path.join(backupDir, backupName);

        // 1. Crear backup de la DB copiando el archivo (con checkpoint WAL primero)
        const backupDbPath = path.join(backupDir, `inventory-${timestamp}.db`);
        db.pragma('wal_checkpoint(FULL)'); // Forzar escritura del WAL al archivo principal
        fs.copyFileSync(dbPath, backupDbPath);

        // 2. Crear ZIP con la DB + imágenes
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            throw err;
        });

        output.on('close', () => {
            // Eliminar la DB temporal
            try { fs.unlinkSync(backupDbPath); } catch (e) {}
            const stat = fs.statSync(backupPath);
            res.json({
                success: true,
                filename: backupName,
                size: stat.size,
                sizeFormatted: (stat.size / 1024 / 1024).toFixed(2) + ' MB',
                date: now.toISOString()
            });
        });

        archive.pipe(output);
        archive.file(backupDbPath, { name: 'inventory.db' });

        // Incluir imágenes si existen
        if (fs.existsSync(uploadDir)) {
            archive.directory(uploadDir, 'uploads');
        }

        archive.finalize();
    } catch (e) {
        logError("POST /api/backup/create", e);
        res.status(500).json({ error: e.message });
    }
});

// Restaurar un backup (subir archivo ZIP)
app.post('/api/backup/restore', authenticate, requireAdmin, (req, res) => {
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, backupDir),
            filename: (req, file, cb) => cb(null, 'restore-temp.zip')
        })
    }).single('backup');

    upload(req, res, async (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se subió ningún archivo' });
            }

            const zipPath = path.join(backupDir, 'restore-temp.zip');
            const extractDir = path.join(backupDir, 'restore-extract');

            // Limpiar directorio de extracción si existe
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });

            // Extraer ZIP
            const { execSync } = require('child_process');
            const unzipper = require('unzipper');
            const zipBuffer = fs.readFileSync(zipPath);
            await new Promise((resolve, reject) => {
                unzipper.Open.buffer(zipBuffer)
                    .then(d => d.extract({ path: extractDir, concurrency: 5 }))
                    .then(resolve)
                    .catch(reject);
            });

            // Verificar que existe inventory.db en el ZIP extraído
            const restoredDbPath = path.join(extractDir, 'inventory.db');
            if (!fs.existsSync(restoredDbPath)) {
                return res.status(400).json({ error: 'El archivo ZIP no contiene inventory.db' });
            }

            // 1. Hacer backup de la DB actual antes de restaurar (por seguridad)
            const safetyBackupPath = path.join(backupDir, `pre-restore-${Date.now()}.db`);
            db.pragma('wal_checkpoint(FULL)');
            fs.copyFileSync(dbPath, safetyBackupPath);

            // 2. Cerrar la conexión actual y reemplazar la DB
            db.close();
            fs.copyFileSync(restoredDbPath, dbPath);

            // 3. Restaurar imágenes si están en el ZIP
            const restoredUploads = path.join(extractDir, 'uploads');
            if (fs.existsSync(restoredUploads)) {
                if (fs.existsSync(uploadDir)) {
                    fs.rmSync(uploadDir, { recursive: true });
                }
                fs.cpSync(restoredUploads, uploadDir, { recursive: true });
            }

            // 4. Reabrir la DB restaurada
            // Nota: Como db es const, necesitamos reiniciar el server
            // Limpiar temporales
            try { fs.unlinkSync(zipPath); } catch (e) {}
            try { fs.rmSync(extractDir, { recursive: true }); } catch (e) {}

            res.json({
                success: true,
                message: 'Backup restaurado. El servidor se reiniciará para aplicar los cambios.',
                safetyBackup: path.basename(safetyBackupPath)
            });

            // Reiniciar el servidor después de 2 segundos
            setTimeout(() => {
                console.log('[Backup] Restauración completada. Reiniciando servidor...');
                process.exit(0); // En el .bat o PM2 se reiniciará automáticamente
            }, 2000);

        } catch (e) {
            logError("POST /api/backup/restore", e);
            res.status(500).json({ error: e.message });
        }
    });
});

// Restaurar un backup existente por nombre de archivo
app.post('/api/backup/restore/:filename', authenticate, requireAdmin, async (req, res) => {
    try {
        const filename = req.params.filename;
        const zipPath = path.join(backupDir, filename);

        if (!fs.existsSync(zipPath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        const extractDir = path.join(backupDir, 'restore-extract');

        // Limpiar directorio de extracción si existe
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });

        // Extraer ZIP
        const unzipper = require('unzipper');
        const zipBuffer = fs.readFileSync(zipPath);
        await new Promise((resolve, reject) => {
            unzipper.Open.buffer(zipBuffer)
                .then(d => d.extract({ path: extractDir, concurrency: 5 }))
                .then(resolve)
                .catch(reject);
        });

        // Verificar que existe inventory.db
        const restoredDbPath = path.join(extractDir, 'inventory.db');
        if (!fs.existsSync(restoredDbPath)) {
            return res.status(400).json({ error: 'El backup no contiene inventory.db' });
        }

        // 1. Backup de seguridad de la DB actual
        const safetyBackupPath = path.join(backupDir, `pre-restore-${Date.now()}.db`);
        db.pragma('wal_checkpoint(FULL)');
        fs.copyFileSync(dbPath, safetyBackupPath);

        // 2. Cerrar DB y reemplazar
        db.close();
        fs.copyFileSync(restoredDbPath, dbPath);

        // 3. Restaurar imágenes
        const restoredUploads = path.join(extractDir, 'uploads');
        if (fs.existsSync(restoredUploads)) {
            if (fs.existsSync(uploadDir)) {
                fs.rmSync(uploadDir, { recursive: true });
            }
            fs.cpSync(restoredUploads, uploadDir, { recursive: true });
        }

        // Limpiar
        try { fs.rmSync(extractDir, { recursive: true }); } catch (e) {}

        res.json({
            success: true,
            message: 'Backup restaurado. El servidor se reiniciará.',
            safetyBackup: path.basename(safetyBackupPath)
        });

        setTimeout(() => {
            console.log('[Backup] Restauración completada. Reiniciando servidor...');
            process.exit(0);
        }, 2000);

    } catch (e) {
        logError("POST /api/backup/restore/:filename", e);
        res.status(500).json({ error: e.message });
    }
});

// Descargar un backup
app.get('/api/backup/download/:filename', authenticate, requireAdmin, (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(backupDir, filename);

        // Validar que el archivo existe y está dentro del directorio de backups
        if (!fs.existsSync(filePath) || !filePath.startsWith(backupDir)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        res.download(filePath, filename);
    } catch (e) {
        logError("GET /api/backup/download/:filename", e);
        res.status(500).json({ error: e.message });
    }
});

// Eliminar un backup
app.delete('/api/backup/:filename', authenticate, requireAdmin, (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(backupDir, filename);

        if (!fs.existsSync(filePath) || !filePath.startsWith(backupDir)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Backup eliminado' });
    } catch (e) {
        logError("DELETE /api/backup/:filename", e);
        res.status(500).json({ error: e.message });
    }
});

// Resetear la base de datos de manera selectiva o total (con backup automático previo)
app.post('/api/backup/selective-reset', authenticate, requireAdmin, (req, res) => {
    try {
        const {
            inventoryId = 'all', // 'all', 'alm', 'mch1', 'mch2'
            clearSales = false,
            clearPurchases = false,
            clearTransfers = false,
            clearInventory = false,
            clearLosses = false
        } = req.body;

        if (!clearSales && !clearPurchases && !clearTransfers && !clearInventory && !clearLosses) {
            return res.status(400).json({ error: 'Debes seleccionar al menos una categoría para resetear.' });
        }

        // 1. Crear backup de seguridad previo
        const safetyBackupPath = path.join(backupDir, `pre-selective-reset-${Date.now()}.db`);
        db.pragma('wal_checkpoint(FULL)');
        fs.copyFileSync(dbPath, safetyBackupPath);

        const summary = {
            inventoryId,
            cleared: []
        };

        db.exec('BEGIN TRANSACTION');

        // A) LIMPIAR VENTAS
        if (clearSales) {
            if (inventoryId === 'all') {
                db.exec('DELETE FROM sale_items');
                db.exec('DELETE FROM returns');
                db.exec('DELETE FROM sales');
                db.exec('DELETE FROM expenses');
                db.exec('DELETE FROM wage_payments');
                db.exec('DELETE FROM sales_sessions');
            } else {
                // Obtener ventas asociadas a este inventario
                const sales = db.prepare('SELECT id, session_id FROM sales WHERE inventory_id = ?').all(inventoryId);
                const saleIds = sales.map(s => s.id);
                const sessionIds = [...new Set(sales.map(s => s.session_id).filter(Boolean))];

                if (saleIds.length > 0) {
                    const placeholders = saleIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM sale_items WHERE sale_id IN (${placeholders})`).run(...saleIds);
                    db.prepare(`DELETE FROM returns WHERE sale_id IN (${placeholders})`).run(...saleIds);
                    db.prepare(`DELETE FROM sales WHERE id IN (${placeholders})`).run(...saleIds);
                }

                if (sessionIds.length > 0) {
                    const sessPlaceholders = sessionIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM expenses WHERE session_id IN (${sessPlaceholders})`).run(...sessionIds);
                    db.prepare(`DELETE FROM wage_payments WHERE session_id IN (${sessPlaceholders})`).run(...sessionIds);
                    db.prepare(`DELETE FROM sales_sessions WHERE id IN (${sessPlaceholders})`).run(...sessionIds);
                }
            }
            summary.cleared.push('Ventas y Sesiones de Caja');
        }

        // B) LIMPIAR ENTRADAS / COMPRAS
        if (clearPurchases) {
            db.exec('DELETE FROM purchase_items');
            db.exec('DELETE FROM purchases');
            summary.cleared.push('Historial de Entradas / Compras');
        }

        // C) LIMPIAR TRASLADOS
        if (clearTransfers) {
            if (inventoryId === 'all') {
                db.exec('DELETE FROM transfer_items');
                db.exec('DELETE FROM transfers');
            } else {
                const transfers = db.prepare('SELECT id FROM transfers WHERE source_inventory = ? OR target_inventory = ?').all(inventoryId, inventoryId);
                const transferIds = transfers.map(t => t.id);
                if (transferIds.length > 0) {
                    const placeholders = transferIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM transfer_items WHERE transfer_id IN (${placeholders})`).run(...transferIds);
                    db.prepare(`DELETE FROM transfers WHERE id IN (${placeholders})`).run(...transferIds);
                }
            }
            summary.cleared.push('Historial de Traslados');
        }

        // D) LIMPIAR MERMAS / PÉRDIDAS
        if (clearLosses) {
            if (inventoryId === 'all') {
                db.exec('DELETE FROM losses');
            } else {
                db.prepare('DELETE FROM losses WHERE inventory = ?').run(inventoryId);
            }
            summary.cleared.push('Mermas / Pérdidas');
        }

        // E) LIMPIAR INVENTARIO / CATÁLOGO / STOCK
        if (clearInventory) {
            if (inventoryId === 'all') {
                db.exec('DELETE FROM product_inventory');
                db.exec('DELETE FROM product_images');
                db.exec('DELETE FROM products');
                // Limpiar imágenes físicas
                if (fs.existsSync(uploadDir)) {
                    fs.rmSync(uploadDir, { recursive: true });
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                summary.cleared.push('Todo el Catálogo y Stock Global');
            } else {
                // Poner a 0 las existencias en el inventario seleccionado
                db.prepare('UPDATE product_inventory SET quantity = 0 WHERE inventory_id = ?').run(inventoryId);
                summary.cleared.push(`Stock puesto a 0 para ${inventoryId}`);
            }
        }

        db.exec('COMMIT');

        res.json({
            success: true,
            message: `Limpieza selectiva completada: ${summary.cleared.join(', ')}`,
            safetyBackup: path.basename(safetyBackupPath),
            summary
        });

    } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        logError("POST /api/backup/selective-reset", e);
        res.status(500).json({ error: e.message });
    }
});

// Resetear la base de datos a estado limpio (mantener solo estructura + admin user)
app.post('/api/backup/reset', authenticate, requireAdmin, (req, res) => {
    try {
        // 1. Crear backup de seguridad antes de resetear
        const safetyBackupPath = path.join(backupDir, `pre-reset-${Date.now()}.db`);
        db.pragma('wal_checkpoint(FULL)');
        fs.copyFileSync(dbPath, safetyBackupPath);

        // 2. Obtener datos del usuario admin antes de limpiar
        const adminUser = db.prepare('SELECT * FROM users LIMIT 1').get();
        const inventories = db.prepare('SELECT * FROM inventories').all();
        const expenseTypes = db.prepare('SELECT * FROM expense_types').all();

        // 3. Limpiar todas las tablas de datos (mantener estructura)
        const tablesToClear = [
            'sale_items', 'sales', 'sales_sessions', 'expenses',
            'product_inventory', 'product_images', 'products',
            'returns', 'purchases', 'purchase_items', 'losses',
            'notifications', 'wage_payments', 'transfers', 'transfer_items',
            'blacklisted_emails'
        ];

        db.exec('BEGIN TRANSACTION');
        tablesToClear.forEach(table => {
            db.exec(`DELETE FROM ${table}`);
        });
        // Resetear autoincrement
        tablesToClear.forEach(table => {
            try {
                db.exec(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
            } catch (e) {}
        });
        db.exec('COMMIT');

        // 4. Limpiar imágenes subidas
        if (fs.existsSync(uploadDir)) {
            fs.rmSync(uploadDir, { recursive: true });
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        res.json({
            success: true,
            message: 'Base de datos reseteada. Se conservó el usuario admin, inventarios y tipos de gastos.',
            safetyBackup: path.basename(safetyBackupPath),
            preserved: { adminUser: adminUser?.email, inventories: inventories.length, expenseTypes: expenseTypes.length }
        });

    } catch (e) {
        logError("POST /api/backup/reset", e);
        res.status(500).json({ error: e.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend in both Production and Local Network mode
// Enables phones on the local LAN/WiFi to load the pre-built PWA bundle directly from Node server
const clientDistPath = path.join(__dirname, '../client/dist');

if (fs.existsSync(clientDistPath)) {
    console.log('[Server] Serving static PWA frontend from:', clientDistPath);
    app.use(express.static(clientDistPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.use((req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }
        // Check if file exists in dist, serve it directly
        const filePath = path.join(clientDistPath, req.path);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return res.sendFile(filePath);
        }
        // Otherwise serve index.html for SPA routing
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
} else {
    // Fallback if dist doesn't exist
    console.log('[Server] Running in API-only mode (build dist not found)');
    app.get('/', (req, res) => {
        res.json({
            message: 'Miss Chulerías API Server',
            status: 'running',
            documentation: '/api/health'
        });
    });
}

// --- ENDPOINTS DE LOGGING AUDITABLE ---
app.post('/api/logs', (req, res) => {
    try {
        const { level = 'info', context = 'CLIENT', message = '', details = null } = req.body;
        writeAppLog(level, context, message, details);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/logs', authenticate, requireAdmin, (req, res) => {
    try {
        const logFile = path.join(logsDir, 'app.log');
        if (!fs.existsSync(logFile)) {
            return res.json({ logs: [] });
        }
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        const lastLines = lines.slice(-200); // Últimas 200 líneas
        res.json({ logs: lastLines });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
