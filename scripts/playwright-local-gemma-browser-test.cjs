const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4184;
const MODEL_ID = "gemma4-e2b-it-onnx";
const MODEL_HOST = "https://largefiles.socialstream.ninja/";
const MODEL_PATH_TEMPLATE = "{model}/";

(async () => {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	let browser;
	try {
		browser = await chromium.launch({
			channel: "chrome",
			headless: true,
			args: ["--enable-unsafe-webgpu"]
		});
		const context = await browser.newContext();
		const page = await context.newPage();
		page.on("console", message => {
			if (message.type() === "error" || message.type() === "warning") {
				console.log(`PAGE_${message.type().toUpperCase()}:`, message.text());
			}
		});
		page.on("pageerror", error => console.log("PAGE_ERROR:", error.message));
		await page.goto(`http://${HOST}:${PORT}/thirdparty/transformersjs/NOTICE.md`, { waitUntil: "domcontentloaded" });

		const result = await page.evaluate(
			async ({ modelId, modelHost, modelPathTemplate }) => {
				const worker = new Worker("/local-browser-model-worker.js?v=18", { type: "module" });
				const pending = new Map();
				const events = [];
				let counter = 0;
				worker.onmessage = event => {
					const message = event.data || {};
					if (message.type === "status" || message.type === "progress") {
						events.push({
							type: message.type,
							state: message.state || "",
							phase: message.phase || "",
							progress: message.progress ?? null,
							message: message.message || ""
						});
						return;
					}
					if (message.type !== "response" || !message.requestId) return;
					const request = pending.get(message.requestId);
					if (!request) return;
					clearTimeout(request.timeoutId);
					pending.delete(message.requestId);
					if (message.ok) request.resolve(message);
					else request.reject(new Error(message.error || "Gemma worker request failed"));
				};
				worker.onerror = event => {
					for (const request of pending.values()) request.reject(new Error(event.message || "Gemma worker error"));
					pending.clear();
				};
				function request(type, payload = {}, timeoutMs = 1200000) {
					const requestId = `gemma-${Date.now()}-${++counter}`;
					return new Promise((resolve, reject) => {
						const timeoutId = setTimeout(() => {
							pending.delete(requestId);
							reject(new Error(`${type} timed out`));
						}, timeoutMs);
						pending.set(requestId, { resolve, reject, timeoutId });
						worker.postMessage({ type, requestId, ...payload });
					});
				}

				const runtime = {
					modelClass: "Gemma4ForConditionalGeneration",
					requiresWebGPU: true,
					dtype: {
						embed_tokens: "q4",
						decoder_model_merged: "q4",
						vision_encoder: "q4",
						audio_encoder: "q4"
					},
					generation: {
						text: { temperature: 1.0, topP: 0.95, topK: 64 },
						vision: { temperature: 1.0, topP: 0.95, topK: 64 }
					}
				};
				const canvas = document.createElement("canvas");
				canvas.width = 64;
				canvas.height = 64;
				const context = canvas.getContext("2d");
				context.fillStyle = "#1255cc";
				context.fillRect(0, 0, 64, 64);
				context.fillStyle = "#ffffff";
				context.fillRect(16, 16, 32, 32);
				const imageDataUrl = canvas.toDataURL("image/png");
				const initStartedAt = performance.now();
				const init = await request("init", {
					providerKey: "localgemma",
					providerLabel: "Local Gemma 4 Multimodal",
					modelId,
					device: "webgpu",
					remoteHost: modelHost,
					remotePathTemplate: modelPathTemplate,
					runtime
				});
				const initMs = Math.round(performance.now() - initStartedAt);
				const generationStartedAt = performance.now();
				const generation = await request(
					"generate",
					{
						providerKey: "localgemma",
						modelId,
						prompt: "Describe the colors and simple shape in this image in one short sentence.",
						systemPrompt: "Use the attached image and answer directly and concisely.",
						images: [imageDataUrl],
						maxNewTokens: 32,
						maxTime: 60,
						runtime
					},
					300000
				);
				const generationMs = Math.round(performance.now() - generationStartedAt);
				await request("dispose", {}, 120000).catch(() => {});
				worker.terminate();
				return { init, initMs, generation, generationMs, events: events.slice(-40) };
			},
			{ modelId: MODEL_ID, modelHost: MODEL_HOST, modelPathTemplate: MODEL_PATH_TEMPLATE }
		);

		console.log("GEMMA_MULTIMODAL_RESULT:", JSON.stringify(result));
		if (result.init.device !== "webgpu") throw new Error(`Gemma multimodal did not initialize on WebGPU: ${JSON.stringify(result.init)}`);
		if (!String(result.generation.text || "").trim()) throw new Error("Gemma multimodal returned no text for an image prompt.");
		console.log("PASS Gemma 4 multimodal ONNX WebGPU test");
	} finally {
		if (browser) await browser.close().catch(() => {});
		server.close();
	}
})().catch(error => {
	console.error(error?.stack || error);
	process.exit(1);
});
