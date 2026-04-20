const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = Number(process.env.AIPROMPT_PORT || 4211);
const ENDPOINT = process.env.AIPROMPT_ENDPOINT || process.argv[2] || "https://llm.socialstream.ninja/v1/chat/completions";
const API_KEY = process.env.AIPROMPT_API_KEY || process.argv[3] || "";
const MODEL = process.env.AIPROMPT_MODEL || process.argv[4] || "default";
const RUNS = Number(process.env.AIPROMPT_RUNS || process.argv[5] || 3);

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

	const prompts = ["Create a compact transparent chat overlay with avatar, name, message, and platform tag. Use old-school browser JavaScript and the SSN bridge. Return only the complete HTML.", "Change this overlay to stack donation, membership, follow, and raid alerts. Keep chatname prominent and support simultaneous alerts. Return only the complete HTML.", "Add a viewer counter ticker for viewer_updates meta snapshots at the bottom, preserving the existing alert behavior. Return only the complete HTML."];

	const results = [];
	for (let i = 0; i < RUNS; i++) {
		const prompt = prompts[i % prompts.length];
		await page.fill("#userRequest", prompt);
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
				return text === "HTML update applied." || /AI request failed|timed out|budget exhausted/i.test(text);
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
				hasHtml: /<html[\s>]/i.test(html) || /<!doctype html/i.test(html)
			};
		});
		results.push({ run: i + 1, prompt, ...snapshot });
		assert(snapshot.status === "HTML update applied.", `run ${i + 1} failed status: ${snapshot.status}`);
		assert(!snapshot.hasConsoleError, `run ${i + 1} preview error: ${snapshot.consoleText}`);
		assert(snapshot.hasHtml && snapshot.htmlLength > 500, `run ${i + 1} did not apply usable HTML`);
	}

	console.log(JSON.stringify({ endpoint: ENDPOINT, model: MODEL, runs: results }, null, 2));
	await browser.close();
	server.close();
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
