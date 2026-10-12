#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'actions.html'), 'utf8');
const state = html.slice(html.indexOf('        var audioUnlockPrompt ='), html.indexOf('        // Multi-layer overlay system references'));
const playback = html.slice(html.indexOf('        async function startAudioPlayback('), html.indexOf('        // Listen for messages from the iframe'));
const binding = html.match(/document\.addEventListener\('click', retryBlockedAudio\);/)[0];

function blocked() {
    return Object.assign(new Error('User interaction required'), { name: 'NotAllowedError' });
}

function setup(play) {
    const prompt = { hidden: true };
    const audios = [];
    const listeners = {};
    const errors = [];
    const sandbox = vm.createContext({
        document: {
            getElementById: () => prompt,
            addEventListener: (name, handler) => { listeners[name] = handler; },
        },
        globalVolume: 0.35,
        Audio: function (src) {
            this.src = src;
            this.calls = 0;
            this.play = () => { this.calls++; return play(this); };
            audios.push(this);
        },
        window: { AudioContext: function () { throw new Error('HTML audio must not depend on AudioContext'); } },
        console: { log() {}, warn() {}, error: (...args) => errors.push(args) },
    });
    vm.runInContext(state + playback + binding, sandbox);
    return { sandbox, prompt, audios, errors, click: () => listeners.click() };
}

async function settle() {
    await new Promise(resolve => setImmediate(resolve));
}

async function run() {
    // Allowed playback starts immediately, without creating or resuming a Web Audio context.
    {
        const test = setup(() => Promise.resolve());
        await test.sandbox.playAudio('uploaded.m4a', 1);
        await test.sandbox.playAudio('muted.mp3', 0);
        await test.sandbox.playAudio('default.wav');
        assert.deepStrictEqual(test.audios.map(audio => audio.volume), [1, 0, 0.35]);
        assert.ok(test.audios.every(audio => audio.calls === 1));
        assert.strictEqual(test.prompt.hidden, true);
        assert.strictEqual(test.errors.length, 0);
    }

    // Autoplay failures settle and offer a retry; the retry starts during the click itself.
    {
        let permitted = false;
        const test = setup(() => permitted ? Promise.resolve() : Promise.reject(blocked()));
        await test.sandbox.playAudio('uploaded.m4a', 1);
        assert.strictEqual(test.prompt.hidden, false);
        permitted = true;
        test.click();
        assert.strictEqual(test.audios[0].calls, 2);
        test.click();
        assert.strictEqual(test.audios[0].calls, 2, 'Repeated clicks must not restart a pending retry');
        await settle();
        assert.strictEqual(test.prompt.hidden, true);
    }

    // Several blocked alerts must not all play at once when permission is granted.
    {
        let permitted = false;
        const test = setup(() => permitted ? Promise.resolve() : Promise.reject(blocked()));
        await test.sandbox.playAudio('old.mp3', 1);
        await test.sandbox.playAudio('latest.mp3', 0.5);
        permitted = true;
        test.click();
        await settle();
        assert.deepStrictEqual(test.audios.map(audio => audio.calls), [1, 2]);
        assert.strictEqual(test.audios[1].volume, 0.5);
        assert.strictEqual(test.prompt.hidden, true);
    }

    // A late failure from an older request cannot replace the latest blocked clip.
    {
        let rejectOld;
        let permitted = false;
        const test = setup(audio => {
            if (audio.src === 'old.mp3') return new Promise((resolve, reject) => { rejectOld = reject; });
            return permitted ? Promise.resolve() : Promise.reject(blocked());
        });
        const oldPlayback = test.sandbox.playAudio('old.mp3', 1);
        await test.sandbox.playAudio('latest.mp3', 1);
        rejectOld(blocked());
        await oldPlayback;
        permitted = true;
        test.click();
        await settle();
        assert.deepStrictEqual(test.audios.map(audio => audio.calls), [1, 2]);
    }

    // A browser may continue denying playback after a click; keep the retry available.
    {
        const test = setup(() => Promise.reject(blocked()));
        await test.sandbox.playAudio('blocked.mp3', 1);
        test.click();
        await settle();
        assert.strictEqual(test.prompt.hidden, false);
        test.click();
        await settle();
        assert.strictEqual(test.audios[0].calls, 3);
    }

    // Invalid media is an actual playback failure, not a request for autoplay permission.
    {
        const test = setup(() => Promise.reject(Object.assign(new Error('Unsupported media'), { name: 'NotSupportedError' })));
        await test.sandbox.playAudio('invalid.mp3', 1);
        assert.strictEqual(test.prompt.hidden, true);
        assert.strictEqual(test.errors.length, 1);
        test.click();
        assert.strictEqual(test.audios[0].calls, 1);
    }

    console.log('Flow Actions audio playback checks passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
