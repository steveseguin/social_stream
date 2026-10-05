const fs = require("fs"),
	path = require("path"),
	os = require("os"),
	cp = require("child_process");
const dir = path.join(os.tmpdir(), "ssn-whisper-native"),
	corpus = process.env.SSAPP_VOICE_CORPUS || path.join(os.tmpdir(), "ssn-voice-corpus");
const cache = process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR;
const executable = cache ? path.join(cache, "whisper-cli.exe") : path.join(dir, "Release/whisper-cli.exe");
const model = path.join(cache || dir, "tiny.en-q5_1.bin");
const inputs = JSON.parse(fs.readFileSync(path.join(corpus, "chunks.json"), "utf8")).filter(x => x.condition !== "long-utterance");
const round = process.env.SSAPP_VOICE_BENCH_ROUND || "1";
const variants =
	round === "7"
		? [
				{ name: "baseline6", args: ["-t", "6"] },
				{ name: "ninjaHint", args: ["-t", "6", "--prompt", "Ninja."] }
			]
		: round === "6"
			? [
					{ name: "baseline6", args: ["-t", "6"] },
					{ name: "ninjaHint", args: ["-t", "6", "--prompt", "Ninja."] },
					{ name: "commandHint", args: ["-t", "6", "--prompt", "Ninja celebration. Launch the fireworks. Show the dancing cat. Release the rainbow unicorn. Ninja start the countdown. Switch to the cozy scene."] }
				]
			: round === "5"
				? [
						{ name: "baseline6", args: ["-t", "6"] },
						{ name: "ninjaHint", args: ["-t", "6", "--prompt", "Ninja."] },
						{ name: "beam3", args: ["-t", "6", "-bs", "3"] }
					]
				: round === "4"
					? [
							{ name: "baseline4", args: ["-t", "4"] },
							{ name: "threads6", args: ["-t", "6"] }
						]
					: round === "3"
						? [
								{ name: "baseline4", args: ["-t", "4"] },
								{ name: "context1280", args: ["-t", "4", "-ac", "1280"] },
								{ name: "threads6", args: ["-t", "6"] },
								{ name: "threads8", args: ["-t", "8"] }
							]
						: round === "2"
							? [
									{ name: "baseline4", args: ["-t", "4"] },
									{ name: "context768", args: ["-t", "4", "-ac", "768"] },
									{ name: "context1024", args: ["-t", "4", "-ac", "1024"] },
									{ name: "noFlash4", args: ["-t", "4", "-nfa"] }
								]
							: [
									{ name: "baseline4", args: ["-t", "4"] },
									{ name: "threads2", args: ["-t", "2"] },
									{ name: "context512", args: ["-t", "4", "-ac", "512"] },
									{ name: "context256", args: ["-t", "4", "-ac", "256"] }
								];
const rows = [],
	normalize = s =>
		s
			.toLowerCase()
			.replace(/[.,!?;:]/g, "")
			.replace(/\s+/g, " ")
			.trim(),
	commands = [...new Set(inputs.filter(x => x.expected).map(x => x.expected))];
for (let i = 0; i < inputs.length; i++) {
	const item = inputs[i],
		audio = fs.readFileSync(path.join(corpus, item.file));
	for (let j = 0; j < variants.length; j++) {
		const variant = variants[(i + j) % variants.length],
			at = performance.now();
		const result = cp.spawnSync(executable, ["-m", model, "-f", "-", "-of", "ssn-voice", "-nt", "-np", "-ng", "-bo", "1", "-bs", "1", "-nf", ...variant.args], { input: audio, windowsHide: true, encoding: "utf8", timeout: 10000 });
		const text = (result.stdout || "").trim(),
			n = normalize(text);
		rows.push({ ...item, variant: variant.name, text, ms: performance.now() - at, passed: result.status === 0 && (item.expected ? n === item.expected : !commands.includes(n)), exit: result.status });
	}
	if (i % 10 === 0) console.log("Compared " + (i + 1) + "/" + inputs.length + " recordings");
}
const summaries = variants.map(v => {
	const r = rows.filter(x => x.variant === v.name),
		times = r.map(x => x.ms).sort((a, b) => a - b);
	return { name: v.name, positive: r.filter(x => x.expected && x.passed).length, negative: r.filter(x => !x.expected && x.passed).length, p50: times[Math.floor(times.length * 0.5)], p95: times[Math.floor(times.length * 0.95)], failures: r.filter(x => !x.passed) };
});
fs.writeFileSync(path.join(os.tmpdir(), "ssn-voice-native-matrix-round" + round + (process.env.SSAPP_VOICE_CORPUS ? "-challenge" : "") + ".json"), JSON.stringify({ summaries, rows }, null, 2));
console.log(JSON.stringify(summaries, null, 2));
