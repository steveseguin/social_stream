const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4202;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function removeChromiumDebugLog() {
  const debugLogPath = path.join(ROOT, 'debug.log');
  try {
    if (fs.existsSync(debugLogPath)) fs.rmSync(debugLogPath);
  } catch (_error) {}
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type'
  };
}

function extractPrompt(body) {
  if (typeof body.prompt === 'string') return body.prompt;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const last = [...messages].reverse().find((entry) => entry && entry.role === 'user') || messages[messages.length - 1] || {};
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) {
    return last.content.map((part) => {
      if (!part) return '';
      if (typeof part === 'string') return part;
      if (typeof part.text === 'string') return part.text;
      return '';
    }).join(' ');
  }
  return '';
}

function responseTextForPrompt(prompt, provider) {
  if (/summarize discussion/i.test(prompt)) {
    return 'Fake chat summary: viewers are asking about setup.';
  }
  if (/ignore me/i.test(prompt)) {
    return 'NO_RESPONSE';
  }
  if (/Buck/i.test(prompt)) {
    return 'NinjaBot: Fake answer for Buck.';
  }
  return `${provider} fake response`;
}

async function fulfillJson(route, status, body) {
  await route.fulfill({
    status,
    headers: corsHeaders(),
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}

async function setupRoutes(context, requestLog, baseUrl) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const method = request.method();
    const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(), body: '' });
      return;
    }

    if (requestUrl.href === 'https://socialstream.ninja/llm-trial-config.json') {
      await fulfillJson(route, 200, {
        enabled: true,
        endpoint: `${baseUrl}/mock/hosted/v1/chat/completions`,
        model: 'ssn-trial-fake',
        token: 'test_token',
        notice: 'Fake SSN hosted trial config'
      });
      return;
    }

    if (requestUrl.pathname === '/ai.js') {
      await route.continue();
      return;
    }

    if (requestUrl.pathname.endsWith('/api/generate')) {
      const body = JSON.parse(request.postData() || '{}');
      const prompt = extractPrompt(body);
      requestLog.push({ provider: 'ollama', url: request.url(), body, prompt });
      await fulfillJson(route, 200, { response: responseTextForPrompt(prompt, 'ollama') });
      return;
    }

    if (requestUrl.pathname.endsWith('/chat/completions')) {
      const body = JSON.parse(request.postData() || '{}');
      const prompt = extractPrompt(body);
      let provider = 'custom';
      if (requestUrl.hostname === 'api.openai.com') provider = 'chatgpt';
      else if (requestUrl.hostname === 'api.deepseek.com') provider = 'deepseek';
      else if (requestUrl.hostname === 'generativelanguage.googleapis.com') provider = 'gemini';
      else if (requestUrl.hostname === 'api.x.ai') provider = 'xai';
      else if (requestUrl.hostname === 'openrouter.ai') provider = 'openrouter';
      else if (requestUrl.hostname === 'api.groq.com') provider = 'groq';
      else if (requestUrl.pathname.includes('/hosted/')) provider = 'hostedllm';
      else if (requestUrl.pathname.includes('/streaming/')) provider = 'custom-streaming';

      requestLog.push({ provider, url: request.url(), body, prompt, authorization: request.headers().authorization || '' });

      if (provider === 'custom-streaming') {
        await route.fulfill({
          status: 200,
          headers: Object.assign(corsHeaders(), { 'content-type': 'text/event-stream; charset=utf-8' }),
          body: [
            'data: {"choices":[{"delta":{"content":"stream "}}]}',
            '',
            'data: {"choices":[{"delta":{"content":"fake response"},"finish_reason":"stop"}]}',
            '',
            'data: [DONE]',
            ''
          ].join('\n')
        });
        return;
      }

      await fulfillJson(route, 200, {
        choices: [{
          message: {
            content: responseTextForPrompt(prompt, provider)
          }
        }]
      });
      return;
    }

    if (isLocal) {
      await route.continue();
      return;
    }

    throw new Error(`Unexpected external request: ${request.url()}`);
  });
}

async function loadAiHarness(page, baseUrl) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.CACHE_SIZE = 20;
    window.settings = {};
    window.lastSentMessage = '';
    window.messageStoreDB = {
      async getRecentMessages() {
        return [
          { chatname: 'Jess', chatmessage: 'How do I set up the bot?', type: 'youtube', timestamp: Date.now() - 20000, textonly: true },
          { chatname: 'Ava', chatmessage: 'Can it answer and roast?', type: 'twitch', timestamp: Date.now() - 10000, textonly: true }
        ];
      },
      async getUserMessages() {
        return [];
      },
      async updateMessage() {}
    };
    window.messagePopup = function () {};
  });
  await page.addScriptTag({ path: path.join(ROOT, 'ai.js') });
  await page.evaluate(() => {
    window.__p2p = [];
    window.__tabs = [];
    window.__overlay = [];
    window.__warnings = [];
    window.sendTargetP2P = function (payload, target) {
      window.__p2p.push(JSON.parse(JSON.stringify({ target, payload })));
    };
    window.sendMessageToTabs = function (payload) {
      window.__tabs.push(JSON.parse(JSON.stringify(payload)));
    };
    window.sendAiOverlayCommand = function (payload, defaults) {
      const meta = Object.assign({}, defaults && defaults.meta || {}, payload && payload.meta || {});
      const target = (payload && payload.target) || (defaults && defaults.target) || (window.settings.aiOverlayLabel && window.settings.aiOverlayLabel.textsetting) || 'cohost-overlay';
      const out = { action: 'aiOverlay', target, meta };
      window.__overlay.push(JSON.parse(JSON.stringify(out)));
      return out;
    };
    window.decodeAndCleanHtml = function (input) {
      const doc = new DOMParser().parseFromString(String(input || ''), 'text/html');
      doc.querySelectorAll('img[alt]').forEach((img) => img.replaceWith(doc.createTextNode(img.getAttribute('alt') || '')));
      return (doc.body.textContent || '').replace(/\s\s+/g, ' ').trim();
    };
    window.fastMessageSimilarity = function () {
      return 0;
    };
    isRAGConfigured = async function () {
      return false;
    };
  });
}

async function runProviderRoutingChecks(page, baseUrl) {
  const providers = [
    {
      name: 'ollama',
      settings: {
        aiProvider: { optionsetting: 'ollama' },
        ollamaendpoint: { textsetting: `${baseUrl}/mock/ollama` },
        ollamamodel: { textsetting: 'fake-llama' }
      }
    },
    {
      name: 'custom',
      settings: {
        aiProvider: { optionsetting: 'custom' },
        customAIEndpoint: { textsetting: `${baseUrl}/mock/custom` },
        customAIModel: { textsetting: 'fake-custom' },
        customAIApiKey: { textsetting: 'custom-key' }
      }
    },
    {
      name: 'hostedllm',
      settings: {
        aiProvider: { optionsetting: 'hostedllm' }
      }
    },
    {
      name: 'chatgpt',
      settings: {
        aiProvider: { optionsetting: 'chatgpt' },
        chatgptApiKey: { textsetting: 'openai-key' },
        chatgptmodel: { textsetting: 'gpt-fake' }
      }
    },
    {
      name: 'gemini',
      settings: {
        aiProvider: { optionsetting: 'gemini' },
        geminiApiKey: { textsetting: 'gemini-key' },
        geminimodel: { textsetting: 'gemini-fake' }
      }
    },
    {
      name: 'deepseek',
      settings: {
        aiProvider: { optionsetting: 'deepseek' },
        deepseekApiKey: { textsetting: 'deepseek-key' },
        deepseekmodel: { textsetting: 'deepseek-fake' }
      }
    },
    {
      name: 'xai',
      settings: {
        aiProvider: { optionsetting: 'xai' },
        xaiApiKey: { textsetting: 'xai-key' },
        xaimodel: { textsetting: 'xai-fake' }
      }
    },
    {
      name: 'openrouter',
      settings: {
        aiProvider: { optionsetting: 'openrouter' },
        openrouterApiKey: { textsetting: 'openrouter-key' },
        openroutermodel: { textsetting: 'openrouter/fake' }
      }
    },
    {
      name: 'groq',
      settings: {
        aiProvider: { optionsetting: 'groq' },
        groqApiKey: { textsetting: 'groq-key' },
        groqmodel: { textsetting: 'groq-fake' }
      }
    }
  ];

  for (const provider of providers) {
    const result = await page.evaluate(async ({ settingsPatch, providerName }) => {
      window.settings = settingsPatch;
      return callLLMAPI(`provider smoke prompt for ${providerName}`);
    }, { settingsPatch: provider.settings, providerName: provider.name });
    assert(result === `${provider.name} fake response`, `${provider.name} returned unexpected response: ${result}`);
  }

  const streaming = await page.evaluate(async (base) => {
    window.settings = {
      aiProvider: { optionsetting: 'custom' },
      customAIEndpoint: { textsetting: `${base}/mock/streaming` },
      customAIModel: { textsetting: 'fake-stream' },
      customAIApiKey: { textsetting: 'stream-key' }
    };
    const chunks = [];
    const response = await callLLMAPI('stream this prompt', null, (chunk) => chunks.push(chunk));
    return { response, chunks };
  }, baseUrl);
  assert(streaming.response === 'stream fake response', `Streaming response mismatch: ${streaming.response}`);
  assert(streaming.chunks.join('') === 'stream fake response', `Streaming chunks mismatch: ${streaming.chunks.join('')}`);
}

async function runChatbotFakeMessageChecks(page, baseUrl) {
  await page.evaluate((base) => {
    window.__p2p = [];
    window.__tabs = [];
    window.__overlay = [];
    window.lastSentMessage = '';
    window.settings = {
      aiProvider: { optionsetting: 'custom' },
      customAIEndpoint: { textsetting: `${base}/mock/chatbot` },
      customAIModel: { textsetting: 'fake-chatbot' },
      customAIApiKey: { textsetting: 'chatbot-key' },
      ollamabotname: { textsetting: 'NinjaBot' },
      ollamaprompt: { textsetting: 'Be concise for {{CURRENT_DATE}}.' },
      ollamaRateLimitPerTab: { numbersetting: '0' },
      alwaysRespondLLM: true,
      nollmcontext: true,
      aiOverlayFromChatBot: true,
      aiOverlayLabel: { textsetting: 'stage' },
      aiOverlayTts: true
    };
  }, baseUrl);

  await page.evaluate(() => processMessageWithOllama({
    tid: 42,
    type: 'youtube',
    chatname: 'Buck',
    userid: 'buck-id',
    chatmessage: 'NinjaBot, answer this <img alt="please">',
    textonly: false
  }));

  let state = await page.evaluate(() => ({
    p2p: window.__p2p,
    tabs: window.__tabs,
    overlay: window.__overlay
  }));
  assert(state.p2p.length === 1 && state.p2p[0].target === 'bot', `Chatbot did not send the bot overlay payload: ${JSON.stringify(state)}`);
  assert(state.p2p[0].payload.chatmessage === 'Fake answer for Buck.', 'Chatbot did not clean the botname prefix from the fake response.');
  assert(state.tabs.length === 1 && state.tabs[0].response === 'NinjaBot: Fake answer for Buck.', 'Chatbot did not send the tab response.');
  assert(state.overlay.length === 1 && state.overlay[0].target === 'stage', 'Chatbot did not send the AI stage overlay command.');
  assert(state.overlay[0].meta.source === 'chatbot' && state.overlay[0].meta.tts === true, 'Chatbot AI overlay metadata is wrong.');
  assert(state.overlay[0].meta.request.chatmessage.includes('NinjaBot'), 'Chatbot AI overlay request context is missing.');

  await page.evaluate(() => {
    window.settings.alwaysRespondLLM = false;
  });
  await page.evaluate(() => processMessageWithOllama({
    tid: 43,
    type: 'twitch',
    chatname: 'Jess',
    chatmessage: 'ignore me',
    textonly: true
  }));
  state = await page.evaluate(() => ({ p2p: window.__p2p, tabs: window.__tabs, overlay: window.__overlay }));
  assert(state.p2p.length === 1 && state.tabs.length === 1 && state.overlay.length === 1, 'NO_RESPONSE fake message should not emit bot output.');

  await page.evaluate(() => {
    window.__p2p = [];
    window.__tabs = [];
    window.__overlay = [];
    window.settings.bottriggerwords = { textsetting: 'ninja' };
  });
  await page.evaluate(() => processMessageWithOllama({
    tid: 44,
    type: 'youtube',
    chatname: 'Ava',
    chatmessage: 'hello without the trigger',
    textonly: true
  }));
  state = await page.evaluate(() => ({ p2p: window.__p2p, tabs: window.__tabs, overlay: window.__overlay }));
  assert(state.p2p.length === 0 && state.tabs.length === 0 && state.overlay.length === 0, 'Missing trigger word should suppress chatbot output.');

  await page.evaluate(() => processMessageWithOllama({
    tid: 45,
    type: 'youtube',
    chatname: 'Buck',
    chatmessage: 'ninja please answer Buck',
    textonly: true
  }));
  state = await page.evaluate(() => ({ p2p: window.__p2p, tabs: window.__tabs, overlay: window.__overlay }));
  assert(state.p2p.length === 1 && state.overlay.length === 1, 'Trigger word fake message did not emit chatbot output.');

  await page.evaluate(() => {
    delete window.settings.bottriggerwords;
    window.__p2p = [];
    window.__tabs = [];
    window.__overlay = [];
  });
  await page.evaluate(() => processSummary({
    tid: 46,
    type: 'youtube',
    chatname: 'Moderator',
    chatmessage: 'summarize please',
    textonly: true
  }));
  state = await page.evaluate(() => ({ p2p: window.__p2p, tabs: window.__tabs, overlay: window.__overlay }));
  assert(state.p2p.length === 1 && /Fake chat summary/.test(state.p2p[0].payload.chatmessage), 'Summary did not emit fake summary to bot overlay.');
  assert(state.overlay.length === 1 && state.overlay[0].meta.source === 'chatbot-summary', 'Summary did not emit AI stage overlay command.');
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const baseUrl = `http://${HOST}:${PORT}`;
  const requestLog = [];

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-logging', '--log-level=3']
    });
    const context = await browser.newContext();
    await setupRoutes(context, requestLog, baseUrl);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await loadAiHarness(page, baseUrl);
    await runProviderRoutingChecks(page, baseUrl);
    await runChatbotFakeMessageChecks(page, baseUrl);

    assert(requestLog.some((entry) => entry.provider === 'hostedllm' && /Bearer test_token/.test(entry.authorization)), 'Hosted LLM fake request did not use the trial token.');
    assert(requestLog.some((entry) => entry.provider === 'custom-streaming' && entry.body.stream === true), 'Custom streaming fake request was not marked stream=true.');
    assert(requestLog.some((entry) => entry.provider === 'custom' && /Current group chat message from Buck/.test(entry.prompt)), 'Chatbot fake message prompt did not include Buck context.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);

    console.log('PASS ai chatbot fake integrations e2e');
    await browser.close();
  } finally {
    server.close();
    removeChromiumDebugLog();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  removeChromiumDebugLog();
  process.exit(1);
});
