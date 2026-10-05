#!/usr/bin/env node
// End-to-end test: hits the local vLLM endpoint using the same multimodal
// payload shape that ai.js (non-Ollama path) now sends. Verifies:
//   1. Text-only generation returns a valid HTML overlay.
//   2. Vision-augmented generation (image attached) returns a valid HTML overlay.
//   3. Auto-fix loop: send a broken page + error message, verify the model repairs it.
//
// Requires: Node 18+ (global fetch), a reachable OpenAI-compatible endpoint.
// Usage:
//   node scripts/aiprompt-vllm-e2e.cjs [endpoint] [model]

const fs = require('fs');
const path = require('path');

const ENDPOINT = process.argv[2] || process.env.AIPROMPT_ENDPOINT || 'http://10.0.0.214:8000/v1/chat/completions';
const MODEL = process.argv[3] || process.env.AIPROMPT_MODEL || 'qwen3.6-35b-a3b-fp8';
const LOG_DIR = path.join(__dirname, '..', 'tmp', 'aiprompt-e2e');
fs.mkdirSync(LOG_DIR, { recursive: true });

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Read the default system prompt from aiprompt.html (single source of truth).
function loadDefaultSystemPrompt() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'aiprompt.html'), 'utf8');
  const m = html.match(/<textarea id="default-system-prompt"[^>]*>([\s\S]*?)<\/textarea>/);
  if (!m) throw new Error('Could not find default-system-prompt textarea in aiprompt.html');
  return m[1];
}

async function callLLM({ systemPrompt, userText, images, stream = false }) {
  const content = images && images.length
    ? [{ type: 'text', text: userText }].concat(images.map(url => ({ type: 'image_url', image_url: { url } })))
    : userText;
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content });

  const body = { model: MODEL, messages, stream, max_tokens: 4096, temperature: 0.4 };
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || '';
  return { text, elapsedMs: Date.now() - started, usage: json.usage };
}

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = fenced[1].trim();
    if (/<!doctype html|<html[\s>]/i.test(inner)) return inner;
  }
  const lower = text.toLowerCase();
  const start = lower.indexOf('<!doctype html') >= 0 ? lower.indexOf('<!doctype html') : lower.indexOf('<html');
  const end = lower.lastIndexOf('</html>');
  if (start >= 0 && end > start) return text.slice(start, end + 7).trim();
  return '';
}

function saveArtifact(name, content) {
  const p = path.join(LOG_DIR, name);
  fs.writeFileSync(p, content);
  return p;
}

// Known-good 1x1 red PNG (verified working via curl probe). Small, but enough to
// prove the multimodal content array is accepted end-to-end by the endpoint.
const TINY_MOCK_SCREENSHOT =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testReachable() {
  const url = ENDPOINT.replace(/\/chat\/completions$/, '/models');
  const res = await fetch(url);
  assert(res.ok, `Endpoint ${url} not reachable (status ${res.status})`);
  const json = await res.json();
  const ids = (json.data || []).map(m => m.id);
  assert(ids.includes(MODEL), `Model ${MODEL} not in endpoint list: ${ids.join(', ')}`);
  console.log(`[1/4] Endpoint reachable. Models: ${ids.join(', ')}`);
}

async function testTextGeneration(systemPrompt) {
  console.log('[2/4] Text-only overlay generation…');
  const userText = [
    '=== CURRENT HTML FILE ===',
    '```html',
    '<!DOCTYPE html><html><head><title>blank</title></head><body></body></html>',
    '```',
    '',
    '=== NEW REQUEST ===',
    'Build a minimal starting-soon overlay: dark background, centered headline "Starting Soon", and a countdown timer that ticks from 05:00 down. No external assets. Return the full HTML.'
  ].join('\n');
  const { text, elapsedMs, usage } = await callLLM({ systemPrompt, userText });
  saveArtifact('01-text-response.txt', text);
  const html = extractHtml(text);
  saveArtifact('01-text-extracted.html', html || '(no html extracted)');
  console.log(`    elapsed=${elapsedMs}ms, tokens=${usage && usage.total_tokens}`);
  assert(html, 'Text-only response did not contain an HTML document');
  assert(/starting\s*soon/i.test(html), 'HTML missing "Starting Soon" text');
  assert(/<script[\s>]/i.test(html), 'HTML missing a <script> (needed for countdown)');
  assert(/05:00|5:00|minutes|setInterval/i.test(html), 'HTML missing timer logic');
  console.log('    ✓ returned valid starting-soon overlay');
}

async function testVisionGeneration(systemPrompt) {
  console.log('[3/4] Vision-augmented review…');
  const userText = [
    '=== CURRENT HTML FILE ===',
    '```html',
    '<!DOCTYPE html><html><head><style>body{background:transparent;color:#fff;font-family:sans-serif}</style></head><body><div id="feed"></div></body></html>',
    '```',
    '',
    '=== ATTACHED ===',
    'A screenshot of the current overlay is attached.',
    '',
    '=== NEW REQUEST ===',
    'Based on the screenshot and current HTML, build a polished chat overlay with avatar, username, message, and a subtle slide-in animation. Return the full HTML.'
  ].join('\n');
  const { text, elapsedMs, usage } = await callLLM({
    systemPrompt,
    userText,
    images: [TINY_MOCK_SCREENSHOT]
  });
  saveArtifact('02-vision-response.txt', text);
  const html = extractHtml(text);
  saveArtifact('02-vision-extracted.html', html || '(no html extracted)');
  console.log(`    elapsed=${elapsedMs}ms, tokens=${usage && usage.total_tokens}`);
  assert(html, 'Vision response did not contain an HTML document');
  assert(/feed|message|chat|name|row|avatar/i.test(html), 'HTML missing chat-overlay-shaped markup');
  assert(/animation|@keyframes|transition|transform/i.test(html), 'HTML missing animation / transform CSS');
  console.log('    ✓ model accepted multimodal payload + returned chat overlay with animation');
}

async function testAutoFixLoop(systemPrompt) {
  console.log('[4/4] Auto-fix loop: break a page, ask for a fix…');
  const brokenHtml = [
    '<!DOCTYPE html><html><head><title>broken</title></head><body>',
    '<div id="feed"></div>',
    '<script>',
    '  // Intentional ReferenceError on load:',
    '  document.getElementById("feed").textContent = definitelyNotDefined.value;',
    '</script>',
    '</body></html>'
  ].join('\n');
  const errorMsg = 'ReferenceError: definitelyNotDefined is not defined';
  const userText = [
    '=== CURRENT HTML FILE ===',
    '```html',
    brokenHtml,
    '```',
    '',
    '=== NEW REQUEST ===',
    'Auto-fix attempt 1/2 — the preview threw: ' + errorMsg + '\n\nPlease return a corrected, complete HTML document that no longer throws on load.'
  ].join('\n');
  const { text, elapsedMs } = await callLLM({ systemPrompt, userText });
  saveArtifact('03-autofix-response.txt', text);
  const html = extractHtml(text);
  saveArtifact('03-autofix-extracted.html', html || '(no html extracted)');
  console.log(`    elapsed=${elapsedMs}ms`);
  assert(html, 'Auto-fix response did not contain an HTML document');
  assert(!/definitelyNotDefined/.test(html), 'Auto-fix still references the broken symbol');
  console.log('    ✓ model removed the broken reference');
}

(async () => {
  console.log(`--- aiprompt vLLM e2e ---`);
  console.log(`endpoint: ${ENDPOINT}`);
  console.log(`model:    ${MODEL}`);
  console.log(`artifacts in: ${LOG_DIR}`);
  console.log('');

  const systemPrompt = loadDefaultSystemPrompt();
  await testReachable();
  await testTextGeneration(systemPrompt);
  await testVisionGeneration(systemPrompt);
  await testAutoFixLoop(systemPrompt);

  console.log('\nAll tests passed.');
})().catch(err => {
  console.error('\nTEST FAILED:', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
