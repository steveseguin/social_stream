import crypto from "node:crypto";

// Source: https://help.throne.com/en/articles/15935990-how-do-i-set-up-webhook-integration
export const THRONE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPXbUfxh7XL4SYUVcfhmYMIbxvtR9E9LDd8gPJ1PwSD8=
-----END PUBLIC KEY-----`;
export const channelId = key =>
	crypto
		.createHash("sha256")
		.update("ssn-throne:" + key)
		.digest("hex");

export function verifyGift(body, headers, publicKey = THRONE_PUBLIC_KEY, now = Date.now()) {
	const timestamp = headers["x-signature-timestamp"],
		signature = headers["x-signature-ed25519"];
	if (!Buffer.isBuffer(body) || body.length > 16384 || !/^\d{10,11}$/.test(timestamp || "") || !/^[a-f0-9]{128}$/i.test(signature || "") || Math.abs(now / 1000 - Number(timestamp)) > 300) return null;
	try {
		if (!crypto.verify(null, Buffer.concat([Buffer.from(timestamp + "."), body]), publicKey, Buffer.from(signature, "hex"))) return null;
		const event = JSON.parse(body.toString("utf8")),
			data = event.data;
		if (event.contract_version !== "1" || !/^[\w-]{1,128}$/.test(event.event_id || "") || !["gift_purchased", "contribution_purchased", "gift_crowdfunded"].includes(event.event_type) || !data || !/^[a-z0-9_.-]{1,50}$/i.test(data.creator_username || "") || typeof data.creator_id !== "string" || !data.creator_id || data.creator_id.length > 128 || typeof data.item_name !== "string" || !data.item_name.trim()) return null;
		const amount = event.event_type === "contribution_purchased" ? data.amount : data.price;
		if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000 || !/^[A-Z]{3}$/.test(data.currency || "")) return null;
		// Forward documented public fields only. Never pass addresses, emails or arbitrary metadata.
		return {
			contract_version: "1",
			event_id: event.event_id,
			event_type: event.event_type,
			data: {
				creator_id: data.creator_id,
				creator_username: data.creator_username.toLowerCase(),
				gifter_username: typeof data.gifter_username === "string" ? data.gifter_username.slice(0, 60) : "Anonymous",
				message: typeof data.message === "string" ? data.message.slice(0, 500) : "",
				item_name: data.item_name.slice(0, 180),
				item_thumbnail_url: typeof data.item_thumbnail_url === "string" ? data.item_thumbnail_url.slice(0, 2048) : "",
				currency: data.currency,
				price: event.event_type === "contribution_purchased" ? undefined : amount,
				amount: event.event_type === "contribution_purchased" ? amount : undefined,
				is_surprise_gift: data.is_surprise_gift === true
			}
		};
	} catch {
		return null;
	}
}

export default async function throneRelay(app, options = {}) {
	const channels = new Map(),
		ipCounts = new Map();
	const publicKey = options.publicKey || THRONE_PUBLIC_KEY;
	let connections = 0;
	// Encapsulated parser: does not change Stripe or any parent application's JSON parser.
	app.removeContentTypeParser("application/json");
	app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 16384 }, (req, body, done) => done(null, body));
	app.get("/v1/throne/status", async () => ({ protocol: "ssn-throne-1" }));
	app.get("/v1/throne/events", { logLevel: "silent" }, async (req, reply) => {
		const { key, creator } = req.query;
		if (!/^[a-f0-9]{64}$/.test(key || "") || !/^[a-z0-9_.-]{1,50}$/.test(creator || "")) return reply.code(400).send({ error: "Invalid connection" });
		const id = channelId(key);
		let channel = channels.get(id);
		if (channel && channel.creator !== creator) return reply.code(409).send({ error: "Creator mismatch" });
		if (connections >= 300 || (ipCounts.get(req.ip) || 0) >= 5 || (channel && channel.clients.size >= 3) || (!channel && channels.size >= 1000)) return reply.code(503).send({ error: "Relay is busy" });
		if (!channel) {
			channel = { creator, clients: new Set(), events: [], seen: new Set(), touched: Date.now() };
			channels.set(id, channel);
		}
		reply.hijack();
		reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*" });
		channel.clients.add(reply.raw);
		connections++;
		ipCounts.set(req.ip, (ipCounts.get(req.ip) || 0) + 1);
		reply.raw.write('data: {"type":"connected"}\n\n');
		// Replay only after a reconnect. Initial connections never replay old purchases.
		const after = channel.events.findIndex(e => e.id === req.headers["last-event-id"]);
		if (after >= 0) channel.events.slice(after + 1).forEach(e => reply.raw.write(e.wire));
		reply.raw.on("close", () => {
			channel.clients.delete(reply.raw);
			channel.touched = Date.now();
			connections--;
			const count = (ipCounts.get(req.ip) || 1) - 1;
			count ? ipCounts.set(req.ip, count) : ipCounts.delete(req.ip);
		});
	});
	app.post("/v1/throne/webhook/:channel", { bodyLimit: 16384, logLevel: "silent", config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (req, reply) => {
		if (!/^[a-f0-9]{64}$/.test(req.params.channel)) return reply.code(400).send({ error: "Invalid channel" });
		const event = verifyGift(req.body, req.headers, publicKey);
		if (!event) return reply.code(401).send({ error: "Invalid Throne event" });
		const channel = channels.get(req.params.channel);
		// No account registration or offline archive. Signed events for inactive channels are discarded.
		if (!channel || event.data.creator_username !== channel.creator) return { received: true };
		if (channel.seen.has(event.event_id)) return { received: true };
		channel.seen.add(event.event_id);
		if (channel.seen.size > 1000) channel.seen.delete(channel.seen.values().next().value);
		const wire = "id: " + event.event_id + "\ndata: " + JSON.stringify(event) + "\n\n";
		channel.events.push({ id: event.event_id, wire });
		if (channel.events.length > 50) channel.events.shift();
		for (const client of channel.clients) {
			if (client.writableLength > 65536) client.destroy();
			else client.write(wire);
		}
		return { received: true };
	});
	const timer = setInterval(() => {
		for (const [id, channel] of channels) {
			if (!channel.clients.size && Date.now() - channel.touched > 300000) channels.delete(id);
			for (const client of channel.clients) {
				if (client.writableLength > 65536) client.destroy();
				else client.write(": heartbeat\n\n");
			}
		}
	}, 15000);
	timer.unref();
	app.addHook("preClose", async () => {
		clearInterval(timer);
		for (const channel of channels.values()) for (const client of channel.clients) client.end();
		channels.clear();
	});
}
