import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/J work/Trading/node_modules/playwright');

async function runLoginTest() {
  console.log('🏁 Iniciando suite de pruebas de Login con Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Escuchar logs y errores de consola del navegador
  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser PageError]:', err.message));

  try {
    // 1. Navegar a /login
    console.log('\n--- TEST 1: Carga de página de Login ---');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    console.log('✅ URL cargada:', page.url());

    // 2. Test intento de login con credenciales inválidas
    console.log('\n--- TEST 2: Intento con credenciales erróneas ---');
    await page.fill('input[name="username"]', 'usuario_inexistente_123');
    await page.fill('input[name="password"]', '9999');
    
    // Clic en Iniciar Sesión
    const loginButton = page.locator('button:has-text("Iniciar Sesión"), button[type="submit"]:has-text("Iniciar")').first();
    await loginButton.click();
    await page.waitForTimeout(1000);

    const errorMessage = await page.evaluate(() => {
      const el = document.querySelector('.bg-rose-500\\/10, .text-rose-400, .text-red-400, [role="alert"]');
      return el ? el.innerText.trim() : null;
    });
    console.log('ℹ️ Mensaje de error recibido:', errorMessage);

    // 3. Test de login con usuario admin/owner de prueba o verificación de campos
    console.log('\n--- TEST 3: Interacción de formulario y modo PIN ---');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', '1234');
    await page.screenshot({ path: 'D:/mch_crm_full/login_filled_test.png' });
    console.log('📸 Captura de formulario completado guardada en login_filled_test.png');

    console.log('\n✨ Test suite ejecutado exitosamente.');

  } catch (error) {
    console.error('❌ Error en el test de Playwright:', error);
  } finally {
    await browser.close();
  }
}

runLoginTest();
