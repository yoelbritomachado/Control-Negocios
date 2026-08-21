const { chromium } = require('C:/Users/Yoe_Laptop/AppData/Local/nvm/v24.16.0/node_modules/@playwright/mcp/node_modules/playwright');
const fs = require('fs');

(async () => {
    console.log("=== INICIANDO AUDITORÍA INTEGRAL DE NAVEGACIÓN Y FUNCIONALIDAD CRM ===");
    const browser = await chromium.launch({
        executablePath: "C:\\Users\\Yoe_Laptop\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
        headless: true
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleLogs = [];
    const pageErrors = [];

    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        consoleLogs.push(`[${type.toUpperCase()}] ${text}`);
    });

    page.on('pageerror', err => {
        pageErrors.push(`[UNCAUGHT] ${err.message}\n${err.stack}`);
    });

    const results = {
        routes: [],
        errors: [],
        warnings: [],
        interactiveTests: []
    };

    // 1. Cargar la página inicial
    try {
        console.log("1. Navegando a http://localhost:5173/ ...");
        await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
        results.routes.push({ url: '/', status: 'OK', title: await page.title() });
    } catch (e) {
        results.routes.push({ url: '/', status: 'FAIL', error: e.message });
    }

    // Setear usuario admin si es necesario o revisar estado de autenticación
    console.log("Configurando sesión de prueba para navegar rutas protegidas...");
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({
            id: 1,
            username: 'admin',
            name: 'Administrador',
            role: 'owner',
            token: 'mock-token'
        }));
        localStorage.setItem('current_inventory', 'mch1');
    });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Rutas principales a auditar
    const routesToTest = [
        { path: '/', label: 'Dashboard' },
        { path: '/inventario', label: 'Inventario' },
        { path: '/entradas', label: 'Entradas' },
        { path: '/traslados', label: 'Traslados' },
        { path: '/mermas', label: 'Mermas' },
        { path: '/usuarios', label: 'Usuarios' },
        { path: '/nexus', label: 'NexusNode' },
        { path: '/historial/traslados', label: 'Historial de Traslados y Entradas' },
        { path: '/historial/mermas', label: 'Historial de Mermas' },
        { path: '/configuracion', label: 'Configuración' },
        { path: '/admin/migracion', label: 'Migración' },
        // Rutas legacy o alias
        { path: '/historial-compras', label: 'Alias Historial Compras' },
        { path: '/historial/compras', label: 'Alias Historial Compras 2' }
    ];

    console.log("\n2. Auditando rutas principales y renderizado...");
    for (const r of routesToTest) {
        try {
            console.log(`- Probando ruta: ${r.path} (${r.label})`);
            await page.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle', timeout: 10000 });
            await page.waitForTimeout(1000);

            const bodyText = await page.evaluate(() => document.body.innerText);
            const isWhiteScreen = bodyText.trim().length === 0;
            const has404 = bodyText.includes('404') || bodyText.includes('Página no encontrada');
            const h1Text = await page.evaluate(() => document.querySelector('h1')?.innerText || 'No H1');

            results.routes.push({
                path: r.path,
                label: r.label,
                h1: h1Text,
                isWhiteScreen,
                has404,
                bodyLength: bodyText.length
            });
        } catch (e) {
            results.routes.push({
                path: r.path,
                label: r.label,
                error: e.message
            });
        }
    }

    // 3. Probar interactividad específica en /historial/traslados
    console.log("\n3. Probando interactividad específica del historial de traslados...");
    try {
        await page.goto('http://localhost:5173/historial/traslados', { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1500);

        const rowsCount = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
        console.log(`Filas detectadas en la tabla de historial: ${rowsCount}`);

        // Probar clic en la primera fila si existe para probar acordeón
        const accordionTest = await page.evaluate(async () => {
            const firstRow = document.querySelector('table tbody tr');
            if (!firstRow) return { success: false, reason: 'No rows' };

            const beforeText = document.body.innerText;
            firstRow.click();
            await new Promise(r => setTimeout(r, 600));
            const afterText = document.body.innerText;

            const hasDetails = afterText.includes('Total en Coste') || afterText.includes('Total en Venta') || afterText.includes('Total Unidades');
            return {
                success: true,
                hasDetails,
                expanded: afterText.length > beforeText.length,
                detailsFound: {
                    hasCost: afterText.includes('Total en Coste'),
                    hasSale: afterText.includes('Total en Venta'),
                    hasUnits: afterText.includes('Total Unidades')
                }
            };
        });

        results.interactiveTests.push({
            name: 'Acordeón de Traslados',
            ...accordionTest
        });
    } catch (e) {
        results.interactiveTests.push({
            name: 'Acordeón de Traslados',
            error: e.message
        });
    }

    // 4. Probar navegación a Traslados y modo edición
    console.log("\n4. Probando modo edición de traslados...");
    try {
        await page.goto('http://localhost:5173/traslados?edit=1', { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1500);

        const editModeState = await page.evaluate(() => {
            return {
                h1: document.querySelector('h1')?.innerText,
                hasEditBadge: document.body.innerText.includes('Modo Edición'),
                hasCancelBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Cancelar Edición')),
                inputsCount: document.querySelectorAll('input, select').length
            };
        });

        results.interactiveTests.push({
            name: 'Modo Edición en /traslados',
            ...editModeState
        });
    } catch (e) {
        results.interactiveTests.push({
            name: 'Modo Edición en /traslados',
            error: e.message
        });
    }

    results.consoleLogs = consoleLogs;
    results.pageErrors = pageErrors;

    fs.writeFileSync('D:/mch_crm_full/audit_report.json', JSON.stringify(results, null, 2));
    console.log("\nAuditoría completa guardada en D:/mch_crm_full/audit_report.json");

    await browser.close();
})();
