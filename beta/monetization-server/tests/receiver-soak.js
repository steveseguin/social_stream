// Manual bounded soak: node --expose-gc monetization-server/tests/receiver-soak.js
// Real localhost HTTP, synthetic signed deliveries, disposable SQLite WAL/FULL DBs.
// Plugins run without the production rate limiter to measure receiver work itself.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import ninja, { ninjaChannel } from '../ninjabacker-relay.js';
import shopify, { shopifyChannel } from '../shopify-relay.js';

const count = 10000, secret = 'synthetic-signing-secret-32-characters', key = 'e'.repeat(64), shop = 'synthetic.myshopify.com';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-commerce-soak-'));
const results = [];
try {
 for (const [name, prefix, plugin, channel] of [['ninja', 'ninjabacker', ninja, ninjaChannel(key)], ['shopify', 'shopify', shopify, shopifyChannel(key)]]) {
  let app, db, base, clock = Date.now(), operations = 0;
  const masterKey = crypto.randomBytes(32), file = path.join(directory, name + '.db'), samples = [], start = performance.now();
  const memory = () => { global.gc?.(); const m = process.memoryUsage(); return { heapMiB: +(m.heapUsed / 1048576).toFixed(2), rssMiB: +(m.rss / 1048576).toFixed(2) }; };
  async function open() {
   db = new Database(file); db.pragma('journal_mode=WAL'); db.pragma('synchronous=FULL');
   app = Fastify({ logger: false });
   await app.register(plugin, { db, masterKey, now: () => clock, fetch: async () => ({ ok: true, json: async () => ({ username: 'synthetic' }) }) });
   base = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function request(route, payload, headers = {}) {
   operations++;
   const response = await fetch(base + '/v1/' + prefix + route, { method: payload === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + key, ...(payload === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(payload === undefined ? {} : { body: typeof payload === 'string' ? payload : JSON.stringify(payload) }) });
   const text = await response.text();
   assert(response.ok, response.status + ': ' + text);
   return text ? JSON.parse(text) : null;
  }
  async function send(id) {
   const body = JSON.stringify(name === 'ninja' ? { type: 'tip', timestamp: clock, amount: 5, currency: 'USD', name: 'Synthetic', message: 'Thank you', receiptEmail: 'private@example.invalid' } : { id: String(id), test: false, financial_status: 'paid', updated_at: new Date(clock).toISOString(), total_price: '5.00', currency: 'USD', line_items: [{ product_id: 1, title: 'Mug', quantity: 1 }], customer: { email: 'private@example.invalid' } });
   const time = String(Math.floor(clock / 1000));
   return request('/webhook/' + channel, body, name === 'ninja' ? { 'x-ninjabacker-delivery': String(id), 'x-ninjabacker-signature': 't=' + time + ',v1=' + crypto.createHmac('sha256', secret).update(time + '.').update(body).digest('hex') } : { 'x-shopify-shop-domain': shop, 'x-shopify-topic': 'orders/paid', 'x-shopify-hmac-sha256': crypto.createHmac('sha256', secret).update(body).digest('base64') });
  }
  try {
   await open();
   await request('/connection', name === 'ninja' ? { username: 'synthetic', token: 'synthetic-tip-token', secret } : { shop, secret });
   samples.push({ deliveries: 0, ...memory() });
   for (let i = 1; i <= count; i++) {
    await send(i);
    if (i % 10 === 0) await send(i); // Authentic provider retries must not double-deliver.
    if (i % 5 === 0) {
     let pull = await request('/events'); assert.equal(pull.events.length, 5);
     assert(!JSON.stringify(pull).includes('private@example.invalid'));
     assert.equal(new Set(pull.events.map(event => event.id)).size, 5);
     if (i % 1000 === 0) {
      assert.equal((await request('/events')).events.length, 0);
      const previous = pull;
      clock += 61000;
      pull = await request('/events');
      assert.deepEqual(pull.events.map(e => e.id), previous.events.map(e => e.id));
      await request('/ack', { lease: previous.lease, ids: previous.events.map(e => e.id) });
      assert.equal(db.prepare('SELECT count(*) n FROM ' + name + '_deliveries WHERE ack=0').get().n, 5);
     }
     await request('/ack', { lease: pull.lease, ids: pull.events.map(event => event.id) });
    }
    if (i % 2000 === 0) {
     assert.equal(db.prepare('SELECT count(*) n FROM ' + name + '_deliveries WHERE payload IS NOT NULL').get().n, 0);
     await app.close(); db.close(); await open();
     await send(i); // Deduplication survives restart.
     assert.equal((await request('/events')).events.length, 0);
     samples.push({ deliveries: i, ...memory() });
     console.log(JSON.stringify({ provider: name, deliveries: i, operations, elapsedSeconds: +((performance.now() - start) / 1000).toFixed(2), ...samples[samples.length - 1] }));
    }
   }
   assert.equal(db.prepare('SELECT count(*) n FROM ' + name + '_deliveries').get().n, count);
   clock += 8 * 86400000;
   assert.equal((await request('/events')).events.length, 0);
   assert.equal(db.prepare('SELECT count(*) n FROM ' + name + '_deliveries').get().n, 0);
   results.push({ provider: name, operations, deliveries: count, elapsedSeconds: +((performance.now() - start) / 1000).toFixed(2), samples });
  } finally { if (app) await app.close(); if (db?.open) db.close(); }
 }
 console.log(JSON.stringify({ node: process.version, platform: process.platform, cpu: os.cpus()[0].model, results }, null, 2));
} finally {
 // Only this freshly-created, resolved temp directory can be removed.
 const resolved = path.resolve(directory), parent = path.resolve(os.tmpdir());
 if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('ssn-commerce-soak-')) throw new Error('Unexpected temp directory');
 fs.rmSync(resolved, { recursive: true, force: true });
}
