// Regenerate audio/tts-phrases from TTS.phraseClips in tts.js with Kokoro (am_eric), then encode with ffmpeg.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/build-tts-phrases.cjs [id ...]   (ffmpeg on PATH by default; ids limit the rebuild)
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');
const {chromium} = require('playwright');
const {startStaticServer} = require('./playwright-static-server.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'audio', 'tts-phrases');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const voice = 'am_eric'; // near the male Portuguese/Spanish Piper voices in pitch, with a clean "h" (bm_fable sounds like "th")
const only = process.argv.slice(2);

function encodeWav(samples, rate) {
    const buffer = Buffer.alloc(44 + samples.length * 2);
    buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
    for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
    return buffer;
}

// Trim silence, fade the edges, and level the voiced parts to the Piper voices' typical loudness.
function finish(samples, rate) {
    const frame = Math.round(rate * 0.01);
    const levels = [];
    for (let i = 0; i + frame <= samples.length; i += frame) {
        let energy = 0;
        for (let j = i; j < i + frame; j++) energy += samples[j] * samples[j];
        levels.push(energy / frame);
    }
    const first = levels.findIndex(level => level > 0.00001);
    const last = levels.length - 1 - levels.slice().reverse().findIndex(level => level > 0.00001);
    const margin = Math.round(rate * 0.06);
    const clip = samples.slice(Math.max(0, first * frame - margin), Math.min(samples.length, (last + 1) * frame + margin));
    const fade = Math.round(rate * 0.008);
    for (let i = 0; i < fade; i++) { clip[i] *= i / fade; clip[clip.length - 1 - i] *= i / fade; }
    const voiced = levels.filter(level => level > 0.0004);
    const level = Math.sqrt(voiced.reduce((sum, value) => sum + value, 0) / voiced.length);
    const peak = clip.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    const gain = Math.min(0.15 / level, 0.95 / peak);
    return clip.map(value => value * gain);
}

(async () => {
    const port = 4191;
    const server = await startStaticServer({root, port});
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-phrases-'));
    let browser;
    try {
        browser = await chromium.launch({headless: true});
        const page = await browser.newPage();
        await page.route('http://127.0.0.1:' + port + '/__phrases.html', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>phrases</title>'}));
        await page.goto('http://127.0.0.1:' + port + '/__phrases.html');
        await page.addScriptTag({url: '/tts.js'});
        const phrases = await page.evaluate(async () => {
            window.SSN_KOKORO_REMOTE_HOST = 'https://huggingface.co/';
            const module = await import('/thirdparty/kokoro-bundle.es.js');
            window.kokoro = await module.KokoroTTS.from_pretrained(TTS.getKokoroAssets().modelId, {dtype: 'fp32', device: 'wasm'});
            return TTS.phraseClips;
        });
        fs.mkdirSync(output, {recursive: true});
        // Normal pace only: slowed Kokoro clips blur the "h" again, and short phrases sit fine after slow Piper speech.
        for (const [id, text] of Object.entries(phrases).filter(([id]) => !only.length || only.includes(id))) {
            const audio = await page.evaluate(async ([text, voice]) => {
                const result = await window.kokoro.generate(text, {voice});
                return {rate: result.sampling_rate, samples: Array.from(result.audio)};
            }, [text, voice]);
            const wav = path.join(temp, id + '.wav');
            fs.writeFileSync(wav, encodeWav(finish(Float32Array.from(audio.samples), audio.rate), audio.rate));
            // MP3 smears the soft "h" onsets into a "t"/"s"; Opus keeps them.
            execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-codec:a', 'libopus', '-b:a', '32k', path.join(output, id + '.ogg')]);
        }
        console.log('Rebuilt ' + (only.length || Object.keys(phrases).length) + ' phrases.');
    } finally {
        if (browser) await browser.close();
        server.close();
        fs.rmSync(temp, {recursive: true, force: true});
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
