import crypto from 'node:crypto';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const retention = 7 * 86400000;
export const shopifyChannel = key => hash('ssn-shopify:' + key);

export function verifyShopify(body, header, secret) {
 if (!Buffer.isBuffer(body) || typeof header !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(header)) return false;
 return crypto.timingSafeEqual(crypto.createHmac('sha256', secret).update(body).digest(), Buffer.from(header, 'base64'));
}
export function paidOrder(data, shop, now = Date.now()) {
 if (!data || data.test !== false || data.cancelled_at || data.financial_status !== 'paid') return null;
 const updated = Date.parse(data.updated_at);
 if (!Number.isFinite(updated) || updated > now + 300000 || updated < now - retention) return null;
 const order = typeof data.id === 'string' && /^\d{1,30}$/.test(data.id) ? data.id : Number.isSafeInteger(data.id) && data.id > 0 ? String(data.id) : '';
 const money = data.total_price_set?.shop_money;
 const amount = money?.amount ?? data.total_price, currency = money?.currency_code ?? data.currency;
 if (!order || typeof amount !== 'string' || !/^\d+(?:\.\d+)?$/.test(amount) || !/^[A-Z]{3}$/.test(currency || '') || Number(amount) <= 0 || Number(amount) >= 10000000) return null;
 const lines = Array.isArray(data.line_items) ? data.line_items.slice(0, 250) : [];
 const quantity = data.line_items?.length <= 250 && lines.every(line => line && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity < 100000) ? lines.reduce((sum, line) => sum + line.quantity, 0) : 0;
 const titles = lines.filter(line => line && line.product_id && typeof line.title === 'string').map(line => line.title.trim().slice(0, 100)).filter(Boolean).slice(0, 3);
 return { id: hash(shop + ':' + order), event: 'purchase', platform: 'shopify', type: 'shopify', chatname: 'Anonymous', chatmessage: 'A store purchase was paid.', textonly: true, chatimg: '', subtitle: titles.join(', ').slice(0, 180), meta: { commerce: { ...(quantity ? { quantity } : {}), currency, orderTotal: Number(amount) } } };
}

export default async function shopifyRelay(app, { db, masterKey, now = Date.now } = {}) {
 if (!db || !Buffer.isBuffer(masterKey) || masterKey.length !== 32) throw new Error('Shopify receiver requires its database and encryption key');
 db.exec(`CREATE TABLE IF NOT EXISTS shopify_receivers (id TEXT PRIMARY KEY, shop TEXT NOT NULL, secret TEXT NOT NULL, received INTEGER NOT NULL DEFAULT 0, lastKind TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS shopify_deliveries (channel TEXT NOT NULL, id TEXT NOT NULL, payload TEXT, created INTEGER NOT NULL, ack INTEGER NOT NULL DEFAULT 0, lease TEXT, expires INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(channel,id));
 CREATE INDEX IF NOT EXISTS shopify_pending ON shopify_deliveries(channel,ack,created);`);
 function seal(value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
 }
 function unseal(value) {
  const data = Buffer.from(value, 'base64'), cipher = crypto.createDecipheriv('aes-256-gcm', masterKey, data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString();
 }
 function credentials(request) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization || '');
  if (!match) throw fail('Configure reliable delivery in SSN first.', 401);
  return shopifyChannel(match[1]);
 }
 function cleanup() { db.prepare('DELETE FROM shopify_deliveries WHERE created < ?').run(now() - retention); }
 // Keep raw bytes for HMAC; only this plugin uses this parser.
 app.removeContentTypeParser('application/json');
 app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 1048576 }, (_req, body, done) => done(null, body));
 function json(request) {
  try { const value = JSON.parse(request.body.toString()); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch {}
  throw fail('Invalid request.');
 }
 app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
 app.get('/v1/shopify/status', async () => ({ protocol: 'ssn-shopify-1' }));
 app.post('/v1/shopify/connection', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async request => {
  const id = credentials(request), value = json(request);
  if (typeof value.shop !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/.test(value.shop)) throw fail('Enter your store.myshopify.com domain.');
  const existing = db.prepare('SELECT * FROM shopify_receivers WHERE id=?').get(id);
  if (value.secret && (typeof value.secret !== 'string' || value.secret.length < 16 || value.secret.length > 256 || /\s/.test(value.secret))) throw fail('Paste the webhook signing secret from Shopify Notifications.');
  if (!value.secret && (!existing || existing.shop !== value.shop)) throw fail('A Shopify webhook signing secret is required.');
  if (existing && existing.shop !== value.shop) throw fail('Disconnect before changing stores.');
  if (!existing && db.prepare('SELECT count(*) AS n FROM shopify_receivers').get().n >= 1000) throw fail('Receiver capacity reached. Try again later.', 503);
  db.prepare('INSERT INTO shopify_receivers(id,shop,secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret').run(id, value.shop, value.secret ? seal(value.secret) : existing.secret);
  return { webhook: 'https://api.socialstream.ninja/v1/shopify/webhook/' + id };
 });
 app.delete('/v1/shopify/connection', async request => {
  const id = credentials(request);
  db.transaction(() => { db.prepare('DELETE FROM shopify_deliveries WHERE channel=?').run(id); db.prepare('DELETE FROM shopify_receivers WHERE id=?').run(id); })();
  return { disconnected: true };
 });
 app.post('/v1/shopify/webhook/:channel', { bodyLimit: 1048576, config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (request, reply) => {
  const id = request.params.channel;
  if (!/^[a-f0-9]{64}$/.test(id)) throw fail('Invalid receiver.');
  const row = db.prepare('SELECT secret,shop FROM shopify_receivers WHERE id=?').get(id);
  if (!row) throw fail('Receiver is no longer configured.', 410);
  if (!verifyShopify(request.body, request.headers['x-shopify-hmac-sha256'], unseal(row.secret))) throw fail('Invalid signature.', 401);
  if (request.headers['x-shopify-shop-domain'] !== row.shop) throw fail('Incorrect store.', 401);
  if (request.headers['x-shopify-topic'] !== 'orders/paid') return reply.code(200).send({ ignored: true });
  const data = json(request), event = paidOrder(data, row.shop, now());
  if (!event) {
   db.prepare('UPDATE shopify_receivers SET received=?,lastKind=? WHERE id=?').run(now(), data.test === true ? 'test' : 'skipped', id);
   return reply.code(200).send({ ignored: true });
  }
  const delivery = event.id, payload = JSON.stringify(event);
  db.transaction(() => {
   cleanup();
   if (db.prepare('SELECT 1 FROM shopify_deliveries WHERE channel=? AND id=?').get(id, delivery)) return;
   if (db.prepare('SELECT count(*) AS n FROM shopify_deliveries WHERE channel=? AND ack=0').get(id).n >= 1000 || db.prepare('SELECT count(*) AS n FROM shopify_deliveries').get().n >= 100000) throw fail('Receiver queue is full. Retry later.', 503);
   db.prepare('INSERT INTO shopify_deliveries(channel,id,payload,created) VALUES(?,?,?,?)').run(id, delivery, payload, now());
   db.prepare('UPDATE shopify_receivers SET received=?,lastKind=? WHERE id=?').run(now(), 'purchase', id);
  })();
  return reply.code(200).send({ accepted: true }); // Only after durable commit, never after emitting an alert.
 });
 app.get('/v1/shopify/events', async request => {
  const id = credentials(request);
  const receiver = db.prepare('SELECT received,lastKind FROM shopify_receivers WHERE id=?').get(id);
  if (!receiver) throw fail('Set up reliable delivery again.', 404);
  return db.transaction(() => {
   cleanup();
   const rows = db.prepare('SELECT id,payload FROM shopify_deliveries WHERE channel=? AND ack=0 AND expires<=? ORDER BY created,id LIMIT 5').all(id, now());
   const lease = crypto.randomBytes(16).toString('hex');
   for (const row of rows) db.prepare('UPDATE shopify_deliveries SET lease=?,expires=? WHERE channel=? AND id=?').run(lease, now() + 60000, id, row.id);
   return { received: receiver.received, lastKind: receiver.lastKind, lease, events: rows.map(row => ({ id: row.id, data: JSON.parse(row.payload) })) };
  })();
 });
 app.post('/v1/shopify/ack', async request => {
  const id = credentials(request), value = json(request);
  if (!/^[a-f0-9]{32}$/.test(value.lease || '') || !Array.isArray(value.ids) || value.ids.length > 5 || value.ids.some(v => typeof v !== 'string' || v.length > 128)) throw fail('Invalid acknowledgment.');
  db.transaction(() => { for (const delivery of value.ids) db.prepare('UPDATE shopify_deliveries SET ack=1,payload=NULL,lease=NULL WHERE channel=? AND id=? AND lease=?').run(id, delivery, value.lease); })();
  return { accepted: true };
 });
 const timer = setInterval(cleanup, 3600000); timer.unref();
 app.addHook('onClose', async () => clearInterval(timer));
}
