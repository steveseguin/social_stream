const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const guides = ['monetization.html', 'creator-store-setup.html', 'shopify-setup.html',
  'product-controls.html', 'obs-control-dock-guide.html', 'alert-effects.html',
  'thermal-printer-guide.html', 'commerce-boards.html'];

test('commerce guides link to packaged pages, anchors and screenshots', () => {
  for (const guide of guides) {
    const file = path.join(root, 'docs', guide);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      const link = match[1].replace(/&amp;/g, '&');
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue;
      const parsed = new URL(link, 'https://local.invalid/docs/' + guide);
      const target = path.resolve(root, '.' + decodeURIComponent(parsed.pathname));
      assert.ok(target.startsWith(root + path.sep), `${guide}: escaped local path ${link}`);
      assert.ok(fs.existsSync(target), `${guide}: missing local resource ${link}`);
      if (parsed.hash && /\.html$/i.test(target)) {
        const fragment = decodeURIComponent(parsed.hash.slice(1));
        const ids = [...fs.readFileSync(target, 'utf8').matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].map(m => m[1]);
        assert.ok(ids.includes(fragment), `${guide}: missing anchor ${link}`);
      }
    }
    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
      assert.match(match[0], /\balt=["'][^"']*["']/, `${guide}: image needs alt text`);
    }
  }
});
