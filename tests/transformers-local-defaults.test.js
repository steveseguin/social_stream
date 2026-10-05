const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const coreBundle = fs.readFileSync(path.join(repoRoot, "thirdparty", "transformersjs", "transformers.min.js"), "utf8");
const webBundle = fs.readFileSync(path.join(repoRoot, "thirdparty", "transformersjs", "transformers.web.min.js"), "utf8");

for (const bundle of [coreBundle, webBundle]) {
	assert.ok(bundle.includes('remoteHost:"https://largefiles.socialstream.ninja/"'));
	assert.ok(!bundle.includes('remoteHost:"https://huggingface.co/"'));
	assert.ok(bundle.includes('["largefiles.socialstream.ninja"]'));
	assert.ok(!bundle.includes('["huggingface.co","hf.co"]'));
}

console.log("PASS transformers local defaults");
