const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const STATIC_PORT = Number(process.env.COHOST_STATIC_PORT || 3000);
const ROOT_DIR = process.cwd();
const ENDPOINT = (process.env.COHOST_ENDPOINT || 'http://10.0.0.36:11434/v1').replace(/\/+$/, '');
const MODEL = process.env.COHOST_MODEL || 'Qwen3.5-35B-A3B-UD-Q6_K_XL.gguf';
const PROMPT = process.env.COHOST_PROMPT || 'Say hello in one short sentence.';

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.wasm') return 'application/wasm';
  return 'application/octet-stream';
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://${req.headers.host}`);
      let reqPath = decodeURIComponent(reqUrl.pathname);
      if (reqPath === '/') reqPath = '/cohost.html';
      const normalizedPath = path.normalize(reqPath).replace(/^(\.\.[\\/])+/, '');
      const filePath = path.join(rootDir, normalizedPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
        fs.createReadStream(filePath).pipe(res);
      });
    } catch (error) {
      res.writeHead(500);
      res.end(error.message || 'Server error');
    }
  });
}

async function waitForServer(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasImagePart(messages) {
  for (const msg of messages || []) {
    if (!msg || msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part && part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
        return true;
      }
    }
  }
  return false;
}

async function run() {
  let staticServer;
  let browser;
  try {
    staticServer = createStaticServer(ROOT_DIR);
    await waitForServer(staticServer, STATIC_PORT);

    const completionsPayloads = [];
    const pageErrors = [];
    const requestFailures = [];
    const consoleWarnings = [];

    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    });
    const context = await browser.newContext({
      baseURL: `http://127.0.0.1:${STATIC_PORT}`,
      permissions: ['camera', 'microphone']
    });
    await context.addInitScript(
      ({ endpoint, model }) => {
        localStorage.setItem('selectedProvider', 'customopenai');
        localStorage.setItem('customEndpoint_customopenai', endpoint);
        localStorage.setItem('modelOverride_customopenai', model);
      },
      { endpoint: ENDPOINT, model: MODEL }
    );
    const page = await context.newPage();

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        consoleWarnings.push(`${msg.type()}:${msg.text()}`);
      }
    });
    page.on('requestfailed', (request) => {
      requestFailures.push(`${request.url()} => ${request.failure()?.errorText || 'failed'}`);
    });
    page.on('request', (request) => {
      try {
        if (request.method() !== 'POST') return;
        const url = request.url();
        if (!url.includes('/v1/chat/completions')) return;
        const data = request.postDataJSON();
        completionsPayloads.push({ url, data });
      } catch (_error) {}
    });

    await page.goto('/cohost.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);

    await page.selectOption('#providerSelect', 'customopenai');
    await page.waitForTimeout(500);

    await page.fill('#customEndpoint', ENDPOINT);
    await page.dispatchEvent('#customEndpoint', 'change');
    await page.waitForTimeout(1200);

    await page.click('#customModelsRefresh', { force: true });
    await page.waitForTimeout(700);

    let modelOptions = [];
    for (let i = 0; i < 8; i += 1) {
      modelOptions = await page.$$eval('#customModelSelect option', (options) =>
        options.map((option) => option.value).filter(Boolean)
      );
      if (modelOptions.length > 0) break;
      await page.waitForTimeout(500);
    }

    if (modelOptions.includes(MODEL)) {
      await page.selectOption('#customModelSelect', MODEL);
    } else {
      await page.fill('#modelOverride', MODEL);
      await page.dispatchEvent('#modelOverride', 'change');
      await page.waitForTimeout(400);
    }

    await page.selectOption('#audioSource', 'none');
    await page.selectOption('#videoSource', 'none');

    await page.click('#startButton', { force: true });
    await page.waitForTimeout(2500);

    const startLabel = await page.$eval('#startButton', (el) => (el.textContent || '').trim());
    assert(startLabel === 'Stop Stream', `Stream failed to start. Start button label: ${startLabel}`);

    await page.fill('.message-input', PROMPT);
    await page.click('#sendButton', { force: true });
    await page.waitForTimeout(3500);

    const diagState = await page.$eval('#diagState', (el) => (el.textContent || '').trim());
    const diagError = await page.$eval('#diagError', (el) => (el.textContent || '').trim());
    const responsesText = await page.$eval('#responses', (el) => (el.textContent || '').trim());

    assert(
      completionsPayloads.length > 0,
      `No /v1/chat/completions request captured. Request failures: ${requestFailures.join(' | ')}`
    );

    const payloadModels = completionsPayloads.map((entry) => entry.data?.model).filter(Boolean);
    assert(
      payloadModels.includes(MODEL),
      `Expected model ${MODEL} in payloads. Seen: ${payloadModels.join(', ')}`
    );

    const sawImagePayload = completionsPayloads.some((entry) => hasImagePart(entry.data?.messages || []));
    assert(sawImagePayload, 'Expected at least one multimodal payload containing image_url.');

    assert(responsesText.length > 0, 'Responses panel stayed empty.');
    assert(diagError === '-' || diagError === '', `Diagnostics reports error: ${diagError}`);
    assert(
      diagState === 'connected' || diagState === 'running' || diagState === 'responding',
      `Unexpected diagnostics state: ${diagState}`
    );

    console.log('PASS real endpoint custom provider flow');
    console.log(`Endpoint: ${ENDPOINT}`);
    console.log(`Model options returned: ${modelOptions.join(', ') || '(none)'}`);
    console.log(`Captured chat/completions payloads: ${completionsPayloads.length}`);
    console.log(`Saw multimodal payload with image_url: ${sawImagePayload ? 'yes' : 'no'}`);
    console.log(`Diagnostics state/error: ${diagState}/${diagError}`);
    console.log(`Responses sample: ${responsesText.slice(0, 220)}`);
    if (consoleWarnings.length) {
      console.log(`Console warnings/errors (${consoleWarnings.length}):`);
      for (const line of consoleWarnings.slice(0, 10)) {
        console.log(`- ${line}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    await closeServer(staticServer);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
