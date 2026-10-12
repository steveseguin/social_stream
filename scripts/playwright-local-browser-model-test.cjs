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

    await page.goto(`http://${HOST}:${PORT}/cohost.html`, {
      waitUntil: 'domcontentloaded'
    });
    await page.waitForFunction(() => !!document.getElementById('providerSelect'));

    const providerState = await page.evaluate(() => {
      const providerSelect = document.getElementById('providerSelect');
      const videoSource = document.getElementById('videoSource');
      const audioSource = document.getElementById('audioSource');
      const apiKey = document.getElementById('apiKey');
      const hasGemmaOption = Array.from(providerSelect.options).some((option) => option.value === 'localgemma');

      providerSelect.value = 'localgemma';
      providerSelect.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        hasGemmaOption,
        selectedProvider: providerSelect.value,
        videoDisabled: videoSource.disabled,
        audioDisabled: audioSource.disabled,
        apiKeyDisabled: apiKey.disabled
      };
    });

    const gpuInfo = await page.evaluate(async () => {
      const result = {
        available: !!navigator.gpu,
        adapterAvailable: false,
        error: ''
      };
      if (!navigator.gpu) {
        return result;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        result.adapterAvailable = !!adapter;
      } catch (error) {
        result.error = error?.message || String(error);
      }
      return result;
    });

    const preferredDevice = gpuInfo.adapterAvailable ? 'webgpu' : 'wasm';

    const workerResult = await page.evaluate(async ({ preferredDevice }) => {
      const worker = new Worker('/local-browser-model-worker.js', { type: 'module' });
      const pending = new Map();
      const tokenChunks = [];
      const statusEvents = [];
      let counter = 0;

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
          return;
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

      const workerProbe = await request('reset', {}, 120000);
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
        workerProbeOk: !!workerProbe?.ok,
        init,
        generation,
        preferredDevice,
        fallbackUsed,
        fallbackReason,
        modelExecutionSkipped,
        modelExecutionSkipReason,
        tokenPreview: tokenChunks.join('').slice(0, 200),
        statusEvents
      };
    }, { preferredDevice });

    await browser.close();

    const generatedText = (workerResult.generation?.text || '').trim();

    console.log('PROVIDER_STATE:', JSON.stringify(providerState));
    console.log('GPU_INFO:', JSON.stringify(gpuInfo));
    console.log('WORKER_PROBE_OK:', workerResult.workerProbeOk ? 'yes' : 'no');
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

    if (!providerState.hasGemmaOption) {
      throw new Error('Cohost provider list is missing localgemma.');
    }
    if (providerState.selectedProvider !== 'localgemma') {
      throw new Error(`Expected localgemma to be selected, got ${providerState.selectedProvider}.`);
    }
    if (providerState.videoDisabled || providerState.audioDisabled) {
      throw new Error('Local Gemma should keep capture selectors enabled.');
    }
    if (!providerState.apiKeyDisabled) {
      throw new Error('Local Gemma should not require an API key.');
    }
    if (blockedExternalRequests.length > 0) {
      throw new Error(`External requests were attempted: ${blockedExternalRequests.join(', ')}`);
    }
    if (!workerResult.workerProbeOk) {
      throw new Error('Generic local browser worker failed its reset probe.');
    }
    if (!generatedText && !workerResult.modelExecutionSkipped) {
      throw new Error('Generation returned empty text.');
    }
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
