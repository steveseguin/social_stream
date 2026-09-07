import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createServer } from '../server.js';
import { verifyShopify, paidOrder, shopifyChannel } from '../shopify-relay.js';

const secret = 'fixture-signing-secret-32-characters', shop = 'fixture-store.myshopify.com';
const order = () => ({ id: 12345, test: false, financial_status: 'paid', updated_at: new Date().toISOString(), total_price: '25.50', currency: 'USD', line_items: [{ product_id: 12, title: 'Creator shirt', quantity: 2 }], customer: { email: 'secret@example.invalid', first_name: 'Private' }, shipping_address: { address1: 'Private address' }, note: 'Private note', order_status_url: 'https://private.invalid/order' });
test('Shopify HMAC covers exact raw bytes, and paid orders exclude tests and private data', () => {
 const body = Buffer.from(JSON.stringify(order())), header = crypto.createHmac('sha256', secret).update(body).digest('base64');
 assert(verifyShopify(body, header, secret)); assert(!verifyShopify(Buffer.concat([body, Buffer.from(' ')]), header, secret));
 for (const bad of ['', 'abcd', header.slice(1)]) assert(!verifyShopify(body, bad, secret));
 const event = paidOrder(order(), shop); assert.equal(event.event, 'purchase'); assert.equal(event.hasDonation, undefined); assert.equal(event.meta.commerce.orderTotal, 25.5); assert.equal(event.meta.commerce.quantity, 2);
 for (const word of ['Private', 'secret@', 'order_status_url', 'shipping_address']) assert(!JSON.stringify(event).includes(word));
 for (const changes of [{ test: true }, { test: undefined }, { financial_status: 'pending' }, { financial_status: 'partially_paid' }, { cancelled_at: new Date().toISOString() }, { total_price: '0' }, { updated_at: '2001-01-01' }, { id: Number.MAX_SAFE_INTEGER + 1 }]) assert.equal(paidOrder({ ...order(), ...changes }, shop), null);
 const jpy = paidOrder({ ...order(), total_price_set: { shop_money: { amount: '2500', currency_code: 'JPY' } } }, shop); assert.equal(jpy.meta.commerce.orderTotal, 2500);
});
test('Shopify verifies store/topic, persists and deduplicates orders across restart, leases and deletes payloads', async () => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-shopify-relay-')), file = path.join(directory, 'store.db');
 const masterKey = crypto.randomBytes(32), key = 'a'.repeat(64), headers = { authorization: 'Bearer ' + key }, hook = '/v1/shopify/webhook/' + shopifyChannel(key);
 let app, db, clock = Date.now();
 const open = async () => { db = new Database(file); app = await createServer({ shopify: { db, masterKey, now: () => clock } }); };
 const send = (data, extra = {}) => { const body = JSON.stringify(data); return app.inject({ method: 'POST', url: hook, headers: { 'content-type': 'application/json', 'x-shopify-shop-domain': shop, 'x-shopify-topic': 'orders/paid', 'x-shopify-hmac-sha256': crypto.createHmac('sha256', secret).update(body).digest('base64'), ...extra }, payload: body }); };
 try {
  await open(); assert.equal((await app.inject('/v1/shopify/events')).statusCode, 401);
  const connection = await app.inject({ method: 'POST', url: '/v1/shopify/connection', headers, payload: { shop, secret } }); assert.equal(connection.statusCode, 200); assert.equal(connection.json().webhook, 'https://api.socialstream.ninja' + hook);
  assert(!db.prepare('SELECT secret FROM shopify_receivers').get().secret.includes(secret));
  assert.equal((await send(order(), { 'x-shopify-hmac-sha256': 'x'.repeat(43) + '=' })).statusCode, 401);
  assert.equal((await send(order(), { 'x-shopify-shop-domain': 'wrong.myshopify.com' })).statusCode, 401);
  await send(order(), { 'x-shopify-topic': 'orders/create' });
  await send({ ...order(), test: true });
  assert.equal(db.prepare('SELECT count(*) n FROM shopify_deliveries').get().n, 0);
  assert.equal((await send({ ...order(), note: 'x'.repeat(20000) })).statusCode, 200); // Real orders exceed the default body limit.
  await send(order(), { 'x-shopify-webhook-id': 'different-delivery-id' });
  await app.close(); db.close(); await open(); await send(order());
  const pull = (await app.inject({ url: '/v1/shopify/events', headers })).json(); assert.equal(pull.events.length, 1);
  assert.equal((await app.inject({ url: '/v1/shopify/events', headers })).json().events.length, 0);
  clock += 61000;
  const retry = (await app.inject({ url: '/v1/shopify/events', headers })).json(); assert.equal(retry.events.length, 1);
  await app.inject({ method: 'POST', url: '/v1/shopify/ack', headers, payload: { lease: pull.lease, ids: [pull.events[0].id] } }); assert.equal(db.prepare('SELECT ack FROM shopify_deliveries').get().ack, 0);
  await app.inject({ method: 'POST', url: '/v1/shopify/ack', headers, payload: { lease: retry.lease, ids: [retry.events[0].id] } }); assert.equal(db.prepare('SELECT payload FROM shopify_deliveries').get().payload, null);
  await send(order()); assert.equal((await app.inject({ url: '/v1/shopify/events', headers })).json().events.length, 0);
  await app.inject({ method: 'DELETE', url: '/v1/shopify/connection', headers }); assert.equal((await send(order())).statusCode, 410);
 } finally { if (app) await app.close(); if (db.open) db.close(); }
});
test('Shopify fails closed when the receiver is not enabled', async () => {
 const app = await createServer(); try { assert.equal((await app.inject('/v1/shopify/status')).statusCode, 503); } finally { await app.close(); }
});
