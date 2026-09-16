import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import Database from "better-sqlite3";
import plugin from "../ebay-showcase.js";
import { fixture, order } from "./ebay-fixture.js";
import { createServer } from "../server.js";

test("Production onboarding serves the challenge without opening incomplete seller OAuth", async () => {
	const db = new Database(":memory:");
	const app = await createServer({ ebay: { db, clientId: "fixture", clientSecret: "fixture", deletionToken: "x".repeat(40), deletionEndpoint: "https://api.socialstream.ninja/v1/ebay/account-deletion", fetch: async () => { throw new Error("Unexpected network"); } } });
	try {
		assert.equal((await app.inject("/v1/ebay/account-deletion?challenge_code=setup")).statusCode, 200);
		assert.equal((await app.inject("/v1/ebay/status")).json().code, "EBAY_NOT_CONFIGURED");
		assert.equal((await app.inject({ method: "POST", url: "/v1/ebay/connect", payload: {} })).statusCode, 503);
		assert.equal((await app.inject("/v1/monetization/health")).json().ok, true);
	} finally { await app.close(); db.close(); }
});

test("eBay deletion verifies signatures, removes only matching sellers, and invalidates sales", async () => {
	const db = new Database(":memory:"), app = Fastify(), remote = fixture();
	const endpoint = "https://api.socialstream.ninja/v1/ebay/account-deletion", verificationToken = "v".repeat(48);
	const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
	let seller = "seller-one", keyRequests = 0, holdSales, releaseSales;
	const fetch = async (url, init) => {
		if (url === "https://apiz.ebay.com/commerce/identity/v1/user/") return { ok: true, json: async () => ({ userId: seller, email: "private@example.invalid" }) };
		if (url === "https://api.ebay.com/commerce/notification/v1/public_key/key-one") {
			keyRequests++;
			return { ok: true, json: async () => ({ key: pair.publicKey.export({ type: "spki", format: "pem" }).replace(/\n/g, "") }) };
		}
		if (holdSales && url.includes("/sell/fulfillment/")) { holdSales(); await new Promise(resolve => { releaseSales = resolve; }); }
		return remote.fetch(url, init);
	};
	await app.register(plugin, { db, clientId: "fixture", clientSecret: "fixture", ruName: "fixture", deletionToken: verificationToken, deletionEndpoint: endpoint, fetch });
	const headers = { authorization: "Bearer " + "a".repeat(64) }, other = { authorization: "Bearer " + "b".repeat(64) }, sameSeller = { authorization: "Bearer " + "c".repeat(64) };
	async function connect(h) {
		const auth = new URL((await app.inject({ method: "POST", url: "/v1/ebay/connect", headers: h })).json().url);
		assert(auth.searchParams.get("scope").includes("commerce.identity.readonly"));
		assert(!auth.searchParams.get("scope").includes("sell.inventory"));
		assert.equal((await app.inject("/v1/ebay/callback?state=" + auth.searchParams.get("state") + "&code=test")).statusCode, 200);
	}
	const message = { metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION" }, notification: { data: { userId: "seller-one" } } };
	const signature = Buffer.from(JSON.stringify({ kid: "key-one", signature: crypto.sign("sha1", Buffer.from(JSON.stringify(message)), pair.privateKey).toString("base64") })).toString("base64");
	const notification = { method: "POST", url: "/v1/ebay/account-deletion", headers: { "content-type": "application/json", "x-ebay-signature": signature }, payload: message };
	try {
		await connect(headers); await connect(sameSeller); seller = "seller-two"; await connect(other);
		assert(!JSON.stringify(db.prepare("SELECT * FROM ebay_account_links").all()).includes("seller-one"));
		const challenge = await app.inject("/v1/ebay/account-deletion?challenge_code=hello");
		assert.equal(challenge.json().challengeResponse, crypto.createHash("sha256").update("hello" + verificationToken + endpoint).digest("hex"));
		assert.equal((await app.inject("/v1/ebay/account-deletion")).statusCode, 400);
		assert.equal((await app.inject({ ...notification, headers: { "content-type": "application/json" } })).statusCode, 412);
		assert.equal((await app.inject({ ...notification, payload: { ...message, notification: { data: { userId: "seller-two" } } } })).statusCode, 412);
		assert.equal((await app.inject({ ...notification, headers: { ...notification.headers, "x-ebay-signature": Buffer.from(JSON.stringify({ kid: "../../attacker", signature: "x" })).toString("base64") } })).statusCode, 412);
		assert.equal(db.prepare("SELECT count(*) AS n FROM ebay_connections").get().n, 3);
		remote.orders = [order()];
		let reached;
		const waiting = new Promise(resolve => { reached = resolve; });
		holdSales = reached;
		const sales = app.inject({ url: "/v1/ebay/sales?since=" + (Date.now() - 60000), headers });
		await waiting;
		assert.equal((await app.inject(notification)).statusCode, 204);
		releaseSales();
		assert.equal((await sales).statusCode, 401);
		assert.equal((await app.inject({ url: "/v1/ebay/status", headers })).json().connected, false);
		assert.equal((await app.inject({ url: "/v1/ebay/status", headers: sameSeller })).json().connected, false);
		assert.equal((await app.inject({ url: "/v1/ebay/status", headers: other })).json().connected, true);
		assert.equal(db.prepare("SELECT count(*) AS n FROM ebay_account_links").get().n, 1);
		assert.equal((await app.inject(notification)).statusCode, 204);
		assert.equal(keyRequests, 1);
	} finally { await app.close(); db.close(); }
});
