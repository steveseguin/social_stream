import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import ninja from '../ninjabacker-relay.js';
import shopify from '../shopify-relay.js';

for (const [name, plugin] of [['ninja', ninja], ['shopify', shopify]]) {
 test(name + ' retention expires old receipts without scanning every retained receipt', async () => {
  const db = new Database(':memory:'), app = Fastify(), now = Date.now();
  try {
   await app.register(plugin, { db, masterKey: crypto.randomBytes(32), now: () => now });
   await app.ready();
   const table = name + '_deliveries';
   const insert = db.prepare('INSERT INTO ' + table + '(channel,id,created,ack,payload) VALUES(?,?,?,?,?)');
   db.transaction(() => {
    for (let i = 0; i < 10000; i++) insert.run('synthetic', String(i), now, i % 2, i % 2 ? null : '{}');
    insert.run('synthetic', 'expired', now - 8 * 86400000, 1, null);
   })();
   const query = 'DELETE FROM ' + table + ' WHERE created < ?';
   const plan = db.prepare('EXPLAIN QUERY PLAN ' + query).all(now - 7 * 86400000);
   assert(plan.some(row => row.detail.includes(name + '_retention')), JSON.stringify(plan));
   assert.equal(db.prepare(query).run(now - 7 * 86400000).changes, 1);
   assert.equal(db.prepare('SELECT count(*) n FROM ' + table).get().n, 10000);
  } finally { await app.close(); db.close(); }
 });
}
