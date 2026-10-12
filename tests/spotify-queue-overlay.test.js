const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SpotifyIntegration = require("../spotify.js");

const repoRoot = path.resolve(__dirname, "..");
const overlayHtml = fs.readFileSync(path.join(repoRoot, "spotify-overlay.html"), "utf8");
const overlayScript = Array.from(overlayHtml.matchAll(/<script\s*>([\s\S]*?)<\/script>/gi))[0][1];

class MockClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class MockElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = { setProperty: (key, value) => { this.style[key] = value; } };
    this.classList = new MockClassList();
    this.attributes = {};
    this.hidden = false;
    this.textContent = "";
    this.className = "";
    this.contentWindow = tag === "iframe" ? {} : undefined;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }

  getAttribute(key) {
    return this.attributes[key] || null;
  }

  querySelectorAll(selector) {
    const className = selector.charAt(0) === "." ? selector.slice(1) : "";
    const found = [];
    function visit(node) {
      node.children.forEach(child => {
        if (child.className.split(/\s+/).includes(className)) found.push(child);
        visit(child);
      });
    }
    visit(this);
    return found;
  }

  set textContent(value) {
    this._textContent = String(value);
    if (value === "") this.children = [];
  }

  get textContent() {
    return this._textContent;
  }
}

class FixedDate extends Date {
  static now() {
    return 1000000;
  }
}

function runOverlay(search) {
  const ids = [
    "overlay", "title", "artist", "album", "status", "errorMessage", "device",
    "art", "progressRow", "currentTime", "totalTime", "bar", "tickerLine",
    "tickerTrack", "queueList", "ariaStatus", "artWrap"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new MockElement()]));
  elements.queueList.hidden = true;
  elements.tickerLine.hidden = true;
  const body = new MockElement("body");
  const listeners = {};
  let iframe;
  const document = {
    body,
    getElementById: id => elements[id],
    createElement: tag => {
      const element = new MockElement(tag);
      if (tag === "iframe") iframe = element;
      return element;
    }
  };
  const window = {
    addEventListener: (type, handler) => {
      listeners[type] = handler;
    }
  };
  const context = {
    URLSearchParams,
    location: { search },
    document,
    window,
    Date: FixedDate,
    console,
    setInterval: () => 1,
    setTimeout: () => 1,
    WebSocket: function WebSocket() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(repoRoot, 'shared/overlay-control-transport.js'), 'utf8'), context);
  context.SSNOverlayControl = window.SSNOverlayControl;
  vm.runInContext(overlayScript, context);
  return { body, elements, iframe, listeners };
}

const samplePayload = {
  spotify: {
    track: {
      name: "River",
      artist: "Eminem",
      album: "Revival",
      imageUrl: "river.jpg",
      duration: 221000
    },
    status: "playing",
    isPlaying: true,
    progressMs: 66000,
    durationMs: 221000,
    receivedAt: 1000000,
    queue: [
      { name: "Hello", artist: "Pop Smoke", imageUrl: "hello.jpg", duration: 190000, requesterName: "Gingy" },
      { name: "Bye Bye Bye", artist: "Younotus", imageUrl: "bye.jpg", duration: 175000, requesterName: "ViewerTwo" },
      { name: "A Much Longer Song Title That Must Truncate Cleanly", artist: "A Long Artist Name", imageUrl: "", duration: 245000, requesterName: "AnotherViewer" }
    ]
  }
};

function sendPayload(overlay, payload) {
  overlay.listeners.message({
    source: overlay.iframe.contentWindow,
    data: { dataReceived: { overlayNinja: payload } }
  });
}

function sendSample(overlay) {
  sendPayload(overlay, samplePayload);
}

async function testManagedQueuePayload() {
  const integration = new SpotifyIntegration();
  integration.accessToken = "token";
  integration.managedQueueEnabled = true;
  global.fetch = async url => {
    if (url.includes("/search?")) {
      return {
        status: 200,
        json: async () => ({
          tracks: {
            items: [{
              uri: "spotify:track:hello",
              name: "Hello",
              artists: [{ name: "Pop Smoke" }],
              album: { name: "Album", images: [{ url: "cover.jpg" }] },
              duration_ms: 190000
            }]
          }
        })
      };
    }
    if (url.includes("/player/queue?uri=")) return { status: 204, ok: true };
    throw new Error(`Unexpected Spotify URL: ${url}`);
  };

  const result = await integration.addToManagedQueue("hello", {
    requesterName: "Gingy",
    requesterKey: "discord:gingy"
  });
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(integration.getOverlayQueue(), [{
    id: result.entry.id,
    name: "Hello",
    artist: "Pop Smoke",
    album: "Album",
    imageUrl: "cover.jpg",
    duration: 190000,
    requesterName: "Gingy",
    status: "queued"
  }]);
}

async function main() {
  assert.ok(overlayHtml.includes('data-offset-ms'), "queue start offsets must be rendered");
  assert.ok(overlayHtml.includes("text-overflow: ellipsis"), "long queue titles must truncate");
  assert.ok(overlayHtml.includes("grid-column: 1 / -1"), "queue rows must span the overlay width");

  const enabled = runOverlay("?session=test&showqueue");
  sendSample(enabled);
  const rows = enabled.elements.queueList.children;
  assert.strictEqual(enabled.body.classList.contains("show-queue"), true);
  assert.strictEqual(enabled.elements.queueList.hidden, false);
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[0].children[1].children[0].textContent, "Hello - Pop Smoke");
  assert.strictEqual(rows[0].children[1].children[1].textContent, "Requested by Gingy");
  assert.strictEqual(rows[0].children[2].textContent, "Starts in 2:35");
  assert.strictEqual(rows[1].children[2].textContent, "Starts in 5:45");

  sendPayload(enabled, {
    spotify: {
      status: "error",
      message: "Playback status is temporarily unavailable."
    }
  });
  assert.strictEqual(enabled.elements.queueList.children.length, 3, "partial playback updates must preserve the managed queue");
  assert.strictEqual(enabled.elements.queueList.hidden, false);

  sendPayload(enabled, { spotify: { status: "idle", queue: [] } });
  assert.strictEqual(enabled.elements.queueList.children.length, 0, "an explicit empty queue must clear the overlay queue");
  assert.strictEqual(enabled.elements.queueList.hidden, true);

  const disabled = runOverlay("?session=test");
  sendSample(disabled);
  assert.strictEqual(disabled.elements.queueList.hidden, true);
  assert.strictEqual(disabled.elements.queueList.children.length, 0);

  await testManagedQueuePayload();
  console.log("Spotify queue overlay tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
