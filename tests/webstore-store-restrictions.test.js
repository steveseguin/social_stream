const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/store-restrictions-baseline.json')));
// A checkout also contains development files; an upload must match the
// reviewed package inventory exactly, with no hidden staging dependency.
const packageFiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/webstore-package-files.json'), 'utf8'));
const isCheckout = fs.existsSync(path.join(root, 'AGENTS.md')) && fs.existsSync(path.join(root, 'package.json'));
const files = isCheckout ? packageFiles : fs.readdirSync(root, { recursive: true }).filter(file => fs.statSync(path.join(root, file)).isFile()).map(file => file.split(path.sep).join('/'));
assert.deepEqual([...files].sort(), [...packageFiles].sort(), 'Upload files differ from the reviewed package inventory');
for (const file of packageFiles) assert.ok(fs.existsSync(path.join(root, file)), `Missing packaged file: ${file}`);

for (const [file, digest] of Object.entries(baseline.licences)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), digest, `Missing or changed reviewed licence: ${file}`);
}
for (const [file, digest] of Object.entries(baseline.sourceAndProviderHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), digest, `Retained source/provider differs from the reviewed official file: ${file}`);
}
for (const file of files) {
    assert.ok(!baseline.excludedFiles.includes(file), `Previously excluded package asset returned: ${file}`);
    assert.ok(!baseline.excludedPrefixes.some(prefix => file.startsWith(prefix)), `Excluded package directory returned: ${file}`);
    if (file.startsWith('docs/')) assert.ok(baseline.packagedHelpFiles.includes(file), `Website documentation must use hosted help: ${file}`);
    if (!/\.(?:html|js|mjs|md|json)$/.test(file) || file.endsWith('emotes.json')) continue;
    const source = read(file);
    assert.ok(!/[?&](?:amp;)?(?:js|base64js|jsb64)=|custom_sample\.js|uploadCustomJS|deleteCustomJS/i.test(source), `Removed executable customization or claim returned: ${file}`);
    assert.ok(!/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\/|\b(?:import|importScripts)\s*\(\s*["']https?:\/\/|\bfrom\s*["']https?:\/\//i.test(source), `Remote executable load returned: ${file}`);
    // Past Blue Argon and Red Titanium rejections: keep these separate from
    // ordinary data/image fetches and legitimate base64 media decoding.
    assert.ok(!/\bensureFunction\s*\(\s*["'][^"']+["']\s*,\s*["']https?:\/\/|\bloadScript\s*\(\s*["']https?:\/\//i.test(source), `Previously rejected remote loader returned: ${file}`);
    assert.ok(!/JSON\s*\.\s*parse\s*\(\s*atob\s*\(/.test(source), `Previously rejected encoded JSON list returned: ${file}`);
    assert.ok(!/stripchat|bongacams|chaturbate|fansly|camsoda|cherry\.tv|myfreecams|joystick\.tv|onlyfans/i.test(source), `Adult-provider reference returned: ${file}`);
    const dynamic = source.match(/\bnew\s+Function\s*\(|\beval\s*\(|\bFunction\s*\(\s*["']/g) || [];
    if (dynamic.length) {
        assert.equal(file, 'shared/vendor/socket.io.min.js', `Unreviewed dynamic-code construction: ${file}`);
        assert.equal(dynamic.length, 1, 'Socket.IO acquired additional dynamic-code paths');
        assert.equal(crypto.createHash('sha256').update(source).digest('hex'), baseline.socketIoSha256, 'Review any Socket.IO update before accepting its fallback');
    }
}

// Socket.IO is needed by Velora and Streamlabs. Its global-object fallback must
// not execute Function in a browser, even when dynamic code is forbidden.
const browser = { setTimeout, clearTimeout, console };
browser.self = browser;
browser.window = browser;
vm.runInNewContext(read('shared/vendor/socket.io.min.js'), browser, { contextCodeGeneration: { strings: false, wasm: false } });
assert.equal(typeof browser.io, 'function');
for (const source of ['velora', 'streamlabs']) {
    assert.ok(read(`sources/websocket/${source}.html`).includes('../../shared/vendor/socket.io.min.js'), `${source} lost its local Socket.IO dependency`);
}
assert.deepEqual(JSON.parse(read('manifest.json')).permissions, ['notifications', 'storage', 'debugger', 'tabs', 'scripting', 'tabCapture', 'identity']);
assert.match(read('privacy.html'), /Limited Use/);
assert.match(read('spotify.js'), /chrome\.identity\.launchWebAuthFlow/);
assert.match(read('service_worker.js'), /if \(backgroundPageTabIdLoaded\)/);
assert.match(read('README.md'), /Chrome Web Store edition/);
assert.ok(!/local AI voices|your own scripts|or convert a StreamElements chat widget/.test(read('README.md')), 'Full-build feature claims returned to the Store README');
console.log('Store restrictions passed: licences, exclusions, hosted help, permissions, custom/remote code and retained Socket.IO.');
