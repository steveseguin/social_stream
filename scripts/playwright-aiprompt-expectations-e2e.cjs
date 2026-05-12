const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = Number(process.env.AIPROMPT_EXPECTATIONS_PORT || 4214);
const ENDPOINT = process.env.AIPROMPT_ENDPOINT || process.argv[2] || "https://llm.socialstream.ninja/v1/chat/completions";
const API_KEY = process.env.AIPROMPT_API_KEY || process.argv[3] || "test_token";
const MODEL = process.env.AIPROMPT_MODEL || process.argv[4] || "qwen3.6-35b-a3b-fp8";
const RUN_COUNT = Math.max(1, Number(process.env.AIPROMPT_EXPECTATIONS_RUNS || process.argv[5] || 1));
const SCENARIO_LIMIT = Math.max(0, Number(process.env.AIPROMPT_EXPECTATIONS_LIMIT || 0));
const SCENARIO_ONLY = String(process.env.AIPROMPT_EXPECTATIONS_ONLY || "").toLowerCase();
const LLM_CALL_TIMEOUT_MS = Math.max(30000, Number(process.env.AIPROMPT_LLM_TIMEOUT_MS || 120000));
const STEP_TIMEOUT_MS = Math.max(45000, Number(process.env.AIPROMPT_EXPECTATIONS_STEP_TIMEOUT_MS || 150000));
const SUITE_TIMEOUT_MS = Math.max(60000, Number(process.env.AIPROMPT_EXPECTATIONS_SUITE_TIMEOUT_MS || 900000));

const ONE_PIXEL_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function logStep(name, step) {
	console.log("[expectations-e2e] " + name + " - " + step);
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

async function streamLLM(prompt, onText) {
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
				temperature: 0.12
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
			parseSseLines(lines.join("\n"), chunk => {
				full += chunk;
				onText(chunk);
			});
		}
		parseSseLines(pending, chunk => {
			full += chunk;
			onText(chunk);
		});
		return full;
	} catch (error) {
		if (error && error.name === "AbortError") throw new Error("LLM request timed out after " + Math.round(LLM_CALL_TIMEOUT_MS / 1000) + "s.");
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

const FEATURED_CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Expectation Featured Chat</title>
	<style>
		html, body { margin: 0; height: 100%; background: transparent; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
		#root { position: fixed; left: 20px; bottom: 20px; width: 420px; }
		#featured { min-height: 60px; padding: 14px; margin-bottom: 10px; background: rgba(20,30,42,0.95); border-left: 5px solid #00d4ff; }
		#feed { display: flex; flex-direction: column; gap: 6px; }
		.row { padding: 8px 10px; background: rgba(0,0,0,0.72); }
		.name { font-weight: 800; color: #9fe; }
	</style>
</head>
<body>
	<div id="root" data-preserve="featured-root">
		<div id="featured" aria-live="polite"></div>
		<div id="feed"></div>
	</div>
	<script>
	(function () {
		var feed = document.getElementById("feed");
		function addFeed(data) {
			var row = document.createElement("div");
			row.className = "row";
			var name = document.createElement("span");
			name.className = "name";
			name.textContent = data.chatname || "Anonymous";
			var msg = document.createElement("span");
			msg.className = "msg";
			msg.textContent = ": " + (data.chatmessage || "");
			row.appendChild(name);
			row.appendChild(msg);
			feed.appendChild(row);
		}
		function handlePayload(data) {
			if (data && data.chatmessage && !data.event) addFeed(data);
		}
		window.handleOverlayPayload = handlePayload;
		window.addEventListener("message", function (event) {
			var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
			if (payload) handlePayload(payload);
		});
	}());
	</script>
</body>
</html>`;

const HTML_CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Expectation HTML Chat</title>
	<style>
		html, body { margin: 0; height: 100%; background: transparent; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
		#feed { position: fixed; right: 20px; bottom: 20px; width: 430px; display: flex; flex-direction: column; gap: 6px; }
		.row { padding: 9px 11px; background: rgba(12,12,16,0.9); }
		.name { font-weight: 800; color: #ffd166; }
		.msg img { max-height: 24px; vertical-align: middle; }
	</style>
</head>
<body>
	<div id="feed" data-preserve="html-feed"></div>
	<script>
	(function () {
		var feed = document.getElementById("feed");
		function addRow(data) {
			var row = document.createElement("div");
			row.className = "row";
			var name = document.createElement("span");
			name.className = "name";
			name.textContent = data.chatname || "Anonymous";
			var msg = document.createElement("span");
			msg.className = "msg";
			msg.textContent = " " + (data.chatmessage || "");
			row.appendChild(name);
			row.appendChild(msg);
			feed.appendChild(row);
		}
		function handlePayload(data) {
			if (data && data.chatmessage && !data.event) addRow(data);
		}
		window.handleOverlayPayload = handlePayload;
		window.addEventListener("message", function (event) {
			var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
			if (payload) handlePayload(payload);
		});
	}());
	</script>
</body>
</html>`;

const AUCTION_META_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Expectation Auction Meta</title>
	<style>
		html, body { margin: 0; height: 100%; background: transparent; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
		#auction { position: fixed; right: 20px; bottom: 20px; min-width: 420px; padding: 16px; background: rgba(5,10,16,0.94); border-left: 5px solid #66e; }
		.label { color: #9ab; font-size: 12px; text-transform: uppercase; }
		.value { font-size: 22px; font-weight: 800; }
	</style>
</head>
<body>
	<div id="auction" data-preserve="auction-root">
		<div class="label">Item</div>
		<div id="title" class="value">Waiting</div>
		<div class="label">Bidder</div>
		<div id="bidder" class="value">-</div>
		<div class="label">Price</div>
		<div id="price" class="value">$0</div>
		<div id="status" class="value"></div>
	</div>
	<script>
	(function () {
		function text(id, value) {
			document.getElementById(id).textContent = value == null ? "" : String(value);
		}
		function handlePayload(data) {
			if (data && data.event === "auction_update" && data.meta) {
				var meta = data.meta;
				text("title", meta.title || "Untitled");
				text("bidder", meta.bidder || meta.statusText || "-");
				text("price", meta.priceText || "$0");
			}
		}
		window.handleOverlayPayload = handlePayload;
		window.addEventListener("message", function (event) {
			var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
			if (payload) handlePayload(payload);
		});
	}());
	</script>
</body>
</html>`;

const SCENARIOS = [
	{
		name: "featured lifecycle and bounded chat",
		seed: FEATURED_CHAT_HTML,
		pageName: "expect-featured",
		steps: [
			{
				name: "featured clears",
				prompt: "Use ssnpatch only. I need this to be a featured chat overlay. When a normal chat payload comes in, show chatname and chatmessage in #featured, replacing the old one, then clear or hide #featured after about 1 second. Keep #feed and the existing payload listener.",
				recovery: "Use ssnpatch only. The featured message did not behave right. Patch handlePayload so every normal chat payload updates #featured with chatname and chatmessage, replaces the old featured content, and clears or hides #featured after 1000ms. Preserve #feed.",
				assert: async env => {
					const tag = env.tag;
					await env.sendPayload({ chatname: "FeaturedA-" + tag, chatmessage: "first featured " + tag, type: "youtube" });
					await env.waitForVisibleText("#featured", "first featured " + tag, 3000);
					await env.sendPayload({ chatname: "FeaturedB-" + tag, chatmessage: "second featured " + tag, type: "youtube" });
					await env.waitForVisibleText("#featured", "second featured " + tag, 3000);
					const oldStillThere = await env.selectorText("#featured");
					assert(oldStillThere.indexOf("first featured " + tag) === -1, "#featured should replace old featured content");
					await env.waitForCleared("#featured", "second featured " + tag, 2600);
					await env.assertNoPreviewError();
				}
			},
			{
				name: "bounded feed preserves featured",
				prompt: "Use ssnpatch only. Also keep the normal chat list in #feed capped to the newest 12 rows so long streams do not leak memory. Do not remove the featured-message behavior from the previous request.",
				recovery: "Use ssnpatch only. The feed must remove old DOM nodes. Patch the existing add/feed logic so #feed has at most 12 child rows after every chat payload, keeps newest messages, and still leaves #featured clearing after about 1 second.",
				assert: async env => {
					const tag = env.tag;
					for (let i = 0; i < 25; i += 1) {
						await env.sendPayload({ chatname: "ListUser" + i, chatmessage: "bounded " + tag + " " + i, type: "youtube" });
					}
					await env.page.waitForTimeout(500);
					const count = await env.countChildren("#feed");
					assert(count <= 12, "#feed should be capped to 12 rows, got " + count);
					const body = await env.previewText();
					assert(body.indexOf("bounded " + tag + " 24") >= 0, "Newest chat row should remain visible");
					assert(body.indexOf("bounded " + tag + " 0") === -1, "Oldest chat row should be removed");
					await env.sendPayload({ chatname: "FeaturedKeep-" + tag, chatmessage: "featured survives " + tag, type: "youtube" });
					await env.waitForVisibleText("#featured", "featured survives " + tag, 3000);
					await env.waitForCleared("#featured", "featured survives " + tag, 2600);
					await env.assertNoPreviewError();
				}
			}
		]
	},
	{
		name: "html chat safety",
		seed: HTML_CHAT_HTML,
		pageName: "expect-html-chat",
		steps: [
			{
				name: "html and sanitizer",
				prompt: "Use ssnpatch only. Chat messages sometimes include safe HTML for emotes, bold text, spans, and links. If data.textonly is true, render chatmessage literally as text. If textonly is false, render safe HTML but strip scripts, onerror/onload/event attributes, javascript: URLs, iframes, and styles. Keep the current feed.",
				recovery: "Use ssnpatch only. The HTML chat support failed. Add a small sanitizer before assigning innerHTML: allow basic tags like b, i, strong, em, span, a, img, remove script/style/iframe/object tags, remove attributes that start with on, block javascript: URLs, and use textContent when data.textonly is true.",
				assert: async env => {
					const tag = env.tag;
					await env.frameEvaluate(() => { window.__xssHit = false; });
					await env.sendPayload({
						chatname: "HtmlUser-" + tag,
						chatmessage: "hello <b id=\"bold-" + tag + "\">bold</b><img id=\"emote-" + tag + "\" src=\"" + ONE_PIXEL_GIF + "\" alt=\"emote\">",
						textonly: false,
						type: "youtube"
					});
					await env.waitForSelector("#bold-" + tag, 3000);
					await env.waitForSelector("#emote-" + tag, 3000);
					await env.sendPayload({
						chatname: "BadHtml-" + tag,
						chatmessage: "<img src=\"x\" onerror=\"window.__xssHit=true\"><script>window.__xssHit=true</script><a href=\"javascript:window.__xssHit=true\">bad</a>",
						textonly: false,
						type: "youtube"
					});
					await env.page.waitForTimeout(600);
					const xssHit = await env.frameEvaluate(() => window.__xssHit === true);
					assert(!xssHit, "Dangerous chatmessage HTML executed script/event code");
					await env.sendPayload({
						chatname: "Literal-" + tag,
						chatmessage: "<b id=\"literal-" + tag + "\">literal</b>",
						textonly: true,
						type: "youtube"
					});
					await env.waitForPreviewText("<b id=\"literal-" + tag + "\">literal</b>", 3000);
					const literalRendered = await env.exists("#literal-" + tag);
					assert(!literalRendered, "textonly chatmessage should stay literal text, not render HTML");
					await env.assertNoPreviewError();
				}
			}
		]
	},
	{
		name: "messy meta payloads",
		seed: AUCTION_META_HTML,
		pageName: "expect-auction-meta",
		steps: [
			{
				name: "auction fallbacks",
				prompt: "Use ssnpatch only. Auction metadata is messy. Show title, bidder/statusText, priceText or numeric price, bidsText or numeric bids, and timer whether it is '00:19' or number seconds. Add visible DOM fields for bids and timer if missing. Also show sold/ended status when meta.status is sold, won, or ended. Ignore unrelated events without crashing.",
				recovery: "Use ssnpatch only. The auction meta fallback handling failed. Patch auction_update handling to read and visibly render meta.title, meta.bidder or meta.statusText, meta.priceText or meta.price, meta.bidsText or meta.bids, meta.timer as string or number, and status sold/won/ended. Add missing visible elements for bids/timer/status before setting textContent.",
				assert: async env => {
					const tag = env.tag;
					await env.sendPayload({
						type: "whatnot",
						event: "auction_update",
						meta: {
							title: "Silver Slab " + tag,
							statusText: "Ava-" + tag + " is Winning!",
							price: 88,
							bids: 7,
							timer: 19,
							status: "winning"
						}
					});
					await env.waitForPreviewText("silver slab " + tag, 3000);
					let body = await env.previewText();
					assert(body.indexOf("ava-" + tag.toLowerCase()) >= 0, "Auction should show statusText/bidder fallback");
					assert(body.indexOf("88") >= 0, "Auction should show numeric price fallback");
					assert(body.indexOf("7") >= 0, "Auction should show numeric bids fallback");
					assert(body.indexOf("19") >= 0, "Auction should show numeric timer fallback");
					await env.sendPayload({
						type: "whatnot",
						event: "auction_update",
						meta: {
							title: "Closed Lot " + tag,
							bidder: "Winner-" + tag,
							priceText: "$101",
							bidsText: "12 Bids",
							timer: "00:00",
							status: "sold"
						}
					});
					await env.waitForPreviewText("closed lot " + tag, 3000);
					body = await env.previewText();
					assert(body.indexOf("winner-" + tag.toLowerCase()) >= 0, "Auction should show bidder");
					assert(body.indexOf("$101") >= 0, "Auction should show priceText");
					assert(body.indexOf("12 bids") >= 0, "Auction should show bidsText");
					assert(/sold|ended|won/.test(body), "Auction should show ended/sold state");
					await env.sendPayload({ event: "viewer_updates", meta: { youtube: 815, nested: { count: 2 }, weird: "n/a" } });
					await env.page.waitForTimeout(300);
					await env.assertNoPreviewError();
				}
			},
			{
				name: "viewer meta without breaking auction",
				prompt: "Use ssnpatch only. Add support for viewer_updates too: sum only numeric top-level values in data.meta and show total viewers in #status. Preserve the existing auction_update branch; auction payloads must still update title, bidder, price, bids, timer, and status after viewer_updates. Keep #status available for sold/viewer text.",
				recovery: "Use ssnpatch only. Patch handlePayload so viewer_updates sums numeric top-level meta values only and writes the total to #status, but preserve the existing auction_update branch exactly or keep it functionally equivalent. Do not return before auction_update can run on auction payloads. If #status is also used for sold status, make sure both viewer total and auction status can still render visibly.",
				assert: async env => {
					const tag = env.tag;
					await env.sendPayload({ event: "viewer_updates", meta: { youtube: 815, twitch: 221, nested: { kick: 94 }, bad: "11" } });
					await env.waitForPreviewText("1036", 3000);
					await env.sendPayload({
						type: "whatnot",
						event: "auction_update",
						meta: {
							title: "Still Works " + tag,
							bidder: "MetaBidder-" + tag,
							priceText: "$55",
							bidsText: "5 Bids",
							timer: "00:05",
							status: "winning"
						}
					});
					await env.waitForPreviewText("still works " + tag, 3000);
					const body = await env.previewText();
					assert(body.indexOf("metabidder-" + tag.toLowerCase()) >= 0 && body.indexOf("$55") >= 0, "Auction behavior should survive viewer update patch");
					await env.assertNoPreviewError();
				}
			}
		]
	}
];

async function main() {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	let bridgeFrame = null;
	const prompts = [];
	const results = [];
	const failures = [];

	async function sendToBuilder(kind, target, value) {
		if (!bridgeFrame) return;
		await bridgeFrame.evaluate(([eventKind, eventTarget, eventValue]) => {
			var out = {};
			out[eventKind] = { target: eventTarget, value: eventValue };
			parent.postMessage({ dataReceived: { overlayNinja: out } }, "*");
		}, [kind, target, value]);
	}

	await context.exposeBinding("__ssnAIPromptCall", async ({ frame }, payload) => {
		bridgeFrame = frame;
		prompts.push(payload.value || "");
		let chunks = 0;
		try {
			const full = await streamLLM(payload.value || "", async chunk => {
				chunks += 1;
				await sendToBuilder("chatbotChunk", payload.target, chunk);
			});
			await sendToBuilder("chatbotResponse", payload.target, chunks ? "" : full);
			return { ok: true, chunks, chars: full.length };
		} catch (error) {
			await sendToBuilder("chatbotResponse", payload.target, JSON.stringify({ error: { message: error.message || String(error) } }));
			return { ok: false, error: error.message || String(error) };
		}
	});

	await context.addInitScript(() => {
		const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
		Object.defineProperty(HTMLIFrameElement.prototype, "src", {
			configurable: true,
			get() { return srcDescriptor.get.call(this); },
			set(value) {
				if (String(value).includes("vdo.socialstream.ninja")) {
					srcDescriptor.set.call(this, "about:blank");
					const frame = this;
					setTimeout(() => {
						const doc = frame.contentDocument;
						doc.open();
						doc.write(`<!DOCTYPE html><html><body><script>
              var store = null;
              var chunks = {};
              function send(payload) { parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*'); }
              window.addEventListener('message', function (event) {
                var payload = event.data && event.data.sendData && event.data.sendData.overlayNinja;
                if (payload && payload.action === 'ssnBridgeChunk') {
                  var key = payload.chunkId;
                  var entry = chunks[key] || { total: payload.total, parts: [], received: 0 };
                  if (typeof entry.parts[payload.index] === 'undefined') entry.received++;
                  entry.parts[payload.index] = payload.value || '';
                  chunks[key] = entry;
                  if (entry.received < entry.total) return;
                  delete chunks[key];
                  payload = JSON.parse(entry.parts.join(''));
                }
                if (!payload) return;
                if (payload.action === 'saveAiPromptOverlays') {
                  store = payload.value || store;
                  send({ aiPromptOverlaysSaved: { target: payload.target || null, ok: true, updatedAt: Date.now() } });
                  return;
                }
                if (payload.action === 'getAiPromptOverlays') {
                  send({ aiPromptOverlays: { target: payload.target || null, value: store } });
                  return;
                }
                if (payload.action === 'chatbot') window.__ssnAIPromptCall(payload);
              });
            <\/script></body></html>`);
						doc.close();
						if (typeof frame.onload === "function") frame.onload(new Event("load"));
					}, 0);
					return;
				}
				srcDescriptor.set.call(this, value);
			}
		});
	});

	const page = await context.newPage();
	page.on("dialog", d => d.accept());
	await page.goto(`http://${HOST}:${PORT}/aiprompt.html?session=expectations-e2e`, { waitUntil: "networkidle" });
	await page.waitForFunction(() => /connected/i.test((document.getElementById("connectionStatus") || {}).textContent || ""), null, { timeout: 12000 });

	async function seedHtml(html, pageName) {
		await page.evaluate(([value, name]) => {
			const prompt = document.getElementById("default-system-prompt").value;
			if (!/ssnpatch[\s\S]{0,220}valid JSON/i.test(prompt)) throw new Error("default prompt does not require valid JSON ssnpatch blocks");
			document.getElementById("pageName").value = name;
			document.getElementById("systemPrompt").value = prompt;
			document.getElementById("htmlEditor").value = value;
			document.getElementById("systemPrompt").dispatchEvent(new Event("input", { bubbles: true }));
			document.getElementById("htmlEditor").dispatchEvent(new Event("input", { bubbles: true }));
			document.getElementById("refreshPreview").click();
		}, [html, pageName]);
		await page.waitForFunction(() => {
			const frame = document.getElementById("previewFrame");
			return frame && frame.contentWindow && typeof frame.contentWindow.handleOverlayPayload === "function";
		}, null, { timeout: 5000 });
	}

	async function clearConversationIfAny() {
		await page.click("#clearConversation");
		await page.waitForTimeout(100);
	}

	async function askAi(request, timeoutMs) {
		const beforeAssistantCount = await page.$$eval(".msg.assistant", els => els.length);
		await page.fill("#userRequest", request);
		await page.click("#sendPrompt");
		await page.waitForFunction(count => document.querySelectorAll(".msg.assistant").length > count, beforeAssistantCount, { timeout: 5000 });
		await page.waitForFunction(() => {
			const text = (document.getElementById("connectionStatus") || {}).textContent || "";
			return /^Patch update applied/.test(text) || /^HTML update applied/.test(text) || /^AI response received/.test(text) || /AI request failed|Patch could not be applied|timed out/i.test(text);
		}, null, { timeout: timeoutMs || STEP_TIMEOUT_MS });
		await waitForAutoFixSettle(timeoutMs || STEP_TIMEOUT_MS);
		const status = await page.$eval("#connectionStatus", el => el.textContent);
		if (!/^Patch update applied/.test(status)) {
			throw new Error("Expected ssnpatch, got status: " + status);
		}
		return status;
	}

	async function waitForAutoFixSettle(timeoutMs) {
		for (let i = 0; i < 4; i += 1) {
			await page.waitForTimeout(900);
			const status = await page.$eval("#connectionStatus", el => el.textContent);
			if (!/Auto-fix|Retrying patch|AI request sent|Waiting for the session bridge/i.test(status)) {
				if (/AI request failed|Patch could not be applied|timed out|Auto-fix budget exhausted/i.test(status)) {
					throw new Error("AI/update failed while settling: " + status);
				}
				return;
			}
			await page.waitForFunction(() => {
				const text = (document.getElementById("connectionStatus") || {}).textContent || "";
				return /^Patch update applied/.test(text) || /^HTML update applied/.test(text) || /^AI response received/.test(text) || /AI request failed|Patch could not be applied|timed out|Auto-fix budget exhausted/i.test(text);
			}, null, { timeout: timeoutMs || STEP_TIMEOUT_MS });
		}
		throw new Error("Auto-fix did not settle: " + await page.$eval("#connectionStatus", el => el.textContent));
	}

	async function previewFrame() {
		const handle = await page.$("#previewFrame");
		return handle.contentFrame();
	}

	async function frameEvaluate(fn, arg) {
		const frame = await previewFrame();
		return frame.evaluate(fn, arg);
	}

	const env = {
		page,
		tag: "",
		sendPayload: payload => page.evaluate(p => {
			const frame = document.getElementById("previewFrame");
			frame.contentWindow.postMessage({ dataReceived: { overlayNinja: p } }, "*");
		}, payload),
		frameEvaluate,
		previewText: () => frameEvaluate(() => (document.body && (document.body.innerText || document.body.textContent) || "").toLowerCase()),
		selectorText: selector => frameEvaluate(sel => {
			const el = document.querySelector(sel);
			return el ? (el.innerText || el.textContent || "") : "";
		}, selector),
		countChildren: selector => frameEvaluate(sel => {
			const el = document.querySelector(sel);
			return el ? el.children.length : -1;
		}, selector),
		exists: selector => frameEvaluate(sel => !!document.querySelector(sel), selector),
		waitForSelector: (selector, timeout) => page.waitForFunction(sel => {
			const frame = document.getElementById("previewFrame");
			return !!(frame && frame.contentWindow && frame.contentWindow.document.querySelector(sel));
		}, selector, { timeout: timeout || 3000 }),
		waitForPreviewText: (needle, timeout) => page.waitForFunction(value => {
			const frame = document.getElementById("previewFrame");
			const body = frame && frame.contentWindow && frame.contentWindow.document.body;
			const text = ((body && (body.innerText || body.textContent)) || "").toLowerCase();
			return text.indexOf(String(value).toLowerCase()) >= 0;
		}, needle, { timeout: timeout || 3000 }),
		waitForVisibleText: (selector, needle, timeout) => page.waitForFunction(([sel, value]) => {
			const frame = document.getElementById("previewFrame");
			const doc = frame && frame.contentWindow && frame.contentWindow.document;
			const win = frame && frame.contentWindow;
			const el = doc && doc.querySelector(sel);
			if (!el) return false;
			const style = win.getComputedStyle(el);
			if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
			return String(el.innerText || el.textContent || "").toLowerCase().indexOf(String(value).toLowerCase()) >= 0;
		}, [selector, needle], { timeout: timeout || 3000 }),
		waitForCleared: (selector, needle, timeout) => page.waitForFunction(([sel, value]) => {
			const frame = document.getElementById("previewFrame");
			const doc = frame && frame.contentWindow && frame.contentWindow.document;
			const win = frame && frame.contentWindow;
			const el = doc && doc.querySelector(sel);
			if (!el) return true;
			const style = win.getComputedStyle(el);
			if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return true;
			return String(el.innerText || el.textContent || "").toLowerCase().indexOf(String(value).toLowerCase()) < 0;
		}, [selector, needle], { timeout: timeout || 2600 }),
		assertNoPreviewError: async () => {
			const visible = await page.$eval("#consoleBar", el => el.classList.contains("visible"));
			const text = visible ? await page.$eval("#consoleBarText", el => el.textContent || "") : "";
			assert(!visible, "Preview console error visible: " + text);
		}
	};

	async function captureFailureContext() {
		let preview = "";
		try { preview = await env.previewText(); } catch (e) { preview = "preview unavailable: " + (e && e.message || e); }
		let html = "";
		try { html = await page.$eval("#htmlEditor", el => String(el.value || "").slice(0, 4000)); } catch (e) { html = "html unavailable: " + (e && e.message || e); }
		let status = "";
		try { status = await page.$eval("#connectionStatus", el => el.textContent || ""); } catch (e) { status = "status unavailable"; }
		let consoleText = "";
		try {
			consoleText = await page.$eval("#consoleBar", el => el.classList.contains("visible") ? ((document.getElementById("consoleBarText") || {}).textContent || "") : "");
		} catch (e) {}
		return {
			status: status.slice(0, 300),
			preview: preview.slice(0, 500),
			html: html,
			console: consoleText.slice(0, 300)
		};
	}

	let scenarios = SCENARIO_ONLY ? SCENARIOS.filter(s => s.name.toLowerCase().indexOf(SCENARIO_ONLY) >= 0) : SCENARIOS.slice();
	if (SCENARIO_LIMIT) scenarios = scenarios.slice(0, SCENARIO_LIMIT);
	assert(scenarios.length > 0, "No expectation scenarios selected.");
	const suiteTimer = setTimeout(() => {
		console.error("expectations suite timed out after " + Math.round(SUITE_TIMEOUT_MS / 1000) + "s");
		process.exit(2);
	}, SUITE_TIMEOUT_MS);
	for (let run = 0; run < RUN_COUNT; run += 1) {
		for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
			const scenario = scenarios[scenarioIndex];
			env.tag = "r" + run + "s" + scenarioIndex + "t" + Date.now();
			await clearConversationIfAny();
			await seedHtml(scenario.seed, scenario.pageName + "-" + run);
			for (let stepIndex = 0; stepIndex < scenario.steps.length; stepIndex += 1) {
				const step = scenario.steps[stepIndex];
				const result = {
					run: run + 1,
					scenario: scenario.name,
					step: step.name,
					status: "not-run",
					attempts: 0
				};
				logStep(scenario.name, step.name);
				try {
					result.attempts += 1;
					await askAi(step.prompt, STEP_TIMEOUT_MS);
					await step.assert(env);
					result.status = "first-pass";
				} catch (firstError) {
					result.firstError = firstError.message || String(firstError);
					result.firstContext = await captureFailureContext();
					if (!step.recovery) {
						result.status = "failed";
						failures.push(result);
					} else {
						try {
							result.attempts += 1;
							logStep(scenario.name, step.name + " recovery");
							await askAi(step.recovery, STEP_TIMEOUT_MS);
							await step.assert(env);
							result.status = "recovered";
						} catch (recoveryError) {
							result.status = "failed";
							result.recoveryError = recoveryError.message || String(recoveryError);
							result.recoveryContext = await captureFailureContext();
							failures.push(result);
						}
					}
				}
				results.push(result);
			}
		}
	}

	await browser.close();
	server.close();
	clearTimeout(suiteTimer);
	const summary = {
		endpoint: ENDPOINT,
		model: MODEL,
		runs: RUN_COUNT,
		scenarios: scenarios.length,
		prompts: prompts.length,
		firstPass: results.filter(r => r.status === "first-pass").length,
		recovered: results.filter(r => r.status === "recovered").length,
		failed: failures.length,
		results
	};
	console.log(JSON.stringify(summary, null, 2));
	if (failures.length) process.exit(1);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
