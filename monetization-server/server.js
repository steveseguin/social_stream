import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import { pathToFileURL } from 'node:url';
import throneRelay from './throne-relay.js';
import ebayShowcase from './ebay-showcase.js';

export async function createServer(options = {}) {
	const app = Fastify({ logger: false, bodyLimit: 16384, trustProxy: '127.0.0.1' });
	await app.register(cors, { origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], credentials: false });
	await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });
	await app.register(throneRelay, options.throne || {});
	if (options.ebay || process.env.EBAY_SHOWCASE_ENABLED === '1') {
		const db = options.ebay?.db || new Database(process.env.SSN_MONETIZATION_DB || 'monetization.db');
		if (!options.ebay?.db) app.addHook('onClose', async () => db.close());
		await app.register(ebayShowcase, { ...options.ebay, db });
	} else {
		app.route({ method: ['GET', 'POST', 'DELETE'], url: '/v1/ebay/*', handler: async (_request, reply) => reply.code(503).send({ code: 'EBAY_NOT_CONFIGURED' }) });
	}
	app.get('/v1/monetization/health', async () => ({ service: 'ssn-monetization', ok: true }));
	return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const app = await createServer();
	await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT || 3079) });
	for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close());
}
