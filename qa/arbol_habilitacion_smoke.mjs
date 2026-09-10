/**
 * Smoke headless — Árbol de habilitación post-reset (docs/FASE_ARBOL_HABILITACION.md).
 * Estados capturados:
 *  1) Post-reset: selector inventario disabled (gris + tooltip) + '+' habilitado + CTA Crear empresa.
 *  2) Crear 'QA POS' (kiosk) → auto-seleccionado → POS/Productos habilitados → Traslados locked (1 inv).
 *  3) Crear 'QA Almacén' → Traslados habilitado.
 *  4) Al terminar: inventarios de prueba se borran por SQL (fuera de este script) → GET [].
 *  5) pageerrors = 0.
 */
import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = 'http://localhost:5173';
const results = {};
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => pageErrors.push(String(err)));

// --- Login ---
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type="text"], input[name="username"]', 'yoelbritomachado');
await page.fill('input[type="password"], input[name="pin"]', '1234');
await page.keyboard.press('Enter');
await page.waitForURL(u => !String(u).includes('/login'), { timeout: 15000 });
await page.waitForTimeout(2500);
results.loggedIn = !page.url().includes('/login');

// --- 1) Estado post-reset ---
await page.waitForTimeout(1500);
const invToggle = page.locator('[data-testid="inventory-selector-toggle"]');
results.invSelectorDisabled = (await invToggle.getAttribute('data-disabled')) === 'true';
results.invTooltip = await invToggle.getAttribute('title');
// '+' habilitado: abrir el despliegue (permitido aunque grey) y ver el botón crear
await invToggle.click({ force: true });
await page.waitForTimeout(600);
results.plusEnabled = await page.locator('[data-testid="create-inventory-button"]').isVisible();
// CTA Crear empresa visible
await page.locator('[data-testid="company-selector-toggle"]').click();
await page.waitForTimeout(600);
results.createCompanyCTA = await page.locator('[data-testid="create-company-button"]').isVisible();
results.companyEmptyLabel = await page.locator('[data-testid="company-selector-toggle"]').innerText();

// Entrada directa por URL a POS sin inventario → empty-state (no crash)
await page.goto(BASE + '/pos', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
results.posEmptyState = await page.getByText('Seleccioná un inventario primero').first().isVisible().catch(() => false);
await page.goto(BASE + '/inventario', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
results.invPageEmptyState = await page.getByText('Seleccioná un inventario primero').first().isVisible().catch(() => false);
await page.goto(BASE + '/traslados', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
results.transfersEmptyState = await page.getByText('Necesitás al menos 2 inventarios').first().isVisible().catch(() => false);

// --- 2) Crear 'QA POS' (kiosk) ---
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('[data-testid="inventory-selector-toggle"]').click({ force: true });
await page.locator('[data-testid="create-inventory-button"]').click();
await page.waitForTimeout(600);
await page.fill('#create-inventory-dialog input[type="text"], form input[type="text"]', 'QA POS');
// tipo kiosk ya es default; buscar botón "Crear" del dialog
await page.locator('[data-testid="create-inventory-dialog"] button[type="submit"]').click();
await page.waitForTimeout(2500);

// Verificar auto-selección y habilitación
results.qaPosLabel = (await page.locator('[data-testid="inventory-selector-toggle"]').innerText()).replace(/\s+/g, ' ').trim();
await page.waitForTimeout(800);
const navPos = page.locator('[data-testid="nav-pos"]');
const navInv = page.locator('[data-testid="nav-inventory"]');
const navTr = page.locator('[data-testid="nav-traslados"]');
results.posUnlockedAfter1 = (await navPos.getAttribute('data-locked')) === 'false';
results.inventoryUnlockedAfter1 = (await navInv.getAttribute('data-locked')) === 'false';
results.transfersLockedAfter1 = (await navTr.getAttribute('data-locked')) === 'true';
results.transfersTooltip1 = await navTr.getAttribute('title');
// badge 'Sin empresa' (C): abrir dropdown para verlo (el activo tiene company_id null)
await page.locator('[data-testid="inventory-selector-toggle"]').click({ force: true });
await page.waitForTimeout(600);
results.badgeSinEmpresa = await page.locator('[data-testid="badge-sin-empresa"]').first().isVisible().catch(() => false);
await page.locator('[data-testid="inventory-selector-toggle"]').click({ force: true }); // cerrar
await page.waitForTimeout(400);
results.localStorageInventory = await page.evaluate(() => localStorage.getItem('mch_inventory'));

// --- 3) Crear 'QA Almacén' ---
await page.locator('[data-testid="inventory-selector-toggle"]').click({ force: true });
await page.locator('[data-testid="create-inventory-button"]').click();
await page.waitForTimeout(600);
await page.fill('form input[type="text"]', 'QA Almacén');
await page.locator('[data-testid="create-inventory-dialog"] button:has-text("No vende")').click();
await page.locator('[data-testid="create-inventory-dialog"] button[type="submit"]').click();
await page.waitForTimeout(2500);
results.transfersUnlockedAfter2 = (await page.locator('[data-testid="nav-traslados"]').getAttribute('data-locked')) === 'false';
results.usuariosAlwaysEnabled = (await page.locator('[data-testid="nav-users"]').getAttribute('data-locked')) === 'false';
results.pageErrors = pageErrors.length;

fs.writeFileSync('D:/mch_crm_full/qa/arbol_habilitacion_smoke.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
