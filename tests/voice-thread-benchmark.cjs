const { app } = require("electron"),
	{ Worker } = require("worker_threads"),
	fs = require("fs"),
	path = require("path"),
	os = require("os"),
	{ pathToFileURL } = require("url");
const root = process.env.SSAPP_REPO || path.resolve(__dirname, "../../ssapp"),
	corpus = path.join(os.tmpdir(), "ssn-voice-corpus");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "ssn-voice-threads-")));
app.disableHardwareAcceleration();
function pcm(file) {
	const b = fs.readFileSync(file);
	let pos = 12;
	while (pos < b.length) {
		const size = b.readUInt32LE(pos + 4);
		if (b.toString("ascii", pos, pos + 4) === "data") {
			const a = new Float32Array(size / 2);
			for (let i = 0; i < a.length; i++) a[i] = b.readInt16LE(pos + 8 + i * 2) / 32768;
			return a.buffer;
		}
		pos += 8 + size + (size % 2);
	}
	throw Error("No WAV data");
}
process.on("uncaughtException", e => {
	fs.writeFileSync(path.join(os.tmpdir(), "ssn-voice-thread-error.txt"), e.stack);
	app.exit(1);
});
app.whenReady()
	.then(async () => {
		const rows = [];
		for (const threads of [0, 1, 2, 4]) {
			let code = fs.readFileSync(path.join(root, "stt-worker.js"), "utf8").replace("'@huggingface/transformers'", JSON.stringify(pathToFileURL(path.join(root, "node_modules/@huggingface/transformers/dist/transformers.node.mjs")).href));
			code = code.replace("progress_callback: handleModelProgress,", "session_options: {intraOpNumThreads:" + threads + ",interOpNumThreads:1},progress_callback: handleModelProgress,");
			const worker = new Worker(code, { eval: true, workerData: { cacheDir: path.join(root, ".codex-tmp/whisper-cache") } });
			let id = 0;
			const infer = audio =>
				new Promise((resolve, reject) => {
					const req = ++id;
					const timer = setTimeout(() => reject(Error("Whisper timeout")), 90000);
					const listener = m => {
						if (m.type === "result" && m.id === req) {
							clearTimeout(timer);
							worker.off("message", listener);
							m.error ? reject(Error(m.error)) : resolve(m);
						}
					};
					worker.on("message", listener);
					worker.postMessage({ id: req, audioBuffer: audio });
				});
			try {
				await infer(new Float32Array(8000).buffer);
				for (let repeat = 0; repeat < 2; repeat++)
					for (const sample of [0, 1, 5, 21]) {
						const result = await infer(pcm(path.join(corpus, "speech-" + sample + ".wav")));
						rows.push({ threads, sample, ms: result.elapsedMs, text: result.text });
						fs.writeFileSync(path.join(os.tmpdir(), "ssn-voice-thread-results.json"), JSON.stringify(rows, null, 2));
						console.log(JSON.stringify(rows.at(-1)));
					}
			} finally {
				console.log("TERMINATING " + threads);
				await worker.terminate();
				console.log("TERMINATED " + threads);
			}
		}
		fs.writeFileSync(path.join(os.tmpdir(), "ssn-voice-thread-results.json"), JSON.stringify(rows, null, 2));
		app.quit();
	})
	.catch(e => {
		console.error(e);
		app.exit(1);
	});
