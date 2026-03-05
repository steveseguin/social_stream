const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const STATIC_PORT = 3000;
const MOCK_PORT = 11438;
const ROOT_DIR = process.cwd();

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyText = Buffer.concat(chunks).toString('utf8');
        resolve(bodyText ? JSON.parse(bodyText) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createMockOpenAICompatServer() {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }
    if (req.method === 'GET' && reqUrl.pathname === '/v1/models') {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'qwen3.5-35b', object: 'model' },
          { id: 'qwen3.5-14b', object: 'model' }
        ]
      }));
      return;
    }
    if (req.method === 'POST' && reqUrl.pathname === '/v1/chat/completions') {
      try {
        const body = await readJson(req);
        const model = body.model || 'unknown-model';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const lastUser = [...messages].reverse().find((m) => m && m.role === 'user');
        const userContent = lastUser?.content;
        let userText = '';
        let hasImage = false;
        if (typeof userContent === 'string') {
          userText = userContent.trim();
        } else if (Array.isArray(userContent)) {
          for (const part of userContent) {
            if (part?.type === 'text' && typeof part.text === 'string') {
              userText += part.text;
            }
            if (part?.type === 'image_url') {
              hasImage = true;
            }
          }
          userText = userText.trim();
        }
        const message = `mock:${model}:${hasImage ? 'image' : 'text'}:${userText || 'no-input'}`;
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: message
              },
              finish_reason: 'stop'
            }
          ]
        }));
      } catch (error) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: error.message || 'Invalid JSON' } }));
      }
      return;
    }
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
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

async function run() {
  let staticServer;
  let mockServer;
  let browser;
  try {
    staticServer = createStaticServer(ROOT_DIR);
    mockServer = createMockOpenAICompatServer();
    await waitForServer(staticServer, STATIC_PORT);
    await waitForServer(mockServer, MOCK_PORT);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    });
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      baseURL: `http://127.0.0.1:${STATIC_PORT}`
    });
    const page = await context.newPage();
    const pageErrors = [];
    const requestHosts = new Set();
    const requestHostnames = new Set();
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          requestHosts.add(url.host);
          requestHostnames.add(url.hostname);
        }
      } catch (_error) {}
    });

    await page.goto('/cohost.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    assert(pageErrors.length === 0, `Page errors on load: ${pageErrors.join(' | ')}`);

    await page.selectOption('#providerSelect', 'customopenai');
    await page.waitForTimeout(500);

    const endpointUrl = `http://127.0.0.1:${MOCK_PORT}/v1`;
    await page.fill('#customEndpoint', endpointUrl);
    await page.dispatchEvent('#customEndpoint', 'change');
    await page.waitForTimeout(700);
    await page.click('#customModelsRefresh');
    await page.waitForTimeout(700);

    const modelOptions = await page.$$eval('#customModelSelect option', (options) =>
      options.map((option) => option.value).filter(Boolean)
    );
    assert(modelOptions.includes('qwen3.5-35b'), 'Expected qwen3.5-35b in custom model list');

    await page.selectOption('#customModelSelect', 'qwen3.5-35b');
    await page.waitForTimeout(300);

    await page.selectOption('#videoSource', 'none');
    await page.selectOption('#audioSource', 'none');
    await page.click('#startButton', { force: true });
    await page.waitForTimeout(1500);

    const startLabel = await page.$eval('#startButton', (el) => el.textContent?.trim() || '');
    assert(startLabel === 'Stop Stream', `Expected stream to start, got start button label: ${startLabel}`);

    await page.fill('.message-input', 'testing custom endpoint');
    await page.click('#sendButton', { force: true });
    await page.waitForTimeout(1200);

    const responsesText = await page.$eval('#responses', (el) => el.textContent || '');
    const containsMockReply = responsesText.includes('mock:qwen3.5-35b') && responsesText.includes('testing custom endpoint');
    assert(
      containsMockReply,
      `Expected mocked completion text in responses. Got: ${responsesText.slice(0, 300)}`
    );

    const diagProvider = await page.$eval('#diagProvider', (el) => el.textContent?.trim() || '');
    const diagState = await page.$eval('#diagState', (el) => el.textContent?.trim() || '');
    assert(diagProvider.includes('OpenAI-Compatible'), `Unexpected provider diagnostics: ${diagProvider}`);
    assert(diagState === 'running' || diagState === 'connected', `Unexpected diagnostics state: ${diagState}`);

    const mixedContentBlocked = await page.evaluate(() => {
      const fn = window.isHttpMixedContentBlocked;
      if (typeof fn !== 'function') return null;
      return fn('http://10.0.0.36:11434/v1');
    });
    assert(mixedContentBlocked === false, 'HTTP endpoint should be allowed on HTTP page origin');

    const externalHosts = [...requestHosts].filter((host) => {
      try {
        const parsed = new URL(`http://${host}`);
        const hostname = parsed.hostname.toLowerCase();
        return !(hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]');
      } catch (_error) {
        return true;
      }
    });
    assert(
      externalHosts.length === 0,
      `Unexpected non-local network requests during test: ${externalHosts.join(', ')}`
    );

    const gpuInfo = await page.evaluate(async () => {
      if (!('gpu' in navigator) || !navigator.gpu?.requestAdapter) {
        return { supported: false, adapter: null };
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { supported: true, adapter: null };
      }
      const info = adapter.info || {};
      return {
        supported: true,
        adapter: {
          vendor: info.vendor || null,
          architecture: info.architecture || null,
          device: info.device || null,
          description: info.description || null
        }
      };
    });

    console.log('PASS custom endpoint flow');
    console.log(`Models loaded: ${modelOptions.join(', ')}`);
    console.log(`Diagnostics provider/state: ${diagProvider}/${diagState}`);
    console.log(`WebGPU support: ${gpuInfo.supported ? 'yes' : 'no'}`);
    if (gpuInfo.adapter) {
      console.log(`WebGPU adapter: ${JSON.stringify(gpuInfo.adapter)}`);
    }
    console.log(`Network hosts touched: ${[...requestHosts].sort().join(', ')}`);
    console.log(`Network hostnames touched: ${[...requestHostnames].sort().join(', ')}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    await closeServer(mockServer);
    await closeServer(staticServer);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
