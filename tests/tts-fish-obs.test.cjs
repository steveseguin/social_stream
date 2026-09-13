// Optional live test: FISH_API_KEY stays in the bridge process, never in the page or OBS profile.
// Uses an isolated portable OBS copy and synthetic text; no existing scenes or channels.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const WebSocket = require(path.join(process.env.SSAPP_REPO || path.resolve(root, "../ssapp"), "node_modules/ws"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

(async () => {
  assert(process.env.FISH_API_KEY, "Set FISH_API_KEY to run the live OBS test");
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-fish-obs-"));
  const bridgePort = await freePort();
  const bridgeToken = require("node:crypto").randomBytes(32).toString("hex");
  const debugPort = await freePort();
  const bridge = spawn(process.execPath, ["scripts/local-tts-bridge.cjs", "--mode", "fish", "--port", String(bridgePort)], {
    cwd: root, windowsHide: true, stdio: "ignore",
    env: { ...process.env, SSN_TTS_TARGET: "https://api.fish.audio/v1/tts", SSN_TTS_TARGET_BEARER: process.env.FISH_API_KEY, SSN_TTS_BRIDGE_TOKEN: bridgeToken }
  });
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/tts.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/tts.js" ? fs.readFileSync(path.join(root, "tts.js")) : '<!doctype html><title>Fish OBS test</title><button id="tts">TTS</button><script src="/tts.js"></script>');
  });
  let obs, socket;
  try {
    const pagePort = await listen(server);
    const url = `http://127.0.0.1:${pagePort}/fish-test`;
    const obsRoot = path.join(output, "obs");
    fs.cpSync(process.env.OBS_INSTALL_DIR || "C:/Program Files/obs-studio", obsRoot, { recursive: true });
    const config = path.join(obsRoot, "config/obs-studio");
    fs.mkdirSync(path.join(config, "basic/profiles/Fish_QA"), { recursive: true });
    fs.mkdirSync(path.join(config, "basic/scenes"), { recursive: true });
    const ini = "[General]\nFirstRun=false\nEnableAutoUpdates=false\n[Basic]\nProfile=Fish_QA\nProfileDir=Fish_QA\nSceneCollection=Fish_QA\nSceneCollectionFile=Fish_QA\n";
    fs.writeFileSync(path.join(config, "global.ini"), ini);
    fs.writeFileSync(path.join(config, "user.ini"), ini);
    fs.writeFileSync(path.join(config, "basic/profiles/Fish_QA/basic.ini"), "[General]\nName=Fish_QA\n[Video]\nBaseCX=640\nBaseCY=360\nOutputCX=640\nOutputCY=360\nFPSType=0\nFPSCommon=30\n");
    fs.writeFileSync(path.join(config, "basic/scenes/Fish_QA.json"), JSON.stringify({
      name: "Fish_QA", current_scene: "Fish QA", current_program_scene: "Fish QA", scene_order: [{ name: "Fish QA" }],
      sources: [
        { name: "Fish speech", id: "browser_source", settings: { url, width: 640, height: 360, shutdown: false, reroute_audio: true } },
        { name: "Fish QA", id: "scene", settings: { items: [{ id: 1, name: "Fish speech", visible: true, pos: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }] } }
      ]
    }));
    const obsEnv = { ...process.env };
    delete obsEnv.FISH_API_KEY;
    obs = spawn(path.join(obsRoot, "bin/64bit/obs64.exe"), ["--portable", "--multi", "--minimize-to-tray", "--disable-updater", "--remote-debugging-port=" + debugPort, "--remote-allow-origins=http://127.0.0.1:" + debugPort], { cwd: path.join(obsRoot, "bin/64bit"), windowsHide: true, stdio: "ignore", env: obsEnv });
    let target;
    for (let i = 0; i < 60; i++) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        target = targets.find(page => page.url === url);
        if (target) break;
      } catch (_) {}
      await delay(500);
    }
    assert(target, "OBS Browser Source loaded");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    const expression = `(async () => {
      for (let i=0;i<100 && typeof TTS === 'undefined';i++) await new Promise(r=>setTimeout(r,100));
      TTS.configure(new URLSearchParams('speech=en-US&ttsprovider=fish&volume=0.2&fishkey=${bridgeToken}&fishendpoint=' + encodeURIComponent('http://127.0.0.1:${bridgePort}/v1/audio/speech')));
      let ended = 0;
      TTS.audio.addEventListener('ended', () => ended++);
      await TTS.fishTTS('Fish Audio relay test in OBS.');
      return { provider:TTS.TTSProvider, keyPresent:!!TTS.FishAPIKey, duration:TTS.audio.duration, ended, queueActive:TTS.premiumQueueActive };
    })()`;
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("OBS audio test timed out")), 45000);
      socket.on("message", raw => {
        const data = JSON.parse(raw);
        if (data.id !== 1) return;
        clearTimeout(timer);
        if (data.error || data.result.exceptionDetails) reject(new Error("OBS evaluation failed"));
        else resolve(data.result.result.value);
      });
      socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    assert.equal(result.provider, "fish");
    assert.equal(result.keyPresent, true); // The page holds only the local bridge token.
    assert(result.duration > 0);
    assert.equal(result.ended, 1);
    assert.equal(result.queueActive, false);
    console.log("PASS live Fish audio through existing bridge in actual OBS", JSON.stringify(result));
  } finally {
    if (socket) socket.close();
    if (obs) obs.kill();
    bridge.kill();
    server.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
