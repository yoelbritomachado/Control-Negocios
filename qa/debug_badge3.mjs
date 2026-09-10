import { chromium } from 'file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.locator('input[name="username"]').fill('yoelbritomachado');
await page.locator('input[name="password"]').fill('1234');
await page.locator('button[type="submit"]').click();
await page.waitForURL(`${BASE}/`);
await page.waitForTimeout(2500);
// La DB ahora tiene qa_pos + qa_almacen (creados en smoke 19:35). Abrir dropdown.
const toggle = page.locator('[data-testid="inventory-selector-toggle"]');
await toggle.click({ force: true });
await page.waitForTimeout(1000);
const badges = await page.locator('[data-testid="badge-sin-empresa"]').count();
console.log('badges:', badges);
const optTexts = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="inventory-selector-toggle"]');
  const parent = el && el.closest('div.relative');
  return parent ? [...parent.querySelectorAll('button')].map(b => b.innerText.replace(/\s+/g,' ').trim()) : [];
});
console.log('buttons:', JSON.stringify(optTexts));
await browser.close();
