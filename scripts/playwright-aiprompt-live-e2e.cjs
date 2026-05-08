const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = Number(process.env.AIPROMPT_PORT || 4211);
const ENDPOINT = process.env.AIPROMPT_ENDPOINT || process.argv[2] || "https://llm.socialstream.ninja/v1/chat/completions";
const API_KEY = process.env.AIPROMPT_API_KEY || process.argv[3] || "test_token";
const MODEL = process.env.AIPROMPT_MODEL || process.argv[4] || "qwen3.6-35b-a3b-fp8";
const RUNS = Number(process.env.AIPROMPT_RUNS || process.argv[5] || 4);

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function parseSseLines(text, onText) {
	const lines = String(text || "").split(/\r?\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || !line.startsWith("data:")) continue;
		const data = line.slice(5).trim();
		if (!data || data === "[DONE]") continue;
		const json = JSON.parse(data);
		const delta = json.choices && json.choices[0] && json.choices[0].delta;
		const text = delta && (delta.content || delta.reasoning_content || "");
		if (text) onText(text);
	}
}

async function streamLLM(prompt, onText) {
	const body = {
		model: MODEL,
		messages: [{ role: "user", content: prompt }],
		stream: true,
		max_tokens: 6000,
		temperature: 0.25
	};
	const headers = { "content-type": "application/json" };
	if (API_KEY) headers.authorization = `Bearer ${API_KEY}`;
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let pending = "";
	let full = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
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
}

async function main() {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	let bridgeFrame = null;

	async function sendToBuilder(kind, target, value) {
		if (!bridgeFrame) return;
		await bridgeFrame.evaluate(
			([eventKind, eventTarget, eventValue]) => {
				const out = {};
				out[eventKind] = { target: eventTarget, value: eventValue };
				parent.postMessage({ dataReceived: { overlayNinja: out } }, "*");
			},
			[kind, target, value]
		);
	}

	await context.exposeBinding("__ssnAIPromptCall", async ({ frame }, payload) => {
		bridgeFrame = frame;
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

	const page = await context.newPage();
	const pageErrors = [];
	const consoleErrors = [];
	page.on("pageerror", err => pageErrors.push(err.message));
	page.on("console", msg => {
		const text = msg.text();
		if (msg.type() === "error" && !/Preview error:/.test(text)) consoleErrors.push(text);
	});

	await page.addInitScript(() => {
		const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
		Object.defineProperty(HTMLIFrameElement.prototype, "src", {
			configurable: true,
			get() {
				return srcDescriptor.get.call(this);
			},
			set(value) {
				if (String(value).includes("vdo.socialstream.ninja")) {
					srcDescriptor.set.call(this, "about:blank");
					const frame = this;
					setTimeout(() => {
						const doc = frame.contentDocument;
						doc.open();
						doc.write(`<!DOCTYPE html><html><body><script>
              var chunks = {};
              var store = null;
              function send(payload) {
                parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*');
              }
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
                if (payload.action === 'chatbot') {
                  window.__ssnAIPromptCall(payload);
                }
              });
            <\/script></body></html>`);
						doc.close();
					}, 0);
					return;
				}
				srcDescriptor.set.call(this, value);
			}
		});
	});

	await page.goto(`http://${HOST}:${PORT}/aiprompt.html?session=playwright-live`, { waitUntil: "networkidle" });
	await page.waitForSelector("#pageList .page-tab", { timeout: 10000 });
	await page.evaluate(() => {
		localStorage.removeItem("ssn-ai-prompt-pages-v2");
		location.reload();
	});
	await page.waitForSelector("#pageList .page-tab", { timeout: 10000 });
	await page.waitForFunction(
		() => {
			const status = document.getElementById("connectionStatus");
			return status && /connected/i.test(status.textContent || "");
		},
		null,
		{ timeout: 12000 }
	);

	async function sendPreviewPayload(payload) {
		return page.evaluate(p => {
			const frame = document.getElementById("previewFrame");
			if (!frame || !frame.contentWindow) return { sent: false, handlerType: "missing-frame" };
			const handlerType = typeof frame.contentWindow.handleOverlayPayload;
			frame.contentWindow.postMessage({ dataReceived: { overlayNinja: p } }, "*");
			return { sent: true, handlerType };
		}, payload);
	}

	async function getPreviewSnapshot() {
		return page.evaluate(() => {
			const frame = document.getElementById("previewFrame");
			const doc = frame && frame.contentWindow && frame.contentWindow.document;
			if (!doc) return { text: "", images: [] };
			let text = (doc.body && doc.body.innerText) || "";
			if (!text && doc.body) {
				const clone = doc.body.cloneNode(true);
				Array.prototype.slice.call(clone.querySelectorAll("script,style")).forEach(node => node.remove());
				text = clone.textContent || "";
			}
			const images = Array.prototype.slice.call(doc.images || []).map(img => img.src || "");
			return { text: text.toLowerCase(), images };
		});
	}

	function assertGeneratedLiveHtml(html, runLabel) {
		assert(/window\.handleOverlayPayload\s*=/.test(html), `${runLabel} missing window.handleOverlayPayload`);
		assert(/dataReceived[\s\S]{0,160}overlayNinja/.test(html), `${runLabel} missing dataReceived.overlayNinja listener`);
		assert(/params\.get\((["'])label\1\)\s*\|\|\s*(["'])dock\2/.test(html), `${runLabel} bridge label should default to dock`);
		assert(!/params\.get\((["'])label\1\)\s*\|\|\s*["'](?!dock["'])/i.test(html), `${runLabel} has unsafe non-dock bridge label fallback`);
		assert(!/(?:random|date\.now\(\)|math\.random\(\))[\s\S]{0,80}label|label[\s\S]{0,80}(?:random|date\.now\(\)|math\.random\(\))/i.test(html), `${runLabel} should not use random/time-based labels`);
	}

	async function waitForPreview(predicate, label, timeoutMs) {
		const started = Date.now();
		let lastSnapshot = null;
		while (Date.now() - started < (timeoutMs || 6000)) {
			const snapshot = await getPreviewSnapshot();
			lastSnapshot = snapshot;
			if (predicate(snapshot)) return snapshot;
			await page.waitForTimeout(200);
		}
		throw new Error("preview assertion timed out: " + label + " snapshot=" + JSON.stringify(lastSnapshot).slice(0, 1200));
	}

	const scenarios = [
		{
			name: "chat-with-source-icon",
			prompt: "I just want a clean chat overlay for OBS. Show avatar, name, message, and a small platform icon. Keep it transparent and make it work with live SSN messages.",
			async validate() {
				await sendPreviewPayload({ chatname: "Jess", chatmessage: "hello from youtube", chatimg: "https://socialstream.ninja/media/user1.jpg", type: "youtube" });
				await waitForPreview(s => s.text.indexOf("jess") >= 0 && s.text.indexOf("hello from youtube") >= 0, "chat text");
				await waitForPreview(s => s.images.some(src => /sources\/images\/youtube\.png/i.test(src)), "youtube source icon");
			}
		},
		{
			name: "stacked-alerts",
			prompt: "Turn this into a hype alert overlay. I want follows, subs, gifted subs, donations, and raids to pop up at the same time if a bunch happen quickly.",
			async validate() {
				await sendPreviewPayload({ chatname: "DonorDana", chatmessage: "keep it up", hasDonation: "$25.00", type: "youtube" });
				await sendPreviewPayload({ chatname: "SubSally", membership: "Member (6 months)", type: "twitch" });
				await sendPreviewPayload({ chatname: "FollowerFran", event: "new_follower", type: "kick" });
				await sendPreviewPayload({ chatname: "GiftyGus", event: "gifted", meta: { gift_count: 5 }, type: "twitch" });
				await sendPreviewPayload({ chatname: "RaidingRita", event: "raid", subtitle: "42 viewers", type: "twitch" });
				await waitForPreview(s => ["donordana", "subsally", "followerfran", "giftygus", "raidingrita"].every(name => s.text.indexOf(name) >= 0), "stacked alert names", 8000);
			}
		},
		{
			name: "viewer-snapshot",
			prompt: "Add a simple bottom viewer counter bar showing each platform and the total. It should stay accurate as platforms come and go.",
			async validate() {
				await sendPreviewPayload({ event: "viewer_updates", meta: { youtube: 815, twitch: 221, kick: 94 } });
				await waitForPreview(s => s.text.indexOf("815") >= 0 && s.text.indexOf("221") >= 0 && s.text.indexOf("94") >= 0, "viewer snapshot counts");
				await sendPreviewPayload({ event: "viewer_updates", meta: { youtube: 900 } });
				await waitForPreview(s => s.text.indexOf("900") >= 0 && s.text.indexOf("94") === -1, "viewer snapshot replacement");
			}
		},
		{
			name: "auction-widget",
			prompt: "I sell on Whatnot and need a sleek auction widget for OBS. Show the current item, bid, who is winning, bid count, and countdown timer. Make sure it updates live.",
			async validate() {
				await sendPreviewPayload({
					type: "whatnot",
					event: "auction_update",
					meta: {
						status: "winning",
						statusText: "Ava is Winning!",
						bidder: "Ava",
						title: "500 Spot Silver Slab Mega Set - #191",
						category: "Coins, U.S. currency",
						price: 88,
						priceText: "$88",
						bids: 7,
						bidsText: "7 Bids",
						timer: "00:19",
						shipping: "Shipping + Taxes are extra"
					}
				});
				await waitForPreview(s => s.text.indexOf("silver slab") >= 0 && s.text.indexOf("ava") >= 0 && s.text.indexOf("$88") >= 0 && s.text.indexOf("00:19") >= 0, "initial auction snapshot", 8000);
				await sendPreviewPayload({
					type: "whatnot",
					event: "auction_update",
					meta: {
						status: "winning",
						statusText: "Ben is Winning!",
						bidder: "Ben",
						title: "500 Spot Silver Slab Mega Set - #191",
						category: "Coins, U.S. currency",
						price: 95,
						priceText: "$95",
						bids: 8,
						bidsText: "8 Bids",
						timer: "00:12"
					}
				});
				await waitForPreview(s => s.text.indexOf("ben") >= 0 && s.text.indexOf("$95") >= 0 && s.text.indexOf("00:12") >= 0, "updated auction snapshot", 8000);
			}
		}
	];

	const results = [];
	for (let i = 0; i < RUNS; i++) {
		const scenario = scenarios[i % scenarios.length];
		await page.fill("#userRequest", scenario.prompt);
		await page.click("#sendPrompt");
		await page.waitForFunction(
			() => {
				const pending = document.querySelector(".msg.assistant:last-child .stream-meta");
				return pending && /chunks/.test(pending.textContent || "");
			},
			null,
			{ timeout: 45000 }
		);
		await page.waitForFunction(
			() => {
				const status = document.getElementById("connectionStatus");
				const text = (status && status.textContent) || "";
				return /^HTML update applied/.test(text) || /AI request failed|timed out|budget exhausted/i.test(text);
			},
			null,
			{ timeout: 180000 }
		);
		await page.waitForTimeout(1800);
		const snapshot = await page.evaluate(() => {
			const status = document.getElementById("connectionStatus").textContent;
			const consoleBar = document.getElementById("consoleBar");
			const consoleText = document.getElementById("consoleBarText").textContent;
			const html = document.getElementById("htmlEditor").value;
			return {
				status,
				hasConsoleError: consoleBar.classList.contains("visible"),
				consoleText,
				htmlLength: html.length,
				hasHtml: /<html[\s>]/i.test(html) || /<!doctype html/i.test(html),
				html
			};
		});
		const resultSnapshot = { ...snapshot };
		delete resultSnapshot.html;
		results.push({ run: i + 1, scenario: scenario.name, prompt: scenario.prompt, ...resultSnapshot });
		assert(/^HTML update applied/.test(snapshot.status), `run ${i + 1} failed status: ${snapshot.status}`);
		assert(!snapshot.hasConsoleError, `run ${i + 1} preview error: ${snapshot.consoleText}`);
		assert(snapshot.hasHtml && snapshot.htmlLength > 500, `run ${i + 1} did not apply usable HTML`);
		try {
			assertGeneratedLiveHtml(snapshot.html, `run ${i + 1} ${scenario.name}`);
		} catch (error) {
			console.error("STRUCTURAL HTML FAILURE", error.message);
			console.error(snapshot.html.slice(0, 10000));
			throw error;
		}
		const handlerType = await page.evaluate(() => {
			const frame = document.getElementById("previewFrame");
			return frame && frame.contentWindow ? typeof frame.contentWindow.handleOverlayPayload : "missing-frame";
		});
		assert(handlerType === "function", `run ${i + 1} did not expose window.handleOverlayPayload; got ${handlerType}`);
		try {
			await scenario.validate();
		} catch (error) {
			const debug = await page.evaluate(() => ({
				html: document.getElementById("htmlEditor").value,
				preview: document.getElementById("previewFrame").contentWindow.document.documentElement.outerHTML,
				handlerType: typeof document.getElementById("previewFrame").contentWindow.handleOverlayPayload
			}));
			console.error("Validation failed for", scenario.name);
			console.error("HANDLER", debug.handlerType);
			console.error(debug.html.slice(0, 10000));
			console.error("PREVIEW", debug.preview.slice(0, 4000));
			throw error;
		}
	}

	await page.evaluate(() => {
		const editor = document.getElementById("htmlEditor");
		editor.value = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Broken</title></head><body><div id="stage"></div><script>var broken = “invalid quotes”; document.getElementById("stage").textContent = broken;<\/script></body></html>';
		editor.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await page.click("#refreshPreview");
	await page.waitForSelector("#consoleBar.visible", { timeout: 5000 });
	await page.click("#consoleBarFix");
	await page.waitForFunction(
			() => {
				const status = document.getElementById("connectionStatus");
				const text = (status && status.textContent) || "";
				return /^HTML update applied/.test(text) || /AI request failed|timed out|budget exhausted/i.test(text);
			},
		null,
		{ timeout: 180000 }
	);
	await page.waitForTimeout(1500);
	const repair = await page.evaluate(() => {
		const status = document.getElementById("connectionStatus").textContent;
		const consoleBar = document.getElementById("consoleBar");
		const consoleText = document.getElementById("consoleBarText").textContent;
		const html = document.getElementById("htmlEditor").value;
		return {
			run: "manual-fix-invalid-character",
			status,
			hasConsoleError: consoleBar.classList.contains("visible"),
			consoleText,
			htmlLength: html.length,
			stillHasInvalidQuotes: /[“”]/.test(html)
		};
	});
	results.push(repair);
	assert(/^HTML update applied/.test(repair.status), "manual invalid-character fix failed status: " + repair.status);
	assert(!repair.hasConsoleError, "manual invalid-character fix left preview error: " + repair.consoleText);
	assert(!repair.stillHasInvalidQuotes, "manual invalid-character fix left smart quotes in script");

	console.log(JSON.stringify({ endpoint: ENDPOINT, model: MODEL, runs: results }, null, 2));
	await browser.close();
	server.close();
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
