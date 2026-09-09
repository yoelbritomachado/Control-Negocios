// Verificación de la tabla de Bolsas de Moneda (fix Icon crash)
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

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

    await page.goto('http://localhost:5173/control-efectivo', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Buscar la tabla de bolsas y su contenido
    const res = await page.evaluate(() => {
        const t = document.body.innerText;
        const idx = t.indexOf('Bolsas');
        return {
            hasBolsas: idx >= 0,
            bolsasSection: idx >= 0 ? t.slice(idx, idx + 700) : '(no encontrado "Bolsas")',
            hasEfectivoReal: /efectivo real/i.test(t),
            hasDiff: /\bdiff\b/i.test(t) || /diferencia/i.test(t),
        };
    });
    console.log('PAGEERRORS:', errors.length ? errors.slice(0, 3) : 'NINGUNO');
    console.log('hasBolsas:', res.hasBolsas, '| hasEfectivoReal:', res.hasEfectivoReal, '| hasDiff:', res.hasDiff);
    console.log('--- SECCION BOLSAS ---');
    console.log(res.bolsasSection);
    await browser.close();
    process.exit(0);
})();
