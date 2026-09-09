// Verificación FINAL: login → /control-efectivo → validar tabla de bolsas visible
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

    const res = await page.evaluate(() => {
        const t = document.body.innerText;
        const grab = (needle, len) => {
            const i = t.indexOf(needle);
            return i >= 0 ? t.slice(i, i + len) : null;
        };
        return {
            hasControlDefinitivo: t.includes('Control Definitivo'),
            hasSaldoMesAnterior: t.includes('Saldo Mes Anterior'),
            hasEfectivoReal: /Efectivo Real/i.test(t),
            mnRow: grab('MN\n', 80),
            usdRow: grab('USD\n', 60),
            transferRow: grab('Transferencias\n', 60),
            diffSection: grab('EFECTIVO REAL', 120),
        };
    });
    console.log('PAGEERRORS:', errors.length ? errors.slice(0, 3) : 'NINGUNO');
    console.log('Control Definitivo visible:', res.hasControlDefinitivo);
    console.log('Columna "Saldo Mes Anterior":', res.hasSaldoMesAnterior);
    console.log('Sección Efectivo Real vs Diff:', res.hasEfectivoReal);
    console.log('Fila MN:', res.mnRow ? res.mnRow.replace(/\n/g, ' | ') : 'NO VISTA');
    console.log('Fila USD:', res.usdRow ? res.usdRow.replace(/\n/g, ' | ') : 'NO VISTA');
    console.log('Fila Transferencias:', res.transferRow ? res.transferRow.replace(/\n/g, ' | ') : 'NO VISTA');
    await browser.close();
})();
