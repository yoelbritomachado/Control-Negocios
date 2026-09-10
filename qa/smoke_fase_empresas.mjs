/**
 * Smoke headless — Fase Empresas: selector Empresa + flechita (FRONTEND).
 * NO endpoints destructivos. Login yoelbritomachado / 1234.
 */
import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    // 1. Login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input[name="username"]').fill('yoelbritomachado');
    await page.locator('input[name="password"]').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    console.log('LOGIN_OK');
    await page.waitForTimeout(2000);

    // 2. Selector Empresa visible ENCIMA de Inventario Activo
    const compSel = page.locator('[data-testid="company-selector"]');
    await compSel.waitFor({ state: 'visible', timeout: 10000 });
    const invSel = page.locator('text=Inventario Activo').first();
    const compBox = await compSel.boundingBox();
    const invBox = await invSel.boundingBox();
    console.log('COMPANY_ABOVE_INVENTORY=' + (compBox && invBox ? (compBox.y < invBox.y) : 'n/a'));

    // 3. Desplegar selector de empresa
    await page.locator('[data-testid="company-selector-toggle"]').click();
    await page.waitForTimeout(600);
    const createCompanyBtn = page.locator('[data-testid="create-company-button"]');
    const ctaVisible = await createCompanyBtn.isVisible().catch(() => false);
    console.log('CREATE_COMPANY_CTA_VISIBLE=' + ctaVisible);
    await page.screenshot({ path: 'qa/empresas_selector_abierto.png' });

    // Abrir mini-form de crear empresa (sin crear)
    if (ctaVisible) {
        await createCompanyBtn.click();
        const dlg = page.locator('[data-testid="create-company-dialog"]');
        await dlg.waitFor({ state: 'visible', timeout: 5000 });
        console.log('CREATE_COMPANY_DIALOG_OK');
        await page.screenshot({ path: 'qa/empresas_create_form.png' });
        await dlg.locator('button[aria-label="Cerrar"]').click();
        await page.waitForTimeout(400);
        await page.locator('[data-testid="company-selector-toggle"]').click(); // cerrar despliegue
        await page.waitForTimeout(400);
    }

    // 4. Desplegar inventarios: estado vacío post-reset (sin MCH fantasma)
    await page.getByText('Inventario Activo').first().click();
    await page.waitForTimeout(600);
    const bodyText = await page.locator('[data-testid="company-selector"]').innerText();
    const emptyInv = await page.locator('[data-testid="empty-inventories"]').isVisible().catch(() => false);
    const mchGhost = bodyText.includes('MCH1') || bodyText.includes('MCH2');
    console.log('EMPTY_INV_VISIBLE=' + emptyInv + ' GHOST_MCH=' + mchGhost);
    await page.screenshot({ path: 'qa/empresas_inventario_dropdown.png' });
    await page.getByText('Inventario Activo').first().click(); // cerrar
    await page.waitForTimeout(400);

    // 5. FIX flechita: capturar antes/después
    const arrow = page.locator('aside button:has(svg.lucide-chevron-left), aside button:has(svg.lucide-chevron-right)').first();
    const dashVisible = () => page.locator('aside :text("Dashboard")').first().isVisible().catch(() => false);
    await page.screenshot({ path: 'qa/flechita_antes.png' });
    const labelBefore = await dashVisible();
    await arrow.evaluate(el => el.click());
    await page.waitForTimeout(800);
    const labelCollapsed = await dashVisible();
    await arrow.evaluate(el => el.click());
    await page.waitForTimeout(800);
    const labelExpanded = await dashVisible();
    await page.screenshot({ path: 'qa/flechita_despues.png' });
    console.log(`FLECHITA texto_antes=${labelBefore} colapsado=${labelCollapsed} texto_vuelve=${labelExpanded} TOGGLE_OK=${labelBefore && !labelCollapsed && labelExpanded}`);

    console.log('PAGE_ERRORS=' + pageErrors.length);
    if (pageErrors.length) console.log('ERRORS: ' + pageErrors.join(' | '));
    await browser.close();
    console.log('SMOKE_DONE');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
