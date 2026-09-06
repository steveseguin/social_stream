const path = require('path');
const { chromium } = require('playwright');

const PAGE_PATH = path.join(process.cwd(), 'cohost.html');
const PAGE_URL = `file:///${PAGE_PATH.replace(/\\/g, '/')}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (message) => {
      consoleMessages.push(message.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#providerSelect');

    const result = await page.evaluate(async () => {
      const output = {
        created: false,
        asyncError: '',
        syncError: '',
        protocol: window.location.protocol
      };

      try {
        const worker = createLocalBrowserWorker();
        output.created = true;
        const errorPromise = new Promise((resolve) => {
          worker.addEventListener('error', (event) => {
            resolve(event?.message || 'worker error');
          }, { once: true });
        });
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve(''), 1200);
        });
        output.asyncError = await Promise.race([errorPromise, timeoutPromise]);
        worker.terminate();
      } catch (error) {
        output.syncError = error && error.message ? error.message : String(error);
      }

      return output;
    });

    assert(result.protocol === 'file:', 'File worker check must run against file://.');
    assert(!result.syncError, `File worker bootstrap threw synchronously: ${result.syncError}`);
    assert(result.created, 'File worker bootstrap did not create a worker.');
    assert(!/cannot be accessed from origin 'null'/i.test(result.asyncError), `File worker bootstrap still hit the null-origin worker error: ${result.asyncError}`);
    assert(!consoleMessages.some((message) => /Couldn't load electron's screen capture/i.test(message)), 'Normal browser file:// load should not show the Electron screen-capture warning.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);

    console.log('PASS cohost file worker check');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
