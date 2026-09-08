import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../../shared/monetization/core.js');
const overlay = fs.readFileSync(new URL('../../shared/monetization/overlay.js', import.meta.url), 'utf8');
const shop = fs.readFileSync(new URL('../../shared/monetization/shop.js', import.meta.url), 'utf8');
const link = { name: 'Mug', url: 'https://example.invalid/mug', amount: 5, currency: 'USD' };
// Exercise the exact source normalizers without duplicating their implementations.
function sourceFunction(source, start, end, context) {
 const first = source.indexOf(start), last = source.indexOf(end, first);
 assert(first >= 0 && last > first);
 vm.createContext(context); vm.runInContext(source.slice(first, last), context);
 return context;
}
test('Overlay snapshots reject price coercion and preserve neighboring valid products', () => {
 for (const mode of ['ebay', 'wishlist', 'commerce']) {
  const context = sourceFunction(overlay, 'function snapshot(raw)', 'function messageText(data)', { mode, safeURL: M.imageURL, SSNMonetization: M });
  for (const invalid of [false, true, [], ['5'], {}, { toString: null }]) {
   const item = { ...link, amount: invalid, currency: { toString: null } };
   const input = { enabled: true, items: [item, link], item, seconds: invalid, rank: invalid, total: invalid, live: { mode: 'show', url: link.url, until: invalid } };
   const clean = context.snapshot({ [mode]: input })[mode];
   if (mode === 'wishlist') assert.equal(clean.item, null);
   else if (mode === 'ebay') { assert.equal(clean.items.length, 1); assert.equal(clean.items[0].amount, 5); }
   else { assert.equal(clean.items[0].amount, null); assert.equal(clean.items[0].currency, 'USD'); }
  }
 }
});
test('Shop rejects malformed expiry before replacing the last good catalog', () => {
 const context = sourceFunction(shop, 'function catalog(next)', 'function draw()', { SSNMonetization: M });
 let state = context.catalog({ commerce: { items: [link], live: { mode: 'show', url: link.url, until: 0 } }, updated: 123 });
 for (const until of [false, [], {}, { toString: null }, 'Infinity', -1]) {
  assert.throws(() => { state = context.catalog({ commerce: { items: [], live: { mode: 'show', until } } }); }, /Invalid catalog expiry/);
  assert.equal(M.commerceCurrent(state.commerce, Date.now()).name, 'Mug');
 }
 state = context.catalog({ commerce: { items: [link], live: { mode: 'hide', until: 0 } } });
 assert.equal(M.commerceCurrent(state.commerce, Date.now()), null);
});
