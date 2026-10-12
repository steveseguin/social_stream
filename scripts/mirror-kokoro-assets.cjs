const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const kokoroAssets = require(path.join(repoRoot, "shared", "ai", "kokoroAssetCatalog.js"));

const bucketName = process.env.KOKORO_R2_BUCKET || "ssnlargefiles";
const sourceHost = process.env.KOKORO_SOURCE_HOST || "https://huggingface.co/";
const verifyHost = process.env.KOKORO_VERIFY_HOST || kokoroAssets.getRemoteHost();
const destinationRoot = path.join(repoRoot, "thirdparty", "models", ...kokoroAssets.resolvePrefix.split("/").filter(Boolean));
const assetPaths = kokoroAssets.getAllAssetPaths();
const isWindows = process.platform === "win32";

function toLocalPath(relativePath) {
	return path.join(destinationRoot, ...relativePath.split("/"));
}

function toRemoteUrl(relativePath) {
	return kokoroAssets.getResolveBase(verifyHost) + relativePath;
}

function toSourceUrl(relativePath) {
	return sourceHost.replace(/\/?$/, "/") + kokoroAssets.resolvePrefix + relativePath;
}

async function downloadFile(relativePath) {
	const targetPath = toLocalPath(relativePath);
	if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
		console.log("local-skip", relativePath);
		return;
	}
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	const response = await fetch(toSourceUrl(relativePath));
	if (!response.ok || !response.body) {
		throw new Error("Download failed for " + relativePath + " (" + response.status + ")");
	}
	await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(targetPath));
	console.log("downloaded", relativePath);
}

async function remoteExists(relativePath) {
	const response = await fetch(toRemoteUrl(relativePath), { method: "HEAD" });
	return response.ok;
}

function uploadFile(relativePath) {
	const localFile = toLocalPath(relativePath);
	const objectPath = bucketName + "/" + kokoroAssets.resolvePrefix + relativePath;
	const result = spawnSync(
		"npx",
		["wrangler", "r2", "object", "put", objectPath, "--file", localFile, "--remote"],
		{
			cwd: repoRoot,
			stdio: "inherit",
			shell: isWindows,
			env: process.env
		}
	);
	if (result.status !== 0) {
		throw new Error("Upload failed for " + relativePath);
	}
}

async function main() {
	if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
		throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.");
	}

	for (const relativePath of assetPaths) {
		await downloadFile(relativePath);
	}

	for (const relativePath of assetPaths) {
		if (await remoteExists(relativePath)) {
			console.log("remote-skip", relativePath);
			continue;
		}
		uploadFile(relativePath);
		console.log("uploaded", relativePath);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
