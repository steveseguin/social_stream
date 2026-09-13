"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

(async () => {
  const requests = [];
  const audio = Buffer.from([0x49, 0x44, 0x33, 0, 1, 2, 255]);
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    const failed = body.includes("reject me");
    res.writeHead(failed ? 402 : 200, { "Content-Type": failed ? "application/json" : "audio/mpeg" });
    res.end(failed ? JSON.stringify({ message: "No credit" }) : audio);
  });
  const upstreamPort = await listen(upstream);
  try {
    for (const scenario of ["fish", "fish-generated", "openai", "f5", "gptsovits"]) {
      const mode = scenario === "fish-generated" ? "fish" : scenario;
      let localToken = scenario === "fish-generated" ? "" : "local-fixture-token";
      const portServer = http.createServer();
      const port = await listen(portServer);
      await new Promise(resolve => portServer.close(resolve));
      const child = spawn(process.execPath, ["scripts/local-tts-bridge.cjs", "--mode", mode, "--port", String(port), "--target", `http://127.0.0.1:${upstreamPort}/synthesize`], {
        cwd: root, windowsHide: true,
        env: { ...process.env, SSN_TTS_TARGET_BEARER: "bridge-fixture", SSN_TTS_BRIDGE_TOKEN: localToken, SSN_TTS_FORWARD_AUTH: "0", SSN_TTS_REF_AUDIO_PATH: "fixture.wav" },
        stdio: ["ignore", "pipe", "pipe"]
      });
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Bridge startup timed out")), 5000);
          let output = "";
          child.stdout.on("data", data => {
            output += data;
            const token = output.match(/Local bridge token \(Fish Audio API Key field\): ([^\r\n]+)/);
            if (mode === "fish" && !token) return;
            if (token) localToken = token[1];
            clearTimeout(timer); resolve();
          });
          child.once("error", reject);
        });
        const url = `http://127.0.0.1:${port}/v1/audio/speech`;
        if (scenario === "fish-generated") assert.match(localToken, /^[a-f0-9]{64}$/);
        const preflight = await fetch(url, { method: "OPTIONS", headers: { Origin: "http://localhost:9000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
        const input = { input: "Hello", model: "s2.1-pro-free", voice: "voice-fixture", response_format: "mp3", speed: 1.3 };
        const headers = { "Content-Type": "application/json" };
        if (mode === "fish") {
          const before = requests.length;
          for (const endpoint of ["/v1/audio/speech", "/tts"]) {
            for (const authorization of ["", "Bearer wrong-token", "Bearer bridge-fixture"]) {
              const denied = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method: "POST",
                headers: { ...headers, Origin: "https://untrusted.example", Authorization: authorization }, body: JSON.stringify(input) });
              assert.equal(denied.status, 401);
              assert(!JSON.stringify(await denied.json()).includes(localToken));
            }
          }
          assert.equal(requests.length, before, "unauthorized requests must never reach the upstream");
          const health = await (await fetch(`http://127.0.0.1:${port}/health`)).text();
          assert(!health.includes(localToken));
          headers.Authorization = "Bearer " + localToken;
        }
        const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(input) });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "audio/mpeg");
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), audio);
        const request = requests[requests.length - 1];
        assert.equal(request.headers.authorization, "Bearer bridge-fixture");
        if (mode === "fish") {
          assert.equal(request.headers.model, "s2.1-pro-free");
          assert.deepEqual(JSON.parse(request.body), { text: "Hello", reference_id: "voice-fixture", format: "mp3", prosody: { speed: 1.3 } });
          const send = body => fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
          await send({ input: "Default voice" });
          assert.equal(requests[requests.length - 1].headers.model, "s2.1-pro-free");
          assert.equal(JSON.parse(requests[requests.length - 1].body).reference_id, undefined);
          const before = requests.length;
          assert.equal((await send({ input: "Hello", model: "typo" })).status, 400);
          assert.equal(requests.length, before);
          const error = await send({ input: "reject me" });
          assert.equal(error.status, 402);
          assert.equal(error.headers.get("access-control-allow-origin"), "*");
          assert.deepEqual(await error.json(), { message: "No credit" });
        } else {
          assert.equal(request.headers.model, undefined, "Fish model header must not leak to other modes");
          if (mode === "openai") assert.deepEqual(JSON.parse(request.body), input);
          if (mode === "f5") assert.equal(request.method, "GET");
          if (mode === "gptsovits") assert.equal(JSON.parse(request.body).ref_audio_path, "fixture.wav");
        }
        console.log("PASS bridge", scenario);
      } finally {
        child.kill();
        if (child.exitCode === null) await new Promise(resolve => child.once("exit", resolve));
      }
    }
  } finally { upstream.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
