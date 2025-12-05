import { chromium } from 'playwright';

async function testWebApp() {
  console.log('Starting web app test...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');

    console.log('Page loaded, waiting for automation test to complete...');

    // Wait for the automation test to run (it starts after 500ms)
    await page.waitForTimeout(15000); // Wait 15 seconds for AI agent to complete

    // Check if there's an alert (success/failure message)
    const alertPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    const alert = await alertPromise;

    if (alert) {
      console.log(`[ALERT] ${alert.message()}`);
      await alert.dismiss();
    }

    // Take a screenshot for verification
    await page.screenshot({ path: 'test_result.png', fullPage: true });
    console.log('Screenshot saved as test_result.png');

    console.log('Test completed successfully');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testWebApp().catch(console.error);