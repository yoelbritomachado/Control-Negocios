// helper reutilizable: login + switch a MCH1 + ir al POS
const path = 'C:/Users/Yoe_Laptop/AppData/Local/nvm/v24.16.0/node_modules/@playwright/mcp/node_modules/playwright';
const { chromium } = require(path);
const EXE = 'C:/Users/Yoe_Laptop/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const fs = require('fs');

function save(name, text) { fs.writeFileSync(`D:/mch_crm_full/qa/${name}`, text); }
function log(status, scenario, detail) { console.log(`[${status}] ${scenario}: ${detail}`); }

async function launch() {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.consoleMsgs = [];
  page.on('pageerror', e => page.errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.consoleMsgs.push(m.text().slice(0, 300)); });
  return { browser, ctx, page };
}

async function loginMch1(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.fill('input[name=username]', 'yoelbritomachado');
  await page.fill('input[name=password]', '1234');
  await page.press('input[name=password]', 'Enter');
  await page.waitForTimeout(3000);
  // switch a MCH1 (dispara el handler React)
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.offsetParent && e.textContent.trim() === 'MCH1' && e.children.length === 0);
    const btn = el && (el.closest('button') || el);
    btn && btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return page;
}

module.exports = { launch, loginMch1, save, log };
