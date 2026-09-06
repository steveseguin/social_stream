import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import Database from "better-sqlite3";
import plugin, { paidSales, publicItem } from "../ebay-showcase.js";
import { fixture, order } from "./ebay-fixture.js";

test("Paid sales exclude pending/cancelled orders and all buyer/payment private fields", () => {
	const a = order(),
		pending = { ...order("pending"), orderPaymentStatus: "PENDING" },
		cancelled = { ...order("cancelled"), cancelStatus: { cancelState: "CANCELED" } };
	const sales = paidSales([a, pending, cancelled]);
	assert.equal(sales.length, 1);
	assert.equal(sales[0].quantity, 2);
	assert(sales[0].paidAt > 0);
	assert(!JSON.stringify(sales).includes("private"));
	assert(!JSON.stringify(sales).includes("DO NOT FORWARD"));
	assert.equal(paidSales([a])[0].id, sales[0].id);
	const item = publicItem({ title: "Auction", buyingOptions: ["AUCTION"], currentBidPrice: { value: "12.50", currency: "USD" }, price: { value: "100", currency: "USD" }, itemEndDate: "2026-10-01T12:00:00Z", image: { imageUrl: "https://evil.invalid/image" } }, "123456789012");
	assert.equal(item.amount, 12.5);
	const starting = publicItem({ title: "No bids yet", buyingOptions: ["AUCTION", "FIXED_PRICE"], minimumPriceToBid: { value: "5", currency: "USD" }, price: { value: "100", currency: "USD" } }, "123456789012");
	assert.equal(starting.amount, 5);
	assert.equal(starting.startingBid, true);
	assert.equal(item.image, "");
	assert.equal(item.endsAt, Date.parse("2026-10-01T12:00:00Z"));
});

test("Seller connection is bound to its private reader, encrypted, read-only, paginated and disconnectable", async () => {
	const db = new Database(":memory:"),
		app = Fastify(),
		remote = fixture(),
		key = "a".repeat(64),
		headers = { authorization: "Bearer " + key };
	await app.register(plugin, { db, clientId: "fixture-id", clientSecret: "fixture-secret", ruName: "fixture-redirect", fetch: remote.fetch });
	try {
		assert.equal((await app.inject("/v1/ebay/status")).statusCode, 401);
		assert.equal((await app.inject({ url: "/v1/ebay/item/123456789012", headers })).statusCode, 401);
		const connect = (await app.inject({ method: "POST", url: "/v1/ebay/connect", headers })).json(),
			auth = new URL(connect.url);
		assert.equal(auth.origin, "https://auth.ebay.com");
		assert(auth.searchParams.get("scope").includes("sell.fulfillment.readonly"));
		assert(!connect.url.includes(key));
		assert.equal((await app.inject("/v1/ebay/callback?state=invalid&code=synthetic")).statusCode, 400);
		const callback = "/v1/ebay/callback?state=" + auth.searchParams.get("state") + "&code=synthetic";
		remote.expires = 0;
		assert.equal((await app.inject(callback)).statusCode, 200);
		assert.equal((await app.inject(callback)).statusCode, 400);
		const stored = db.prepare("SELECT * FROM ebay_connections").get();
		assert(!JSON.stringify(stored).includes(key));
		assert(!JSON.stringify(stored).includes("synthetic-refresh"));
		assert.equal((await app.inject({ url: "/v1/ebay/status", headers })).json().connected, true);
		assert.equal((await app.inject({ url: "/v1/ebay/status", headers: { authorization: "Bearer " + "b".repeat(64) } })).json().connected, false);
		remote.expires = 7200;
		assert.equal((await app.inject({ url: "/v1/ebay/item/123456789012", headers })).json().amount, 32.5);
		assert(remote.calls.some(c => new URLSearchParams(c.init.body).get("grant_type") === "refresh_token"));
		assert(remote.calls.some(c => new URLSearchParams(c.init.body).get("grant_type") === "client_credentials"));
		remote.orders = Array.from({ length: 201 }, (_, i) => order("order-" + i));
		const url = "/v1/ebay/sales?since=" + (Date.now() - 60000),
			result = await app.inject({ url, headers });
		assert.equal(result.statusCode, 200, result.body);
		assert.equal(result.json().sales.length, 201);
		assert(remote.calls.some(c => c.url.searchParams.get("offset") === "200"));
		assert(!result.body.includes("private-buyer"));
		const count = remote.calls.length;
		await app.inject({ url, headers });
		assert.equal(remote.calls.length, count);
		// A client polling every 60 seconds must not repeatedly hit the previous snapshot.
		const clock = Date.now;
		Date.now = () => clock() + 60000;
		try {
			remote.orders.push(order("fresh-order"));
			assert.equal((await app.inject({ url, headers })).json().sales.length, 202);
		} finally {
			Date.now = clock;
		}
		assert.equal((await app.inject({ method: "DELETE", url: "/v1/ebay/connection", headers })).statusCode, 200);
		assert.equal(db.prepare("SELECT count(*) AS n FROM ebay_connections").get().n, 0);
		assert.equal((await app.inject({ url: "/v1/ebay/item/123456789012", headers })).statusCode, 401);
	} finally {
		await app.close();
		db.close();
	}
});
