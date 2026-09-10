/**
 * Smoke headless — Fase Reset de Fábrica (FRONTEND).
 * SOLO NAVEGACIÓN: verifica que el diálogo del reset aparece y que el botón '+'
 * del selector de inventario existe. NO confirma el reset, NO hace POST destructivo.
 */
import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    // 1. Login (yoelbritomachado / 1234)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input[name="username"]').fill('yoelbritomachado');
    await page.locator('input[name="password"]').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    console.log('LOGIN_OK');

    // 2. Configuración → botón Reset de Fábrica → diálogo (sin confirmar)
    await page.goto(`${BASE}/configuracion`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const resetBtn = page.locator('[data-testid="factory-reset-button"]');
    await resetBtn.waitFor({ state: 'visible', timeout: 10000 });
    await resetBtn.click();
    const dialog = page.locator('[data-testid="factory-reset-dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1500); // dar tiempo al GET /backups/last
    const dialogText = await dialog.innerText();
    const hasBackupQuestion = dialogText.includes('¿Querés hacer un backup?');
    await page.screenshot({ path: 'qa/factory_reset_dialog.png' });
    console.log('DIALOG_OK backupQuestion=' + hasBackupQuestion);
    console.log('DIALOG_TEXT=' + dialogText.slice(0, 200).replace(/\n/g, ' | '));
    // Cerrar diálogo SIN confirmar nada
    await page.locator('[data-testid="factory-reset-dialog"] button[aria-label="Cerrar"]').click();

    // 3. Selector de inventario → botón '+'
    const invToggle = page.getByText('Inventario Activo').first();
    await invToggle.click();
    await page.waitForTimeout(600);
    const plusBtn = page.locator('[data-testid="create-inventory-button"]');
    const plusVisible = await plusBtn.isVisible().catch(() => false);
    console.log('PLUS_BUTTON_VISIBLE=' + plusVisible);
    // Abrir el formulario del '+' (verificar que aparece) — solo abrir, NO crear
    if (plusVisible) {
        await plusBtn.click();
        const form = page.locator('[data-testid="create-inventory-dialog"]');
        await form.waitFor({ state: 'visible', timeout: 5000 });
        const formText = await form.innerText();
        console.log('FORM_OK tieneTipoPV=' + formText.includes('Punto de Venta') + ' tieneAlmacen=' + formText.includes('Almacén'));
        await page.screenshot({ path: 'qa/create_inventory_form.png' });
        await form.locator('button[aria-label="Cerrar"]').click();
    }

    console.log('PAGE_ERRORS=' + pageErrors.length);
    if (pageErrors.length) console.log('ERRORS: ' + pageErrors.join(' | '));
    await browser.close();
    console.log('SMOKE_DONE');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });