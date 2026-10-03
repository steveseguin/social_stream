const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
// This fixture comes from the reviewed incoming release, not the working tree.
// The old official-source-baseline.json remains as 3.50.12 history.
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/webstore-release-baseline.json'), 'utf8'));
const actual = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.deepEqual(actual, baseline.manifest, 'Manifest differs from the reviewed release: review every registration, dependency and permission before updating the fixture');
for (const [file, expected] of Object.entries(baseline.sourceHashes)) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.equal(digest, expected, `Capture source/provider differs from reviewed release: ${file}`);
}
console.log(`Reviewed Web Store source parity passed: ${actual.content_scripts.length} registrations (${baseline.release_commit}).`);
