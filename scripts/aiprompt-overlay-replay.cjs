#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const htmlPath = process.argv[2];
const scenario = process.argv[3] || 'alert-banner';
if (!htmlPath) { console.error('usage: replay.cjs <path.html> [chat-overlay|alert-banner|viewer-ticker]'); process.exit(2); }

const ROOT = process.cwd();
const PORT = 4202;

async function sendPayload(page, payload) {
  await page.evaluate(p => {
    try { if (typeof window.handleOverlayPayload === 'function') window.handleOverlayPayload(p); } catch (e) {}
    window.postMessage({ dataReceived: { overlayNinja: p } }, '*');
  }, payload);
}
async function waitForText(page, predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < (timeoutMs || 5000)) {
    const seen = (await page.evaluate(() => {
      var buf = window.__seenBuf || '';
      var raw = (document.body && document.body.textContent) || '';
      var rendered = (document.body && document.body.innerText) || '';
      var combined = raw + '\n' + rendered;
      if (combined && buf.indexOf(combined) < 0) buf = buf + '\n' + combined;
      window.__seenBuf = buf;
      return buf;
    }))?.toLowerCase() || '';
    if (predicate(seen)) return seen;
    await page.waitForTimeout(150);
  }
  return (await page.evaluate(() => window.__seenBuf || (document.body && document.body.textContent) || '')).toLowerCase();
}

const SCENARIOS = {
  'chat-overlay': [
    { name: 'Alice sent', p: { chatname: 'Alice', chatmessage: 'hi from Alice', type: 'youtube' }, check: t => t.indexOf('alice') >= 0 },
    { name: 'Bob sent', p: { chatname: 'Bob', chatmessage: 'hi from Bob', type: 'youtube' }, check: t => t.indexOf('bob') >= 0 },
    { name: 'Carol sent', p: { chatname: 'Carol', chatmessage: 'hi from Carol', type: 'youtube' }, check: t => t.indexOf('carol') >= 0 },
    { name: 'SpamBot filtered', p: { chatname: 'SpamBot9000', chatmessage: 'spam', bot: true, type: 'youtube' }, check: t => t.indexOf('spambot9000') < 0, negate: true },
    { name: 'Event filtered', p: { event: 'new_follower', chatname: 'EventActor', type: 'twitch' }, check: t => t.indexOf('eventactor') < 0, negate: true },
    { name: 'Unique token', p: { chatname: 'Dave', chatmessage: 'UNIQUE_MSG_TOKEN_42', type: 'kick' }, check: t => t.indexOf('unique_msg_token_42') >= 0 }
  ],
  'alert-banner': [
    { name: 'Follower', p: { event: 'new_follower', chatname: 'FollowerFran', type: 'twitch' }, check: t => t.indexOf('followerfran') >= 0 },
    { name: 'Sub', p: { event: 'subscriber', chatname: 'SubSally', type: 'youtube', membership: 'Member (2 months)' }, check: t => t.indexOf('subsally') >= 0 },
    { name: 'Gift', p: { event: 'subscription_gift', chatname: 'GiftyGus', type: 'twitch', subtitle: '5', meta: { gift_count: 5 } }, check: t => t.indexOf('giftygus') >= 0 },
    { name: 'Donation', p: { chatname: 'DonorDana', chatmessage: 'keep it up', type: 'youtube', hasDonation: '$25.00' }, check: t => t.indexOf('donordana') >= 0 && t.indexOf('25') >= 0 },
    { name: 'Raid', p: { event: 'raid', chatname: 'RaidingRita', type: 'twitch', subtitle: '42 viewers', meta: { viewers: 42 } }, check: t => t.indexOf('raidingrita') >= 0 }
  ]
};

(async () => {
  const payloads = SCENARIOS[scenario];
  if (!payloads) { console.error('unknown scenario'); process.exit(2); }
  const server = await startStaticServer({ root: ROOT, host: '127.0.0.1', port: PORT });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

  const slug = 'replay-' + Date.now() + '.html';
  const diskPath = path.join(ROOT, slug);
  fs.copyFileSync(htmlPath, diskPath);
  await page.goto('http://127.0.0.1:' + PORT + '/' + slug + '?session=test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  for (const t of payloads) {
    await sendPayload(page, t.p);
    const seen = await waitForText(page, t.check, 4000);
    const ok = t.check(seen);
    console.log((ok ? '[OK]' : '[FAIL]'), t.name);
    if (!ok) console.log('  tail:', seen.slice(-200));
  }

  fs.unlinkSync(diskPath);
  await ctx.close();
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
