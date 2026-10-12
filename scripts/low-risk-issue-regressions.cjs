const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Facebook Watch URLs normalize to their numeric video ID", () => {
  const source = read("sources/websocket/facebook.js");
  const start = source.indexOf("function normalizeVideoId");
  const end = source.indexOf("function normalizePageId", start);
  const context = { URL };
  vm.runInNewContext(source.slice(start, end), context);

  assert.strictEqual(context.normalizeVideoId("https://www.facebook.com/watch/?v=123456"), "123456");
  assert.strictEqual(context.normalizeVideoId("https://facebook.com/user/videos/987654"), "987654");
  assert.strictEqual(context.normalizeVideoId("24680"), "24680");
});

test("unknown source colors use a deterministic fallback without throwing", () => {
  const context = {};
  vm.runInNewContext(read("libs/colours.js") + "\nresult = getColorFromType('custom-source');", context);
  assert.match(context.result, /^#[0-9a-f]{6}$/i);
});

test("plain-text overlay sinks retain the event contract", () => {
  const featuredFiles = [
    "featured-3d.html",
    "featured-animated.html",
    "featured-cyberpunk.html",
    "featured-dynamic.html",
    "featured-elegant.html",
    "featured-gaming.html",
    "featured-glass.html",
    "featured-gradient.html",
    "featured-modern.html",
    "featured-neon.html",
    "featured-particles.html",
    "featured-retro.html",
    "featured-slide.html"
  ];

  for (const file of featuredFiles) {
    const source = read(path.join("themes", "featured-styles", file));
    assert.ok(source.includes("content.textonly === true"), file);
    assert.ok(source.includes("text.textContent = content.chatmessage"), file);
    assert.ok(!source.includes("innerHTML = content.chatname"), file);
  }

  assert.ok(read("events.html").includes("data.textonly === true"));
  assert.ok(read("sampleemote.html").includes("tmp.textContent = data.chatmessage"));
  assert.ok(read("themes/deuks_overlay/overlay1.html").includes("data.textonly ? escapeHtml"));
  assert.ok(read("themes/huan-kiara/index.html").includes("data.textonly ? escapeHtml"));
});

test("media conversion failures preserve Discord and WhatsApp messages", () => {
  for (const file of ["sources/discord.js", "sources/whatsapp.js"]) {
    const source = read(file);
    assert.ok(source.includes("xhr.onerror"), file);
    assert.ok(source.includes("xhr.onabort"), file);
    assert.ok(source.includes("reader.onerror"), file);
    assert.ok(source.includes("finish(url)"), file);

    const start = source.indexOf("function toDataURL");
    const end = source.indexOf("function escapeHtml", start);
    let callbackValues = [];
    class FailingRequest {
      open() {}
      send() { this.onerror(); }
    }
    const context = {
      XMLHttpRequest: FailingRequest,
      FileReader: class {},
      callbackValues
    };
    vm.runInNewContext(source.slice(start, end) + "\ntoDataURL('https://invalid.example/avatar.png', value => callbackValues.push(value));", context);
    assert.deepStrictEqual(callbackValues, ["https://invalid.example/avatar.png"], file);
  }
});

test("observer and container fixes preserve all incoming records", () => {
  const tellonym = read("sources/tellonym.js");
  assert.ok(tellonym.includes("mutationIndex < mutations.length"));
  assert.ok(!tellonym.includes("mutations[0].addedNodes"));

  const cime = read("sources/cime.js");
  assert.ok(!cime.includes("startupSuppressUntil"));
  assert.ok(cime.includes("markExistingMessagesProcessed(chatList)"));

  const flextv = read("sources/flextv.js");
  assert.ok(flextv.indexOf('document.querySelector(".chat-list, .chat-content")') < flextv.indexOf("document.querySelector(CHAT_ITEM_SELECTOR)"));

  const xSource = read("sources/x.js");
  assert.ok(xSource.includes("disconnectedContainer.marked = false"));
  assert.ok(xSource.includes("observer = null"));
});

test("WebSocket wrappers and callbacks retain native/current ownership", () => {
  const whatnot = read("sources/inject/whatnot-ws.js");
  assert.ok(whatnot.includes("window.WebSocket.prototype = OriginalWS.prototype"));
  for (const constant of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    assert.ok(whatnot.includes(`window.WebSocket.${constant} = OriginalWS.${constant}`));
  }

  class FakeWebSocket {
    constructor(url) { this.url = url; }
    addEventListener() {}
    removeEventListener() {}
  }
  FakeWebSocket.CONNECTING = 0;
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSING = 2;
  FakeWebSocket.CLOSED = 3;
  FakeWebSocket.prototype.send = function () {};
  const context = {
    window: { WebSocket: FakeWebSocket, postMessage() {} },
    console: { log() {}, error() {} },
    URL
  };
  vm.runInNewContext(whatnot, context);
  const intercepted = new context.window.WebSocket("wss://example.com/socket");
  assert.ok(intercepted instanceof context.window.WebSocket);
  assert.strictEqual(context.window.WebSocket.OPEN, FakeWebSocket.OPEN);

  const joystick = read("sources/websocket/joystick.js");
  assert.ok((joystick.match(/if\(st\.socket!==s\)return/g) || []).length >= 4);
});

test("message payload fixes retain canonical primitive fields", () => {
  const chaturbate = read("sources/chaturbate.js");
  assert.ok(chaturbate.includes('event: event ? "notice" : ""'));
  assert.ok(chaturbate.includes("private: !!private"));

  const phraseGuess = read("games/phraseguess.html");
  assert.ok(phraseGuess.indexOf("data = data.content") < phraseGuess.indexOf("if (data.chatmessage && data.chatname)"));

  const youtube = read("sources/websocket/youtube.html");
  assert.ok(youtube.includes("const viewCount = Number.parseInt(stats.viewCount, 10)"));
  assert.ok(youtube.includes("event: 'view_update', meta: viewCount"));

  const huan = read("themes/huan-kiara/index.html");
  assert.ok(huan.includes('typeof badge === "string"'));
});

test("auth state and token access level cannot fall back to stale values", () => {
  const youtubeAuth = read("sources/websocket/youtube_auth.js");
  assert.ok(youtubeAuth.includes('tokenAccessLevel: "youtubeOAuthTokenAccessLevel"'));
  assert.ok(youtubeAuth.includes("localStorage.removeItem(STORAGE_KEYS.tokenAccessLevel)"));
  assert.ok(youtubeAuth.includes("localStorage.setItem(STORAGE_KEYS.tokenAccessLevel, accessLevel)"));

  class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }
  const localStorage = new MemoryStorage();
  const authContext = {
    window: { dispatchEvent() {} },
    document: { readyState: "loading", addEventListener() {}, getElementById() { return null; } },
    localStorage,
    sessionStorage: new MemoryStorage(),
    location: { search: "", origin: "https://socialstream.ninja", pathname: "/sources/websocket/youtube_auth.html" },
    URLSearchParams,
    URL,
    Math,
    Date,
    console
  };
  vm.runInNewContext(youtubeAuth, authContext);
  authContext.window.SSYouTubeAuthStore.seed({ accessToken: "token", accessLevel: "admin" });
  assert.strictEqual(localStorage.getItem("youtubeOAuthTokenAccessLevel"), "admin");
  authContext.window.SSYouTubeAuthStore.clear();
  assert.strictEqual(localStorage.getItem("youtubeOAuthTokenAccessLevel"), null);

  const spotifyHandler = read("electron-spotify-handler.js");
  assert.ok(spotifyHandler.includes("!state || !returnedState || returnedState !== state"));
  assert.ok(read("spotify.js").includes("result.code,\n\t                    result.state,"));
});

test("successful spend commands record their configured cooldown", () => {
  const source = read("pointsactions.js");
  const spendBranch = source.slice(source.indexOf("if (commandName === '!spend')"), source.indexOf("// Process standard commands"));
  assert.ok(spendBranch.includes("await this.handleSpendCommand"));
  assert.ok(spendBranch.includes("if (result && result.success)"));
  assert.ok(spendBranch.includes("this.setCooldown(message.chatname, message.type, commandName, command.cooldown)"));
});

test("Neutron non-zero lengths use explicit units", () => {
  for (const file of ["themes/Neutron/chatOnly.css", "themes/Neutron/stream.css"]) {
    const source = read(file);
    assert.doesNotMatch(source, /(?:top|left|width|height):\s*[1-9]\d*\s*;/, file);
  }
});

test("disabled ChatGPT capture is excluded from relay targets", () => {
  const source = read("background.js");
  const block = source.slice(source.indexOf("if (!settings.openai)"), source.indexOf("if (!settings.chime)"));
  assert.ok(block.includes('sitename.startsWith("https://chat.openai.com/")'));
  assert.ok(block.includes('sitename.startsWith("https://chatgpt.com/")'));
});

test("Crowdcast and Floatplane ignore non-message mutation nodes", () => {
  assert.ok(read("sources/crowdcast.js").includes("!ele || ele.nodeType !== 1"));
  const floatplane = read("sources/floatplane.js");
  assert.ok(floatplane.includes("!ele || ele.nodeType !== 1 || !ele.querySelector"));
  assert.ok(floatplane.includes("if (!name || !msg)"));
});
