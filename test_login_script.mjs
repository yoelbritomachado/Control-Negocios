import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(e => ({
        name: e.name,
        type: e.type,
        placeholder: e.placeholder,
        id: e.id,
        value: e.value
      }));
    });
    console.log('Inputs:', JSON.stringify(inputs, null, 2));

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(e => e.innerText.trim());
    });
    console.log('Buttons:', JSON.stringify(buttons, null, 2));
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

test();
