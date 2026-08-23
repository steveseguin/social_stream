"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const platformConfigs = [
  { file: "config_0.json", platform: "Windows" },
  { file: "config_mac_0.json", platform: "macOS" },
  { file: "config_linux_0.json", platform: "Linux" },
];

for (const expected of platformConfigs) {
  const configPath = path.join(repoRoot, "settings", expected.file);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  for (const sourceName of ["kick", "twitch"]) {
    const signin = config[sourceName] && config[sourceName].signin;
    assert.ok(signin, `${expected.file} is missing ${sourceName}.signin`);
    assert.strictEqual(
      signin.preload,
      "mock",
      `${expected.file} ${sourceName} must use the compatibility mock sign-in path`
    );
    assert.match(signin.userAgent, /Chrome\/151\.0\.0\.0/, `${expected.file} ${sourceName} sign-in UA is stale`);
    assert.ok(signin.mockUserAgentData, `${expected.file} ${sourceName} sign-in client hints are missing`);
    assert.strictEqual(signin.mockUserAgentData.platform, expected.platform);
    assert.strictEqual(signin.mockUserAgentData.uaFullVersion, "151.0.7922.77");

    for (const brand of signin.mockUserAgentData.fullVersionList) {
      if (brand.brand === "Google Chrome" || brand.brand === "Chromium") {
        assert.strictEqual(brand.version, "151.0.7922.77");
      }
    }

    if (expected.platform === "macOS") {
      assert.strictEqual(
        signin.mockUserAgentData.architecture,
        undefined,
        `${sourceName} must let SSApp derive Intel vs Apple Silicon at runtime`
      );
      assert.strictEqual(signin.mockUserAgentData.bitness, undefined);
    }
  }

  assert.strictEqual(config.kick.signin.enforceSigninCSP, false);
}

console.log("Sign-in compatibility config tests passed.");
