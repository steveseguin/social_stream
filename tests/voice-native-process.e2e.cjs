const assert = require("node:assert/strict");
const cp = require("node:child_process");
let observedArgs;
let spawned,
	missingDependency = false;
const began = new Promise(resolve => {
	spawned = resolve;
});
const original = cp.spawn;
cp.spawn = (...args) => {
	observedArgs = args[1];
	if (missingDependency) {
		const { EventEmitter } = require("node:events"),
			{ PassThrough } = require("node:stream");
		const fake = new EventEmitter();
		fake.stdin = new PassThrough();
		fake.stdout = new PassThrough();
		fake.stderr = new PassThrough();
		fake.kill = () => {};
		process.nextTick(() => fake.emit("close", -1073741515));
		return fake;
	}
	const child = original(...args);
	child.once("spawn", () => spawned(child));
	return child;
};
const create = require("../../ssapp/voice-native-whisper");
cp.spawn = original;
(async () => {
	assert(process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR, "Point to the verified runtime cache");
	const engine = create({
		app: {
			getPath: () => {
				throw Error("Use an isolated cache");
			}
		}
	});
	const pending = engine.transcribe(new Float32Array(64000).buffer);
	const cancelled = assert.rejects(pending, /cancelled/);
	const child = await began;
	engine.stop();
	await cancelled;
	assert(child.exitCode !== null || child.signalCode !== null);
	const result = await engine.transcribe(new Float32Array(8000).buffer);
	assert.equal(typeof result.text, "string");
	engine.stop();
	missingDependency = true;
	await assert.rejects(engine.transcribe(new Float32Array(8000).buffer), /Visual C\+\+ Redistributable \(x64\)/);
	const os = require("node:os"),
		originalCpus = os.cpus;
	try {
		for (const [cores, expected] of [
			[1, 1],
			[4, 4],
			[8, 4],
			[16, 4],
			[24, 6],
			[32, 6]
		]) {
			os.cpus = () => Array(cores).fill({});
			const capped = create({
				app: {
					getPath: () => {
						throw Error("Use the isolated cache");
					}
				}
			});
			await assert.rejects(capped.transcribe(new Float32Array(8000).buffer), /Visual C/);
			assert.equal(observedArgs[observedArgs.indexOf("-t") + 1], String(expected), "Thread cap for " + cores + " logical CPUs");
		}
	} finally {
		os.cpus = originalCpus;
	}
	missingDependency = false;
	console.log("PASS real native process cancellation and fresh recognition after Stop");
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
