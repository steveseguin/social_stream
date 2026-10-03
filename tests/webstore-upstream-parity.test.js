const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/official-source-baseline.json'), 'utf8'));
const actual = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const expected = JSON.parse(JSON.stringify(baseline.manifest));
// Steve explicitly requested this Web Store release version. Keep the official
// baseline intact and continue comparing every other field in full.
expected.version = '3.50.12';
const adultScripts = new Set(['stripchat', 'bongacams', 'cam4', 'chaturbate', 'fansly', 'camsoda', 'cherrytv', 'myfreecams', 'joystick']);
const adultHosts = new Set(['stripchat.com', 'bongacams.com', 'cam4.com', 'chaturbate.com', 'fansly.com', 'camsoda.com', 'cherry.tv', 'myfreecams.com', 'joystick.tv']);
expected.content_scripts = expected.content_scripts.filter(entry => !entry.js.some(file => adultScripts.has(path.posix.basename(file, '.js').replace(/-ws$/, ''))));
expected.host_permissions = expected.host_permissions.filter(pattern => {
  const host = pattern.split('://')[1].split('/')[0].replace(/^\*\./, '').replace(/^www\./, '');
  return !adultHosts.has(host);
});
expected.permissions = expected.permissions.filter(permission => !['webNavigation', 'activeTab'].includes(permission));
const disabledLocalResources = new Set(['shared/ai/browserModelCatalog.js', 'shared/ai/localBrowserLLM.js', 'local-browser-model-worker.js', 'cohost-local-qwen-worker.js']);
expected.web_accessible_resources[0].resources = expected.web_accessible_resources[0].resources.filter(file => !disabledLocalResources.has(file));

// Compare whole registrations in order. Never collapse registrations by their source filename.
assert.deepEqual(actual, expected, 'Manifest differs from official beyond the explicitly reviewed Web Store exceptions');
for (const file of new Set(actual.content_scripts.flatMap(entry => entry.js))) {
  const relative = file.replace(/^\.\//, '');
  assert.ok(baseline.sourceHashes[relative], `Unreviewed source dependency: ${relative}`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  assert.equal(digest, baseline.sourceHashes[relative], `Source/dependency differs from reviewed official code: ${relative}`);
}
console.log(`Official-source parity passed: ${actual.content_scripts.length} registrations and their complete dependency lists (${baseline.commit}).`);
