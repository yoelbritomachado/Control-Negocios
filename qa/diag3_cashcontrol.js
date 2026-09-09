// Diagnóstico: captura de la página completa + respuesta API tal cual la recibe el front
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let apiBody = null;
    page.on('response', async r => {
        if (r.url().includes('/api/cash-control') && r.status() === 200) {
            try { apiBody = await r.json(); } catch {}
        }
    });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

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

    console.log('PAGEERRORS:', errors.length ? errors.slice(0, 3) : 'NINGUNO');
    console.log('=== API que recibió el front ===');
    if (apiBody) {
        console.log('keys:', Object.keys(apiBody));
        console.log('bags presente:', !!apiBody.bags);
        if (apiBody.bags) console.log('bolsas:', Object.keys(apiBody.bags));
        if (apiBody.error) console.log('ERROR del API:', apiBody.error);
    } else {
        console.log('(ninguna llamada 200 capturada)');
    }
    await browser.close();
})();
