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
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Todo', exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'faseb_inventario_todo.png', fullPage: true });
    const sedesMR = await page.getByText('M&R ·').count();
    console.log('Sedes M&R visibles en tab Todo:', sedesMR, '| pageerrors:', pageErrors.length);
    await browser.close();
    console.log('SHOT TODO OK');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
