const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
const start = source.indexOf("async function trySendTargetP2P");
const end = source.indexOf("function broadcastLeaderboardReset", start);
assert.ok(start >= 0 && end > start, "P2P delivery implementation must be extractable");
const implementation = source.slice(start, end);

function createHarness({ bridge = null, iframe = null, peers = {} } = {}) {
    const sandbox = vm.createContext({
        ninjaBridge: bridge,
        iframe,
        connectedPeers: peers,
        console: { warn() {} },
        Date,
        Number,
        Promise,
        Object,
        setTimeout,
    });
    vm.runInContext(implementation + "\nthis.sendTargetP2P = sendTargetP2P;", sandbox);
    return sandbox;
}

async function run() {
    let attempts = 0;
    const retrying = createHarness({
        bridge: {
            isReady: () => true,
            sendToLabel: async () => {
                attempts++;
                return attempts >= 3;
            },
        },
    });
    const delivered = await retrying.sendTargetP2P({ action: "play" }, "actions", {
        timeoutMs: 100,
        intervalMs: 5,
    });
    assert.equal(delivered, true, "actions delivery should recover when its peer connects late");
    assert.equal(attempts, 3, "failed actions sends should retry without duplicating a successful send");

    let posts = 0;
    const legacy = createHarness({
        iframe: {
            contentWindow: {
                postMessage: () => {
                    posts++;
                },
            },
        },
        peers: { peer1: "actions", peer2: "dock" },
    });
    assert.equal(await legacy.sendTargetP2P({ action: "play" }, "actions"), true);
    assert.equal(posts, 1, "legacy delivery should target only matching peers");

    const noRetry = createHarness();
    const startedAt = Date.now();
    assert.equal(await noRetry.sendTargetP2P({}, "dock"), false);
    assert.ok(Date.now() - startedAt < 100, "non-actions targets should retain fire-once behavior");

    console.log("PASS targeted P2P retry");
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
