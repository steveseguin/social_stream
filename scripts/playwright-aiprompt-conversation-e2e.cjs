const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = Number(process.env.AIPROMPT_CONVO_PORT || 4212);
const ENDPOINT = process.env.AIPROMPT_ENDPOINT || process.argv[2] || "https://llm.socialstream.ninja/v1/chat/completions";
const API_KEY = process.env.AIPROMPT_API_KEY || process.argv[3] || "test_token";
const MODEL = process.env.AIPROMPT_MODEL || process.argv[4] || "qwen3.6-35b-a3b-fp8";
const RUN_COUNT = Math.max(1, Number(process.env.AIPROMPT_CONVO_RUNS || process.argv[5] || 3));
const LLM_CALL_TIMEOUT_MS = Math.max(30000, Number(process.env.AIPROMPT_LLM_TIMEOUT_MS || 240000));
const USER_PROMPT_VARIANTS = [
	{
		label: "low-context-auction",
		auction: "Use ssnpatch only. im bad at this, auction box needs the clock thing and number of bids from meta.timer and meta.bidsText or meta.bids. also where it says Winner make it say High bidder. dont rebuild whole thing. remember this weird test word: {{CANARY}}",
		chat: "Use ssnpatch only. same file, keep the clock and bids you just added. normal chat payload is no data.event and has data.chatmessage. put data.chatname + ': ' + data.chatmessage into #chatlog.",
		donation: "Use ssnpatch only. donations should say Tip now, not Donation. The test donation has data.type = youtube, so show that platform word inside the same card too."
	},
	{
		label: "misspelled-short",
		auction: "ssnpatch only plz. aution overlay: add timer and bids from meta, timer is meta.timer and bids is meta.bidsText or meta.bids. winner label should be High bidder. do tiny patch. canary thing {{CANARY}}",
		chat: "ssnpatch only. it still dont show chat. if data.chatmessage exists and data.event is empty/missing, append one line to #chatlog like data.chatname + ': ' + data.chatmessage. dont remove auction timer or bids.",
		donation: "ssnpatch only. tip alert not donation alert. make the word Tip show and also print data.type in the alert text, like youtube."
	},
	{
		label: "rambling-nontechnical",
		auction: "Use ssnpatch only. I don't know code. The auction screen needs the little countdown and how many bids, whatever the meta data has for timer and bids. Also the winner word is confusing, call it High bidder. Keep the card. Secret memory word {{CANARY}}",
		chat: "Use ssnpatch only. I sent youtube chat and nothing happened. Chat data has no event, has chatname and chatmessage. Please append chatname + ': ' + chatmessage into the existing #chatlog spot. Leave the auction stuff alone.",
		donation: "Use ssnpatch only. For the money alert, I call these tips. Change Donation to Tip and include data.type text in the alert, so youtube is visible when the payload type is youtube."
	}
];

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function logStep(run, variant, step) {
	console.log("[conversation-e2e] run " + run + " " + variant + " - " + step);
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
				temperature: 0.15
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

const AUCTION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Conversation Patch Auction</title>
	<style>
		html, body { margin: 0; height: 100%; background: transparent; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
		#auction { position: fixed; right: 20px; bottom: 20px; min-width: 420px; padding: 18px; background: rgba(10,14,18,0.9); border-left: 5px solid #00d4ff; }
		.label { color: #9ab; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
		.value { font-size: 24px; font-weight: 800; }
		#chatlog { margin-top: 10px; font-size: 16px; }
	</style>
</head>
<body>
	<div id="auction">
		<div class="label">Item</div>
		<div id="title" class="value">Waiting</div>
		<div class="label" id="winnerLabel">Winner</div>
		<div id="bidder" class="value">-</div>
		<div class="label">Bid</div>
		<div id="price" class="value">$0</div>
		<div id="chatlog"></div>
	</div>
	<script>
	(function () {
		function setText(id, value) {
			document.getElementById(id).textContent = value == null ? "" : String(value);
		}
		function handlePayload(data) {
			if (data && data.event === "auction_update" && data.meta) {
				var meta = data.meta;
				setText("title", meta.title || "Untitled");
				setText("bidder", meta.bidder || meta.statusText || "-");
				setText("price", meta.priceText || meta.price || "$0");
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

const DONATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Conversation Patch Donation</title>
	<style>
		html, body { margin: 0; height: 100%; background: transparent; color: #fff; font-family: Arial, sans-serif; overflow: hidden; }
		#feed { position: fixed; left: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
		.alert { background: rgba(24, 18, 34, 0.92); border-left: 5px solid #f0c866; padding: 12px 14px; min-width: 320px; }
		.kind { color: #f0c866; font-weight: 800; text-transform: uppercase; }
		.amount { font-size: 24px; font-weight: 900; }
	</style>
</head>
<body>
	<div id="feed"></div>
	<script>
	(function () {
		var feed = document.getElementById("feed");
		function addAlert(kind, name, amount, message) {
			var card = document.createElement("div");
			card.className = "alert";
			card.innerHTML = '<div class="kind">' + kind + '</div><div class="amount">' + amount + '</div><div class="name"></div><div class="msg"></div>';
			card.querySelector(".name").textContent = name || "Anonymous";
			card.querySelector(".msg").textContent = message || "";
			feed.appendChild(card);
		}
		function handlePayload(data) {
			if (data && data.hasDonation) {
				addAlert("Donation", data.chatname, data.hasDonation, data.chatmessage);
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

async function main() {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	let bridgeFrame = null;
	const prompts = [];

	async function sendToBuilder(kind, target, value) {
		if (!bridgeFrame) return;
		await bridgeFrame.evaluate(([eventKind, eventTarget, eventValue]) => {
			const out = {};
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
	await page.goto(`http://${HOST}:${PORT}/aiprompt.html?session=conversation-e2e`, { waitUntil: "networkidle" });
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

	async function askPatch(request, timeoutMs) {
		const beforeAssistantCount = await page.$$eval(".msg.assistant", els => els.length);
		await page.fill("#userRequest", request);
		await page.click("#sendPrompt");
		await page.waitForFunction(count => document.querySelectorAll(".msg.assistant").length > count, beforeAssistantCount, { timeout: 5000 });
		await page.waitForFunction(() => {
			const text = (document.getElementById("connectionStatus") || {}).textContent || "";
			return /^Patch update applied/.test(text) || /^HTML update applied/.test(text) || /AI request failed|Patch could not be applied|timed out/i.test(text);
		}, null, { timeout: timeoutMs || 180000 });
		const status = await page.$eval("#connectionStatus", el => el.textContent);
		assert(/^Patch update applied/.test(status), "Expected ssnpatch to apply, got status: " + status);
		await waitForAutoFixSettle(timeoutMs || 180000);
	}

	async function waitForAutoFixSettle(timeoutMs) {
		for (let i = 0; i < 3; i += 1) {
			await page.waitForTimeout(900);
			let status = await page.$eval("#connectionStatus", el => el.textContent);
			if (!/Auto-fix|AI request sent|Waiting for the session bridge/i.test(status)) {
				assert(!/AI request failed|Patch could not be applied|timed out|Auto-fix budget exhausted/i.test(status), "AI/update failed while settling: " + status);
				return;
			}
			await page.waitForFunction(() => {
				const text = (document.getElementById("connectionStatus") || {}).textContent || "";
				return /^Patch update applied/.test(text) || /^HTML update applied/.test(text) || /AI request failed|Patch could not be applied|timed out|Auto-fix budget exhausted/i.test(text);
			}, null, { timeout: timeoutMs || 180000 });
		}
		const finalStatus = await page.$eval("#connectionStatus", el => el.textContent);
		assert(!/Auto-fix|AI request sent|Waiting for the session bridge|AI request failed|Patch could not be applied|timed out|Auto-fix budget exhausted/i.test(finalStatus), "Auto-fix did not settle: " + finalStatus);
	}

	async function sendPreviewPayload(payload) {
		await page.evaluate(p => {
			const frame = document.getElementById("previewFrame");
			frame.contentWindow.postMessage({ dataReceived: { overlayNinja: p } }, "*");
		}, payload);
	}

	async function previewText() {
		return page.evaluate(() => {
			const frame = document.getElementById("previewFrame");
			const body = frame && frame.contentWindow && frame.contentWindow.document.body;
			return ((body && (body.innerText || body.textContent)) || "").toLowerCase();
		});
	}

	async function currentHtmlSnippet() {
		return page.$eval("#htmlEditor", el => String(el.value || "").slice(0, 2500));
	}

	const results = [];
	for (let runIndex = 0; runIndex < RUN_COUNT; runIndex += 1) {
		const variant = USER_PROMPT_VARIANTS[runIndex % USER_PROMPT_VARIANTS.length];
		const canary = "AIPATCH_CANARY_" + (7319 + runIndex) + "_" + variant.label;

		await seedHtml(AUCTION_HTML, "auction-patch-" + runIndex);
		logStep(runIndex + 1, variant.label, "auction patch");
		await askPatch(variant.auction.replace("{{CANARY}}", canary), 240000);
		await sendPreviewPayload({ type: "whatnot", event: "auction_update", meta: { title: "Silver Slab", bidder: "Ava", priceText: "$88", bidsText: "7 Bids", timer: "00:19" } });
		await page.waitForTimeout(400);
		let text = await previewText();
		assert(text.includes("silver slab") && text.includes("ava") && text.includes("$88"), "Auction base fields missing after patch: " + text);
		assert(text.includes("00:19") && text.includes("7 bids") && text.includes("high bidder"), "Auction patch fields missing: " + text);

		logStep(runIndex + 1, variant.label, "chat patch");
		await askPatch(variant.chat, 240000);
		await sendPreviewPayload({ chatname: "Jess", chatmessage: "hello auction chat", type: "youtube" });
		await page.waitForTimeout(400);
		text = await previewText();
		assert(text.includes("jess: hello auction chat"), "Chat support patch missing: " + text + "\nHTML snippet:\n" + await currentHtmlSnippet());
		assert((prompts[prompts.length - 1] || "").includes(canary), "Conversation prompt should remember earlier user input before clearing.");

		await seedHtml(DONATION_HTML, "donation-patch-" + runIndex);
		logStep(runIndex + 1, variant.label, "donation patch");
		await askPatch(variant.donation, 240000);
		await sendPreviewPayload({ chatname: "DonorDana", chatmessage: "keep it up", hasDonation: "$25.00", type: "youtube" });
		await page.waitForTimeout(400);
		text = await previewText();
		assert(text.includes("tip") && text.includes("$25.00") && text.includes("donordana") && text.includes("youtube"), "Donation patch behavior missing: " + text);

		logStep(runIndex + 1, variant.label, "clear-memory check");
		await page.click("#clearConversation");
		await page.fill("#userRequest", "Answer only, no HTML: do you still see the earlier canary phrase in the recent conversation?");
		await page.click("#sendPrompt");
		await page.waitForFunction(() => /AI response received|HTML update applied|Patch update applied|AI request failed/i.test((document.getElementById("connectionStatus") || {}).textContent || ""), null, { timeout: 180000 });
		assert(!(prompts[prompts.length - 1] || "").includes(canary), "Conversation prompt should not include old canary after clear.");
		results.push({ run: runIndex + 1, variant: variant.label });
	}

	console.log(JSON.stringify({ endpoint: ENDPOINT, model: MODEL, runs: results, prompts: prompts.length, status: "passed" }, null, 2));
	await browser.close();
	server.close();
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
