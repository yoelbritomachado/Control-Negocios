// Verificación del fix CashControlPage: login + navegar a /cash-control
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    // Login
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const inputs = await page.locator('input').all();
    let filledUser = false;
    for (const inp of inputs) {
        const type = (await inp.getAttribute('type') || '').toLowerCase();
        const name = (await inp.getAttribute('name') || '').toLowerCase();
        const ph = (await inp.getAttribute('placeholder') || '').toLowerCase();
        if (!filledUser && (type === 'text' || type === 'email' || name.includes('user'))) {
            await inp.fill('yoelbritomachado');
            filledUser = true;
        } else if (type === 'password' || name.includes('pin') || ph.includes('pin')) {
            await inp.fill('1234');
        }
    }
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    // Control de Efectivo (ruta real en App.jsx: /control-efectivo)
    await page.goto('http://localhost:5173/control-efectivo', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const rootLen = await page.evaluate("document.getElementById('root')?.innerHTML?.length || 0");
    const text = await page.evaluate("document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 1200)");
    console.log('PAGEERRORS:', errors.length ? errors.slice(0, 3) : 'NINGUNO');
    console.log('ROOT HTML LEN:', rootLen);
    console.log('--- PAGINA ---');
    console.log(text);
    await browser.close();
    process.exit(errors.some(e => e.includes('Icon')) ? 1 : 0);
})();
