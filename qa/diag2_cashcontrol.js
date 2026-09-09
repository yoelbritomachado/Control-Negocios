// ¿Por qué DefinitiveControl no renderiza si data.bags existe?
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 150)); });

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

    // Estado de React vía el store de la página: buscar si hay error visible en la card
    const info = await page.evaluate(() => {
        const t = document.body.innerText;
        const errIdx = t.search(/error|fall|invalid|cannot/i);
        // número de glass-cards
        const cards = document.querySelectorAll('.glass-card').length;
        // último texto de la página
        return { errSnippet: errIdx >= 0 ? t.slice(Math.max(0, errIdx - 80), errIdx + 120) : null, cards, tail: t.slice(-500) };
    });
    console.log('PAGEERRORS:', errors.length ? errors.slice(0, 5) : 'NINGUNO');
    console.log('glass-cards:', info.cards);
    console.log('errSnippet:', info.errSnippet || '(ninguno visible)');
    console.log('=== TAIL de la página ===');
    console.log(info.tail);
    await browser.close();
})();
