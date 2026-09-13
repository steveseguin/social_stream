import crypto from "node:crypto";

// eBay's account-deletion protocol, isolated from other provider webhooks.
export default async function ebayDeletion(app, options) {
	const { endpoint, verificationToken, applicationToken, api, removeAccount } = options;
	if (!/^https:\/\//.test(endpoint || "") || !/^[A-Za-z0-9_-]{32,80}$/.test(verificationToken || "")) throw new Error("Invalid eBay deletion endpoint configuration");
	const path = new URL(endpoint).pathname, keys = new Map();
	app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 16384 }, (_request, body, done) => done(null, body));
	app.get(path, async (request, reply) => {
		const challenge = request.query.challenge_code;
		if (typeof challenge !== "string" || !challenge.length || challenge.length > 1024) return reply.code(400).send({ error: "Missing challenge code" });
		return { challengeResponse: crypto.createHash("sha256").update(challenge + verificationToken + endpoint).digest("hex") };
	});
	app.post(path, async (request, reply) => {
		let signature, message;
		try {
			const header = request.headers["x-ebay-signature"];
			if (typeof header !== "string" || header.length > 4096 || !Buffer.isBuffer(request.body)) throw new Error();
			signature = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
			if (!/^[A-Za-z0-9_-]{1,256}$/.test(signature.kid || "") || typeof signature.signature !== "string" || signature.signature.length > 2048) throw new Error();
			message = JSON.parse(request.body.toString("utf8"));
			if (message?.metadata?.topic !== "MARKETPLACE_ACCOUNT_DELETION" || typeof message?.notification?.data?.userId !== "string" || !message.notification.data.userId || message.notification.data.userId.length > 256) throw new Error();
		} catch (_) {
			return reply.code(412).send({ error: "Invalid eBay notification" });
		}
		let key = keys.get(signature.kid);
		if (!key || key.expires < Date.now()) {
			const result = await api("/commerce/notification/v1/public_key/" + encodeURIComponent(signature.kid), { headers: { Authorization: "Bearer " + await applicationToken() } });
			try {
				const pem = result.key.replace("-----BEGIN PUBLIC KEY-----", "-----BEGIN PUBLIC KEY-----\n").replace("-----END PUBLIC KEY-----", "\n-----END PUBLIC KEY-----");
				key = { value: crypto.createPublicKey(pem), expires: Date.now() + 3600000 };
				if (key.value.asymmetricKeyType !== "ec") throw new Error();
			} catch (_) {
				return reply.code(502).send({ error: "eBay notification key unavailable" });
			}
			if (keys.size >= 100) keys.delete(keys.keys().next().value);
			keys.set(signature.kid, key);
		}
		// eBay's official Node SDK signs the JSON serialization with ECDSA/SHA-1.
		let valid = false;
		try { valid = crypto.verify("sha1", Buffer.from(JSON.stringify(message)), key.value, Buffer.from(signature.signature, "base64")); } catch (_) {}
		if (!valid) return reply.code(412).send({ error: "Invalid eBay notification signature" });
		await removeAccount(message.notification.data.userId);
		return reply.code(204).send();
	});
	app.addHook("onClose", async () => keys.clear());
}
