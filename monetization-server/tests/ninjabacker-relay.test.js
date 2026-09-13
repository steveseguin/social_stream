import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import relay, { verifyNinja, ninjaChannel } from '../ninjabacker-relay.js';

test('NinjaBacker HMAC authenticates raw bytes and the delivery timestamp', () => {
 const secret = 'a'.repeat(64), now = Date.now(), time = String(Math.floor(now / 1000));
 const body = Buffer.from('{ "type":"tip", "timestamp":1 }');
 const signature = 't=' + time + ',v1=' + crypto.createHmac('sha256', secret).update(time + '.').update(body).digest('hex');
 assert(verifyNinja(body, signature, secret, now));
 assert(!verifyNinja(Buffer.from(JSON.stringify(JSON.parse(body))), signature, secret, now));
 assert(!verifyNinja(body, signature, secret, now + 301000));
 assert(!verifyNinja(body, signature, secret, now - 301000));
 for (const invalid of ['', 't=0,v1=x', 't=Infinity,v1=' + 'a'.repeat(64)]) assert(!verifyNinja(body, invalid, secret));
});

test('Receiver persists offline tips and deduplication across restart, leases work, and removes private data', async () => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-receiver-'));
 const database = path.join(directory, 'receiver.db'), masterKey = crypto.randomBytes(32), key = 'b'.repeat(64), secret = 'c'.repeat(64);
 const channel = ninjaChannel(key), headers = { authorization: 'Bearer ' + key };
 let clock = Date.now(), app, db;
 async function open() {
  db = new Database(database); app = Fastify();
  await app.register(relay, { db, masterKey, now: () => clock, fetch: async url => ({ ok: url.endsWith('/private-tip-id'), json: async () => ({ username: 'creator' }) }) });
 }
 async function send(id, overrides = {}, invalid = false) {
  const body = JSON.stringify({ type: 'tip', amount: 500, currency: 'JPY', timestamp: 123, name: 'Secret identity', anonymous: true, message: '<b>Hello</b>', callbackId: 'not-authentication', receiptEmail: 'private@example.invalid', ...overrides });
  const time = String(Math.floor(clock / 1000));
  const signature = crypto.createHmac('sha256', secret).update(time + '.').update(body).digest('hex');
  return app.inject({ method: 'POST', url: '/v1/ninjabacker/webhook/' + channel, headers: { 'content-type': 'application/json; charset=utf-8', 'x-ninjabacker-delivery': id, 'x-ninjabacker-signature': 't=' + time + ',v1=' + (invalid ? '0'.repeat(64) : signature) }, payload: body });
 }
 try {
  await open();
  assert.equal((await app.inject('/v1/ninjabacker/events')).statusCode, 401);
  const configure = payload => app.inject({ method: 'POST', url: '/v1/ninjabacker/connection', headers, payload });
  assert.equal((await configure({ username: 'other', token: 'private-tip-id', secret })).statusCode, 401);
  assert.equal((await configure({ username: 'creator', token: 'private-tip-id', secret })).statusCode, 200);
  assert(!db.prepare('SELECT secret FROM ninja_receivers').get().secret.includes(secret));
  assert.equal((await send('first', {}, true)).statusCode, 401);
  assert.equal((await send('first')).statusCode, 204);
  assert.equal((await send('first')).statusCode, 204);
  assert.equal((await send('preview', { isTest: true })).statusCode, 204);
  assert.equal(db.prepare('SELECT count(*) AS n FROM ninja_deliveries').get().n, 2);
  await app.close(); db.close(); await open();
  assert.equal((await send('first')).statusCode, 204);
  const pull = (await app.inject({ url: '/v1/ninjabacker/events', headers })).json();
  assert.equal(pull.events.length, 2);
  assert.equal(pull.events[0].data.amount, 500);
  assert.equal(pull.events[0].data.fromLabel, 'Anonymous');
  assert.equal(pull.events[0].data.message, '<b>Hello</b>');
  assert(!JSON.stringify(pull).includes('Secret identity'));
  assert(!JSON.stringify(pull).includes('receiptEmail'));
  assert(!JSON.stringify(pull).includes('callbackId'));
  assert(pull.events.find(e => e.id === 'preview').data.isTest);
  assert.equal((await app.inject({ url: '/v1/ninjabacker/events', headers })).json().events.length, 0);
  clock += 61000;
  const retry = (await app.inject({ url: '/v1/ninjabacker/events', headers })).json();
  assert.equal(retry.events.length, 2);
  const ack = value => app.inject({ method: 'POST', url: '/v1/ninjabacker/ack', headers, payload: value });
  await ack({ lease: pull.lease, ids: ['first', 'preview'] });
  assert.equal(db.prepare('SELECT sum(ack) AS n FROM ninja_deliveries').get().n, 0);
  await ack({ lease: retry.lease, ids: ['first', 'preview'] });
  assert.equal(db.prepare('SELECT count(*) AS n FROM ninja_deliveries WHERE payload IS NOT NULL').get().n, 0);
  await app.close(); db.close(); await open();
  assert.equal((await send('first')).statusCode, 204);
  assert.equal((await app.inject({ url: '/v1/ninjabacker/events', headers })).json().events.length, 0);
  assert.equal((await app.inject({ url: '/v1/ninjabacker/events', headers: { authorization: 'Bearer ' + 'd'.repeat(64) } })).statusCode, 404);
  db.exec("CREATE TEMP TRIGGER fail_queue BEFORE INSERT ON ninja_deliveries BEGIN SELECT RAISE(ABORT,'disk failure fixture'); END");
  assert.equal((await send('storage-fails')).statusCode, 500);
  db.exec('DROP TRIGGER fail_queue');
  assert.equal((await send('storage-fails')).statusCode, 204);
  clock += 8 * 86400000;
  assert.equal((await app.inject({ url: '/v1/ninjabacker/events', headers })).json().events.length, 0);
  assert.equal((await app.inject({ method: 'DELETE', url: '/v1/ninjabacker/connection', headers })).statusCode, 200);
  assert.equal((await send('gone')).statusCode, 410);
 } finally { await app.close(); db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
