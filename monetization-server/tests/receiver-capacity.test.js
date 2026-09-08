import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import ninja, { ninjaChannel } from '../ninjabacker-relay.js';
import shopify, { shopifyChannel } from '../shopify-relay.js';

for (const [name, prefix, plugin, channelFor] of [['ninja', 'ninjabacker', ninja, ninjaChannel], ['shopify', 'shopify', shopify, shopifyChannel]]) {
 test(name + ' rejects overflow without losing retries and isolates acknowledgments', async () => {
  const db = new Database(':memory:'), app = Fastify(), now = Date.now();
  const key = 'e'.repeat(64), channel = channelFor(key), secret = 'synthetic-signing-secret-32-characters', shop = 'synthetic.myshopify.com';
  const headers = { authorization: 'Bearer ' + key }, root = '/v1/' + prefix, table = name + '_deliveries';
  try {
   await app.register(plugin, { db, masterKey: crypto.randomBytes(32), now: () => now, fetch: async () => ({ ok: true, json: async () => ({ username: 'synthetic' }) }) });
   const setup = await app.inject({ method: 'POST', url: root + '/connection', headers, payload: name === 'ninja' ? { username: 'synthetic', token: 'synthetic-tip-token', secret } : { shop, secret } });
   assert.equal(setup.statusCode, 200);
   const send = id => {
    const payload = JSON.stringify(name === 'ninja' ? { type: 'tip', amount: 5, currency: 'USD', timestamp: now } : { id: String(id), test: false, financial_status: 'paid', updated_at: new Date(now).toISOString(), total_price: '5.00', currency: 'USD' });
    const timestamp = String(Math.floor(now / 1000));
    return app.inject({ method: 'POST', url: root + '/webhook/' + channel, payload, headers: { 'content-type': 'application/json', ...(name === 'ninja' ? { 'x-ninjabacker-delivery': String(id), 'x-ninjabacker-signature': 't=' + timestamp + ',v1=' + crypto.createHmac('sha256', secret).update(timestamp + '.').update(payload).digest('hex') } : { 'x-shopify-shop-domain': shop, 'x-shopify-topic': 'orders/paid', 'x-shopify-hmac-sha256': crypto.createHmac('sha256', secret).update(payload).digest('base64') }) } });
   };
   const ok = name === 'ninja' ? 204 : 200;
   assert.equal((await send(1)).statusCode, ok);
   const insert = db.prepare('INSERT INTO ' + table + '(channel,id,payload,created) VALUES(?,?,?,?)');
   db.transaction(() => { for (let i = 0; i < 999; i++) insert.run(channel, 'fixture-' + i, '{}', now); })();
   assert.equal((await send(1)).statusCode, ok); // Retrying an existing delivery succeeds even when full.
   assert.equal((await send(2)).statusCode, 503);
   const pull = (await app.inject({ url: root + '/events', headers })).json();
   assert.equal(pull.events.length, 5);
   const ack = { lease: pull.lease, ids: [pull.events[0].id] };
   await app.inject({ method: 'POST', url: root + '/ack', headers: { authorization: 'Bearer ' + 'f'.repeat(64) }, payload: ack });
   assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE ack=0').get().n, 1000);
   await app.inject({ method: 'POST', url: root + '/ack', headers, payload: ack });
   const responses = await Promise.all([send(2), send(3)]);
   assert.deepEqual(responses.map(r => r.statusCode).sort((a, b) => a - b), [ok, 503]);
   assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE ack=0').get().n, 1000);
  } finally { await app.close(); db.close(); }
 });
}
