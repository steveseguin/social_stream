// Refresh compatibility WAVs from finished catalog audio; no speech engine runs here.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const {startStaticServer} = require('./playwright-static-server.cjs');
const output = path.resolve(__dirname, '../audio/alerts');
const clips = {
    applause: 'sfx-small-applause',
    drumroll: 'sfx-drumroll-reveal',
    whoosh: 'sfx-clean-whoosh',
    'cash-register': 'sfx-cash-register',
    boing: 'sfx-rubber-boing',
    'record-scratch': 'sfx-record-stop',
    pop: 'sfx-confetti-pop',
    camera: 'sfx-camera-shutter',
    'voice-thank-you': 'voice-en-friendly-thanks-watching',
    'voice-welcome': 'voice-en-friendly-welcome',
    'voice-lets-go': 'voice-en-upbeat-lets-go',
    'voice-hype-train': 'voice-en-upbeat-hype-train'
};
function encodeWav(channels, rate) {
    const count = channels.length, frames = channels[0].length;
    const buffer = Buffer.alloc(44 + frames * count * 2);
    buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(count, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * count * 2, 28);
    buffer.writeUInt16LE(count * 2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < count; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
            buffer.writeInt16LE(Math.round(sample * 32767), 44 + (frame * count + channel) * 2);
        }
    }
    return buffer;
}
(async () => {
    Object.values(clips).forEach(id => fs.accessSync(path.resolve(output, '../catalog', id + '.mp3')));
    let browser;
    const server = await startStaticServer({root: path.resolve(__dirname, '..'), port: 4189});
    try {
        browser = await chromium.launch({headless: true, args: ['--renderer-process-limit=2']});
        const page = await browser.newPage();
        await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await page.goto('http://127.0.0.1:4189/audio-library.html');
        for (const [name, id] of Object.entries(clips)) {
            const pcm = await page.evaluate(async id => {
                const context = new AudioContext({sampleRate: 44100});
                try {
                    const response = await fetch('/audio/catalog/' + id + '.mp3');
                    if (!response.ok) throw new Error('Missing catalog audio: ' + id);
                    const buffer = await context.decodeAudioData(await response.arrayBuffer());
                    return {rate: buffer.sampleRate, channels: Array.from({length: buffer.numberOfChannels}, (_, channel) => Array.from(buffer.getChannelData(channel)))};
                } finally { await context.close(); }
            }, id);
            fs.writeFileSync(path.join(output, name + '.wav'), encodeWav(pcm.channels, pcm.rate));
        }
        console.log('Refreshed twelve alert WAVs from the finished sound catalog.');
    } finally {
        if (browser) await browser.close();
        server.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
