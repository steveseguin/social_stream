#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../sources/websocket/kick.js"), "utf8");
const cache = new Map();
const context = vm.createContext({ state: { chatMessageCache: cache } });
for (const name of [
	"normalizeKickMessageId", "pickKickMessageId", "looksLikeKickMessageId",
	"normalizeKickReplyText", "lookupKickChatMessage", "extractReplyMessageId",
	"buildKickReplyLabel", "buildKickReplyMeta", "extractReplyDetails", "pickFirstString",
	"extractMessageContent", "extractFragmentText"
]) {
	const match = source.match(new RegExp("^function " + name + "\\([^]*?^}", "m"));
	assert.ok(match, "Missing source function: " + name);
	vm.runInContext(match[0], context);
}

const parentId = "parent-message-id";
const parent = { id: parentId, content: "Original app message", sender: { username: "Streamer" } };
const expected = { messageId: parentId, author: "Streamer", text: parent.content };
function assertReply(message, payload, expectedMeta = expected) {
	const reply = context.extractReplyDetails(message, payload || {});
	const meta = JSON.parse(JSON.stringify(context.buildKickReplyMeta(reply)));
	assert.deepEqual(meta, expectedMeta);
	assert.equal(reply.label, [expectedMeta.author, expectedMeta.text].filter(Boolean).join(": "));
}

// The original need not have been captured locally when the reply includes its text.
assertReply({ reply_to: parent });
assertReply({ reply_to_message_id: parentId, reply_to: parent });
assertReply({ parent_message_id: parentId }, { reply: parent });
assertReply({ reply_to_message_id: parentId }, { reply: { content: parent.content, sender: parent.sender } });
assertReply({ reply_to_message_id: parentId, reply_to: { id: parentId, sender: parent.sender } }, { reply: parent });

// Missing details must preserve the native parent ID without inventing a quote.
assertReply({ reply_to_message_id: parentId }, {}, { messageId: parentId });
assertReply({ reply_to_message_id: parentId, reply_to: { id: parentId, sender: parent.sender } }, {}, { messageId: parentId, author: "Streamer" });
assertReply({ reply_to_message_id: parentId, parent: { ...parent, id: "different-parent" } }, {}, { messageId: parentId });
assert.equal(context.extractReplyDetails({ content: "Ordinary chat" }, {}), null);

// Cached originals still work, including partial caches with only an author.
cache.set(parentId, { authorName: "Streamer", plainText: parent.content });
assertReply({ reply_to_message_id: parentId });
cache.set(parentId, { authorName: "Streamer", plainText: "" });
assertReply({ reply_to_message_id: parentId }, { reply: parent });

console.log("PASS: Kick replies preserve supplied quotes, cached context, and native parent IDs.");
