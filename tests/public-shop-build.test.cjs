const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('public viewer build preserves stable assets and packages every viewer dependency', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-public-shop-build-'));
  try {
    // A beta viewer release must not overwrite stable application dependencies.
    const sentinel = path.join(tempRoot, 'shared', 'monetization', 'core.js');
    fs.mkdirSync(path.dirname(sentinel), { recursive: true });
    fs.writeFileSync(sentinel, 'stable application sentinel');
    const build = spawnSync('python', ['scripts/build-public-shop.py', '--source', root, '--output', tempRoot], {
      cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(build.status, 0, build.stderr || String(build.error || build.stdout));
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'stable application sentinel');
    const html = fs.readFileSync(path.join(tempRoot, 'shop.html'), 'utf8');
    const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m => m[1]).filter(x => !/^https?:/.test(x));
    assert.ok(references.length >= 6);
    const prefixes = new Set();
    for (const relative of references) {
      const match = relative.match(/^(public-shop-assets\/[a-f\d]{16}\/)(.+)$/);
      assert.ok(match, `Unversioned viewer asset: ${relative}`);
      prefixes.add(match[1]);
      assert.equal(fs.readFileSync(path.join(tempRoot, relative), 'utf8'), fs.readFileSync(path.join(root, match[2]), 'utf8'));
    }
    assert.equal(prefixes.size, 1, 'Viewer assets must share a content version');
    const prefix = [...prefixes][0];
    for (const locale of fs.readdirSync(path.join(root, 'translations')).filter(f => f.endsWith('.json'))) {
      const deployed = path.join(tempRoot, prefix, 'translations', locale);
      assert.deepEqual(JSON.parse(fs.readFileSync(deployed, 'utf8')), JSON.parse(fs.readFileSync(path.join(root, 'translations', locale), 'utf8')));
    }
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
    assert.match(workflow, /python3 beta-content\/scripts\/build-public-shop\.py --source beta-content --output gh-pages-content/);
  } finally {
    const resolved = path.resolve(tempRoot);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'ssn-public-shop-build-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
