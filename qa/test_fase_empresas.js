#!/usr/bin/env node
// QA: Fase Empresas — companies + inventories.company_id (docs/FASE_EMPRESAS_SELECTOR.md)
// ⚠️ SANDBOX (patrón qa/test_factory_reset.js): NUNCA toca la DB de producción.
//   1) Copia server/inventory.db → qa/tmp_sandbox_companies/
//   2) Levanta su PROPIO server (puerto 3102) con DB_PATH/BACKUP_DIR/UPLOAD_DIR aislados
//   3) Flujo: crear empresa → crear inventario linkeado → filtro company_id → renombrar →
//      inventario sin company_id cae a default → logo base64 → producción ilesa
//   4) Mata su server y limpia el sandbox al final
//
// Uso: node qa/test_fase_empresas.js [--no-cleanup]
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const PROD_DB = path.join(__dirname, '..', 'server', 'inventory.db');
const SANDBOX_DIR = path.join(__dirname, 'tmp_sandbox_companies');
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
            headers: { 'Content-Type': 'application/json' }
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

async function main() {
    // --- SANDBOX setup ---
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    fs.copyFileSync(PROD_DB, SANDBOX_DB);
    fs.mkdirSync(SANDBOX_BACKUPS, { recursive: true });
    fs.mkdirSync(SANDBOX_UPLOADS, { recursive: true });
    log(`🔒 SANDBOX: DB copiada a ${SANDBOX_DB}`);
    log(`🔒 Producción ${PROD_DB} NO será tocada (server aislado en :${PORT})\n`);

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

    // Conteos reales de producción ANTES (para assert final no-destructivo).
    // companies aún puede no existir en prod (migración corre al arrancar el server prod).
    const prodBefore = (() => {
        const d = new Database(PROD_DB, { readonly: true });
        const hasCompanies = !!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'").get();
        const r = {
            companies: hasCompanies ? d.prepare('SELECT COUNT(*) c FROM companies').get().c : 0,
            companyNames: hasCompanies ? d.prepare('SELECT name FROM companies ORDER BY id').all().map(r => r.name) : [],
            inventories: d.prepare('SELECT COUNT(*) c FROM inventories').get().c,
            products: d.prepare('SELECT COUNT(*) c FROM products').get().c,
            sales: d.prepare('SELECT COUNT(*) c FROM sales').get().c,
        };
        d.close();
        return r;
    })();
    log(`📊 Producción antes: ${JSON.stringify(prodBefore)}\n`);

    try {
        const up = await waitForServer();
        assert(up, `Server sandbox arriba en :${PORT}`);
        if (!up) throw new Error('sandbox no arrancó: ' + serverOut.slice(-400));

        log('\n========== QA FASE EMPRESAS (SANDBOX) ==========\n');

        // --- [1] Migración: tabla companies + default ---
        log('[1] Migración companies al arranque');
        const list0 = await req('GET', '/api/companies');
        assert(list0.status === 200 && Array.isArray(list0.body), `GET /api/companies → 200 array (got ${list0.status})`);
        const def0 = Array.isArray(list0.body) ? list0.body.find(c => c.is_default) : null;
        assert(!!def0 && def0.name === 'Miss Chulerías', `Empresa default 'Miss Chulerías' sembrada (got ${JSON.stringify(def0 && def0.name)})`);
        assert(Array.isArray(list0.body) && list0.body.every(c => 'inventories_count' in c), 'Shape incluye inventories_count');
        log(`  companies: ${JSON.stringify(list0.body)}`);

        // Migración de inventories: los existentes del sandbox (copia de prod) deben haber
        // quedado linkeados a la default (backfill). En prod hay 0 inventarios: OK.
        const sbDb = new Database(SANDBOX_DB);
        const sbCols = sbDb.prepare('PRAGMA table_info(inventories)').all().map(c => c.name);
        assert(sbCols.includes('company_id'), 'inventories.company_id existe tras migración');
        const orphanCount = sbDb.prepare('SELECT COUNT(*) c FROM inventories WHERE company_id IS NULL').get().c;
        assert(orphanCount === 0, `Backfill: 0 inventarios huérfanos (got ${orphanCount})`);

        // --- [2] POST /api/companies: crear empresa ---
        log('\n[2] POST /api/companies {name}');
        const badName = await req('POST', '/api/companies', { name: '   ' });
        assert(badName.status === 400, `Nombre vacío rechazado con 400 (got ${badName.status})`);
        const created = await req('POST', '/api/companies', { name: 'QA Segunda Empresa' });
        assert(created.status === 201 && created.body.name === 'QA Segunda Empresa', `Empresa creada (got ${created.status})`);
        const newId = created.body && created.body.id;
        assert(!!newId, `id de empresa nuevo: ${newId}`);

        // NO DELETE: la spec lo prohíbe
        const del = await req('DELETE', `/api/companies/${newId}`);
        assert(del.status === 404, `DELETE /api/companies/:id NO existe (got ${del.status}, esperado 404)`);

        // --- [3] POST /api/inventories linkeado ---
        log('\n[3] POST /api/inventories {name, type, company_id}');
        const invLinked = await req('POST', '/api/inventories', { name: 'QA POS Empresa', type: 'kiosk', company_id: newId });
        assert(invLinked.status === 201 && invLinked.body.company_id === newId, `Inventario linkeado a empresa ${newId} (got ${JSON.stringify(invLinked.body && invLinked.body.company_id)})`);

        // company_id inexistente → 400
        const invBad = await req('POST', '/api/inventories', { name: 'QA Fantasmo', type: 'kiosk', company_id: 99999 });
        assert(invBad.status === 400, `company_id inexistente rechazado con 400 (got ${invBad.status})`);

        // --- [4] GET /api/inventories?company_id=N filtra ---
        log('\n[4] GET /api/inventories?company_id=N');
        const invDef = await req('POST', '/api/inventories', { name: 'QA POS Default', type: 'warehouse' });
        assert(invDef.status === 201 && invDef.body.company_id === def0.id, `Sin company_id → cae a default id ${def0.id} (got ${JSON.stringify(invDef.body && invDef.body.company_id)})`);

        const byCompany = await req('GET', `/api/inventories?company_id=${newId}`);
        assert(byCompany.status === 200 && Array.isArray(byCompany.body), 'GET ?company_id → 200 array');
        assert(byCompany.body.length === 1 && byCompany.body[0].id === invLinked.body.id, `Filtro company_id=${newId} devuelve SOLO el inventario de esa empresa (len=${byCompany.body.length})`);

        const byDefault = await req('GET', `/api/inventories?company_id=${def0.id}`);
        assert(byDefault.body.some(i => i.id === invDef.body.id), 'El inventario default aparece bajo la empresa default');

        // Huérfanos fuera del listado filtrado
        sbDb.prepare(`UPDATE inventories SET company_id = NULL WHERE id = ?`).run(invLinked.body.id);
        const orphanFiltered = await req('GET', `/api/inventories?company_id=${newId}`);
        assert(orphanFiltered.body.length === 0, 'Inventario con company_id NULL NO aparece en listado filtrado');
        const onlyWith = await req('GET', '/api/inventories?only_with_company=1');
        assert(!onlyWith.body.some(i => i.id === invLinked.body.id), '?only_with_company=1 excluye huérfanos');
        sbDb.prepare(`UPDATE inventories SET company_id = ? WHERE id = ?`).run(newId, invLinked.body.id); // restaurar

        // --- [5] PUT /api/companies/:id renombrar ---
        log('\n[5] PUT /api/companies/:id (renombrar)');
        const renamed = await req('PUT', `/api/companies/${newId}`, { name: 'QA Empresa Renombrada' });
        assert(renamed.status === 200 && renamed.body.name === 'QA Empresa Renombrada', `Renombre OK (got ${JSON.stringify(renamed.body && renamed.body.name)})`);

        // --- [6] Logo base64 ---
        log('\n[6] PUT /api/companies/:id/logo (base64)');
        const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const logoResp = await req('PUT', `/api/companies/${newId}/logo`, { logo: PNG_1PX });
        assert(logoResp.status === 200 && logoResp.body.logo && logoResp.body.logo.startsWith('/uploads/companies/'), `Logo guardado en ${logoResp.body && logoResp.body.logo}`);
        const logoFileOk = logoResp.body && logoResp.body.logo && fs.existsSync(path.join(SANDBOX_UPLOADS, logoResp.body.logo.replace('/uploads/', '')));
        assert(logoFileOk, 'Archivo de logo existe físicamente en uploads/companies/');
        const logoBad = await req('PUT', `/api/companies/${newId}/logo`, { logo: 'no-es-base64' });
        assert(logoBad.status === 400, `Base64 inválido rechazado con 400 (got ${logoBad.status})`);

        // --- [7] GET /api/companies refleja conteos ---
        log('\n[7] GET /api/companies con conteos');
        const listFinal = await req('GET', '/api/companies');
        const fin = listFinal.body.find(c => c.id === newId);
        assert(fin && fin.inventories_count === 1, `inventories_count de empresa nueva = 1 (got ${fin && fin.inventories_count})`);
        assert(listFinal.body.length === 2, `Total empresas = 2 (default + nueva), got ${listFinal.body.length}`);
        log(`  companies final: ${JSON.stringify(listFinal.body)}`);

        // --- [8] Producción ilesa ---
        log('\n[8] Producción ilesa (companies sin contaminar, conteos de inventories intactos):');
        const prodAfter = (() => {
            const d = new Database(PROD_DB, { readonly: true });
            const hasCompanies = !!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'").get();
            const r = {
                hasCompanies,
                companies: hasCompanies ? d.prepare('SELECT COUNT(*) c FROM companies').get().c : 0,
                companyNames: hasCompanies ? d.prepare('SELECT name FROM companies ORDER BY id').all().map(r => r.name) : [],
                inventories: d.prepare('SELECT COUNT(*) c FROM inventories').get().c,
                products: d.prepare('SELECT COUNT(*) c FROM products').get().c,
                sales: d.prepare('SELECT COUNT(*) c FROM sales').get().c,
            };
            d.close();
            return r;
        })();
        log(`  Producción después: ${JSON.stringify(prodAfter)}`);
        if (!prodAfter.hasCompanies) {
            log('  ℹ️ companies aún no existe en producción (se crea al reiniciar el server prod) — check diferido al restart final.');
        } else {
            assert(prodAfter.companies === prodBefore.companies, `companies producción intacto (${prodBefore.companies} → ${prodAfter.companies})`);
            assert(!prodAfter.companyNames.some(n => n.includes('QA')), 'Ninguna empresa QA se filtró a producción');
        }
        assert(prodAfter.inventories === prodBefore.inventories, `inventories producción intacto (${prodBefore.inventories} → ${prodAfter.inventories})`);
        // NOTA: producción está en 0 ventas/productos post-reset — NO se assertea >0 (consigna).

        sbDb.close();
    } finally {
        try { serverProc.kill(); } catch (e) {}
        await sleep(800);
        if (!NO_CLEANUP) {
            try { fs.rmSync(SANDBOX_DIR, { recursive: true, force: true }); log('\n🧹 Sandbox limpiado'); }
            catch (e) { log(`(sandbox no limpiado: ${e.message})`); }
        } else {
            log(`\n(sandbox preservado en ${SANDBOX_DIR})`);
        }
    }

    log('\n========== RESULTADO ==========');
    if (process.exitCode === 1) { log('❌ HAY FALLOS — revisar arriba'); process.exit(1); }
    log('✅ TODO OK — Fase Empresas verificada en SANDBOX (producción ilesa)\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
