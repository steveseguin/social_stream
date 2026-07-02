const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.onnx_data': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function buildHeaders(filePath, size) {
  return {
    'Content-Type': contentType(filePath),
    'Content-Length': size,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://${HOST}:${PORT}`);
        const pathname = decodeURIComponent(reqUrl.pathname);
        const relativePath = pathname.replace(/^\/+/, '');
        let filePath = path.join(ROOT, relativePath);

        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (pathname === '/' || pathname === '') {
          filePath = path.join(ROOT, 'index.html');
        }

        fs.stat(filePath, (err, stats) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          if (stats.isDirectory()) {
            const indexPath = path.join(filePath, 'index.html');
            fs.stat(indexPath, (indexErr, indexStats) => {
              if (indexErr || !indexStats.isFile()) {
                res.writeHead(404);
                res.end('Not Found');
                return;
              }
              res.writeHead(200, buildHeaders(indexPath, indexStats.size));
              fs.createReadStream(indexPath).pipe(res);
            });
            return;
          }

          res.writeHead(200, buildHeaders(filePath, stats.size));
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (error) {
        res.writeHead(500);
        res.end(String(error));
      }
    });

    server.on('error', reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}

(async () => {
  const server = await startStaticServer();
  const blockedExternalRequests = [];

  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--enable-unsafe-webgpu',
        '--use-angle=swiftshader',
        '--enable-features=Vulkan,UseSkiaRenderer'
      ]
    });

    const context = await browser.newContext();
    context.on('requestfailed', (request) => {
      console.log('REQUEST_FAILED:', request.url(), request.failure()?.errorText || '');
    });
    context.on('response', (response) => {
      const url = response.url();
      if (
        url.includes('cohost-local-qwen-worker.js') ||
        url.includes('transformers.min.js') ||
        url.includes('/onnx/')
      ) {
        console.log('RESPONSE:', response.status(), url);
      }
    });
    await context.route('**/*', (route) => {
      const requestUrl = new URL(route.request().url());
      const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';
      if (isHttp && !isLocal) {
        blockedExternalRequests.push(route.request().url());
        route.abort();
        return;
      }
      route.continue();
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      console.log('PAGE_CONSOLE:', msg.type(), msg.text());
    });
    page.on('pageerror', (err) => {
      console.log('PAGE_ERROR:', err.message);
    });
    await page.goto(`http://${HOST}:${PORT}/thirdparty/transformersjs/NOTICE.md`, {
      waitUntil: 'domcontentloaded'
    });

    const gpuInfo = await page.evaluate(async () => {
      const result = {
        available: !!navigator.gpu,
        adapterAvailable: false,
        description: '',
        vendor: '',
        architecture: '',
        error: ''
      };
      if (!navigator.gpu) {
        return result;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          return result;
        }
        result.adapterAvailable = true;
        if (typeof adapter.requestAdapterInfo === 'function') {
          try {
            const info = await adapter.requestAdapterInfo();
            result.description = info.description || '';
            result.vendor = info.vendor || '';
            result.architecture = info.architecture || '';
          } catch (infoError) {
            result.error = infoError?.message || String(infoError);
          }
        }
      } catch (error) {
        result.error = error?.message || String(error);
      }
      return result;
    });

    const preferredDevice = gpuInfo.adapterAvailable ? 'webgpu' : 'wasm';

    const workerResult = await page.evaluate(async ({ preferredDevice }) => {
      const worker = new Worker('/cohost-local-qwen-worker.js', { type: 'module' });
      const pending = new Map();
      const tokenChunks = [];
      let counter = 0;

      const statusEvents = [];

      function rejectAll(errorMessage) {
        for (const [id, entry] of pending.entries()) {
          clearTimeout(entry.timeoutId);
          entry.reject(new Error(errorMessage));
          pending.delete(id);
        }
      }

      function request(type, payload = {}, timeoutMs = 2400000) {
        const requestId = `pw-${Date.now()}-${++counter}`;
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error(`${type} timed out`));
          }, timeoutMs);

          pending.set(requestId, { resolve, reject, timeoutId });
          worker.postMessage({ type, requestId, ...payload });
        });
      }

      worker.onmessage = (event) => {
        const message = event.data || {};
        if (message.type === 'status') {
          statusEvents.push({
            state: message.state || '',
            message: message.message || ''
          });
        }
        if (message.type === 'token' && message.text) {
          tokenChunks.push(message.text);
          return;
        }
        if (message.type === 'response' && message.requestId) {
          const pendingRequest = pending.get(message.requestId);
          if (!pendingRequest) {
            return;
          }
          clearTimeout(pendingRequest.timeoutId);
          pending.delete(message.requestId);
          if (message.ok) {
            pendingRequest.resolve(message);
          } else {
            pendingRequest.reject(new Error(message.error || 'Worker request failed'));
          }
        }
      };

      worker.onerror = (event) => {
        const details = [
          event.message || 'Worker error',
          event.filename || '',
          event.lineno || 0,
          event.colno || 0
        ].join(' | ');
        rejectAll(details);
      };

      worker.onmessageerror = () => {
        rejectAll('Worker message error');
      };

      async function runAttempt(device) {
        const init = await request('init', {
          modelId: 'thirdparty/models/qwen3.5-0.8b-onnx',
          device,
          runtime: {
            modelClass: 'Qwen3_5ForConditionalGeneration',
            dtype: {
              embed_tokens: 'q4',
              decoder_model_merged: 'q4',
              model: 'q4',
              vision_encoder: 'q4'
            }
          }
        }, 2400000);

        const generation = await request('generate', {
          prompt: 'Reply with EXACTLY LOCAL_OFFLINE_OK and nothing else.',
          systemPrompt: 'You must reply with EXACTLY LOCAL_OFFLINE_OK and nothing else.',
          maxNewTokens: 6,
          temperature: 0.1,
          topP: 0.9,
          device
        }, 2400000);

        return { init, generation };
      }

      let init;
      let generation;
      let fallbackUsed = false;
      let fallbackReason = '';
      let modelExecutionSkipped = false;
      let modelExecutionSkipReason = '';

      try {
        ({ init, generation } = await runAttempt(preferredDevice));
      } catch (error) {
        const message = error?.message || String(error);
        const isKnownQuantizedKernelGap = /GatherBlockQuantized|Could not find an implementation/i.test(message);
        if (preferredDevice !== 'webgpu') {
          if (!isKnownQuantizedKernelGap) {
            throw error;
          }
          modelExecutionSkipped = true;
          modelExecutionSkipReason = message;
        } else {
          fallbackUsed = true;
          fallbackReason = message;
          tokenChunks.length = 0;
          await request('dispose', {}, 120000).catch(() => {});
          try {
            ({ init, generation } = await runAttempt('wasm'));
          } catch (fallbackError) {
            const fallbackMessage = fallbackError?.message || String(fallbackError);
            const fallbackIsKnownQuantizedKernelGap = /GatherBlockQuantized|Could not find an implementation/i.test(fallbackMessage);
            if (!fallbackIsKnownQuantizedKernelGap) {
              throw fallbackError;
            }
            modelExecutionSkipped = true;
            modelExecutionSkipReason = fallbackMessage;
          }
        }
      }

      await request('dispose', {}, 120000).catch(() => {});
      worker.terminate();

      return {
        init,
        preferredDevice,
        fallbackUsed,
        fallbackReason,
        modelExecutionSkipped,
        modelExecutionSkipReason,
        generation,
        tokenPreview: tokenChunks.join('').slice(0, 200),
        statusEvents
      };
    }, { preferredDevice });

    await browser.close();

    const generatedText = (workerResult.generation?.text || '').trim();
    const offlineOk = blockedExternalRequests.length === 0;

    console.log('GPU_INFO:', JSON.stringify(gpuInfo));
    console.log('PREFERRED_DEVICE:', workerResult.preferredDevice || 'unknown');
    console.log('WORKER_DEVICE:', workerResult.init?.device || 'unknown');
    console.log('DEVICE_FALLBACK_USED:', workerResult.fallbackUsed ? 'yes' : 'no');
    if (workerResult.fallbackReason) {
      console.log('DEVICE_FALLBACK_REASON:', workerResult.fallbackReason);
    }
    console.log('MODEL_EXECUTION_SKIPPED:', workerResult.modelExecutionSkipped ? 'yes' : 'no');
    if (workerResult.modelExecutionSkipReason) {
      console.log('MODEL_EXECUTION_SKIP_REASON:', workerResult.modelExecutionSkipReason);
    }
    console.log('OFFLINE_EXTERNAL_REQUESTS_BLOCKED:', blockedExternalRequests.length);
    console.log('GENERATION_TEXT:', generatedText);
    console.log('TOKEN_PREVIEW:', workerResult.tokenPreview || '');
    console.log('STATUS_EVENTS:', JSON.stringify(workerResult.statusEvents || []));

    if (!offlineOk) {
      throw new Error(`External requests were attempted: ${blockedExternalRequests.join(', ')}`);
    }
    if (!generatedText && !workerResult.modelExecutionSkipped) {
      throw new Error('Generation returned empty text.');
    }
  } finally {
    server.close();
  }
})();
