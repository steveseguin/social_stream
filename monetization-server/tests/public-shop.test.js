import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { createServer } from '../server.js';
import { shopId } from '../public-shop.js';

test('Public catalog has a stable read-only identity, whitelists fields and can be unpublished', async () => {
    const db = new Database(':memory:'), key = randomBytes(32).toString('hex'), id = shopId(key);
    const app = await createServer({ publicShop: { db } });
    const headers = { authorization: 'Bearer ' + key };
    const item = { name: 'Creator shirt', url: 'https://example.com/shirt', image: '', amount: 25, currency: 'USD', purpose: 'shop', customer: 'PRIVATE' };
    try {
        assert.equal((await app.inject({ method: 'POST', url: '/v1/shop', payload: { items: [item] } })).statusCode, 401);
        const post = payload => app.inject({ method: 'POST', url: '/v1/shop', headers, payload });
        assert.equal((await post({ items: [{ ...item, url: 'javascript:alert(1)' }] })).statusCode, 400);
        assert.equal((await post({ enabled: true, items: [item], session: 'PRIVATE', key, live: { mode: 'show', url: item.url, until: 0 } })).json().id, id);
        let response = await app.inject('/v1/shop/' + id);
        assert.equal(response.statusCode, 200); assert.equal(response.headers['cache-control'], 'no-store');
        assert(!response.body.includes('PRIVATE')); assert(!response.body.includes(key));
        assert.equal(response.json().commerce.live.url, item.url);
        // A reader cannot overwrite or delete the publisher's page using the public ID.
        await app.inject({ method: 'DELETE', url: '/v1/shop', headers: { authorization: 'Bearer ' + id } });
        assert.equal((await app.inject('/v1/shop/' + id)).statusCode, 200);
        assert.equal((await post({ enabled: false, items: [{ ...item, name: 'Updated shirt' }] })).json().id, id);
        response = await app.inject('/v1/shop/' + id);
        assert.equal(response.json().commerce.items[0].name, 'Updated shirt');
        assert.equal(response.json().commerce.live.mode, 'hide');
        await app.inject({ method: 'DELETE', url: '/v1/shop', headers });
        assert.equal((await app.inject('/v1/shop/' + id)).statusCode, 404);
        assert.equal((await post({ items: [item] })).json().id, id);
    } finally { await app.close(); db.close(); }
});

test('Public pages fail clearly when the service is not configured', async () => {
    const app = await createServer();
    try { assert.equal((await app.inject({ method: 'POST', url: '/v1/shop', payload: { items: [] } })).statusCode, 503); }
    finally { await app.close(); }
});

test('Malformed public catalog fields stay bounded and never expose publisher metadata', async () => {
    const db = new Database(':memory:'), key = randomBytes(32).toString('hex');
    const app = await createServer({ publicShop: { db } });
    const headers = { authorization: 'Bearer ' + key };
    try {
        for (const value of [null, false, true, '', [], ['USD'], {}, { toString: null }]) {
            const response = await app.inject({ method: 'POST', url: '/v1/shop', headers, payload: { enabled: true, seconds: value, items: [{ name: 'Mug', url: 'https://example.invalid/mug', amount: value, currency: value, privateToken: key }] } });
            assert.equal(response.statusCode, 200, response.body);
            const read = await app.inject('/v1/shop/' + shopId(key));
            assert.equal(read.statusCode, 200);
            assert(!read.body.includes(key));
            assert.equal(read.json().commerce.items[0].amount, null);
            assert.equal(read.json().commerce.items[0].currency, 'USD');
        }
        for (const items of [[null], [{}], Array(21).fill({ name: 'Mug', url: 'https://example.invalid' })]) {
            assert.equal((await app.inject({ method: 'POST', url: '/v1/shop', headers, payload: { items } })).statusCode, 400);
        }
    } finally { await app.close(); db.close(); }
});
