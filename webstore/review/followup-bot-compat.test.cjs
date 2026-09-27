'use strict';
require('./use-candidate.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {createStaticServer, closeServer} = require('../../tests/background-overlay-compat-matrix.test.cjs');
const {configureContext, deliver} = require('../../tests/helpers/chat-security-harness.cjs');
const prepared = JSON.parse(fs.readFileSync(path.join(__dirname, 'followup-proposed.json'), 'utf8'));
const testRoot = process.argv.includes('--proposed') ? prepared.isolated_directory : path.resolve(__dirname, '../candidate');
const body = fs.readFileSync(path.join(testRoot, 'bot.html'), 'utf8');
(async () => {
    const server = await createStaticServer();
    let browser, count = 0;
    try {
        browser = await chromium.launch({headless:true});
        for (const stack of [false,true]) for (const mode of [true,false,undefined]) {
            const context = await browser.newContext();
            try {
                await configureContext(context, server.baseUrl);
                await context.route('**/bot.html*', route => route.fulfill({contentType:'text/html',body}));
                const page = await context.newPage(), errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.goto(server.baseUrl + '/bot.html?session=LOCAL_REVIEW' + (stack ? '&stack=3' : ''));
                await page.evaluate(() => {
                    window.__bodyChecks = [];
                    const sanitize = SocialStreamChatHTML.sanitize;
                    SocialStreamChatHTML.sanitize = text => { __bodyChecks.push(text); return sanitize(text); };
                });
                const chatmessage = 'REVIEW <b>bold</b> &amp; ordinary text';
                const payload = {id:++count, type:'twitch',chatname:'Viewer',chatmessage};
                if (mode !== undefined) payload.textonly = mode;
                await deliver(page, payload);
                await page.waitForFunction(() => document.getElementById('message')?.textContent.includes('REVIEW'));
                const result = await page.locator('#message').evaluate(element => ({text:element.textContent,bold:element.querySelector('b')?.textContent,checks:__bodyChecks}));
                if (mode === true) {
                    assert.equal(result.text, chatmessage);
                    assert(!result.checks.includes(chatmessage));
                } else {
                    assert.equal(result.text, 'REVIEW bold & ordinary text');
                    assert.equal(result.bold, 'bold');
                    assert(result.checks.includes(chatmessage), 'HTML display copy reaches shared sanitizer');
                }
                assert.deepEqual(errors, []);
            } finally { await context.close(); }
        }
        console.log('PASS '+count+' bot display checks: plain text, rich formatting, sanitizer invocation, stacking and no page exceptions');
    } finally { if (browser) await browser.close(); await closeServer(server.server); }
})().catch(error => {console.error(error);process.exitCode=1;});
