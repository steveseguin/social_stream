// Run manually: node --expose-gc monetization-server/tests/commerce-benchmark.js
// Synthetic CPU/SQLite measurements only: no external network or provider payments.
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import os from 'node:os';
import Database from 'better-sqlite3';
const M = createRequire(import.meta.url)('../../shared/monetization/core.js');
const now = Date.now();
function measure(fn, iterations) {
 const samples = [];
 for (let i = 0; i < iterations; i++) { const start = performance.now(); fn(i); samples.push(performance.now() - start); }
 samples.sort((a, b) => a - b);
 return { iterations, totalMs: +samples.reduce((sum, n) => sum + n, 0).toFixed(2), p50Ms: +samples[Math.floor(iterations * .5)].toFixed(4), p95Ms: +samples[Math.floor(iterations * .95)].toFixed(4) };
}
const payload = { type: 'tip', amount: 5, currency: 'USD', timestamp: now, fromLabel: 'Synthetic', message: 'Thank you' };
for (let i = 0; i < 2000; i++) M.tip(payload);
global.gc?.(); const initialHeap = process.memoryUsage().heapUsed;
const tips = measure(i => { const row = M.tip({ ...payload, id: String(i) }); if (row.donoValue !== 5) throw new Error('Tip mismatch'); }, 50000);
global.gc?.(); const retainedHeapBytes = process.memoryUsage().heapUsed - initialHeap;
const db = new Database(':memory:');
db.exec('CREATE TABLE deliveries(channel TEXT, id TEXT, created INTEGER, ack INTEGER, PRIMARY KEY(channel,id)); CREATE INDEX pending ON deliveries(channel,ack,created)');
const insert = db.prepare('INSERT INTO deliveries VALUES(?,?,?,?)');
db.transaction(() => { for (let i = 0; i < 100000; i++) insert.run('channel-' + (i % 100), String(i), now, 1); })();
const cleanup = db.prepare('DELETE FROM deliveries WHERE created < ?');
const beforeIndex = measure(() => cleanup.run(now - 604800000), 200);
db.exec('CREATE INDEX retention ON deliveries(created)');
const afterIndex = measure(() => cleanup.run(now - 604800000), 200);
db.close();
console.log(JSON.stringify({ node: process.version, platform: process.platform, cpu: os.cpus()[0].model, gcAvailable: !!global.gc, tips, retainedHeapBytes, retentionAt100kRows: { beforeIndex, afterIndex } }, null, 2));
