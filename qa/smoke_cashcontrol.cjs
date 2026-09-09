const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Bypass UI login: inyectar sesión directamente en localStorage (login API verificado por HTTP)
  const session = await fetch('http://localhost:3002/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'yoelbritomachado', pin: '1234' }),
  }).then(r => r.json());
  if (!session.token) { console.log('LOGIN_API_FAIL', JSON.stringify(session)); }
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.setItem('session_token', s.token);
    localStorage.setItem('mch_user_data', JSON.stringify(s.user));
  }, session);
  console.log('SESSION_INJECTED url=', page.url());

    await page.goto('http://localhost:5173/control-efectivo', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const text = await page.textContent('body');
  console.log('PAGE_HAS_TITLE=', /Control de Efectivo/i.test(text));
  console.log('HAS_DELIVERIES_CARD=', /Entregas de Efectivo/i.test(text));
  console.log('HAS_USA_CARD=', /Efectivo Entregado en USA/i.test(text));
  console.log('HAS_SALARY_CARD=', /Salario Admin/i.test(text));
  console.log('HAS_WAGES_CARD=', /Auditor[íi]a Salarios/i.test(text));

  // Alternar tabs MCH | M&R | Todo (scoped a botones de tabs de negocio en la card de filtros)
  const tabsContainer = page.locator('div.glass-card').filter({ hasText: 'Negocio' }).first();
  for (const label of ['M&R', 'MCH', 'Todo', 'MCH']) {
    const btn = tabsContainer.locator('button', { hasText: label }).first();
    try {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      console.log(`CLICKED_TAB_${label.replace('&','AND')} ok`);
    } catch (err) {
      console.log(`CLICKED_TAB_${label.replace('&','AND')} FAIL ${err.message.split('\n')[0]}`);
    }
  }

  console.log('PAGEERRORS=', JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS_COUNT=', consoleErrors.length);
  if (consoleErrors.length) console.log('CONSOLE_ERRORS_HEAD=', JSON.stringify(consoleErrors.slice(0, 5)));
  await page.screenshot({ path: 'smoke_cashcontrol.png', fullPage: false });
  await browser.close();
  process.exit(pageErrors.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
