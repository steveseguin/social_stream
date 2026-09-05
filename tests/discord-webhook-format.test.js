const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const settingsDefinitionsSource = fs.readFileSync(path.join(repoRoot, "shared", "config", "settingsDefinitions.js"), "utf8");

function extractFunction(source, name) {
	const start = source.indexOf(`function ${name}(`);
	assert.ok(start >= 0, `${name} was not found`);
	const bodyStart = source.indexOf("{", start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		if (source[index] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, index + 1);
		}
	}
	throw new Error(`${name} did not have a complete body`);
}

const payloadBuilderSource = extractFunction(backgroundSource, "buildAllMessagesDiscordPayload");
const buildAllMessagesDiscordPayload = Function(
	"validateImageUrl",
	"capitalizeFirstLetter",
	"decodeAndCleanHtml",
	`${payloadBuilderSource}\nreturn buildAllMessagesDiscordPayload;`
)(
	(value) => value || null,
	(value) => String(value || "").replace(/^./, (character) => character.toUpperCase()),
	(value) => String(value || "").replace(/<[^>]+>/g, "")
);

const message = {
	chatname: "Slackadelic",
	chatmessage: "A compact <b>message</b>",
	chatimg: "https://example.com/avatar.png",
	type: "discord",
};

const richPayload = buildAllMessagesDiscordPayload(message);
assert.equal(richPayload.username, "Slackadelic @ Discord");
assert.equal(richPayload.embeds[0].description, "A compact message");
assert.ok(richPayload.embeds[0].timestamp);
assert.equal(richPayload.content, undefined);

const simplePayload = buildAllMessagesDiscordPayload(message, true);
assert.deepEqual(simplePayload, {
	content: "A compact message",
	username: "Slackadelic @ Discord",
	avatar_url: "https://example.com/avatar.png",
});
assert.equal(simplePayload.embeds, undefined);

assert.match(popupSource, /data-setting="postallserverdiscordsimple"/);
assert.match(settingsDefinitionsSource, /"postallserverdiscordsimple":\s*\{/);
assert.match(backgroundSource, /buildAllMessagesDiscordPayload\(data, getSettingFlag\("postallserverdiscordsimple"\)\)/);

console.log("Discord webhook formatting passed (rich default and simple opt-in).");
