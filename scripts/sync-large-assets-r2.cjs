const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const args = new Set(process.argv.slice(2));

function readArg(name, fallback) {
	const prefix = name + "=";
	const value = process.argv.slice(2).find(arg => arg.startsWith(prefix));
	return value ? value.slice(prefix.length) : fallback;
}

const thresholdMb = Number(readArg("--threshold-mb", process.env.SSN_R2_THRESHOLD_MB || 25));
const thresholdBytes = thresholdMb * 1024 * 1024;
const bucketName = readArg("--bucket", process.env.SSN_R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || process.env.KOKORO_R2_BUCKET || "ssnlargefiles");
const publicHost = normalizeHost(readArg("--host", process.env.SSN_LARGE_ASSET_HOST || "https://largefiles.socialstream.ninja/"));
const shouldUpload = args.has("--upload");
const shouldVerify = args.has("--verify") || shouldUpload;
const shouldSkipExisting = !args.has("--no-skip-existing");

const skippedDirs = new Set([".git", ".claude", "node_modules", ".npm-cache", "tmp", "tests/artifacts", "electron_app_reference", "social_stream_v3"]);

function normalizeHost(value) {
	const host = String(value || "").trim();
	if (!host) return "";
	return host.endsWith("/") ? host : host + "/";
}

function toSlash(value) {
	return value.replace(/\\/g, "/");
}

function getObjectKey(relativePath) {
	const rel = toSlash(relativePath);
	if (rel.startsWith("thirdparty/models/")) {
		return rel.slice("thirdparty/models/".length);
	}
	if (rel.startsWith("thirdparty/piper/")) {
		return "piper/" + rel.slice("thirdparty/piper/".length);
	}
	return rel;
}

function getTrackedFiles() {
	const result = spawnSync("git", ["ls-files", "-z"], {
		cwd: repoRoot,
		encoding: "utf8",
		shell: isWindows
	});
	if (result.status !== 0) return new Set();
	return new Set(result.stdout.split("\0").filter(Boolean).map(toSlash));
}

function walk(dir, files) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		const relativePath = toSlash(path.relative(repoRoot, fullPath));
		if (entry.isDirectory()) {
			if (skippedDirs.has(relativePath) || skippedDirs.has(entry.name)) continue;
			walk(fullPath, files);
			continue;
		}
		if (!entry.isFile()) continue;
		const stat = fs.statSync(fullPath);
		if (stat.size >= thresholdBytes) {
			files.push({
				path: relativePath,
				fullPath,
				bytes: stat.size,
				mb: stat.size / 1024 / 1024,
				objectKey: getObjectKey(relativePath)
			});
		}
	}
}

function formatMb(value) {
	return value.toFixed(2) + " MB";
}

async function remoteHead(asset) {
	if (!publicHost) return { ok: false, status: "no-host" };
	const response = await fetch(publicHost + asset.objectKey, { method: "HEAD" });
	return {
		ok: response.ok,
		status: response.status,
		length: response.headers.get("content-length") || ""
	};
}

function upload(asset) {
	const objectPath = bucketName + "/" + asset.objectKey;
	const result = spawnSync("npx", ["--yes", "wrangler", "r2", "object", "put", objectPath, "--file", asset.fullPath, "--remote"], {
		cwd: repoRoot,
		stdio: "inherit",
		shell: isWindows,
		env: process.env
	});
	if (result.status !== 0) {
		throw new Error("Upload failed for " + asset.path);
	}
}

async function main() {
	if (!Number.isFinite(thresholdMb) || thresholdMb <= 0) {
		throw new Error("--threshold-mb must be a positive number.");
	}
	if (shouldUpload && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
		throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required for --upload.");
	}

	const trackedFiles = getTrackedFiles();
	const assets = [];
	walk(repoRoot, assets);
	assets.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

	console.log("Large asset R2 plan");
	console.log("bucket:", bucketName);
	console.log("host:", publicHost || "(none)");
	console.log("threshold:", thresholdMb + " MiB");
	console.log("mode:", shouldUpload ? "upload" : shouldVerify ? "verify" : "dry-run");
	console.log("");

	if (!assets.length) {
		console.log("No matching assets found.");
		return;
	}

	for (const asset of assets) {
		asset.tracked = trackedFiles.has(asset.path);
		console.log(`${formatMb(asset.mb)}\t${asset.tracked ? "tracked" : "local"}\t${asset.path}`);
		console.log(`  -> ${asset.objectKey}`);
	}
	console.log("");

	let totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
	console.log(`count: ${assets.length}`);
	console.log(`total: ${formatMb(totalBytes / 1024 / 1024)}`);

	if (!shouldVerify) return;

	for (const asset of assets) {
		let head = null;
		try {
			head = await remoteHead(asset);
		} catch (error) {
			head = { ok: false, status: error.message };
		}

		if (head.ok) {
			console.log("remote-ok", asset.objectKey, head.length ? `(${head.length} bytes)` : "");
			if (shouldUpload && shouldSkipExisting) continue;
		} else {
			console.log("remote-miss", asset.objectKey, `(${head.status})`);
		}

		if (shouldUpload) {
			upload(asset);
			console.log("uploaded", asset.objectKey);
		}
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
