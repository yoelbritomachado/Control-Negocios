import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.locator('input[name="username"]').fill('yoelbritomachado');
await page.locator('input[name="password"]').fill('1234');
await page.locator('button[type="submit"]').click();
await page.waitForURL(`${BASE}/`);
await page.waitForTimeout(2000);
// abrir dropdown de inventarios
const toggle = page.locator('[data-testid="inventory-selector-toggle"]');
console.log('toggle count', await toggle.count());
await toggle.click({ force: true });
await page.waitForTimeout(800);
const badges = await page.locator('[data-testid="badge-sin-empresa"]').count();
console.log('badges count:', badges);
if (badges > 0) console.log('badge visible:', await page.locator('[data-testid="badge-sin-empresa"]').first().isVisible());
// dump de buttons del dropdown para ver estructura
const buttons = await page.locator('[data-testid="inventory-option"]').count();
console.log('inventory-option count:', buttons);
await page.screenshot({ path: 'qa/badge_debug.png' });
await browser.close();
