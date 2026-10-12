const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "docs", "vdo-password-test-vectors.json"), "utf8"));

function sha256(value) {
	return crypto.createHash("sha256").update(value, "utf8").digest();
}

const phrase = fixture.password + fixture.salt;
const passwordHash = sha256(phrase).toString("hex").slice(0, 6);
const roomHash = sha256(fixture.room + fixture.password + fixture.salt).toString("hex").slice(0, 16);
const key = sha256(phrase);
const iv = Buffer.from(fixture.iv, "hex");
const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
const ciphertext = Buffer.concat([cipher.update(fixture.plaintext, "utf8"), cipher.final()]).toString("hex");

assert.equal(passwordHash, fixture.passwordHash);
assert.equal(roomHash, fixture.roomHash);
assert.equal(fixture.streamIdBase + passwordHash, fixture.streamId);
assert.equal(key.toString("hex"), fixture.phraseSha256);
assert.equal(ciphertext, fixture.ciphertext);

const sdk = fs.readFileSync(path.join(root, "thirdparty", "vdoninja-sdk.js"), "utf8");
assert.match(sdk, /_generateHash\(__effectivePassword \+ this\.salt, 6\)/);
assert.match(sdk, /_generateHash\(room \+ password \+ this\.salt, 16\)/);
assert.match(sdk, /\{ name: "AES-CBC", iv: vector \}/);

console.log("VDO password interoperability vectors passed");
