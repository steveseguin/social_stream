const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = Number(process.env.TTS_TEST_PORT || 4217);
const DEFAULT_LIVE_URL = "https://socialstream.ninja/beta/dock.html?session=tts-validation&speech&twolines";
const DEFAULT_PROVIDERS = ["system", "espeak", "kokoro", "piper", "kitten"];

function getArg(name) {
	const prefix = "--" + name + "=";
	const found = process.argv.find((arg) => arg.startsWith(prefix));
	return found ? found.slice(prefix.length) : null;
}

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms))
	]);
}

function makeDockUrl(baseUrl, provider) {
	const url = new URL(baseUrl);
	url.searchParams.set("session", url.searchParams.get("session") || "tts-validation");
	url.searchParams.set("speech", "");
	url.searchParams.delete("ttsprovider");
	return url.href;
}

async function testProvider(page, baseUrl, provider) {
	const url = makeDockUrl(baseUrl, provider);
	const consoleErrors = [];
	const failedRequests = [];
	const badResponses = [];
	const pageErrors = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			consoleErrors.push(message.text());
		}
	});
	page.on("requestfailed", (request) => {
		failedRequests.push(request.url() + " :: " + (request.failure()?.errorText || "failed"));
	});
	page.on("response", (response) => {
		const status = response.status();
		if (status >= 400) {
			badResponses.push(status + " " + response.url());
		}
	});
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
	await page.waitForFunction(() => window.TTS && typeof window.TTS.configure === "function", null, { timeout: 30000 });

	let result;
	let error = null;
	try {
		result = await withTimeout(page.evaluate(async (providerName) => {
		function ensure(condition, message) {
			if (!condition) throw new Error(message);
		}

		if (window.HTMLMediaElement) {
			window.HTMLMediaElement.prototype.play = function() {
				this.dispatchEvent(new Event("ended"));
				return Promise.resolve();
			};
		}

		if (providerName === "system") {
			ensure(window.speechSynthesis, "speechSynthesis unavailable");
			ensure(window.SpeechSynthesisUtterance, "SpeechSynthesisUtterance unavailable");
			let utteranceText = "";
			window.speechSynthesis.speak = function(utterance) {
				utteranceText = utterance && utterance.text ? utterance.text : "";
				setTimeout(() => utterance.dispatchEvent(new Event("end")), 0);
			};
			window.TTS.voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
			window.TTS.TTSProvider = "system";
			window.TTS.speech = true;
			window.TTS.speak("tts validation message", true);
			ensure(utteranceText.indexOf("tts validation message") !== -1, "system TTS did not call speak");
			return { ok: true, detail: "speechSynthesis spoke" };
		}

		if (providerName === "espeak") {
			const ok = await window.TTS.initEspeak();
			ensure(ok && window.TTS.espeakInstance, "eSpeak init failed");
			const wav = await window.TTS.espeakInstance.speak("tts validation message", window.TTS.espeakSettings);
			const size = wav && (wav.byteLength || wav.size || 0);
			ensure(size > 44, "eSpeak generated empty WAV");
			return { ok: true, detail: "wav=" + size };
		}

		if (providerName === "piper") {
			const ok = await window.TTS.initPiper();
			ensure(ok && window.TTS.piperInstance, "Piper init failed");
			const blob = await window.TTS.piperInstance.synthesize("tts validation message", window.TTS.piperSettings.speed);
			ensure(blob && blob.size > 44, "Piper generated empty WAV");
			return {
				ok: true,
				detail: "blob=" + blob.size + " model=" + (window.TTS.piperInstance.voiceModelPath || "")
			};
		}

		if (providerName === "kokoro") {
			const ok = await window.TTS.initKokoro();
			ensure(ok && window.TTS.kokoroTtsInstance, "Kokoro init failed");
			const streamer = new window.TTS.TextSplitterStream();
			streamer.push("tts validation message");
			streamer.close();
			const stream = window.TTS.kokoroTtsInstance.stream(streamer, {
				voice: window.TTS.kokoroSettings.voiceName || "af_aoede",
				speed: window.TTS.kokoroSettings.speed || 1,
				streamAudio: false
			});
			for await (const chunk of stream) {
				if (!chunk || !chunk.audio) continue;
				const blob = chunk.audio.toBlob();
				ensure(blob && blob.size > 44, "Kokoro generated empty WAV");
				return { ok: true, detail: "blob=" + blob.size + " device=" + window.TTS.kokoroDevice };
			}
			throw new Error("Kokoro generated no audio");
		}

		if (providerName === "kitten") {
			const ok = await window.TTS.initKitten();
			ensure(ok && window.TTS.kittenInstance, "Kitten init failed");
			const blob = await window.TTS.kittenInstance.generateSpeech(
				"tts validation message",
				window.TTS.kittenSettings.voice,
				window.TTS.kittenSettings.speed
			);
			ensure(blob && blob.size > 44, "Kitten generated empty WAV");
			return { ok: true, detail: "blob=" + blob.size + " voice=" + window.TTS.kittenSettings.voice };
		}

		throw new Error("Unsupported provider: " + providerName);
		}, provider), provider === "piper" || provider === "kitten" || provider === "kokoro" ? 300000 : 90000, provider);
	} catch (caught) {
		error = caught;
	}

	return {
		provider,
		url,
		error: error ? error.message : null,
		result,
		consoleErrors: consoleErrors.filter((message) => /tts|speech|piper|kitten|kokoro|espeak|wasm|onnx/i.test(message)).slice(0, 20),
		pageErrors: pageErrors.slice(0, 20),
		failedRequests: failedRequests.filter((message) => /tts|speech|piper|kitten|kokoro|espeak|wasm|onnx/i.test(message)).slice(0, 20),
		badResponses: badResponses.filter((message) => /tts|speech|piper|kitten|kokoro|espeak|wasm|onnx/i.test(message)).slice(0, 20)
	};
}

async function main() {
	const local = process.argv.includes("--local");
	const blockLocalPiperModels = process.argv.includes("--block-local-piper-models");
	const providers = (getArg("providers") || DEFAULT_PROVIDERS.join(",")).split(",").map((value) => value.trim()).filter(Boolean);
	let server = null;
	const baseUrl = getArg("url") || (local ? `http://${HOST}:${PORT}/dock.html?session=tts-validation&speech&twolines` : DEFAULT_LIVE_URL);

	if (local) {
		server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	}

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	await context.addInitScript(() => {
		const nativeEval = window.eval;
		Object.defineProperty(window, "eval", {
			value: nativeEval,
			writable: false,
			configurable: false
		});
	});
	if (blockLocalPiperModels) {
		await context.route(`http://${HOST}:${PORT}/thirdparty/piper/piper-voices/**/*.onnx`, (route) => route.fulfill({ status: 404, body: "Not Found" }));
		await context.route(`http://${HOST}:${PORT}/thirdparty/piper/piper-voices/*.onnx`, (route) => route.fulfill({ status: 404, body: "Not Found" }));
	}
	const results = [];

	try {
		for (const provider of providers) {
			const page = await context.newPage();
			try {
				results.push(await testProvider(page, baseUrl, provider));
			} catch (error) {
				results.push({ provider, error: error.message });
			} finally {
				await page.close();
			}
		}
	} finally {
		await browser.close();
		if (server) server.close();
	}

		for (const entry of results) {
		if (entry.error) {
			console.log("FAIL", entry.provider, entry.error);
			if (entry.badResponses && entry.badResponses.length) console.log("  badResponses:", entry.badResponses.join(" | "));
			if (entry.failedRequests && entry.failedRequests.length) console.log("  failedRequests:", entry.failedRequests.join(" | "));
			if (entry.consoleErrors && entry.consoleErrors.length) console.log("  consoleErrors:", entry.consoleErrors.join(" | "));
			if (entry.pageErrors && entry.pageErrors.length) console.log("  pageErrors:", entry.pageErrors.join(" | "));
			continue;
		}
		console.log("PASS", entry.provider, entry.result.detail);
		if (entry.badResponses.length) console.log("  badResponses:", entry.badResponses.join(" | "));
		if (entry.failedRequests.length) console.log("  failedRequests:", entry.failedRequests.join(" | "));
		if (entry.consoleErrors.length) console.log("  consoleErrors:", entry.consoleErrors.join(" | "));
		if (entry.pageErrors.length) console.log("  pageErrors:", entry.pageErrors.join(" | "));
	}

	if (results.some((entry) => entry.error)) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
