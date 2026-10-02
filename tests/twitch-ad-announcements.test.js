#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../sources/static/twitch_points.js'), 'utf8');

async function fixture(browser, settings) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html><body><div data-a-target="video-player"><video id="stream"></video><div id="ad-status"></div></div></body></html>');
    await page.evaluate(settings => {
        window.messages = [];
        window.chrome = { runtime: {
            id: 'twitch-ad-test',
            onMessage: { addListener(listener) { window.receiveSettings = listener; } },
            sendMessage(id, payload, callback) {
                if (payload.getSettings) return callback({ settings });
                if (payload.message) window.messages.push(JSON.parse(JSON.stringify(payload.message)));
                if (callback) callback({});
            }
        } };
    }, settings);
    await page.addScriptTag({ content: source });
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
    return {
        page,
        async run(action) {
            await page.evaluate(action);
            // Allow the production MutationObserver and media event tasks to run.
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
        },
        async messages() { return page.evaluate(() => window.messages); },
        async settings(settings) {
            await page.evaluate(settings => window.receiveSettings({ settings }, {}, () => {}), settings);
        },
        async close() {
            assert.deepEqual(errors, [], 'The full Twitch helper must run without browser errors');
            await page.close();
        }
    };
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const enabled = await fixture(browser, { twichadannounce: true });
        await enabled.run(() => {
            document.body.appendChild(document.createElement('video'));
            const stream = document.getElementById('stream');
            window.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('visibilitychange'));
            stream.dispatchEvent(new Event('play'));
            stream.dispatchEvent(new Event('play'));
            stream.dispatchEvent(new Event('abort'));
        });
        assert.deepEqual(await enabled.messages(), [], 'Normal playback with an ID-less video must not announce an ad');

        // These markers are rendered by Twitch's VideoAdBanner / VideoAdCountdown
        // components, verified in these Twitch player assets:
        // https://assets.twitch.tv/assets/11622-c59053644fc8ca2683bd.js
        // https://assets.twitch.tv/assets/81731-4753171c39568429b47e.js
        await enabled.run(() => {
            document.getElementById('ad-status').innerHTML = '<span data-a-target="video-ad-label">Ad break</span><span data-a-target="video-ad-countdown">0:30</span>';
        });
        let messages = await enabled.messages();
        assert.equal(messages.length, 1, 'Confirmed ad UI must announce the start without waiting for a play event');
        assert.equal(messages[0].chatmessage, 'An ad break is starting..');
        assert.equal(messages[0].event, 'ad_break');
        assert.equal(messages[0].type, 'twitch');
        assert.equal(messages[0].chatname, 'Ad Alert');
        assert.equal(messages[0].textonly, true);
        await enabled.run(() => {
            const stream = document.getElementById('stream');
            stream.dispatchEvent(new Event('play'));
            stream.dispatchEvent(new Event('play'));
            stream.dispatchEvent(new Event('abort'));
            const label = document.querySelector('[data-a-target="video-ad-label"]');
            label.replaceWith(label.cloneNode(true));
            document.querySelector('[data-a-target="video-ad-countdown"]').textContent = '0:29';
        });
        assert.equal((await enabled.messages()).length, 1, 'Replay, abort, countdown updates, and a UI rerender must not duplicate an active break');
        await enabled.run(() => document.querySelector('[data-a-target="video-ad-label"]').remove());
        assert.equal((await enabled.messages()).length, 1, 'The countdown still identifies the active break');
        await enabled.run(() => document.querySelector('[data-a-target="video-ad-countdown"]').remove());
        messages = await enabled.messages();
        assert.equal(messages.length, 2);
        assert.equal(messages[1].chatmessage, 'An ad break is stopping.');
        await enabled.run(() => {
            const label = document.createElement('span');
            label.dataset.aTarget = 'video-ad-label';
            document.getElementById('ad-status').appendChild(label);
        });
        assert.equal((await enabled.messages()).length, 3, 'A later break must still announce');
        await enabled.run(() => document.getElementById('ad-status').textContent = '');
        assert.equal((await enabled.messages()).length, 4);
        await enabled.close();

        const disabled = await fixture(browser, {});
        await disabled.run(() => {
            document.getElementById('ad-status').innerHTML = '<span data-a-target="video-ad-label">Ad break</span>';
            document.body.appendChild(document.createElement('video'));
            document.getElementById('stream').dispatchEvent(new Event('play'));
        });
        assert.deepEqual(await disabled.messages(), [], 'Announcements must be off by default at the source');
        await disabled.settings({ twichadannounce: true });
        assert.equal((await disabled.messages()).length, 1, 'Enabling announcements detects an already active ad');
        await disabled.settings({});
        await disabled.run(() => document.getElementById('ad-status').textContent = '');
        assert.equal((await disabled.messages()).length, 1, 'Disabling announcements must suppress the end too');
        await disabled.settings({ twichadannounce: true });
        assert.equal((await disabled.messages()).length, 1, 'Re-enabling after the ad must not emit an unmatched end');
        await disabled.close();

        const muted = await fixture(browser, { twichadmute: true, twichadannounce: true });
        await muted.run(() => {
            const stream = document.getElementById('stream');
            Object.defineProperty(stream, 'paused', { get: () => false });
            stream.volume = 0.4;
            stream.dispatchEvent(new Event('volumechange'));
            document.body.appendChild(document.createElement('video'));
            document.getElementById('ad-status').innerHTML = '<span data-a-target="video-ad-label">Ad break</span>';
            stream.dispatchEvent(new Event('play'));
        });
        assert.deepEqual(await muted.page.evaluate(() => [document.getElementById('stream').muted, document.querySelector('video:not([id])').muted]), [false, true], 'Existing automatic-mute actions must still run');
        assert.equal((await muted.messages()).length, 1);
        await muted.run(() => document.getElementById('stream').dispatchEvent(new Event('abort')));
        assert.deepEqual(await muted.page.evaluate(() => [document.getElementById('stream').muted, document.querySelector('video:not([id])').muted]), [true, false], 'Existing abort audio actions must still run');
        assert.equal((await muted.messages()).length, 1, 'Abort alone must not end the announcement');
        await muted.run(() => document.getElementById('ad-status').textContent = '');
        assert.equal((await muted.messages()).length, 2);
        await muted.close();
    } finally {
        await browser.close();
    }
    console.log('PASS: Twitch ad announcements require ad UI and opt-in, emit once per transition, and preserve audio actions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
