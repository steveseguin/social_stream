const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4183;
const MODEL_HOST = "https://largefiles.socialstream.ninja/";

const MODEL_SPECS = [
	{
		providerKey: "localqwen",
		label: "Qwen 3.5 0.8B",
		modelId: "qwen3.5-0.8b-onnx-opt",
		runtime: {
			modelClass: "Qwen3_5ForConditionalGeneration",
			requiresWebGPU: true,
			dtype: {
				embed_tokens: "q4",
				decoder_model_merged: "q4",
				model: "q4",
				vision_encoder: "q4"
			},
			generation: {
				text: { temperature: 0.6, topP: 0.95, topK: 20 },
				vision: { temperature: 0.7, topP: 0.8, topK: 20 }
			}
		}
	},
	{
		providerKey: "localqwen2b",
		label: "Qwen 3.5 2B",
		modelId: "qwen3.5-2b-onnx-opt",
		runtime: {
			modelClass: "Qwen3_5ForConditionalGeneration",
			requiresWebGPU: true,
			dtype: {
				embed_tokens: "q4",
				decoder_model_merged: "q4",
				model: "q4",
				vision_encoder: "q4"
			},
			generation: {
				text: { doSample: false, repetitionPenalty: 1.0, noRepeatNgramSize: 4 },
				vision: { doSample: false, repetitionPenalty: 1.0, noRepeatNgramSize: 4 }
			}
		}
	}
];

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

(async () => {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	const blockedExternalRequests = [];
	const modelRequests = [];
	let browser;

	try {
		browser = await chromium.launch({
			channel: "chrome",
			headless: true,
			args: ["--enable-unsafe-webgpu"]
		});
		const context = await browser.newContext();

		context.on("request", request => {
			const url = new URL(request.url());
			if (url.hostname === "largefiles.socialstream.ninja") {
				modelRequests.push(url.href);
			}
		});
		await context.route("**/*", async route => {
			const requestUrl = new URL(route.request().url());
			const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === "localhost";
			const isModelHost = requestUrl.hostname === "largefiles.socialstream.ninja";
			const isHttp = requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
			if (isHttp && !isLocal && !isModelHost) {
				blockedExternalRequests.push(requestUrl.href);
				await route.abort();
				return;
			}
			await route.continue();
		});

		const page = await context.newPage();
		page.on("console", message => {
			if (message.type() === "error" || message.type() === "warning") {
				console.log(`PAGE_${message.type().toUpperCase()}:`, message.text());
			}
		});
		page.on("pageerror", error => console.log("PAGE_ERROR:", error.message));
		await page.goto(`http://${HOST}:${PORT}/thirdparty/transformersjs/NOTICE.md`, { waitUntil: "domcontentloaded" });

		const gpuInfo = await page.evaluate(async () => {
			const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
			return {
				navigatorGpu: !!navigator.gpu,
				adapterAvailable: !!adapter,
				features: adapter ? Array.from(adapter.features || []) : []
			};
		});
		assert(gpuInfo.adapterAvailable, `Installed Chrome did not expose a WebGPU adapter: ${JSON.stringify(gpuInfo)}`);

		async function runWorkerModel(spec, options = {}) {
			return await page.evaluate(
				async ({ spec, modelHost, initOnly }) => {
					const worker = new Worker("/local-browser-model-worker.js?v=18", { type: "module" });
					const pending = new Map();
					const statusEvents = [];
					const tokenText = new Map();
					let requestCounter = 0;

					function rejectAll(message) {
						for (const [requestId, entry] of pending.entries()) {
							clearTimeout(entry.timeoutId);
							entry.reject(new Error(message));
							pending.delete(requestId);
						}
					}

					function request(type, payload = {}, timeoutMs = 1200000) {
						const requestId = `chrome-${Date.now()}-${++requestCounter}`;
						return new Promise((resolve, reject) => {
							const timeoutId = setTimeout(() => {
								pending.delete(requestId);
								reject(new Error(`${type} timed out for ${spec.label}`));
							}, timeoutMs);
							pending.set(requestId, { resolve, reject, timeoutId });
							worker.postMessage({ type, requestId, ...payload });
						});
					}

					worker.onmessage = event => {
						const message = event.data || {};
						if (message.type === "status" || message.type === "progress") {
							statusEvents.push({
								type: message.type,
								state: message.state || "",
								phase: message.phase || "",
								progress: Number.isFinite(message.progress) ? message.progress : null,
								message: message.message || ""
							});
							return;
						}
						if (message.type === "token" && message.requestId) {
							tokenText.set(message.requestId, (tokenText.get(message.requestId) || "") + String(message.text || ""));
							return;
						}
						if (message.type !== "response" || !message.requestId) return;
						const entry = pending.get(message.requestId);
						if (!entry) return;
						clearTimeout(entry.timeoutId);
						pending.delete(message.requestId);
						if (message.ok) entry.resolve(message);
						else entry.reject(new Error(message.error || "Worker request failed"));
					};
					worker.onerror = event => rejectAll(event.message || `Worker error for ${spec.label}`);
					worker.onmessageerror = () => rejectAll(`Worker message error for ${spec.label}`);

					const initStartedAt = performance.now();
					const init = await request("init", {
						providerKey: spec.providerKey,
						providerLabel: spec.label,
						modelId: spec.modelId,
						device: "webgpu",
						remoteHost: modelHost,
						remotePathTemplate: "{model}/",
						runtime: spec.runtime
					});
					const initMs = Math.round(performance.now() - initStartedAt);

					if (initOnly) {
						await request("dispose", {}, 120000).catch(() => {});
						worker.terminate();
						return { init, initMs, statusEvents };
					}

					const canvas = document.createElement("canvas");
					canvas.width = 96;
					canvas.height = 64;
					const context = canvas.getContext("2d");
					context.fillStyle = "#d51f2a";
					context.fillRect(0, 0, 48, 64);
					context.fillStyle = "#1d4ed8";
					context.fillRect(48, 0, 48, 64);
					const image = canvas.toDataURL("image/jpeg", 0.85);

					const vision = await request(
						"generate",
						{
							providerKey: spec.providerKey,
							modelId: spec.modelId,
							prompt: "Briefly name the two dominant colors in this test image. Do not greet me or ask a question.",
							systemPrompt: "Answer the latest request directly and concisely.",
							images: [image],
							maxNewTokens: 32,
							maxTime: 60,
							runtime: spec.runtime
						},
						600000
					);
					const remember = await request(
						"generate",
						{
							providerKey: spec.providerKey,
							modelId: spec.modelId,
							prompt: "Remember exactly: my browser test codename is Silver Otter 73. Reply only with remembered.",
							systemPrompt: "Follow the latest instruction exactly.",
							maxNewTokens: 16,
							maxTime: 60,
							runtime: spec.runtime
						},
						600000
					);
					const recall = await request(
						"generate",
						{
							providerKey: spec.providerKey,
							modelId: spec.modelId,
							prompt: "What browser test codename did I tell you earlier? Answer with only the codename.",
							systemPrompt: "Follow the latest instruction exactly.",
							maxNewTokens: 16,
							maxTime: 60,
							runtime: spec.runtime
						},
						600000
					);

					await request("dispose", {}, 120000).catch(() => {});
					worker.terminate();
					return { init, initMs, vision, remember, recall, statusEvents };
				},
				{ spec, modelHost: MODEL_HOST, initOnly: !!options.initOnly }
			);
		}

		const results = [];
		for (const spec of MODEL_SPECS) {
			const result = await runWorkerModel(spec);
			assert(result.init.device === "webgpu", `${spec.label} did not initialize on WebGPU.`);
			assert(String(result.vision.text || "").trim(), `${spec.label} returned no multimodal response.`);
			assert(!/(?:do you want|would you like) to (?:discuss|talk about)/i.test(result.vision.text), `${spec.label} appended a generic readiness question: ${JSON.stringify(result.vision.text)}`);
			assert(String(result.remember.text || "").trim(), `${spec.label} returned no memory acknowledgement.`);
			assert(String(result.recall.text || "").trim() === "Silver Otter 73", `${spec.label} exact recall failed: ${JSON.stringify(result.recall)}`);
			results.push({ spec, result });
			console.log(
				"MODEL_RESULT:",
				JSON.stringify({
					provider: spec.providerKey,
					model: spec.modelId,
					initMs: result.initMs,
					device: result.init.device,
					vision: result.vision.text,
					remember: result.remember.text,
					recall: result.recall.text
				})
			);
		}

		const warmRequestStart = modelRequests.length;
		const warmResult = await runWorkerModel(MODEL_SPECS[0], { initOnly: true });
		const warmModelRequests = modelRequests.slice(warmRequestStart).filter(url => url.includes(MODEL_SPECS[0].modelId));
		assert(warmResult.init.device === "webgpu", "Warm Qwen 0.8B init did not use WebGPU.");
		assert(warmModelRequests.length === 0, `Warm Qwen 0.8B init redownloaded model files: ${warmModelRequests.join(", ")}`);
		assert(blockedExternalRequests.length === 0, `Unexpected external requests: ${blockedExternalRequests.join(", ")}`);

		console.log("GPU_INFO:", JSON.stringify(gpuInfo));
		console.log("MODEL_REQUEST_COUNT:", modelRequests.length);
		console.log("WARM_INIT_MS:", warmResult.initMs);
		console.log("WARM_MODEL_REQUEST_COUNT:", warmModelRequests.length);
		console.log("PASS installed Chrome Qwen 0.8B/2B WebGPU, multimodal, memory, and cache e2e");
	} finally {
		if (browser) await browser.close().catch(() => {});
		server.close();
	}
})().catch(error => {
	console.error(error && error.stack ? error.stack : error);
	process.exit(1);
});
