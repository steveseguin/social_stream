import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../shared/monetization/core.js');
export const shopId = key => createHash('sha256').update('ssn-public-shop:' + key).digest('hex');

// Public snapshots only. The write capability is never stored or returned.
export default async function publicShop(app, { db }) {
    db.exec('CREATE TABLE IF NOT EXISTS public_shops (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated INTEGER NOT NULL)');
    const get = db.prepare('SELECT body, updated FROM public_shops WHERE id = ?');
    function identity(request, reply) {
        const key = String(request.headers.authorization || '').replace(/^Bearer /, '');
        if (!/^[a-f0-9]{64}$/.test(key)) { reply.code(401).send({ error: 'A private publishing key is required.' }); return ''; }
        return shopId(key);
    }
    app.post('/v1/shop', { bodyLimit: 98304 }, async (request, reply) => {
        const id = identity(request, reply); if (!id) return;
        const raw = request.body;
        if (!raw || !Array.isArray(raw.items) || raw.items.length > 20) return reply.code(400).send({ error: 'Invalid product list.' });
        const c = M.commerce(raw);
        if (c.items.length !== raw.items.length) return reply.code(400).send({ error: 'Invalid public product link.' });
        if (!get.get(id) && db.prepare('SELECT count(*) n FROM public_shops').get().n >= 1000) return reply.code(503).send({ error: 'Public page capacity reached.' });
        const live = raw.live;
        if (live && ['hide', 'show'].includes(live.mode)) c.live = { mode: live.mode, url: c.items.some(item => item.url === live.url) ? live.url : '', until: Number.isFinite(live.until) ? Math.max(0, Math.min(Date.now() + 3600000, live.until)) : 0 };
        // Do not retain overlay settings, private metadata, session IDs, or customer data.
        const body = { items: c.items, display: c.display, seconds: c.seconds, live: c.enabled ? c.live : { mode: 'hide', until: 0 } };
        db.prepare('INSERT INTO public_shops VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body, updated=excluded.updated').run(id, JSON.stringify(body), Date.now());
        return { id };
    });
    app.delete('/v1/shop', async (request, reply) => {
        const id = identity(request, reply); if (!id) return;
        db.prepare('DELETE FROM public_shops WHERE id = ?').run(id);
        return { removed: true };
    });
    app.get('/v1/shop/:id', async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const row = /^[a-f0-9]{64}$/.test(request.params.id) && get.get(request.params.id);
        if (!row) return reply.code(404).send({ error: 'This page is not published.' });
        return { commerce: JSON.parse(row.body), updated: row.updated };
    });
}
