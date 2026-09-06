import crypto from "node:crypto";

const scope = "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const text = (value, max = 180) => (typeof value === "string" ? value.slice(0, max) : "");
const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// Only these public fields leave the service. Orders include private shipping/payment data.
export function paidSales(orders) {
	const sales = [];
	for (const order of orders || []) {
		if (order.orderPaymentStatus !== "PAID" || (order.cancelStatus?.cancelState && !["NONE_REQUESTED", "CANCEL_REJECTED"].includes(order.cancelStatus.cancelState))) continue;
		const payments = (order.paymentSummary?.payments || []).filter(p => p.paymentStatus === "PAID");
		const paidAt = Math.max(0, ...payments.map(p => Date.parse(p.paymentDate) || 0));
		for (const line of order.lineItems || []) {
			if (!/^\d{9,15}$/.test(line.legacyItemId || "") || !line.lineItemId || !order.orderId) continue;
			sales.push({ id: hash(order.orderId + ":" + line.lineItemId), itemId: line.legacyItemId, name: text(line.title), quantity: Math.max(1, Math.min(100000, Number(line.quantity) || 1)), paidAt, createdAt: Date.parse(order.creationDate) || 0 });
		}
	}
	return sales;
}
export function publicItem(item, id) {
	const auction = (item.buyingOptions || []).includes("AUCTION"),
		price = auction ? item.currentBidPrice || item.minimumPriceToBid : item.price;
	if (!item.title || !price || !Number.isFinite(Number(price.value)) || Number(price.value) < 0 || !/^[A-Z]{3}$/.test(price.currency || "")) throw failure("This listing does not have a supported price.");
	const image = text(item.image?.imageUrl, 2048);
	return { id, name: text(item.title), amount: Number(price.value), currency: price.currency, image: /^https:\/\/i\.ebayimg\.com\//i.test(image) ? image : "", url: "https://www.ebay.com/itm/" + id, auction, startingBid: auction && !item.currentBidPrice, endsAt: Date.parse(item.itemEndDate) || 0, available: !(item.estimatedAvailabilities || []).some(a => a.estimatedAvailabilityStatus === "OUT_OF_STOCK"), updatedAt: Date.now() };
}

// Optional, read-only seller integration; no listing edits, fulfillment or checkout permissions.
export default async function ebayShowcase(app, options = {}) {
	const db = options.db,
		clientId = options.clientId || process.env.EBAY_CLIENT_ID,
		secret = options.clientSecret || process.env.EBAY_CLIENT_SECRET,
		ruName = options.ruName || process.env.EBAY_RUNAME;
	if (!db || !clientId || !secret || !ruName) throw new Error("eBay requires a database, EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME");
	let browseToken = null;
	const transport = options.fetch || fetch,
		pending = new Map(),
		cache = new Map(),
		busy = new Set();
	db.exec("CREATE TABLE IF NOT EXISTS ebay_connections (id TEXT PRIMARY KEY, token TEXT NOT NULL, created INTEGER NOT NULL)");
	function seal(value, key) {
		const iv = crypto.randomBytes(12),
			cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
		return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString("base64");
	}
	function unseal(value, key) {
		const data = Buffer.from(value, "base64"),
			cipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), data.subarray(0, 12));
		cipher.setAuthTag(data.subarray(-16));
		return JSON.parse(Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString());
	}
	function credentials(request) {
		const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization || "");
		if (!match) throw failure("Connect eBay from SSN first.", 401);
		return { key: match[1], id: hash("ssn-ebay:" + match[1]) };
	}
	async function api(path, init) {
		const controller = new AbortController(),
			timeout = setTimeout(() => controller.abort(), 12000);
		try {
			const response = await transport("https://api.ebay.com" + path, { ...init, redirect: "error", signal: controller.signal });
			if (!response.ok) throw failure(response.status === 401 ? "Reconnect your eBay seller account." : response.status === 429 ? "eBay rate limit reached; retry shortly." : "eBay could not complete the request. Check API access and listing availability.", 502);
			return await response.json();
		} finally {
			clearTimeout(timeout);
		}
	}
	function token(body) {
		return api("/identity/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(clientId + ":" + secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() });
	}
	async function access(c) {
		const row = db.prepare("SELECT token FROM ebay_connections WHERE id = ?").get(c.id);
		if (!row) throw failure("Connect your eBay seller account first.", 401);
		let data = unseal(row.token, c.key);
		if (data.expires < Date.now() + 60000) {
			const result = await token({ grant_type: "refresh_token", refresh_token: data.refresh, scope });
			if (!result.access_token) throw failure("Reconnect your eBay account.", 502);
			data = { ...data, access: result.access_token, expires: Date.now() + Number(result.expires_in || 0) * 1000 };
			db.prepare("UPDATE ebay_connections SET token = ? WHERE id = ?").run(seal(data, c.key), c.id);
		}
		return data.access;
	}
	app.addHook("onSend", async (_request, reply) => {
		reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
	});
	app.get("/v1/ebay/status", async request => {
		const c = credentials(request);
		return { protocol: "ssn-ebay-1", connected: !!db.prepare("SELECT id FROM ebay_connections WHERE id = ?").get(c.id) };
	});
	app.post("/v1/ebay/connect", async request => {
		const c = credentials(request);
		for (const [key, value] of pending) if (value.expires < Date.now() || value.id === c.id) pending.delete(key);
		if (pending.size >= 1000 || db.prepare("SELECT count(*) AS count FROM ebay_connections").get().count >= 10000) throw failure("Connection service is busy. Try again later.", 503);
		const state = crypto.randomBytes(32).toString("hex");
		pending.set(state, { ...c, expires: Date.now() + 600000 });
		return { url: "https://auth.ebay.com/oauth2/authorize?" + new URLSearchParams({ client_id: clientId, redirect_uri: ruName, response_type: "code", scope, state }) };
	});
	app.get("/v1/ebay/callback", { logLevel: "silent" }, async (request, reply) => {
		const state = text(request.query.state, 64),
			c = pending.get(state);
		pending.delete(state);
		if (!c || c.expires < Date.now() || !request.query.code || request.query.error) return reply.code(400).type("text/plain").send("Connection cancelled or expired. Return to SSN and connect again.");
		const result = await token({ grant_type: "authorization_code", code: text(request.query.code, 8192), redirect_uri: ruName });
		if (!result.refresh_token || !result.access_token) throw failure("eBay did not grant seller access.", 502);
		db.prepare("INSERT OR REPLACE INTO ebay_connections (id, token, created) VALUES (?, ?, ?)").run(c.id, seal({ refresh: result.refresh_token, access: result.access_token, expires: Date.now() + Number(result.expires_in || 0) * 1000 }, c.key), Date.now());
		cache.delete(c.id);
		return reply.type("text/plain").send("eBay connected. Return to SSN, add your own listings, and enable the showcase.");
	});
	app.delete("/v1/ebay/connection", async request => {
		const c = credentials(request);
		db.prepare("DELETE FROM ebay_connections WHERE id = ?").run(c.id);
		cache.delete(c.id);
		for (const [state, value] of pending) if (value.id === c.id) pending.delete(state);
		return { connected: false };
	});
	app.get("/v1/ebay/item/:id", async request => {
		const c = credentials(request),
			id = request.params.id;
		if (!/^\d{9,15}$/.test(id)) throw failure("Use a full eBay item link.");
		await access(c);
		if (!browseToken || browseToken.expires < Date.now() + 60000) {
			const value = await token({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" });
			if (!value.access_token) throw failure("eBay Browse access is unavailable.", 502);
			browseToken = { value: value.access_token, expires: Date.now() + Number(value.expires_in || 0) * 1000 };
		}
		const bearer = browseToken.value;
		return publicItem(await api("/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=" + id, { headers: { Authorization: "Bearer " + bearer, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } }), id);
	});
	app.get("/v1/ebay/sales", async request => {
		const c = credentials(request),
			since = Number(request.query.since),
			now = Date.now();
		if (!Number.isSafeInteger(since) || since < now - 30 * 86400000 || since > now) throw failure("Sales history must be within the last 30 days.");
		const old = cache.get(c.id);
		if (old && old.at > now - 55000 && old.since <= since) return old.result;
		if (busy.has(c.id)) throw failure("Sales are updating. Retry shortly.", 429);
		busy.add(c.id);
		try {
			const bearer = await access(c),
				sales = [];
			let offset = 0;
			while (true) {
				const query = new URLSearchParams({ filter: "lastmodifieddate:[" + new Date(since).toISOString() + ".." + new Date(now).toISOString() + "]", limit: "200", offset: String(offset) });
				const result = await api("/sell/fulfillment/v1/order?" + query, { headers: { Authorization: "Bearer " + bearer } });
				if (!Array.isArray(result.orders)) throw failure("eBay returned an incomplete order response.", 502);
				sales.push(...paidSales(result.orders));
				offset += result.orders.length;
				if (!result.next) break;
				if (!result.orders.length || offset >= 10000) throw failure("Too many orders for this time window. Please narrow it.", 502);
			}
			const result = { sales, through: now };
			if (cache.size >= 1000) cache.delete(cache.keys().next().value);
			cache.set(c.id, { at: now, since, result });
			return result;
		} finally {
			busy.delete(c.id);
		}
	});
	app.addHook("onClose", async () => {
		pending.clear();
		cache.clear();
	});
}
