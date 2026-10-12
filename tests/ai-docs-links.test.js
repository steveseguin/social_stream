const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pages = [
  "index.html",
  "docs/index.html",
  "docs/guides.html",
  "docs/features.html",
  "docs/ai-modes-guide.html"
];
const missing = [];

for (const relativePage of pages) {
  const pagePath = path.join(root, relativePage);
  const html = fs.readFileSync(pagePath, "utf8");
  const references = html.matchAll(/(?:href|src)="([^"]+)"/g);

  for (const match of references) {
    const reference = match[1];
    const cleanReference = reference.split(/[?#]/)[0];
    if (
      !cleanReference ||
      cleanReference.startsWith("$") ||
      cleanReference.startsWith("http://") ||
      cleanReference.startsWith("https://") ||
      cleanReference.startsWith("//") ||
      cleanReference.startsWith("data:") ||
      cleanReference.startsWith("mailto:") ||
      cleanReference.startsWith("javascript:")
    ) {
      continue;
    }

    const target = path.resolve(path.dirname(pagePath), cleanReference);
    if (!fs.existsSync(target)) {
      missing.push(`${relativePage} -> ${reference}`);
    }
  }
}

assert.deepStrictEqual(missing, [], `Missing local links:\n${missing.join("\n")}`);

const landingPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
const aiGuide = fs.readFileSync(path.join(root, "docs", "ai-modes-guide.html"), "utf8");
const supportedSitesData = fs.readFileSync(path.join(root, "docs", "js", "sites.js"), "utf8");

assert(landingPage.includes('href="./docs/ai-modes-guide.html"'), "Landing page should link to the complete AI guide");
assert(aiGuide.includes('id="browser-companion"'), "AI guide should include the ChatGPT browser companion setup");
assert(aiGuide.includes('id="voice-cohost"'), "AI guide should include the voice cohost setup");
assert(!supportedSitesData.includes('title: "Claude.ai"'), "Claude should not be advertised as a capture source");

console.log("AI docs links passed.");
