const fs = require("fs"),
	path = require("path"),
	os = require("os"),
	cp = require("child_process");
const dir = path.join(os.tmpdir(), "ssn-whisper-native"),
	corpus = path.join(os.tmpdir(), "ssn-voice-corpus"),
	rows = [];
for (const item of JSON.parse(fs.readFileSync(path.join(corpus, "chunks.json"), "utf8"))) {
	if (item.condition === "long-utterance") continue;
	const start = Date.now();
	const r = cp.spawnSync(path.join(dir, "Release/whisper-cli.exe"), ["-m", path.join(dir, "tiny.en-q5_1.bin"), "-f", "-", "-of", "ssn-voice", "-nt", "-np", "-ng", "-bo", "1", "-bs", "1", "-nf"], { input: fs.readFileSync(path.join(corpus, item.file)), windowsHide: true, encoding: "utf8", timeout: 10000 });
	if (r.status !== 0) throw Error(r.stderr);
	const text = r.stdout.trim(),
		normalized = text
			.toLowerCase()
			.replace(/[.,!?;:]/g, "")
			.replace(/\s+/g, " ")
			.trim(),
		hit = ["ninja celebration", "launch the fireworks", "show the dancing cat"].includes(normalized);
	rows.push({ ...item, text, ms: Date.now() - start, passed: item.expected ? normalized === item.expected : !hit });
}
fs.writeFileSync(path.join(os.tmpdir(), "ssn-voice-native-results.json"), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ positive: rows.filter(r => r.expected && r.passed).length, total: rows.filter(r => r.expected).length, negative: rows.filter(r => !r.expected && r.passed).length, negativeTotal: rows.filter(r => !r.expected).length, p95: rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(rows.length * 0.95)], failures: rows.filter(r => !r.passed) }, null, 2));
