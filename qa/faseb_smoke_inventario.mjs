import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173';
const shots = [];
const pageErrors = [];
const consoleErrors = [];

async function main() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });

    console.log('== 1. LOGIN ==');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    const userInput = page.locator('input[name="username"]');
    await userInput.waitFor({ state: 'visible', timeout: 15000 });
    await userInput.fill('yoelbritomachado');
    await page.locator('input[name="password"]').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    console.log('URL post-login:', page.url());

    console.log('== 2. NAVEGAR A /inventario-valorizado ==');
    await page.goto(`${BASE}/inventario-valorizado`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Verificar secciones
    const checks = {};
    for (const [key, text] of [
        ['tabsNegocio', 'Negocio'],
        ['cardInventario', 'VENTAS POSIBLES'],
        ['cardConteo', 'CONTEO FÍSICO'],
        ['cardRebajas', 'REBAJAS Y AUMENTOS'],
        ['menuLateral', 'Inventario Valorizado'],
    ]) {
        try {
            const cnt = await page.getByText(text, { exact: false }).count();
            checks[key] = cnt > 0;
        } catch { checks[key] = false; }
    }
    console.log('CHECKS secciones:', JSON.stringify(checks));

    // Verificar tabs
    const tabMCH = await page.getByRole('button', { name: 'MCH', exact: true }).count();
    const tabTodo = await page.getByRole("button", { name: "Todo", exact: true }).count().catch(() => 'n/a');
    console.log('Tabs MCH count:', tabMCH);

    console.log('== 3. ALTERNAR TABS M&R → MCH → Todo → MCH ==');
    const cycle = async (label, exact) => {
        await page.getByRole('button', { name: label, exact }).first().click();
        await page.waitForTimeout(700);
        const active = await page.locator('button.bg-cyan-500\\/20, button.bg-violet-500\\/20').allInnerTexts();
        console.log(`Tab [${label}] activa:`, active.join(','));
    };
    await cycle('M&R', true);
    await cycle('MCH', true);
    await cycle('Todo', true);
    await cycle('MCH', true);

    await page.waitForTimeout(1200);
    const todoSedes = await page.getByText('M&R ·').count();
    console.log('Sedes M&R visibles en tab Todo:', todoSedes);
    await cycle('MCH', true);

    // Screenshot
    await page.screenshot({ path: 'qa/faseb_inventario.png', fullPage: true });
    shots.push('qa/faseb_inventario.png');
    console.log('Screenshot: qa/faseb_inventario.png');

    console.log('PAGEERRORS:', pageErrors.length, JSON.stringify(pageErrors));
    console.log('CONSOLE-ERRORS:', consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 5)));

    await browser.close();

    if (pageErrors.length > 0) {
        console.error('SMOKE FAILED: pageerrors > 0');
        process.exit(1);
    }
    const required = ['tabsNegocio', 'cardInventario', 'cardConteo', 'cardRebajas'];
    const failed = required.filter(k => !checks[k]);
    if (failed.length) {
        console.error('SMOKE FAILED: faltan secciones:', failed.join(','));
        process.exit(1);
    }
    console.log('SMOKE OK');
}

main().catch((e) => {
    console.error('SMOKE FAILED:', e.message);
    process.exit(1);
});
