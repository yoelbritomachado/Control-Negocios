#!/usr/bin/env node
// QA: Reset Total de Fábrica REAL (docs/FASE_RESET_MULTIEMPRESA.md §1)
// ⚠️ SANDBOX: este test NUNCA toca la DB de producción.
//   1) Copia server/inventory.db → qa/tmp_sandbox/
//   2) Levanta su PROPIO server (puerto 3102) con DB_PATH/BACKUP_DIR/UPLOAD_DIR aislados
//   3) Corre el flujo destructivo ahí (datos test → backup → reset → verificación)
//   4) Mata su server y limpia el sandbox al final
//
// Uso:  node qa/test_factory_reset.js [--sin-backup] [--no-cleanup]
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const PROD_DB = path.join(__dirname, '..', 'server', 'inventory.db');
const SANDBOX_DIR = path.join(__dirname, 'tmp_sandbox');
const SANDBOX_DB = path.join(SANDBOX_DIR, 'inventory.db');
const SANDBOX_BACKUPS = path.join(SANDBOX_DIR, 'backups');
const SANDBOX_UPLOADS = path.join(SANDBOX_DIR, 'uploads');
const PORT = 3102;
const API = `http://127.0.0.1:${PORT}`;
const NO_CLEANUP = process.argv.includes('--no-cleanup');

function req(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            method,
            hostname: '127.0.0.1',
            port: PORT,
            path: urlPath,
            headers: {
                'Content-Type': 'application/json',
                // Autenticación: el server cae a usuario owner si no hay token válido
                // (getFallbackUser), y requireAdmin acepta role owner.
                ...(global.OWNER_TOKEN ? { 'Authorization': `Bearer ${global.OWNER_TOKEN}` } : {})
            }
        };
        const r = http.request(options, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(raw); } catch (e) { parsed = { raw }; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
    });
}

function log(msg) { console.log(msg); }

function assert(cond, label) {
    if (cond) { log(`  ✅ ${label}`); return true; }
    log(`  ❌ FALLO: ${label}`);
    process.exitCode = 1;
    return false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForServer(timeoutMs = 25000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try { await req('GET', '/api/health'); return true; } catch (e) {}
        await sleep(500);
    }
    return false;
}
const timeoutMs = 25000; // para waitForServer

async function main() {
    // --- SANDBOX setup: copia la DB producción, nunca la toca ---
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    fs.copyFileSync(PROD_DB, SANDBOX_DB);
    fs.mkdirSync(SANDBOX_BACKUPS, { recursive: true });
    fs.mkdirSync(SANDBOX_UPLOADS, { recursive: true });
    log(`🔒 SANDBOX: DB copiada a ${SANDBOX_DB} (${fs.statSync(SANDBOX_DB).size} bytes)`);
    log(`🔒 Producción ${PROD_DB} NO será tocada (server aislado en :${PORT})\n`);
    // Baseline de producción para el check final de "producción intacta"
    const prodBaseline = new Database(PROD_DB, { readonly: true });
    const PROD_SALES_BEFORE = prodBaseline.prepare('SELECT COUNT(*) c FROM sales').get().c;
    const PROD_PRODUCTS_BEFORE = prodBaseline.prepare('SELECT COUNT(*) c FROM products').get().c;
    prodBaseline.close();
    log(`🔒 Baseline producción: products=${PROD_PRODUCTS_BEFORE}, sales=${PROD_SALES_BEFORE}\n`);

    // --- Levantar server de sandbox ---
    const serverProc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
        env: {
            ...process.env,
            PORT: String(PORT),
            DB_PATH: SANDBOX_DB,
            BACKUP_DIR: SANDBOX_BACKUPS,
            UPLOAD_DIR: SANDBOX_UPLOADS,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverOut = '';
    serverProc.stdout.on('data', d => serverOut += d);
    serverProc.stderr.on('data', d => serverOut += d);
    serverProc.on('exit', code => { if (code && code !== 0) log(`[server sandbox exit ${code}] ${serverOut.slice(-600)}`); });

    try {
        const up = await waitForServer();
        assert(up, `Server sandbox arriba en :${PORT}`);
        if (!up) throw new Error('sandbox no arrancó: ' + serverOut.slice(-400));

        const db = new Database(SANDBOX_DB);
        db.pragma('journal_mode = WAL');
        const useBackup = !process.argv.includes('--sin-backup');

        log('\n========== QA FACTORY RESET (SANDBOX) ==========\n');

        // --- PASO 1: crear datos de prueba (marcados 'test') ---
        log('[1] Creando datos de prueba...');
        const seed = db.transaction(() => {
            db.prepare(`INSERT INTO users (username, email, pin, role, is_verified, authorized_to_work)
                        VALUES ('test_worker', 'test_worker@test.local', '1234', 'seller', 1, 1)
                        `).run();
            const invId = 'TQA_TEST';
            db.prepare(`INSERT INTO inventories (id, name, code, type, business) VALUES (?, 'TEST Almacén QA', 'TQA', 'warehouse', 'MCH')`).run(invId);
            db.prepare(`INSERT INTO inventories (id, name, code, type, business) VALUES ('TQB_TEST', 'TEST POS QA', 'TQB', 'kiosk', 'MCH')`).run();
            db.prepare(`INSERT INTO products (name, quantity, cost_mx, inventory_id) VALUES ('TEST Producto QA', 10, 50, ?)`).run(invId);
            const prodId = db.prepare(`SELECT id FROM products WHERE name = 'TEST Producto QA'`).get().id;
            db.prepare(`INSERT INTO product_inventory (product_id, inventory_id, quantity) VALUES (?, ?, 10)`).run(prodId, invId);
            db.prepare(`INSERT INTO sales (inventory_id, total, items_count, payment_method, date) VALUES (?, 200, 1, 'cash', datetime('now'))`).run(invId);
            const saleId = db.prepare(`SELECT id FROM sales WHERE inventory_id = ? ORDER BY id DESC LIMIT 1`).get(invId).id;
            db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, 2, 100)`).run(saleId, prodId);
            db.prepare(`INSERT INTO expenses (type, amount, description, date, payment_method) VALUES ('test', 50, 'TEST gasto QA', datetime('now'), 'cash')`).run();
            try { db.prepare(`INSERT INTO nexus_nodes (type, name, status) VALUES ('test', 'TEST node QA', 'online')`).run(); } catch (e) {}
            try { db.prepare(`INSERT INTO notifications (type, title, message, is_read, created_at) VALUES ('test', 'TEST notif', 'test', 0, datetime('now'))`).run(); } catch (e) {}
            // Sembrar salario de apertura (dato operativo con período que el reset DEBE borrar)
            try {
                db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_salary_opening_2026-09_TEST', '1234.5')`).run();
                db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('test_setting_general', 'no_borrar')`).run();
            } catch (e) { log('  (aviso) seed settings: ' + e.message); }
        });
        seed();

        const before = {
            users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
            inventories: db.prepare('SELECT COUNT(*) c FROM inventories').get().c,
            products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
            sales: db.prepare('SELECT COUNT(*) c FROM sales').get().c,
            expenses: db.prepare('SELECT COUNT(*) c FROM expenses').get().c,
        };
        log(`  Datos antes del reset: ${JSON.stringify(before)}\n`);
        assert(before.users >= 2, 'Datos de prueba creados (>=2 usuarios: dueño + test_worker)');
        assert(before.inventories >= 2, 'Inventarios de prueba creados (>=2)');
        assert(before.products >= 1 && before.sales >= 1 && before.expenses >= 1, 'Producto, venta y gasto de prueba creados');

        // --- PASO 2: validar rechazo sin confirm correcta ---
        log('\n[2] POST /api/factory-reset sin confirm → debe ser 400');
        const bad1 = await req('POST', '/api/factory-reset', { backup: false, confirm: 'reset' });
        assert(bad1.status === 400, `confirm='reset' (lowercase) rechazado con 400 (got ${bad1.status})`);
        const bad2 = await req('POST', '/api/factory-reset', { backup: false });
        assert(bad2.status === 400, `sin confirm rechazado con 400 (got ${bad2.status})`);

        // --- PASO 3: GET /api/backups/last ---
        log('\n[3] GET /api/backups/last → fecha del último backup');
        const lastBefore = await req('GET', '/api/backups/last');
        log(`  Respuesta: ${JSON.stringify(lastBefore.body)}`);
        assert(lastBefore.status === 200 && ('date' in lastBefore.body), 'GET /api/backups/last responde {date}');

        // --- PASO 4: reset CON backup ---
        log(`\n[4] POST /api/factory-reset {backup: ${useBackup}, confirm: 'RESET'}`);
        const filesBeforeReset = fs.existsSync(SANDBOX_BACKUPS)
            ? fs.readdirSync(SANDBOX_BACKUPS).filter(f => f.endsWith('.zip')).sort() : [];
        const resp = await req('POST', '/api/factory-reset', { backup: useBackup, confirm: 'RESET' });
        log(`  Status: ${resp.status}`);
        log(`  Body: ${JSON.stringify(resp.body, null, 2).slice(0, 1200)}`);
        assert(resp.status === 200 && resp.body.ok === true, 'Reset exitoso (ok:true)');
        if (useBackup) {
            assert(resp.body.backup_created === true, 'backup_created: true');
            assert(!!resp.body.backup_name, `backup_name presente (${resp.body.backup_name})`);
        }
        assert(resp.body.deleted && typeof resp.body.deleted === 'object', 'deleted: {tabla: conteo} presente');

        // --- PASO 5: verificación en DB ---
        log('\n[5] Verificación post-reset en DB (sandbox):');
        const after = {
            users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
            users_non_owner: db.prepare(`SELECT COUNT(*) c FROM users WHERE role != 'owner' AND LOWER(email) != 'yoelbritomachado@gmail.com'`).get().c,
            inventories: db.prepare('SELECT COUNT(*) c FROM inventories').get().c,
            products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
            product_inventory: db.prepare('SELECT COUNT(*) c FROM product_inventory').get().c,
            sales: db.prepare('SELECT COUNT(*) c FROM sales').get().c,
            sale_items: db.prepare('SELECT COUNT(*) c FROM sale_items').get().c,
            expenses: db.prepare('SELECT COUNT(*) c FROM expenses').get().c,
            transfers: db.prepare('SELECT COUNT(*) c FROM transfers').get().c,
            purchases: db.prepare('SELECT COUNT(*) c FROM purchases').get().c,
            losses: db.prepare('SELECT COUNT(*) c FROM losses').get().c,
            sales_sessions: db.prepare('SELECT COUNT(*) c FROM sales_sessions').get().c,
            nexus_nodes: db.prepare('SELECT COUNT(*) c FROM nexus_nodes').get().c,
            notifications: db.prepare('SELECT COUNT(*) c FROM notifications').get().c,
            settings: db.prepare('SELECT COUNT(*) c FROM settings').get().c,
        };
        log('  ' + JSON.stringify(after));
        assert(after.users_non_owner === 0, 'Usuarios no-dueño: 0');
        const owner = db.prepare(`SELECT username, email, role FROM users WHERE role = 'owner' OR LOWER(email) = 'yoelbritomachado@gmail.com'`).all();
        log(`  Dueño restante: ${JSON.stringify(owner)}`);
        assert(owner.length === 1 && owner[0].username === 'yoelbritomachado', 'Queda SOLO el dueño yoelbritomachado');
        assert(after.inventories === 0, 'inventories: 0 filas (no queda ningún almacén ni POS)');
        assert(after.products === 0, 'products: 0');
        assert(after.product_inventory === 0, 'product_inventory: 0');
        assert(after.sales === 0 && after.sale_items === 0, 'ventas: 0 (sales + sale_items)');
        assert(after.expenses === 0, 'expenses: 0');
        assert(after.transfers === 0, 'transfers: 0');
        assert(after.purchases === 0, 'purchases: 0');
        assert(after.losses === 0, 'losses: 0');
        assert(after.sales_sessions === 0, 'sales_sessions: 0');
        assert(after.nexus_nodes === 0, 'nexus_nodes: 0');
        assert(after.notifications === 0, 'notifications: 0');

        // Settings: generales intactos, pero admin_salary_opening_* DEBE estar borrado
        // (dato operativo con período: si sobrevive, Control de Efectivo re-inyecta egresos fantasma)
        const settingsAfter = db.prepare('SELECT COUNT(*) c FROM settings').get().c;
        const settingsBefore = db.prepare('SELECT COUNT(*) c FROM settings').get().c;
        const salaryRows = db.prepare("SELECT COUNT(*) c FROM settings WHERE key LIKE 'admin_salary_opening_%'").get().c;
        assert(settingsAfter >= settingsBefore - salaryRows && salaryRows === 0,
            `settings generales intactos; admin_salary_opening_* borrado (${salaryRows} restantes)`);
        // Verificar además que el setting general de prueba SOBREVIVIÓ (sembrado en fase [1])
        const generalKept = db.prepare("SELECT COUNT(*) c FROM settings WHERE key = 'test_setting_general'").get().c;
        assert(generalKept === 1, 'settings generales de prueba sobreviven al reset');

        // Backups intactos (en SANDBOX_BACKUPS)
        log('\n[6] Backups intactos (sandbox):');
        const filesAfterReset = fs.existsSync(SANDBOX_BACKUPS)
            ? fs.readdirSync(SANDBOX_BACKUPS).filter(f => f.endsWith('.zip')).sort() : [];
        const nuevos = filesAfterReset.filter(f => !filesBeforeReset.includes(f));
        log(`  Antes: ${filesBeforeReset.length} zips | Después: ${filesAfterReset.length} zips | Nuevo: ${nuevos.join(', ') || 'ninguno'}`);
        assert(filesAfterReset.length >= filesBeforeReset.length, 'Ningún backup preexistente fue borrado');
        if (useBackup) {
            assert(nuevos.includes(resp.body.backup_name), `El backup del reset (${resp.body.backup_name}) existe en sandbox/backups`);
            const stillThere = fs.existsSync(path.join(SANDBOX_BACKUPS, resp.body.backup_name));
            assert(stillThere, 'Backup creado sigue intacto en disco');
        }

        // --- PASO 7: la app tolera 0 inventarios ---
        log('\n[7] App tolera 0 inventarios:');
        const inv = await req('GET', '/api/inventories');
        assert(inv.status === 200 && Array.isArray(inv.body) && inv.body.length === 0, `GET /api/inventories → [] sin crash (got ${inv.status}, len=${Array.isArray(inv.body) ? inv.body.length : 'no-array'})`);

        const health = await req('GET', '/api/health');
        assert(health.status === 200, `GET /api/health sigue OK (${health.status})`);

        // --- PASO 8: PRODUCCIÓN INTACTA ---
        log('\n[8] Producción intacta:');
        const prodCheck = new Database(PROD_DB, { readonly: true });
        const prodSales = prodCheck.prepare('SELECT COUNT(*) c FROM sales').get().c;
        const prodProducts = prodCheck.prepare('SELECT COUNT(*) c FROM products').get().c;
        prodCheck.close();
        // La producción puede estar en estado cero (post-reset del dueño) o con datos:
        // lo que NUNCA puede pasar es que el sandbox MODIFIQUE la producción.
        // Guardamos el conteo al inicio del test y comparamos (ver fase [1]).
        assert(prodSales === PROD_SALES_BEFORE && prodProducts === PROD_PRODUCTS_BEFORE,
            `Producción ilesa (products=${prodProducts}/${PROD_PRODUCTS_BEFORE}, sales=${prodSales}/${PROD_SALES_BEFORE})`);

        db.close();
    } finally {
        // --- Matar server sandbox SIEMPRE ---
        try { serverProc.kill(); } catch (e) {}
        await sleep(800);
        if (!NO_CLEANUP) {
            try { fs.rmSync(SANDBOX_DIR, { recursive: true, force: true }); log('\n🧹 Sandbox limpiado'); } catch (e) { log(`(sandbox no limpiado: ${e.message})`); }
        } else {
            log(`\n(sandbox preservado en ${SANDBOX_DIR})`);
        }
    }

    log('\n========== RESULTADO ==========');
    if (process.exitCode === 1) { log('❌ HAY FALLOS — revisar arriba'); process.exit(1); }
    log('✅ TODO OK — Reset de fábrica REAL verificado en SANDBOX (producción ilesa)\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });