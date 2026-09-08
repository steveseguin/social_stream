import crypto from 'node:crypto';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const retention = 7 * 86400000;
export const ninjaChannel = key => hash('ssn-ninjabacker:' + key);

export function verifyNinja(body, header, secret, now = Date.now()) {
 const match = /^t=(\d{10,11}),v1=([a-f0-9]{64})$/.exec(header || '');
 if (!Buffer.isBuffer(body) || !match || Math.abs(now / 1000 - Number(match[1])) > 300) return false;
 const expected = crypto.createHmac('sha256', secret).update(match[1] + '.').update(body).digest();
 return crypto.timingSafeEqual(expected, Buffer.from(match[2], 'hex'));
}

export default async function ninjaRelay(app, { db, masterKey, fetch: transport = fetch, now = Date.now } = {}) {
 if (!db || !Buffer.isBuffer(masterKey) || masterKey.length !== 32) throw new Error('NinjaBacker receiver requires its database and encryption key');
 db.exec(`CREATE TABLE IF NOT EXISTS ninja_receivers (id TEXT PRIMARY KEY, username TEXT NOT NULL, secret TEXT NOT NULL, received INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ninja_deliveries (channel TEXT NOT NULL, id TEXT NOT NULL, payload TEXT, created INTEGER NOT NULL, ack INTEGER NOT NULL DEFAULT 0, lease TEXT, expires INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(channel,id));
 CREATE INDEX IF NOT EXISTS ninja_pending ON ninja_deliveries(channel,ack,created);`);
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
  return ninjaChannel(match[1]);
 }
 function cleanup() { db.prepare('DELETE FROM ninja_deliveries WHERE created < ?').run(now() - retention); }
 // Keep raw bytes for HMAC; only this plugin uses this parser.
 app.removeContentTypeParser('application/json');
 app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 16384 }, (_req, body, done) => done(null, body));
 function json(request) {
  try { const value = JSON.parse(request.body.toString()); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch {}
  throw fail('Invalid request.');
 }
 app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
 app.get('/v1/ninjabacker/status', async () => ({ protocol: 'ssn-ninjabacker-1' }));
 app.post('/v1/ninjabacker/connection', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async request => {
  const id = credentials(request), value = json(request);
  if (!/^[a-z0-9_-]{1,50}$/.test(value.username || '') || !/^[a-zA-Z0-9_-]{8,128}$/.test(value.token || '')) throw fail('Enter your NinjaBacker username and private Tip ID.');
  const existing = db.prepare('SELECT * FROM ninja_receivers WHERE id=?').get(id);
  if (value.secret && (typeof value.secret !== 'string' || value.secret.length < 32 || value.secret.length > 256 || /\s/.test(value.secret))) throw fail('Paste the signing secret from your NinjaBacker dashboard.');
  if (!value.secret && (!existing || existing.username !== value.username)) throw fail('A NinjaBacker signing secret is required.');
  if (existing && existing.username !== value.username) throw fail('Switch to live delivery before changing the reliable-delivery account.');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
  try {
   const response = await transport('https://ninjabacker.com/v1/public/performer/' + encodeURIComponent(value.token), { redirect: 'error', signal: controller.signal });
   if (!response.ok || (await response.json()).username !== value.username) throw fail('The private Tip ID must belong to this NinjaBacker account.', 401);
  } finally { clearTimeout(timeout); }
  if (!existing && db.prepare('SELECT count(*) AS n FROM ninja_receivers').get().n >= 1000) throw fail('Receiver capacity reached. Try again later.', 503);
  db.prepare('INSERT INTO ninja_receivers(id,username,secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret').run(id, value.username, value.secret ? seal(value.secret) : existing.secret);
  return { webhook: 'https://api.socialstream.ninja/v1/ninjabacker/webhook/' + id };
 });
 app.delete('/v1/ninjabacker/connection', async request => {
  const id = credentials(request);
  db.transaction(() => { db.prepare('DELETE FROM ninja_deliveries WHERE channel=?').run(id); db.prepare('DELETE FROM ninja_receivers WHERE id=?').run(id); })();
  return { disconnected: true };
 });
 app.post('/v1/ninjabacker/webhook/:channel', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (request, reply) => {
  const id = request.params.channel, delivery = request.headers['x-ninjabacker-delivery'];
  if (!/^[a-f0-9]{64}$/.test(id)) throw fail('Invalid receiver.');
  const row = db.prepare('SELECT secret FROM ninja_receivers WHERE id=?').get(id);
  if (!row) throw fail('Receiver is no longer configured.', 410);
  if (!verifyNinja(request.body, request.headers['x-ninjabacker-signature'], unseal(row.secret), now())) throw fail('Invalid signature.', 401);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(delivery || '')) throw fail('Missing or invalid delivery ID.');
  const data = json(request);
  if (data.type !== 'tip') return reply.code(204).send();
  if ((data.isTest !== undefined && typeof data.isTest !== 'boolean') || (data.anonymous !== undefined && typeof data.anonymous !== 'boolean')) throw fail('Invalid tip flags.');
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 10000000 || !/^[A-Z]{3}$/.test(data.currency || '') || !Number.isSafeInteger(data.timestamp) || data.timestamp <= 0) throw fail('Invalid tip.');
  // Whitelist public fields, preserve major units, and strip correlation/receipt/private data.
  const payload = JSON.stringify({ type: 'tip', amount: data.amount, currency: data.currency, timestamp: data.timestamp, fromLabel: data.anonymous ? 'Anonymous' : typeof data.name === 'string' ? data.name.slice(0, 60) : 'Anonymous', message: typeof data.message === 'string' ? data.message.slice(0, 500) : '', anonymous: data.anonymous === true, isTest: data.isTest === true });
  db.transaction(() => {
   cleanup();
   if (db.prepare('SELECT 1 FROM ninja_deliveries WHERE channel=? AND id=?').get(id, delivery)) return;
   if (db.prepare('SELECT count(*) AS n FROM ninja_deliveries WHERE channel=? AND ack=0').get(id).n >= 1000 || db.prepare('SELECT count(*) AS n FROM ninja_deliveries').get().n >= 100000) throw fail('Receiver queue is full. Retry later.', 503);
   db.prepare('INSERT INTO ninja_deliveries(channel,id,payload,created) VALUES(?,?,?,?)').run(id, delivery, payload, now());
   db.prepare('UPDATE ninja_receivers SET received=? WHERE id=?').run(now(), id);
  })();
  return reply.code(204).send(); // Only after durable commit, never after emitting an alert.
 });
 app.get('/v1/ninjabacker/events', async request => {
  const id = credentials(request);
  const receiver = db.prepare('SELECT received FROM ninja_receivers WHERE id=?').get(id);
  if (!receiver) throw fail('Set up reliable delivery again.', 404);
  return db.transaction(() => {
   cleanup();
   const rows = db.prepare('SELECT id,payload FROM ninja_deliveries WHERE channel=? AND ack=0 AND expires<=? ORDER BY created,id LIMIT 5').all(id, now());
   const lease = crypto.randomBytes(16).toString('hex');
   for (const row of rows) db.prepare('UPDATE ninja_deliveries SET lease=?,expires=? WHERE channel=? AND id=?').run(lease, now() + 60000, id, row.id);
   return { received: receiver.received, lease, events: rows.map(row => ({ id: row.id, data: JSON.parse(row.payload) })) };
  })();
 });
 app.post('/v1/ninjabacker/ack', async request => {
  const id = credentials(request), value = json(request);
  if (!/^[a-f0-9]{32}$/.test(value.lease || '') || !Array.isArray(value.ids) || value.ids.length > 5 || value.ids.some(v => typeof v !== 'string' || v.length > 128)) throw fail('Invalid acknowledgment.');
  db.transaction(() => { for (const delivery of value.ids) db.prepare('UPDATE ninja_deliveries SET ack=1,payload=NULL,lease=NULL WHERE channel=? AND id=? AND lease=?').run(id, delivery, value.lease); })();
  return { accepted: true };
 });
 const timer = setInterval(cleanup, 3600000); timer.unref();
 app.addHook('onClose', async () => clearInterval(timer));
}
