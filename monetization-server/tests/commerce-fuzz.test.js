import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { paidSales, publicItem } from '../ebay-showcase.js';
import { paidOrder } from '../shopify-relay.js';
import { order } from './ebay-fixture.js';
const M = createRequire(import.meta.url)('../../shared/monetization/core.js');

// Fixed seed makes unexpected boundary failures reproducible without network/accounts.
function generator() {
 let seed = 0x53534e;
 const next = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
 const atoms = [null, false, true, 0, -1, 1e20, '', 'USD', '__proto__', '<script>private</script>'];
 function value(depth = 0) {
  if (depth > 2 || next(3) === 0) return atoms[next(atoms.length)];
  if (next(2)) return Array.from({ length: next(5) }, () => value(depth + 1));
  const result = {};
  for (const key of ['data', 'name', 'amount', 'currency', 'items', 'id', 'event_type', 'variants', 'images']) if (next(2)) result[key] = value(depth + 1);
  return result;
 }
 return value;
}

test('10,000 deterministic JSON inputs do not crash public normalizers or provider boundaries', () => {
 const random = generator();
 for (let i = 0; i < 10000; i++) {
  const value = random();
  assert.doesNotThrow(() => {
   const c = M.commerce(value);
   assert(c.items.length <= 20);
   M.config(value); M.item(value); M.ladder(value, ''); M.tip(value); M.throne(value);
   M.fourthwallProduct(value, 'https://example.invalid/products/mug'); M.shopifyProduct(value);
   for (const provider of ['kofi', 'bmac', 'fourthwall']) M.providerEvent(provider, value, 'fixture');
   paidSales(value); paidOrder(value, 'fixture.myshopify.com');
  }, 'seed 0x53534e input ' + i + ': ' + JSON.stringify(value));
 }
});

test('Malformed eBay orders cannot invent a sold quantity or crash another sale', () => {
 for (const quantity of [undefined, null, false, true, '', '2', 0, -1, 0.5, 100001]) {
  const bad = order(); bad.lineItems[0].quantity = quantity;
  assert.deepEqual(paidSales([bad]), []);
 }
 const good = order();
 assert.equal(paidSales([null, {}, { ...good, lineItems: {} }, { ...good, lineItems: [null] }, good]).length, 1);
 assert.equal(paidSales([{ ...good, paymentSummary: { payments: [null, {}] } }])[0].paidAt, 0);
});

test('Prices, currency and event types cannot be supplied as JSON arrays or coercion objects', () => {
 const link = { name: 'Mug', url: 'https://example.invalid/mug' };
 for (const invalid of [[], ['USD'], {}, { toString: null }, true]) {
  assert.equal(M.tip({ type: 'tip', id: 'fixture', amount: 5, currency: invalid }), null);
  assert.equal(M.throne({ contract_version: '1', event_id: 'fixture', event_type: 'gift_purchased', data: { item_name: 'Mug', price: 500, currency: invalid } }), null);
  const c = M.commerce({ items: [{ ...link, currency: invalid, amount: invalid }], seconds: invalid });
  assert.equal(c.items[0].currency, 'USD');
  assert.equal(c.items[0].amount, null);
  assert.equal(c.seconds, 30);
  assert.equal(M.item({ ...link, amount: invalid }), null);
 }
 assert.equal(M.throne({ contract_version: '1', event_id: 'fixture', event_type: ['gift_purchased'], data: { item_name: 'Mug', price: 500, currency: 'USD' } }), null);
});

test('Malformed eBay prices never become a free listing', () => {
 for (const value of [null, false, true, '', [], {}, { toString: null }, 'Infinity', '0x10']) {
  assert.throws(() => publicItem({ title: 'Mug', price: { value, currency: 'USD' } }, '123456789012'), error => error.statusCode === 400);
 }
 assert.throws(() => publicItem(null, '123456789012'), error => error.statusCode === 400);
 const item = publicItem({ title: 'Mug', buyingOptions: {}, estimatedAvailabilities: [null], price: { value: '12.50', currency: 'USD' } }, '123456789012');
 assert.equal(item.amount, 12.5);
 assert.equal(item.available, true);
});
