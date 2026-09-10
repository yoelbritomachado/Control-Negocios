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
// dump: estructura de inventarios: qué aparece al abrir
const toggle = page.locator('[data-testid="inventory-selector-toggle"]');
await toggle.click({ force: true });
await page.waitForTimeout(900);
// dump html completo del contenedor del selector
const html = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="inventory-selector-toggle"]');
  let parent = el ? el.closest('div.relative') : null;
  return parent ? parent.innerHTML.slice(0, 4000) : 'NO PARENT';
});
console.log(html);
await browser.close();
