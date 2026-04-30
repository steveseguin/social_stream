#!/usr/bin/env node
// Full e2e test harness: generates overlays via the vLLM endpoint using the
// SAME system prompt aiprompt.html ships with, loads the generated HTML in
// headless Chromium, feeds realistic SSN payloads, and asserts behavior.
//
// This is the loop we iterate on: run, look at failures, tighten the system
// prompt or starter templates, re-run.
//
// Usage: node scripts/aiprompt-overlay-e2e.cjs [endpoint] [model]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ENDPOINT = process.argv[2] || process.env.AIPROMPT_ENDPOINT || 'http://10.0.0.214:8000/v1/chat/completions';
const MODEL = process.argv[3] || process.env.AIPROMPT_MODEL || 'qwen3.6-35b-a3b-fp8';

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4201;
const LOG_DIR = path.join(ROOT, 'tmp', 'aiprompt-overlay-e2e');
fs.mkdirSync(LOG_DIR, { recursive: true });

const SYSTEM_PROMPT = (function () {
  const html = fs.readFileSync(path.join(ROOT, 'aiprompt.html'), 'utf8');
  const m = html.match(/<textarea id="default-system-prompt"[^>]*>([\s\S]*?)<\/textarea>/);
  if (!m) throw new Error('Could not find default-system-prompt in aiprompt.html');
  // unescape HTML entities just in case (our source file stores plain text)
  return m[1];
})();

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = fenced[1].trim();
    if (/<!doctype html|<html[\s>]/i.test(inner)) return inner;
  }
  const lower = (text || '').toLowerCase();
  const start = lower.indexOf('<!doctype html') >= 0 ? lower.indexOf('<!doctype html') : lower.indexOf('<html');
  const end = lower.lastIndexOf('</html>');
  if (start >= 0 && end > start) return text.slice(start, end + 7).trim();
  return '';
}

async function generate({ request, starterHtml }) {
  const userText = [
    '=== CURRENT HTML FILE ===',
    '```html',
    starterHtml || '<!DOCTYPE html><html><head></head><body></body></html>',
    '```',
    '',
    '=== RECENT CONVERSATION ===',
    'None yet.',
    '',
    '=== NEW REQUEST ===',
    request,
    '',
    'If the request needs a file change, return ONE complete HTML document inside one ```html fenced block. If it\'s just a question, answer normally.'
  ].join('\n');
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ],
    max_tokens: 6000,
    temperature: 0.3
  };
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('vLLM HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  const raw = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || '';
  return { raw, html: extractHtml(raw), elapsed: Date.now() - started };
}

// Dispatch a payload to an overlay two ways: call its handleOverlayPayload
// global if present, and also post a window message. Most overlays listen on
// window 'message' and check dataReceived.overlayNinja; some also check
// event.source — so we try both.
async function sendPayload(page, payload) {
  await page.evaluate(p => {
    try {
      if (typeof window.handleOverlayPayload === 'function') {
        window.handleOverlayPayload(p);
      }
    } catch (e) { /* record later via pageerror */ }
    window.postMessage({ dataReceived: { overlayNinja: p } }, '*');
  }, payload);
}

// Poll body.innerText until predicate returns true. Handles the "alert rendered
// briefly then dismissed" case by latching any text we ever observed into a
// session-scoped buffer on window.
// Read body text both with raw textContent (ignores text-transform: uppercase
// CSS) and innerText (respects rendered case), accumulate into a buffer, and
// compare case-insensitively so uppercase-styled overlays still match.
async function waitForText(page, predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < (timeoutMs || 5000)) {
    const seen = await page.evaluate(() => {
      var buf = window.__seenBuf || '';
      var raw = (document.body && document.body.textContent) || '';
      var rendered = (document.body && document.body.innerText) || '';
      var combined = raw + '\n' + rendered;
      if (combined && buf.indexOf(combined) < 0) buf = buf + '\n' + combined;
      window.__seenBuf = buf;
      return buf;
    });
    if (predicate(seen.toLowerCase())) return seen;
    await page.waitForTimeout(150);
  }
  return page.evaluate(() => window.__seenBuf || (document.body && document.body.textContent) || '');
}

async function runOverlayInBrowser(page, serverUrl, html, assertions) {
  // Write to a tmp html file under ROOT so the static server can serve it.
  const slug = 'tmp-overlay-' + Math.random().toString(36).slice(2, 8) + '.html';
  const diskPath = path.join(ROOT, slug);
  fs.writeFileSync(diskPath, html);

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(serverUrl + '/' + slug + '?session=test', { waitUntil: 'domcontentloaded' });
  // Give the overlay a moment to attach listeners
  await page.waitForTimeout(400);

  const results = [];
  for (const a of assertions) {
    try {
      await a.run(page);
      results.push({ name: a.name, pass: true });
    } catch (e) {
      results.push({ name: a.name, pass: false, error: (e && e.message) || String(e) });
    }
  }

  try { fs.unlinkSync(diskPath); } catch (e) { /* ignore */ }

  const relevantErrors = errors.filter(e =>
    !/vdo\.ninja|net::ERR|Failed to fetch|CORS|socialstream\.ninja|ERR_BLOCKED|Failed to load resource/i.test(e));

  return { results, errors: relevantErrors };
}

// Assertions for each scenario
const TESTS = [
  {
    name: 'chat-overlay',
    request: 'Build a transparent chat overlay. Show each chat message with the sender\'s avatar (chatimg), username (chatname), and message text (chatmessage). Filter out bot messages (data.bot === true) and non-chat events (data.event is set). Respect ?limit=N to cap visible rows (default 10). Use the SSN bridge pattern. Return the complete HTML.',
    assertions: [
      {
        name: 'three chat messages appear in DOM',
        async run(page) {
          for (const name of ['Alice', 'Bob', 'Carol']) {
            await sendPayload(page, { chatname: name, chatmessage: 'hi from ' + name, type: 'youtube' });
          }
          await page.waitForTimeout(300);
          const count = await page.evaluate(() => {
            const txt = ((document.body && document.body.textContent) || '').toLowerCase();
            return ['alice', 'bob', 'carol'].filter(n => txt.indexOf(n) >= 0).length;
          });
          if (count !== 3) throw new Error('expected 3 chatnames in DOM, got ' + count);
        }
      },
      {
        name: 'bot messages are filtered out',
        async run(page) {
          await sendPayload(page, { chatname: 'SpamBot9000', chatmessage: 'spam', bot: true, type: 'youtube' });
          await page.waitForTimeout(200);
          const has = await page.evaluate(() => ((document.body && document.body.textContent) || '').toLowerCase().indexOf('spambot9000') >= 0);
          if (has) throw new Error('bot chatname leaked into rendered chat');
        }
      },
      {
        name: 'system events are filtered out of chat',
        async run(page) {
          await sendPayload(page, { event: 'new_follower', chatname: 'EventActor', type: 'twitch' });
          await page.waitForTimeout(200);
          const has = await page.evaluate(() => ((document.body && document.body.textContent) || '').toLowerCase().indexOf('eventactor') >= 0);
          if (has) throw new Error('event-flagged payload rendered as chat');
        }
      },
      {
        name: 'message content is rendered',
        async run(page) {
          await sendPayload(page, { chatname: 'Dave', chatmessage: 'UNIQUE_MSG_TOKEN_42', type: 'kick' });
          await page.waitForTimeout(200);
          const has = await page.evaluate(() => ((document.body && document.body.textContent) || '').toLowerCase().indexOf('unique_msg_token_42') >= 0);
          if (!has) throw new Error('message text missing from DOM');
        }
      }
    ]
  },
  {
    name: 'alert-banner',
    request: 'Build an alert banner overlay. Show distinct animated alerts for: new followers (data.event === "new_follower"), subscribers (data.event === "subscriber" or data.membership is set and no event), gifted subs (data.event === "subscription_gift" or data.event === "gifted"), donations (data.hasDonation is set), and raids (data.event === "raid"). Each alert should include the user\'s name. Auto-dismiss alerts after about 4 seconds. Background must be transparent. Return the complete HTML.',
    assertions: [
      {
        name: 'follower alert appears with the name',
        async run(page) {
          await sendPayload(page, { event: 'new_follower', chatname: 'FollowerFran', type: 'twitch' });
          const seen = (await waitForText(page, t => t.indexOf('followerfran') >= 0, 6000)).toLowerCase();
          if (seen.indexOf('followerfran') < 0) throw new Error('follower alert missing in DOM');
        }
      },
      {
        name: 'subscriber alert appears with the name',
        async run(page) {
          await sendPayload(page, { event: 'subscriber', chatname: 'SubSally', type: 'youtube', membership: 'Member (2 months)' });
          const seen = (await waitForText(page, t => t.indexOf('subsally') >= 0, 6000)).toLowerCase();
          if (seen.indexOf('subsally') < 0) throw new Error('subscriber alert missing in DOM');
        }
      },
      {
        name: 'gifted-sub alert appears with the name',
        async run(page) {
          await sendPayload(page, { event: 'subscription_gift', chatname: 'GiftyGus', type: 'twitch', subtitle: '5', meta: { gift_count: 5 } });
          const seen = (await waitForText(page, t => t.indexOf('giftygus') >= 0, 6000)).toLowerCase();
          if (seen.indexOf('giftygus') < 0) throw new Error('gifted-sub alert missing in DOM');
        }
      },
      {
        name: 'donation alert appears with name and amount',
        async run(page) {
          await sendPayload(page, { chatname: 'DonorDana', chatmessage: 'keep it up', type: 'youtube', hasDonation: '$25.00' });
          const seen = (await waitForText(page, t => t.indexOf('donordana') >= 0 && t.indexOf('25') >= 0, 6000)).toLowerCase();
          if (seen.indexOf('donordana') < 0) throw new Error('donation alert missing name');
          if (seen.indexOf('25') < 0) throw new Error('donation alert missing amount');
        }
      },
      {
        name: 'raid alert appears with the raider name',
        async run(page) {
          await sendPayload(page, { event: 'raid', chatname: 'RaidingRita', type: 'twitch', subtitle: '42 viewers', meta: { viewers: 42 } });
          const seen = (await waitForText(page, t => t.indexOf('raidingrita') >= 0, 6000)).toLowerCase();
          if (seen.indexOf('raidingrita') < 0) throw new Error('raid alert missing in DOM');
        }
      }
    ]
  },
  {
    name: 'viewer-ticker',
    request: 'Build a bottom bar overlay that shows live per-platform viewer counts plus a total. Read from data.event === "viewer_updates" where data.meta is an object like { youtube: 800, twitch: 200 }. Background must be transparent. Return the complete HTML.',
    assertions: [
      {
        name: 'renders platform counts from viewer_updates',
        async run(page) {
          await sendPayload(page, { event: 'viewer_updates', meta: { youtube: 815, twitch: 221, kick: 94 } });
          await page.waitForTimeout(300);
          const txt = (await page.evaluate(() => document.body.innerText || '')).replace(/,/g, '');
          for (const token of ['815', '221', '94']) {
            if (txt.indexOf(token) < 0) throw new Error('missing count ' + token + ' in DOM');
          }
        }
      },
      {
        name: 'shows a combined total',
        async run(page) {
          await sendPayload(page, { event: 'viewer_updates', meta: { youtube: 100, twitch: 50 } });
          await page.waitForTimeout(300);
          const txt = (await page.evaluate(() => document.body.innerText || '')).replace(/,/g, '');
          if (!/\b150\b/.test(txt)) throw new Error('combined total 150 not rendered');
        }
      },
      {
        name: 'updates when a new viewer_updates arrives',
        async run(page) {
          await sendPayload(page, { event: 'viewer_updates', meta: { youtube: 9999 } });
          await page.waitForTimeout(300);
          const txt = (await page.evaluate(() => document.body.innerText || '')).replace(/,/g, '');
          if (txt.indexOf('9999') < 0) throw new Error('updated count 9999 missing');
        }
      }
    ]
  }
];

async function runRound(label) {
  console.log('\n=========================================================');
  console.log('Round: ' + label);
  console.log('Endpoint: ' + ENDPOINT + '   model: ' + MODEL);
  console.log('=========================================================');

  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const browser = await chromium.launch({ headless: true });
  const serverUrl = 'http://' + HOST + ':' + PORT;
  const summary = [];

  for (const test of TESTS) {
    console.log('\n--- ' + test.name + ' ---');
    let gen;
    try {
      gen = await generate({ request: test.request });
    } catch (e) {
      console.log('  [FAIL] generation error: ' + e.message);
      summary.push({ name: test.name, gen: false });
      continue;
    }
    console.log('  generated ' + (gen.html || '').length + ' chars in ' + gen.elapsed + 'ms');
    fs.writeFileSync(path.join(LOG_DIR, label + '-' + test.name + '.raw.txt'), gen.raw);
    fs.writeFileSync(path.join(LOG_DIR, label + '-' + test.name + '.html'), gen.html || gen.raw);
    if (!gen.html) {
      console.log('  [FAIL] no HTML extracted from response');
      summary.push({ name: test.name, extracted: false });
      continue;
    }

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let outcome;
    try {
      outcome = await runOverlayInBrowser(page, serverUrl, gen.html, test.assertions);
    } finally {
      await ctx.close();
    }

    const passes = outcome.results.filter(r => r.pass).length;
    const total = outcome.results.length;
    for (const r of outcome.results) {
      console.log('  ' + (r.pass ? '[\u2713]' : '[\u2717]') + ' ' + r.name + (r.pass ? '' : ' — ' + r.error));
    }
    if (outcome.errors.length) {
      console.log('  [!] page/console errors:');
      for (const e of outcome.errors.slice(0, 4)) console.log('      ' + e);
    }
    summary.push({ name: test.name, passes: passes, total: total, errors: outcome.errors });
  }

  await browser.close();
  server.close();

  console.log('\n--- round summary ---');
  let totalPass = 0, totalChecks = 0;
  for (const s of summary) {
    if (s.gen === false) { console.log('  ' + s.name + ': generation error'); continue; }
    if (s.extracted === false) { console.log('  ' + s.name + ': no HTML extracted'); continue; }
    totalPass += s.passes; totalChecks += s.total;
    console.log('  ' + s.name + ': ' + s.passes + '/' + s.total);
  }
  console.log('  TOTAL: ' + totalPass + '/' + totalChecks);
  return summary;
}

(async () => {
  const label = process.argv[4] || 'round-' + Date.now();
  await runRound(label);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
