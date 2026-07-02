const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..');
const chromeCandidates = [
    chromium.executablePath(),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findBrowser() {
    for (const candidate of chromeCandidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error('No Chrome or Edge executable found for smoke test.');
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
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-local-browser-model-'));
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
            throw new Error('Could not determine unpacked extension id for smoke test.');
        }
        const page = await context.newPage();
        const consoleMessages = [];
        const pageErrors = [];

        page.on('console', (message) => {
            consoleMessages.push({
                type: message.type(),
                text: message.text()
            });
        });
        page.on('pageerror', (error) => {
            pageErrors.push(error && error.message ? error.message : String(error));
        });

        await page.goto(`chrome-extension://${extensionId}/tests/local-browser-model-smoke.html`, {
            waitUntil: 'load',
            timeout: 120000
        });

        await page.waitForFunction(() => {
            return window.__SSN_LOCAL_BROWSER_MODEL_SMOKE__ && window.__SSN_LOCAL_BROWSER_MODEL_SMOKE__.done;
        }, { timeout: 900000 });

        const result = await page.evaluate(() => window.__SSN_LOCAL_BROWSER_MODEL_SMOKE__);
        console.log(JSON.stringify({
            result,
            consoleMessages,
            pageErrors
        }, null, 2));

        if (!result || !result.success) {
            throw new Error(result && result.error ? result.error : 'Smoke test failed.');
        }
    } finally {
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

run().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
