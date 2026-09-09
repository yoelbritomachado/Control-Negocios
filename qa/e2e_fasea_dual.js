// E2E final Fase A: dual-block Control de Efectivo con backend vivo
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 120)));

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const inputs = await page.locator('input').all();
    let fu = false;
    for (const inp of inputs) {
        const t = (await inp.getAttribute('type') || '').toLowerCase();
        const n = (await inp.getAttribute('name') || '').toLowerCase();
        if (!fu && (t === 'text' || t === 'email' || n.includes('user'))) { await inp.fill('yoelbritomachado'); fu = true; }
        else if (t === 'password' || n.includes('pin')) await inp.fill('1234');
    }
    const btn = page.locator('button[type=submit]').first();
    if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    await page.goto('http://localhost:5173/control-efectivo', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);

    const read = async (label) => {
        const t = await page.evaluate(() => document.body.innerText);
        const grab = (needle, len) => { const i = t.indexOf(needle); return i >= 0 ? t.slice(i, i + len).replace(/\n/g, ' | ') : null; };
        console.log(`--- ${label} ---`);
        console.log('  Bolsas:', /CONTROL DEFINITIVO/i.test(t) ? '✓' : '✗');
        console.log('  MN row:', (grab('MN\t', 90) || grab('MN\n', 90) || 'NO VISTA').slice(0, 90));
        console.log('  Entregas card:', /ENTREGAS DE EFECTIVO/i.test(t) ? '✓' : '✗');
        console.log('  USA card:', /EFECTIVO ENTREGADO EN USA/i.test(t) ? '✓' : '✗');
        console.log('  Salario Admin:', /SALARIO ADMIN/i.test(t) ? '✓' : '✗');
        console.log('  Auditoría:', /AUDITORÍA SALARIOS/i.test(t) ? '✓' : '✗');
        console.log('  Diff salarios visible:', /Diff/i.test(t) ? '✓' : '—');
    };

    await read('TAB MCH (default)');
    await page.screenshot({ path: '../qa/fasea_mch.png' });

    // Cambiar a M&R
    const mrTab = page.locator('button:has-text("M&R")').first();
    if (await mrTab.count()) { await mrTab.click(); await page.waitForTimeout(2500); await read('TAB M&R'); }
    await page.screenshot({ path: '../qa/fasea_mr.png' });

    // Volver a Todo
    const todoTab = page.locator('button:has-text("Todo")').first();
    if (await todoTab.count()) { await todoTab.click(); await page.waitForTimeout(2000); await read('TAB Todo'); }

    console.log('PAGEERRORS:', errors.length ? errors : 'NINGUNO');
    await browser.close();
})();