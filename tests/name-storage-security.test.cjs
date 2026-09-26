const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver } = require('./helpers/chat-security-harness.cjs');
const { routePositiveControl } = require('./helpers/name-security-controls.cjs');
const rawName = 'A "Ace" &amp; <b>Viewer</b> \u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}<img src="data:image/png;base64,broken" onerror="window.__hits++">';
(async () => {
    const server = await createStaticServer(); let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext(); await configureContext(context, server.baseUrl);
        await context.addInitScript(() => { window.__hits = 0; });
        for (const control of [true, false]) {
            const page = await context.newPage();
            if (control) await routePositiveControl(page, 'tipjar.html');
            await page.goto(server.baseUrl + '/tipjar.html?session=STORE_' + control + '&style=meter&persistent', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => { donationHistory.length = 0; currentAmount = 0; });
            for (const id of [5311, 5312]) await deliver(page, { id, chatname: rawName, chatmessage: 'tip', type: 'youtube', hasDonation: '$2.00', donoValue: 2, textonly: true });
            await page.waitForFunction(() => donationHistory.length === 2);
            await page.waitForTimeout(80);
            assert.equal(await page.evaluate(() => window.__hits > 0), control, 'Recent tip positive control/fixed');
            for (const method of ['showHistoryPanel', 'showLeaderboard']) {
                const result = await page.evaluate(method => {
                    window.__hits = 0; window[method]();
                    return { names: donationHistory.map(item => item.donator), stored: JSON.parse(localStorage.getItem(historyStorageKey)).map(item => item.donator), amount: currentAmount };
                }, method);
                await page.waitForTimeout(80);
                assert.equal(await page.evaluate(() => window.__hits > 0), control, method + ': positive control/fixed');
                assert.deepEqual(result.names, [rawName, rawName]);
                assert.deepEqual(result.stored, [rawName, rawName]);
                assert.equal(result.amount, 4);
            }
            await page.reload({ waitUntil: 'domcontentloaded' });
            assert.deepEqual(await page.evaluate(() => donationHistory.map(item => item.donator)), [rawName, rawName], 'Reload retains raw donor keys');
            await page.close();
        }
        console.log('PASS Tip Jar recent tips, history, leaderboard, repeated donor totals and persistence');

        // The extension normally creates this database before the history page opens.
        const seed = await context.newPage(); await seed.goto(server.baseUrl + '/tests/fixtures/empty');
        await seed.evaluate(() => new Promise((resolve, reject) => {
            const request = indexedDB.open('chatMessagesDB_v3', 4);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp');
                store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
            };
            request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
        }));
        await seed.close();

        for (const control of [true, false]) {
            const page = await context.newPage();
            if (control) await routePositiveControl(page, 'chathistory.html');
            await page.goto(server.baseUrl + '/chathistory.html', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!db);
            const record = { id: 76541, timestamp: Date.now(), chatname: rawName, type: 'youtube', chatmessage: 'History test', textonly: true };
            await page.evaluate(record => new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put(record);
                transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
            }), record);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => messages.length > 0);
            await page.waitForTimeout(80);
            assert.equal(await page.evaluate(() => window.__hits > 0), control, 'Stored history view positive control/fixed');
            const readback = await page.evaluate(name => new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).index('user_timestamp').getAll(IDBKeyRange.bound([name, 0], [name, Number.MAX_SAFE_INTEGER]));
                request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
            }), rawName);
            assert.deepEqual(readback, [record], 'Original name still locates the exact saved record');
            async function exportText(format) {
                await page.evaluate(format => {
                    window.__exportBlob = null;
                    URL.createObjectURL = blob => { window.__exportBlob = blob; return 'blob:offline-test'; };
                    HTMLAnchorElement.prototype.click = function () {};
                    exportMessages(format);
                }, format);
                await page.waitForFunction(() => !!window.__exportBlob);
                return page.evaluate(() => window.__exportBlob.text());
            }
            assert.deepEqual(JSON.parse(await exportText('json')), [record], 'JSON export retains raw identity');
            const html = await exportText('html');
            const exported = await context.newPage(); await exported.goto(server.baseUrl + '/tests/fixtures/empty');
            await exported.setContent(html, { waitUntil: 'domcontentloaded' }); await exported.waitForTimeout(80);
            assert.equal(await exported.evaluate(() => window.__hits > 0), control, 'HTML export positive control/fixed');
            assert.ok((await exported.locator('.username').textContent()).includes('A "Ace" & Viewer'));
            await exported.close(); await page.close();
        }
        console.log('PASS history IndexedDB name index, reload, displayed name and JSON/HTML exports');
    } finally { if (browser) await browser.close(); await closeServer(server.server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
