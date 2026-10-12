'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const root = process.env.SSN_POPUP_ROOT || path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Run with local Playwright + its Chromium installation, and no other UI test
// stealing focus. SSN_POPUP_ROOT selects an isolated baseline checkout;
// SSN_POPUP_MODES=warm,cold,disabled selects cases; SSN_POPUP_TRACE_DIR saves
// native traces/screenshots. Timing is reported, not used as a machine-speed
// threshold; assertions target repeated layout and the known retry delay.

// A toolbar popup is not a tab: Chromium autosizes it while HTML is arriving.
// Playwright does not expose action popups as pages, so attach to their CDP target.
function popupProtocol(cdp, sessionId) {
    let nextId = 0;
    const pending = new Map();
    cdp.on('Target.receivedMessageFromTarget', event => {
        if (event.sessionId !== sessionId) return;
        const message = JSON.parse(event.message);
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
    });
    function send(method, params) {
        return new Promise((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error('Popup CDP timeout: ' + method)); }, 10000);
            pending.set(id, { resolve, reject, timer });
            cdp.send('Target.sendMessageToTarget', {
                sessionId, message: JSON.stringify({ id, method, params })
            }).catch(error => { clearTimeout(timer); pending.delete(id); reject(error); });
        });
    }
    const evaluate = async function (expression) {
        const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
        return response.result.value;
    };
    evaluate.send = send;
    return evaluate;
}

async function run(mode) {
    const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-popup-startup-')), {
        channel: 'chromium', headless: false,
        args: ['--load-extension=' + root, '--disable-extensions-except=' + root],
        viewport: { width: 600, height: 600 }
    });
    try {
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        let background;
        for (let attempt = 0; attempt < 150; attempt++) {
            background = context.pages().find(page => page.url().includes('/background.html'));
            if (background) break;
            await delay(100);
        }
        assert(background, 'Background opened in isolated profile');
        await background.waitForFunction(() => window.ssappBackgroundLoadState?.status === 'ready' && typeof streamID !== 'undefined' && streamID);
        await background.evaluate(async () => {
            settings.bttv = { setting: true };
            await chrome.storage.local.set({ settings });
        });
        if (mode === 'disabled') {
            await worker.evaluate(() => chrome.runtime.sendMessage({ cmd: 'setOnOffState', data: { value: false } }));
        }
        if (mode !== 'warm') {
            await worker.evaluate(async () => {
                // Keep this a recent-close test even on a slow CI host.
                lastBackgroundPageCreated = Date.now();
                for (const tab of await chrome.tabs.query({})) {
                    if (isBackgroundPageUrl(tab.url)) await chrome.tabs.remove(tab.id);
                }
            });
        }
        const host = context.pages().find(page => page.url() === 'about:blank');
        assert(host);
        await host.bringToFront();
        await worker.evaluate(async () => {
            const window = (await chrome.windows.getAll()).find(window => window.type === 'normal');
            await chrome.windows.update(window.id, { focused: true });
        });
        await delay(200);
        const cdp = await context.newCDPSession(host);
        await cdp.send('Tracing.start', {
            categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReturnAsStream'
        });
        const opened = Date.now();
        await worker.evaluate(async () => {
            const window = (await chrome.windows.getAll()).find(window => window.type === 'normal');
            await chrome.action.openPopup({ windowId: window.id });
        });
        let target;
        for (let attempt = 0; attempt < 100; attempt++) {
            target = (await cdp.send('Target.getTargets')).targetInfos.find(target => target.url.endsWith('/popup.html'));
            if (target) break;
            await delay(50);
        }
        assert(target, 'Native toolbar popup opened');
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
        const evaluate = popupProtocol(cdp, sessionId);
        await evaluate(`new Promise((resolve, reject) => {
            const deadline = Date.now() + 10000;
            function check() {
                if (window.popupStartupSettingsHydrated && document.body.classList.contains('loaded') &&
                    !document.documentElement.classList.contains('popup-initializing')) return resolve(true);
                if (Date.now() > deadline) return reject(new Error('Menu did not initialize'));
                setTimeout(check, 25);
            }
            check();
        })`);
        const readyMs = Date.now() - opened;
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const state = await evaluate(`({
            bttv: document.querySelector('[data-setting="bttv"]').checked,
            preview: document.getElementById('multi-alerts-preview-frame').getAttribute('src'),
            visible: document.body.getBoundingClientRect().height > 0,
            overflow: scrollY,
            elements: document.querySelectorAll('*').length
        })`);
        assert(state.bttv, 'Persisted settings arrive with and without background');
        assert(state.visible, 'Menu is visible');
        assert.equal(state.overflow, 0, 'Outer popup has not scrolled blank');

        // Verify the actual recovery completes, rather than just its storage snapshot.
        if (mode === 'cold') {
            let recovered = false;
            while (Date.now() - opened < 3500) {
                recovered = await worker.evaluate(() => backgroundPageTabIdLoaded);
                if (recovered) break;
                await delay(50);
            }
            assert(recovered, 'Recent background closure must recover before the old five-second cooldown');
        } else if (mode === 'disabled') {
            assert.equal(await worker.evaluate(async () => (await queryBackgroundTabs()).length), 0,
                'Opening disabled extension settings must not restart capture');
        }

        const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end');
        const { stream } = await complete;
        let trace = '';
        for (;;) {
            const chunk = await cdp.send('IO.read', { handle: stream });
            trace += chunk.data;
            if (chunk.eof) break;
        }
        await cdp.send('IO.close', { handle: stream });
        const events = JSON.parse(trace).traceEvents;
        if (process.env.SSN_POPUP_TRACE_DIR) {
            fs.mkdirSync(process.env.SSN_POPUP_TRACE_DIR, { recursive: true });
            fs.writeFileSync(path.join(process.env.SSN_POPUP_TRACE_DIR, 'popup-' + mode + '.json'), trace);
            const screenshot = await evaluate.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(process.env.SSN_POPUP_TRACE_DIR, 'popup-' + mode + '.png'), Buffer.from(screenshot.data, 'base64'));
        }
        const parser = events.find(event => event.name === 'ParseHTML' && event.args?.beginData?.url === target.url);
        assert(parser, 'Trace includes actual popup parser');
        const frame = parser.args.beginData.frame;
        const layouts = events.filter(event => event.name === 'Layout' && event.ph === 'X' && event.args?.beginData?.frame === frame);
        // Later innerHTML updates also emit ParseHTML; they are not streaming
        // document parsing. Stop at this document's DOMContentLoaded milestone.
        const domReady = events.find(event => event.name === 'MarkDOMContent' && event.args?.data?.frame === frame);
        assert(domReady, 'Trace includes popup DOMContentLoaded');
        const parseEnd = domReady.ts;
        const partialLayouts = layouts.filter(event => event.ts < parseEnd && event.args?.beginData?.totalObjects > 100);
        assert.equal(partialLayouts.length, 0, 'Do not repeatedly lay out the partial menu while parsing');
        assert(!state.preview, 'Closed alert preview does not initialize during startup');
        const firstPaintMs = await evaluate(`performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime`);
        console.log(JSON.stringify({ mode, readyMs, firstPaintMs, layoutMs: Math.round(layouts.reduce((sum, event) => sum + event.dur, 0) / 1000), partialLayouts: partialLayouts.length }));

        // Real native control events: open, load and close the previously lazy preview.
        if (mode === 'cold') {
            // Record the first explicit test envelope without playing audio.
            await evaluate(`(() => {
                window.__previewEnvelopes = [];
                document.getElementById('multi-alerts-preview-frame').addEventListener('load', function () {
                    this.contentWindow.addEventListener('message', function (event) {
                        if (event.data && event.data.multiAlertsPreview && event.data.multiAlertsPreview.__multiAlertsPreviewEnvelope) {
                            __previewEnvelopes.push(event.data.multiAlertsPreview);
                            event.stopImmediatePropagation();
                        }
                    }, true);
                });
                sendOverlayPreview('multialerts', buildMultiAlertPreviewDescriptor('follow'));
            })()`);
        } else {
            await evaluate(`document.querySelector('label[for="wrapper-multi-alert-preview-options"]').click()`);
        }
        await evaluate(`new Promise((resolve, reject) => {
            const frame = document.getElementById('multi-alerts-preview-frame');
            const deadline = Date.now() + 8000;
            function check() {
                if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentWindow.location.href.includes('multi-alerts.html')) return resolve(true);
                if (Date.now() > deadline) return reject(new Error('Preview failed to load on opening'));
                setTimeout(check, 25);
            }
            check();
        })`);
        assert(await evaluate(`!!document.getElementById('multi-alerts-preview-frame').dataset.currentPreviewUrl`));
        if (mode === 'cold') {
            await evaluate(`new Promise((resolve, reject) => {
                const deadline = Date.now() + 2000;
                function check() {
                    if (__previewEnvelopes.length) return resolve();
                    if (Date.now() > deadline) return reject(new Error('First explicit test lost during lazy loading'));
                    setTimeout(check, 25);
                }
                check();
            })`);
            assert.equal(await evaluate(`__previewEnvelopes[0].silent`), false, 'First explicit test keeps its sound intent');
        }
        await evaluate(`document.querySelector('label[for="wrapper-multi-alert-preview-options"]').click()`);
        assert(await evaluate(`document.querySelector('[data-setting="bttv"]').checked`), 'Preview interaction preserves settings');
    } finally {
        await context.close();
    }
}

(async () => {
    const modes = process.env.SSN_POPUP_MODES ? process.env.SSN_POPUP_MODES.split(',') : ['warm', 'cold', 'disabled'];
    for (const mode of modes) {
        assert(['warm', 'cold', 'disabled'].includes(mode), 'Unknown popup test mode');
        await run(mode);
    }
    console.log('Native toolbar popup startup, lazy preview, persisted settings and background recovery passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
