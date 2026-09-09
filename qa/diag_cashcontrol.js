// Diagnóstico profundo: red + DOM completo en /control-efectivo
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const apiCalls = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', async r => {
        if (r.url().includes('/api/cash-control')) {
            let body = '(sin cuerpo)';
            try { body = (await r.text()).slice(0, 300); } catch {}
            apiCalls.push({ status: r.status(), url: r.url().slice(0, 120), body });
        }
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const inputs = await page.locator('input').all();
    let filledUser = false;
    for (const inp of inputs) {
        const type = (await inp.getAttribute('type') || '').toLowerCase();
        const name = (await inp.getAttribute('name') || '').toLowerCase();
        if (!filledUser && (type === 'text' || type === 'email' || name.includes('user'))) {
            await inp.fill('yoelbritomachado');
            filledUser = true;
        } else if (type === 'password' || name.includes('pin')) {
            await inp.fill('1234');
        }
    }
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    await page.goto('http://localhost:5173/control-efectivo', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);

    const full = await page.evaluate(() => document.body.innerText);
    console.log('=== API CALLS ===');
    apiCalls.forEach(c => console.log(`[${c.status}] ${c.url}\n   body: ${c.body.slice(0, 200)}`));
    console.log('=== PAGEERRORS ===', errors.length ? errors.slice(0, 3) : 'NINGUNO');
    console.log('=== ¿Contiene? ===');
    ['Bolsas de Moneda', 'Control Definitivo', 'Saldo Mes Anterior', 'Efectivo Real', 'Diferencia'].forEach(k => {
        console.log(`  "${k}":`, full.includes(k));
    });
    const i = full.indexOf('Control Definitivo');
    console.log('=== TEXTO desde Control Definitivo ===');
    console.log(i >= 0 ? full.slice(i, i + 900) : '(sección no presente)');
    await browser.close();
})();
