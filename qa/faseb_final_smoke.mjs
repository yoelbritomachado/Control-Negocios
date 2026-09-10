
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
    // ciclo completo de tabs con captura de pageerrors
    const cycle = async (label) => {
        await page.getByRole('button', { name: label, exact: true }).first().click();
        await page.waitForTimeout(800);
        const body = await page.evaluate(() => document.body.innerText);
        return {
            hasVentas: body.toUpperCase().includes('VENTAS POSIBLES'),
            hasRebajas: body.toUpperCase().includes('REBAJAS Y AUMENTOS'),
            hasConteo: body.toUpperCase().includes('CONTEO FÍSICO') || body.toUpperCase().includes('CONTEO FISICO'),
            hasTotales: body.toUpperCase().includes('TOTALES POR NEGOCIO'),
        };
    };
    const facts = {};
    facts['M&R'] = await cycle('M&R');
    facts['MCH'] = await cycle('MCH');
    facts['Todo'] = await cycle('Todo');
    const bodyFinal = await page.evaluate(() => document.body.innerText);
    const parenVacio = bodyFinal.includes('a precio de venta ()');
    console.log('FACTS ' + JSON.stringify({ facts, parenVacio, pageErrors: pageErrors.length }));
    // ultimo screenshot final tras ciclo completo (tab Todo activa)
    await page.screenshot({ path: 'qa/faseb_inventario_final.png', fullPage: true });
    await browser.close();
    console.log('FINAL SMOKE DONE');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
