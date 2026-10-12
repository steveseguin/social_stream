const assert = require("assert");
const fs = require("fs");
const path = require("path");

function makeVdoUrl(password) {
  return "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" +
    encodeURIComponent(password) +
    "&solo&view=test&novideo&noaudio&label=dock&cleanoutput&room=test";
}

const samples = [
  "HCRz@L9Pt%nvTezQ",
  "pa&ss=1",
  "a+b c",
  "100% real",
  "equals=inside"
];

for (const password of samples) {
  const parsed = new URL(makeVdoUrl(password));
  assert.strictEqual(parsed.searchParams.get("password"), password);
}

const broken = new URL("https://vdo.socialstream.ninja/?password=pa&ss=1");
assert.notStrictEqual(broken.searchParams.get("password"), "pa&ss=1");
assert.strictEqual(broken.searchParams.has("ss"), true);

const skipDirs = new Set([".git", "node_modules", "tmp", "thirdparty", "vendor"]);
const extensions = new Set([".html", ".js", ".md"]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
}

walk(path.resolve(__dirname, ".."));

const rawPasswordPatterns = [
  /password=\$\{(?:password|this\.state\.password)\}/,
  /password=["']?\s*\+\s*(?:password|this\.state\.password)\b/,
  /password=["']\s*\+\s*(?:password|this\.state\.password)\b/
];
const violations = [];

for (const file of files) {
  if (path.resolve(file) === __filename) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes("password=") || line.includes("encodeURIComponent")) return;
    if (rawPasswordPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${path.relative(process.cwd(), file)}:${index + 1}:${line.trim()}`);
    }
  });
}

assert.deepStrictEqual(violations, []);
console.log("VDO password URL encoding tests passed");
