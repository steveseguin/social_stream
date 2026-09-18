import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import http from "node:http";
import relay, { verifyGift, channelId } from "../throne-relay.js";

const pair = crypto.generateKeyPairSync("ed25519");
const event = { contract_version: "1", event_id: "gift-123", event_type: "gift_purchased", data: { creator_id: "creator-id", creator_username: "creator", gifter_username: "Anonymous", item_name: "Studio light", price: 1099, currency: "USD" } };
function signed(value = event, time = Math.floor(Date.now() / 1000)) {
	const body = Buffer.from(JSON.stringify(value)),
		timestamp = String(time);
	return { body, headers: { "content-type": "application/json", "x-signature-timestamp": timestamp, "x-signature-ed25519": crypto.sign(null, Buffer.concat([Buffer.from(timestamp + "."), body]), pair.privateKey).toString("hex") } };
}
test("Only fresh, correctly signed, documented gift events are accepted", () => {
	const s = signed();
	assert.equal(verifyGift(s.body, s.headers, pair.publicKey).event_id, "gift-123");
	assert.equal(verifyGift(Buffer.from(s.body.toString().replace("1099", "9999")), s.headers, pair.publicKey), null);
	assert.equal(verifyGift(s.body, { ...s.headers, "x-signature-ed25519": "0".repeat(128) }, pair.publicKey), null);
	const stale = signed(event, Math.floor(Date.now() / 1000) - 400);
	assert.equal(verifyGift(stale.body, stale.headers, pair.publicKey), null);
	for (const invalid of [
		{ ...event, contract_version: "2" },
		{ ...event, event_type: "unknown" },
		{ ...event, data: { ...event.data, price: -1 } }
	]) {
		const packet = signed(invalid);
		assert.equal(verifyGift(packet.body, packet.headers, pair.publicKey), null);
	}
	const extra = signed({ ...event, data: { ...event.data, email: "private@example.invalid", address: "PRIVATE" } });
	assert(!JSON.stringify(verifyGift(extra.body, extra.headers, pair.publicKey)).includes("PRIVATE"));
	assert(!JSON.stringify(verifyGift(extra.body, extra.headers, pair.publicKey)).includes("email"));
});
test("Signed webhook reaches only its channel and creator; retries do not duplicate; parent JSON stays intact", async () => {
	const app = Fastify();
	app.post("/parent", async req => ({ amount: req.body.amount }));
	await app.register(relay, { publicKey: pair.publicKey });
	await app.listen({ host: "127.0.0.1", port: 0 });
	const port = app.server.address().port,
		key = "a".repeat(64),
		key2 = "b".repeat(64),
		messages = [[], []],
		requests = [];
	async function listen(privateKey, index, lastId) {
		return new Promise((resolve, reject) => {
			const request = http.get({ hostname: "127.0.0.1", port, path: "/v1/throne/events?key=" + privateKey + "&creator=creator", headers: lastId ? { "Last-Event-ID": lastId } : {} }, res => {
				res.setEncoding("utf8");
				res.on("data", data => {
					messages[index].push(data);
					if (data.includes("connected")) resolve();
				});
			});
			request.on("error", reject);
			requests.push(request);
		});
	}
	try {
		await listen(key, 0);
		await listen(key2, 1);
		const send = async (value = event) => {
			const s = signed(value);
			return app.inject({ method: "POST", url: "/v1/throne/webhook/" + channelId(key), headers: s.headers, payload: s.body });
		};
		assert.equal((await send()).statusCode, 200);
		await new Promise(r => setTimeout(r, 30));
		assert(messages[0].join("").includes("Studio light"));
		assert(!messages[1].join("").includes("Studio light"));
		await send();
		await send({ ...event, event_id: "wrong-creator", data: { ...event.data, creator_username: "other" } });
		await new Promise(r => setTimeout(r, 30));
		assert.equal((messages[0].join("").match(/Studio light/g) || []).length, 1);
		assert(!messages[0].join("").includes("wrong-creator"));
		requests[0].destroy();
		await new Promise(r => setTimeout(r, 30));
		await send({ ...event, event_id: "during-reconnect" });
		await listen(key, 0, "gift-123");
		await new Promise(r => setTimeout(r, 30));
		assert(messages[0].join("").includes("during-reconnect"));
		assert.equal((await app.inject({ method: "POST", url: "/parent", payload: { amount: 12 } })).json().amount, 12);
		const invalid = await app.inject({ method: "POST", url: "/v1/throne/webhook/" + channelId(key), payload: event });
		assert.equal(invalid.statusCode, 401);
		assert.equal((await app.inject({ url: "/v1/throne/events?key=" + channelId(key) + "&creator=WRONG" })).statusCode, 400);
	} finally {
		requests.forEach(r => r.destroy());
		await app.close();
	}
});
