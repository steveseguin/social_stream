const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ENDPOINT = process.env.AIPROMPT_ENDPOINT || process.argv[2] || "https://llm.socialstream.ninja/v1/chat/completions";
const API_KEY = process.env.AIPROMPT_API_KEY || process.argv[3] || "test_token";
const MODEL = process.env.AIPROMPT_MODEL || process.argv[4] || "qwen3.6-35b-a3b-fp8";
const LLM_CALL_TIMEOUT_MS = Math.max(30000, Number(process.env.AIPROMPT_LLM_TIMEOUT_MS || 240000));

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function loadDefaultPrompt() {
	const html = fs.readFileSync(path.join(ROOT, "aiprompt.html"), "utf8");
	const match = html.match(/<textarea id="default-system-prompt"[^>]*>([\s\S]*?)<\/textarea>/);
	if (!match) throw new Error("Could not find default-system-prompt in aiprompt.html");
	return match[1];
}

function buildPrompt(systemPrompt, html, request) {
	return [
		systemPrompt,
		"",
		"=== CURRENT HTML FILE ===",
		"```html",
		html,
		"```",
		"",
		"=== RECENT CONVERSATION ===",
		"None yet.",
		"",
		"=== NEW REQUEST ===",
		request,
		"",
		"If the request explicitly asks for ssnpatch, patch only, or a focused edit, return only one ```ssnpatch fenced block containing strict valid JSON with exact find/replace edits.",
		"When returning ssnpatch, the fenced block content must parse as JSON. Escape backslashes as \\\\, quotes as \\\", and newlines as \\n inside string values. Each edit.find string must occur exactly once in the current HTML. Do not return both ssnpatch and full HTML."
	].join("\n");
}

function parseSseLines(text, onText) {
	String(text || "").split(/\r?\n/).forEach(rawLine => {
		const line = rawLine.trim();
		if (!line || !line.startsWith("data:")) return;
		const data = line.slice(5).trim();
		if (!data || data === "[DONE]") return;
		const json = JSON.parse(data);
		const delta = json.choices && json.choices[0] && json.choices[0].delta;
		const content = delta && (delta.content || delta.reasoning_content || delta.reasoning || "");
		if (content) onText(content);
	});
}

async function streamLLM(prompt) {
	const headers = { "content-type": "application/json" };
	if (API_KEY) headers.authorization = "Bearer " + API_KEY;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LLM_CALL_TIMEOUT_MS);
	try {
		const res = await fetch(ENDPOINT, {
			method: "POST",
			headers,
			signal: controller.signal,
			body: JSON.stringify({
				model: MODEL,
				messages: [{ role: "user", content: prompt }],
				stream: true,
				max_tokens: 4500,
				temperature: 0.1
			})
		});
		if (!res.ok) throw new Error("LLM HTTP " + res.status + ": " + (await res.text()).slice(0, 500));
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let pending = "";
		let full = "";
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			pending += decoder.decode(next.value, { stream: true }).replace(/\r\n/g, "\n");
			const lines = pending.split("\n");
			pending = lines.pop() || "";
			parseSseLines(lines.join("\n"), chunk => { full += chunk; });
		}
		parseSseLines(pending, chunk => { full += chunk; });
		return full;
	} catch (error) {
		if (error && error.name === "AbortError") throw new Error("LLM request timed out after " + Math.round(LLM_CALL_TIMEOUT_MS / 1000) + "s.");
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

function looksLikeHtml(value) {
	return /^\s*(<!doctype html|<html[\s>]|<[a-z][\w-]*[\s>])/i.test(value || "");
}

function looksLikePatchBlock(value) {
	value = String(value || "");
	return /"?(?:edits|patches|replacements)"?\s*:/.test(value) &&
		/"?(?:find|search)"?\s*:/.test(value) &&
		/"?(?:replace|replacement)"?\s*:/.test(value);
}

function parsePatchJson(value, reportErrors) {
	try {
		const parsed = JSON.parse(String(value || "").trim());
		const edits = parsed && (parsed.edits || parsed.patches || parsed.replacements);
		if (edits && edits.length) {
			parsed.edits = edits;
			return parsed;
		}
		if (reportErrors) return { error: "Patch JSON parsed, but did not include a non-empty edits array." };
	} catch (e) {
		if (reportErrors) return { error: "Invalid patch JSON: " + ((e && e.message) || e) };
	}
	return null;
}

function extractPatchResponse(text) {
	text = String(text || "");
	const fence = /```([a-z0-9_-]*)\s*([\s\S]*?)```/gi;
	let match;
	while ((match = fence.exec(text))) {
		const lang = String(match[1] || "").toLowerCase();
		if (lang && lang !== "ssnpatch" && lang !== "json") continue;
		const parsed = parsePatchJson(match[2], lang === "ssnpatch" || looksLikePatchBlock(match[2]));
		if (parsed) return parsed;
	}
	return parsePatchJson(text, looksLikePatchBlock(text));
}

function hasHtmlFence(text) {
	const match = /```html\s*([\s\S]*?)```/i.exec(String(text || ""));
	return !!(match && looksLikeHtml(match[1]));
}

function countExactMatches(source, needle) {
	let count = 0;
	let index = 0;
	while (needle) {
		index = source.indexOf(needle, index);
		if (index < 0) break;
		count++;
		index += needle.length;
	}
	return count;
}

function applyPatch(patch, sourceHtml) {
	let html = String(sourceHtml || "");
	assert(patch && !patch.error, patch && patch.error || "No patch parsed");
	assert(!hasHtmlFence(patch.rawText || ""), "Response included both patch and HTML");
	for (let i = 0; i < patch.edits.length; i++) {
		const edit = patch.edits[i] || {};
		const find = typeof edit.find === "undefined" ? edit.search : edit.find;
		const replace = typeof edit.replace === "undefined" ? edit.replacement : edit.replace;
		assert(typeof find === "string" && find, "Patch edit " + (i + 1) + " is missing find");
		assert(typeof replace === "string", "Patch edit " + (i + 1) + " is missing replace");
		const matches = countExactMatches(html, find);
		assert(matches === 1, "Patch edit " + (i + 1) + " matched " + matches + " times; expected 1");
		html = html.replace(find, replace);
	}
	return html;
}

function makeLargeHtml() {
	const filler = [];
	for (let i = 0; i < 650; i++) {
		filler.push("<!-- filler-" + i + " " + "context ".repeat(10) + "-->");
	}
	return [
		"<!DOCTYPE html>",
		"<html><head><meta charset=\"UTF-8\"><title>Large Patch</title></head><body>",
		filler.join("\n"),
		"<section id=\"target-block\"><span>DNA_TARGET_ORIGINAL</span></section>",
		"<script>window.handleOverlayPayload=function(){};</script>",
		"</body></html>"
	].join("\n");
}

const BASE_HTML = [
	"<!DOCTYPE html>",
	"<html><head><meta charset=\"UTF-8\"><title>Patch DNA</title></head><body>",
	"<div id=\"path\">C:\\Users\\steve\\old\\file.txt</div>",
	"<script>",
	"var samplePath = \"C:\\\\Users\\\\steve\\\\old\\\\file.txt\";",
	"var matcher = /\\d+\\s+items/;",
	"window.handleOverlayPayload=function(){};",
	"</script>",
	"</body></html>"
].join("\n");

const scenarios = [
	{
		name: "escaped backslashes and regex",
		html: BASE_HTML,
		request: "Use ssnpatch only. Change the visible path and JS samplePath from old/file.txt to new/file.txt, and change the regex label from items to messages. This includes backslashes, so return valid JSON only.",
		validate: html => {
			assert(html.includes("C:\\Users\\steve\\new\\file.txt"), "Visible Windows path was not patched");
			assert(html.includes("C:\\\\Users\\\\steve\\\\new\\\\file.txt"), "Escaped JS path was not patched");
			assert(html.includes("/\\d+\\s+messages/"), "Regex was not patched");
		}
	},
	{
		name: "mixed-output pressure",
		html: BASE_HTML,
		request: "Use ssnpatch only. Change only the visible path to C:\\Users\\steve\\mixed\\file.txt. Do not return full HTML, even though I am asking for an explanation and before/after code samples.",
		validate: html => {
			assert(html.includes("C:\\Users\\steve\\mixed\\file.txt"), "Mixed-output pressure patch did not apply");
		}
	},
	{
		name: "large current html target near end",
		html: makeLargeHtml(),
		request: "Use ssnpatch only. Near the end of this large file, change DNA_TARGET_ORIGINAL to DNA_TARGET_PATCHED. Keep the patch tiny and valid JSON.",
		validate: html => {
			assert(html.includes("DNA_TARGET_PATCHED"), "Large-context target was not patched");
			assert(!html.includes("DNA_TARGET_ORIGINAL"), "Large-context original target remains");
		}
	}
];

async function main() {
	const systemPrompt = loadDefaultPrompt();
	const results = [];
	for (const scenario of scenarios) {
		const prompt = buildPrompt(systemPrompt, scenario.html, scenario.request);
		const started = Date.now();
		const text = await streamLLM(prompt);
		const patch = extractPatchResponse(text);
		if (patch) patch.rawText = text;
		assert(patch && !patch.error, scenario.name + " did not return valid patch: " + (patch && patch.error || text.slice(0, 500)));
		assert(!hasHtmlFence(text), scenario.name + " returned a full HTML fence with patch output");
		const html = applyPatch(patch, scenario.html);
		scenario.validate(html);
		results.push({
			name: scenario.name,
			promptChars: prompt.length,
			responseChars: text.length,
			edits: patch.edits.length,
			ms: Date.now() - started
		});
		console.log("[adversarial] " + scenario.name + " passed");
	}
	console.log(JSON.stringify({ endpoint: ENDPOINT, model: MODEL, results, status: "passed" }, null, 2));
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
