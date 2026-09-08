import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/J work/Trading/node_modules/playwright');

async function testLogin() {
  console.log('🚀 Iniciando Playwright para testear Login...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('📍 Navegando a http://localhost:5173/login ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

    console.log('📄 Título:', await page.title());
    console.log('🔗 URL actual:', page.url());

    // Capturar inputs
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(e => ({
        placeholder: e.placeholder,
        type: e.type,
        name: e.name,
        id: e.id,
        className: e.className
      }));
    });
    console.log('📥 Inputs encontrados:', inputs);

    // Capturar botones
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(e => ({
        text: e.innerText.trim(),
        type: e.type
      }));
    });
    console.log('🔘 Botones encontrados:', buttons);

    // Tomar screenshot de la pantalla de login
    await page.screenshot({ path: 'D:/mch_crm_full/login_page_preview.png' });
    console.log('📸 Screenshot guardado en D:/mch_crm_full/login_page_preview.png');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('🏁 Fin del test inicial.');
  }
}

testLogin();
