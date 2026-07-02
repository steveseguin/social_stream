const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..');
const chromeCandidates = [
    chromium.executablePath(),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

const TEST_CASES = [
    {
        id: 'same-user-fuck',
        expectedFinal: false,
        sequence: [
            { user: 'Lucy', text: 'F' },
            { user: 'Lucy', text: 'U' },
            { user: 'Lucy', text: 'C' },
            { user: 'Lucy', text: 'K' }
        ]
    },
    {
        id: 'cross-user-fuck',
        expectedFinal: false,
        sequence: [
            { user: 'A', text: 'F' },
            { user: 'B', text: 'U' },
            { user: 'C', text: 'C' },
            { user: 'D', text: 'K' }
        ]
    },
    {
        id: 'same-user-threat',
        expectedFinal: false,
        sequence: [
            { user: 'Max', text: 'go' },
            { user: 'Max', text: 'kill' },
            { user: 'Max', text: 'yourself' }
        ]
    },
    {
        id: 'same-user-insult',
        expectedFinal: false,
        sequence: [
            { user: 'Ben', text: 'you' },
            { user: 'Ben', text: 'are' },
            { user: 'Ben', text: 'an' },
            { user: 'Ben', text: 'idiot' }
        ]
    },
    {
        id: 'same-user-nice',
        expectedFinal: true,
        sequence: [
            { user: 'Lucy', text: 'N' },
            { user: 'Lucy', text: 'I' },
            { user: 'Lucy', text: 'C' },
            { user: 'Lucy', text: 'E' }
        ]
    },
    {
        id: 'mixed-room-harmless',
        expectedFinal: true,
        sequence: [
            { user: 'A', text: 'hi' },
            { user: 'B', text: 'gg' },
            { user: 'C', text: 'lol' },
            { user: 'D', text: 'nice' }
        ]
    }
];

function findBrowser() {
    for (const candidate of chromeCandidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error('No Chrome or Edge executable found for localqwen censor flow test.');
}

function normalizePathForCompare(value) {
    return String(value || '')
        .replace(/\//g, '\\')
        .replace(/\\+$/, '')
        .toLowerCase();
}

function findExtensionIdInProfile(userDataDir) {
    const preferencesPath = path.join(userDataDir, 'Default', 'Preferences');
    if (!fs.existsSync(preferencesPath)) {
        return '';
    }
    const preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    const settings = preferences?.extensions?.settings || {};
    const expectedPath = normalizePathForCompare(repoRoot);

    for (const [extensionId, entry] of Object.entries(settings)) {
        if (normalizePathForCompare(entry && entry.path) === expectedPath) {
            return extensionId;
        }
    }

    return '';
}

async function waitForExtensionId(context) {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
        try {
            serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
        } catch (_error) {
            return '';
        }
    }
    return new URL(serviceWorker.url()).host;
}

async function run() {
    const executablePath = findBrowser();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-localqwen-censor-flow-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        executablePath,
        headless: false,
        args: [
            `--disable-extensions-except=${repoRoot}`,
            `--load-extension=${repoRoot}`
        ]
    });

    try {
        let extensionId = await waitForExtensionId(context);
        if (!extensionId) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            extensionId = findExtensionIdInProfile(userDataDir);
        }
        if (!extensionId) {
            throw new Error('Could not determine unpacked extension id for localqwen censor flow test.');
        }

        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/background.html`, {
            waitUntil: 'load',
            timeout: 120000
        });

        await page.waitForFunction(() => {
            return typeof censorMessageWithLLM === 'function' && typeof ChatContextManager === 'object';
        }, null, { timeout: 120000 });

        const result = await page.evaluate(async (cases) => {
            const outputs = [];
            settings.aiProvider = { optionsetting: 'localqwen' };
            settings.localqwenmodel = { textsetting: 'qwen3.5-0.8b-onnx' };
            settings.localgemmahost = { textsetting: 'https://largefiles.socialstream.ninja/' };
            settings.ollamaCensorBotBlockMode = true;

            for (const testCase of cases) {
                if (typeof disposeLocalBrowserLLMClient === 'function') {
                    try {
                        await disposeLocalBrowserLLMClient();
                    } catch (_error) {}
                }
                if (typeof resetCensorContextMessages === 'function') {
                    resetCensorContextMessages();
                }
                ChatContextManager.cache.recentMessages = [];
                ChatContextManager.messageCount = 0;
                ChatContextManager.summary = null;
                ChatContextManager.summaryTime = 0;

                const steps = [];
                for (let index = 0; index < testCase.sequence.length; index += 1) {
                    const entry = testCase.sequence[index];
                    const passed = await censorMessageWithLLM({
                        chatname: entry.user,
                        userid: entry.user,
                        type: 'youtube',
                        textonly: true,
                        chatmessage: entry.text
                    });
                    steps.push({
                        user: entry.user,
                        text: entry.text,
                        passed
                    });
                }
                outputs.push({
                    id: testCase.id,
                    steps,
                    finalPassed: steps[steps.length - 1].passed
                });
            }

            if (typeof disposeLocalBrowserLLMClient === 'function') {
                try {
                    await disposeLocalBrowserLLMClient();
                } catch (_error) {}
            }

            return outputs;
        }, TEST_CASES);

        for (const testCase of TEST_CASES) {
            const matching = result.find((entry) => entry.id === testCase.id);
            assert(matching, `Missing result for ${testCase.id}`);
            assert.strictEqual(
                matching.finalPassed,
                testCase.expectedFinal,
                `${testCase.id} final moderation mismatch: ${JSON.stringify(matching)}`
            );
        }

        console.log(JSON.stringify(result, null, 2));
    } finally {
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

run().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
