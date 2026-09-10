
import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173';
async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input[name="username"]').fill('yoelbritomachado');
    await page.locator('input[name="password"]').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    await page.goto(`${BASE}/inventario-valorizado`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    const yellowInputs = await page.locator('input').evaluateAll(
        els => els.filter(e => {
            const bg = getComputedStyle(e).backgroundColor;
            return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)' && bg.includes('255, 255, 204');
        }).length
    );
    const facts = {
        url: page.url(),
        hasTitulo: body.includes('Inventario Valorizado'),
        hasVentasPosibles: body.includes('Ventas Posibles'),
        hasConteoFisico: body.includes('Conteo Fisico por Sede') || body.includes('CONTEO FÍSICO'),
        hasRebajas: body.includes('Rebajas y Aumentos'),
        hasParenVacio: body.includes('a precio de venta ()'),
        yellowInputs,
        tabMCH: await page.getByRole('button', { name: 'MCH', exact: true }).count(),
        tabTodo: await page.getByRole('button', { name: 'Todo', exact: true }).count(),
        menuEntrada: await page.getByRole('link', { name: 'Inventario Valorizado' }).count(),
        pageErrors: pageErrors.length,
    };
    console.log('FACTS ' + JSON.stringify(facts));
    // capturar las lines del subtitulo de Ventas Posibles
    const lines = body.split('\n').filter(l => l.includes('precio de venta'));
    console.log('SUBTITULO ' + JSON.stringify(lines));
    await browser.close();
    console.log('DOM SMOKE DONE');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
