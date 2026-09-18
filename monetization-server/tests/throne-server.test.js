import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createServer } from "../server.js";

test("SSN service boots independently and exposes only its own integration routes", async () => {
 const db = new Database(":memory:");
 const app = await createServer({ ebay: { db, clientId: "fixture-id", clientSecret: "fixture-secret", ruName: "fixture-redirect" } });
 try {
  assert.equal((await app.inject("/v1/monetization/health")).json().service, "ssn-monetization");
  assert.equal((await app.inject("/v1/throne/status")).json().protocol, "ssn-throne-1");
  assert.equal((await app.inject({ url: "/v1/ebay/status", headers: { authorization: "Bearer " + "e".repeat(64) } })).json().connected, false);
  assert.equal((await app.inject("/v1/tips/anything")).statusCode, 404);
  assert.equal((await app.inject({ method: "POST", url: "/v1/throne/webhook/" + "0".repeat(64), payload: { invalid: true } })).statusCode, 401);
 } finally { await app.close(); db.close(); }
});
