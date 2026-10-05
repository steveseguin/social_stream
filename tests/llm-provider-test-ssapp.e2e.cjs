#!/usr/bin/env node
'use strict';

// SSAPP_REPO=../ssn_app node tests/llm-provider-test-ssapp.e2e.cjs [--live]
// Runs the real desktop popup in a fresh profile. --live also tests SSN's free LLM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || ['ssapp', 'ssn_app']
    .map(name => path.resolve(sourceRoot, '..', name))
    .find(directory => fs.existsSync(path.join(directory, 'node_modules', 'electron')));
assert.ok(appRoot, 'Set SSAPP_REPO to the installed SSApp checkout.');
const { _electron } = require(require.resolve('playwright-core', { paths: [sourceRoot, appRoot] }));
const electronPath = require(path.join(appRoot, 'node_modules', 'electron'));
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-llm-provider-test-'));
const profile = path.join(artifacts, 'profile');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [];
const timers = new Set();
const results = [];
let app;
let page;

async function freePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

const fixture = http.createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
        const body = JSON.parse(raw || '{}');
        requests.push({ model: body.model, url: request.url });
        const timer = setTimeout(() => {
            timers.delete(timer);
            response.setHeader('Content-Type', 'application/json');
            const status = { 'invalid-key': 401, 'invalid-model': 404, 'server-error': 503 }[body.model];
            if (status) {
                response.writeHead(status);
                response.end(JSON.stringify({ error: { code: body.model, message: 'Provider fixture: ' + body.model } }));
            } else {
                response.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Connected: ' + body.model } }] }));
            }
        }, { timeout: 62000, 'after-timeout': 4500, 'beyond-default-timeout': 32000 }[body.model] || 1500);
        timers.add(timer);
    });
});

async function run() {
    await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${fixture.address().port}/v1/chat/completions`;
    const localPort = await freePort();
    app = await _electron.launch({
        executablePath: electronPath,
        args: ['.', '--multiinstance', '--preferlocalassets', `--filesource=${sourceRoot}`, `--ssapp-local-server-port=${localPort}`],
        cwd: appRoot,
        env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1', SSAPP_DEBUG_LOGS: '0' },
        timeout: 60000
    });
    page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.waitForFunction(() => typeof ensurePopupPanelLoaded === 'function', null, { timeout: 60000 });
    await page.evaluate(async () => { await setupIframeSource(); await ensurePopupPanelLoaded(); });
    await page.waitForFunction(() => {
        const background = document.getElementById('frame2')?.contentWindow;
        const popup = document.getElementById('frame1')?.contentWindow;
        return typeof background?.callLLMAPI === 'function' && typeof popup?.testSelectedLLMProvider === 'function';
    }, null, { timeout: 60000 });
    await delay(2000);
    if (await page.locator('body').evaluate(element => element.classList.contains('overlay-collapsed'))) {
        await page.locator('#popup-handle').click();
    }
    const popup = page.frameLocator('#frame1');
    if (await popup.locator('#beginnerWelcomeAdvanced').isVisible()) {
        await popup.locator('#beginnerWelcomeAdvanced').click();
    }
    await popup.locator('label[for="wrapper-bots-options-ext"]').click();
    // Observe actual provider calls; leave the real transport and response handling intact.
    await page.evaluate(() => {
        const background = document.getElementById('frame2').contentWindow;
        background.llmTestCallCount = 0;
        const call = background.callLLMAPI;
        background.callLLMAPI = async function() {
            background.llmTestCallCount++;
            try {
                return await call.apply(this, arguments);
            } finally {
                if (arguments[6]?.settings?.customAIModel?.textsetting === 'timeout') {
                    // Deliver this result late, even if the network also expires at 60 seconds.
                    await new Promise(resolve => setTimeout(resolve, 2500));
                }
            }
        };
    });
    const callCount = () => page.evaluate(() => document.getElementById('frame2').contentWindow.llmTestCallCount);
    const readOutput = () => popup.locator('#testSelectedLLMProviderOutput').evaluate(element => ({
        output: element.textContent,
        status: element.ownerDocument.getElementById('testSelectedLLMProviderStatus').textContent,
        disabled: element.ownerDocument.getElementById('testSelectedLLMProvider').disabled
    }));

    async function test(name, provider, fields, status, expected, pendingCheck) {
        await popup.locator('#aiProvider').selectOption(provider);
        for (const [key, value] of Object.entries(fields)) {
            const input = popup.locator(`[data-textsetting="${key}"]`);
            await input.fill(value);
            await input.dispatchEvent('change');
        }
        const before = await callCount();
        const began = Date.now();
        await popup.locator('#testSelectedLLMProvider').click();
        if (pendingCheck) await pendingCheck();
        await page.waitForFunction(() => {
            const doc = document.getElementById('frame1').contentDocument;
            return !doc.getElementById('testSelectedLLMProvider').disabled &&
                /^(Connected|Failed)$/.test(doc.getElementById('testSelectedLLMProviderStatus').textContent.trim());
        }, null, { timeout: 65000 });
        const result = await readOutput();
        assert.equal(result.status, status, name + ': ' + result.output);
        assert.match(result.output, expected, name + ': ' + result.output);
        assert.doesNotMatch(result.output, /Unknown error/, name);
        assert.equal(await callCount() - before, 1, name + ' must invoke the provider once');
        results.push({ name, elapsedMs: Date.now() - began, ...result });
        fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ results, requests }, null, 2));
        console.log('PASS ' + name + ' (' + results[results.length - 1].elapsedMs + ' ms)');
        return result;
    }

    await test('delayed success', 'custom', { customAIEndpoint: endpoint, customAIModel: 'slow-success', customAIApiKey: '' }, 'Connected', /^Connected: slow-success$/, async () => {
        await delay(750);
        assert.equal((await readOutput()).disabled, true, 'A slow test must stay pending beyond 500 ms');
        // A second click on the disabled DOM button must not submit another test.
        await popup.locator('#testSelectedLLMProvider').evaluate(button => button.click());
    });
    for (const [model, status] of [['invalid-key', 401], ['invalid-model', 404], ['server-error', 503]]) {
        await test('delayed ' + model, 'custom', { customAIModel: model }, 'Failed', new RegExp(`Status: ${status}[\\s\\S]*Provider fixture: ${model}`));
    }
    await test('reply after 30 seconds', 'custom', { customAIModel: 'beyond-default-timeout' }, 'Connected', /^Connected: beyond-default-timeout$/);
    if (process.argv.includes('--live')) {
        await test('live SSN custom endpoint', 'custom', {
            customAIEndpoint: 'https://llm.socialstream.ninja/v1/chat/completions',
            customAIModel: 'default', customAIApiKey: 'test_token'
        }, 'Connected', /\S/);
        await test('live SSN hosted trial', 'hostedllm', {
            hostedLLMToken: '', hostedLLMEndpoint: '', hostedLLMModel: ''
        }, 'Connected', /\S/);
        await page.screenshot({ path: path.join(artifacts, 'live-connected.png') });
    }
    console.log('Checking the full 60-second timeout and late reply handling...');
    await test('timeout', 'custom', { customAIEndpoint: endpoint, customAIModel: 'timeout', customAIApiKey: '' }, 'Failed', /^Connection test timed out\.$/);
    assert.ok(results[results.length - 1].elapsedMs >= 59000, 'The timeout must allow the full minute');
    await page.screenshot({ path: path.join(artifacts, 'timeout.png') });
    await test('new test after timeout', 'custom', { customAIModel: 'after-timeout' }, 'Connected', /^Connected: after-timeout$/, async () => {
        await delay(3500); // The old provider reply arrives while this test is still pending.
        const result = await readOutput();
        assert.equal(result.disabled, true, 'A late reply must not finish a newer test');
        assert.match(result.status, /^Testing /);
    });
    for (const model of ['slow-success', 'invalid-key', 'invalid-model', 'server-error', 'beyond-default-timeout', 'timeout', 'after-timeout']) {
        assert.equal(requests.filter(request => request.model === model).length, 1, model + ' must send one HTTP request');
    }
    assert.equal(await callCount(), results.length, 'No late retry may submit another provider request');
    console.log('All LLM provider desktop tests passed. Artifacts: ' + artifacts);
}

run().catch(async error => {
    console.error(error.stack);
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {});
    console.error('Artifacts: ' + artifacts);
    process.exitCode = 1;
}).finally(async () => {
    if (app) await app.close().catch(() => {});
    for (const timer of timers) clearTimeout(timer);
    fixture.closeAllConnections();
    fixture.close();
});
