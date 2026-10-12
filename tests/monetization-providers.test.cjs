const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../shared/monetization/core.js');
test('Ko-fi retains public tips and adds memberships and purchases', () => {
 const base = { type: 'Donation', is_public: true, from_name: 'Jess', amount: '5.00', currency: 'USD', message: '<b>hello</b>' };
 assert.equal(M.providerEvent('kofi', base, '1').donoValue, 5);
 assert.equal(M.providerEvent('kofi', { ...base, is_public: false }, '2'), null);
 const member = M.providerEvent('kofi', { ...base, type: 'Subscription', tier_name: 'Gold', is_first_subscription_payment: true }, '3');
 assert.equal(member.event, 'new_subscriber'); assert.equal(member.membership, 'Gold'); assert.equal(member.donoValue, 5);
 const shop = M.providerEvent('kofi', { ...base, type: 'Shop Order', shop_items: [{ item_name: 'Print' }] }, '4');
 assert.equal(shop.event, 'purchase'); assert.equal(shop.subtitle, 'Print'); assert.equal(shop.hasDonation, undefined); assert.equal(shop.textonly, true);
});
test('Buy Me a Coffee handles paid commerce and wishlist contributions without private notes or test payments', () => {
 const data = { id: 42, amount: 5, currency: 'USD', status: 'succeeded', supporter_name: 'Jess', support_note: 'private note', note_hidden: 'true', supporter_email: 'secret@example.invalid' };
 const event = { type: 'wishlist_payment.created', live_mode: true, data: { ...data, wishlist: { title: 'Camera', completed: true, price: 500 } } };
 const row = M.providerEvent('bmac', event, '1');
 assert.equal(row.event, 'giftcontribution'); assert.equal(row.donoValue, 5); assert.equal(row.meta.commerce.completed, true); assert.equal(row.chatmessage, '');
 assert(!JSON.stringify(row).includes('secret@')); assert(!JSON.stringify(row).includes('private note'));
 assert.equal(M.providerEvent('bmac', { ...event, live_mode: false }, '2'), null);
 assert.equal(M.providerEvent('bmac', { ...event, type: 'wishlist_payment.refunded' }, '3'), null);
 assert.equal(M.providerEvent('bmac', { ...event, data: { ...data, status: 'pending' } }, '4'), null);
 const shop = M.providerEvent('bmac', { type: 'extra_purchase.created', data: { ...data, extras: [{ title: 'A print' }] } }, '5');
 assert.equal(shop.event, 'purchase'); assert.equal(shop.hasDonation, undefined); assert.equal(shop.subtitle, 'A print');
 const member = M.providerEvent('bmac', { type: 'membership.started', data: { ...data, status: 'active', membership_level_name: 'Gold' } }, '6');
 assert.equal(member.event, 'new_subscriber'); assert.equal(member.membership, 'Gold'); assert.equal(member.hasDonation, undefined);
});
test('Fourthwall preserves existing order donation values but never exposes billing identity', () => {
 const data = { amounts: { total: { value: 25, currency: 'USD' } }, billing: { address: { name: 'Private name' } }, offers: [{ name: 'T-shirt' }] };
 const row = M.providerEvent('fourthwall', { type: 'ORDER_PLACED', data }, '1');
 assert.equal(row.event, 'purchase'); assert.equal(row.donoValue, 25);
 const redemption = M.providerEvent('fourthwall', { type: 'ORDER_PLACED', data: { ...data, amounts: { ...data.amounts, giftCards: [{ amountUsed: { value: 25, currency: 'USD' } }] } } }, 'redemption');
 assert.equal(redemption.hasDonation, undefined); assert.equal(redemption.event, 'purchase'); assert.equal(row.meta.commerce.legacyDonationValue, true); assert.equal(row.chatname, 'Anonymous');
 assert.equal(M.providerEvent('fourthwall', { type: 'ORDER_UPDATED', data }, '2'), null);
 assert.equal(M.providerEvent('fourthwall', { type: 'ORDER_PLACED', testMode: true, data }, '3'), null);
 assert.equal(M.providerEvent('fourthwall', { type: 'GIFT_PURCHASE', data: { ...data, offer: { name: 'Gift shirt' } } }, '4').event, 'gift');
 assert.equal(M.providerEvent('fourthwall', { type: 'DONATION', data }, '5').donoValue, 25);
});
test('manual catalog sanitizes links, caps entries and supports blank prices and rotation', () => {
 const input = { enabled: true, items: [{ name: 'Store', url: 'https://example.com/shop', purpose: 'shop' }, { name: 'Gift', url: 'https://example.com/gift', amount: 12, currency: 'EUR', purpose: 'gift' }, { name: 'Bad', url: 'javascript:alert(1)' }] };
 const c = M.config({ commerce: input }).commerce;
 assert.equal(c.items.length, 2); assert.equal(c.items[0].amount, null); assert.equal(c.qr, true);
 assert.equal(M.commerceCurrent(c, 0).name, 'Store'); assert.equal(M.commerceCurrent(c, 30000).name, 'Gift');
 c.display = 'first'; assert.equal(M.commerceCurrent(c, 30000).name, 'Store');
 assert.equal(M.commerce({ items: Array(30).fill(input.items[0]) }).items.length, 20);
 assert.equal(M.config({ presentation: { view: 'bad', scale: 100, onlytype: 'kofi, bad source,bmac' } }).presentation.onlytype, 'kofi,bmac');
});

test('Fourthwall import excludes hidden and unavailable products and ambiguous prices', () => {
 const p = { name: 'Print', slug: 'print', state: { type: 'AVAILABLE' }, access: { type: 'PUBLIC' }, variants: [{ unitPrice: { value: 25, currency: 'USD' } }], images: [{ url: 'https://example.com/print.jpg' }] };
 const url = 'https://shop.example/products/print?tracking=drop#details';
 assert.equal(M.fourthwallProduct(p, url).amount, 25); assert.equal(M.fourthwallProduct(p, url).url, 'https://shop.example/products/print');
 assert.equal(M.fourthwallProduct({ ...p, access: { type: 'PRIVATE' } }, url), null);
 assert.equal(M.fourthwallProduct({ ...p, state: { type: 'SOLD_OUT' } }, url), null);
 assert.equal(M.fourthwallProduct(p, 'https://shop.example/products/other'), null);
 assert.equal(M.fourthwallProduct({ ...p, variants: [...p.variants, { unitPrice: { value: 30, currency: 'USD' } }] }, url).amount, null);
 assert.equal(M.fourthwallProduct({ ...p, type: 'BUNDLE' }, url).amount, null);
 assert.equal(M.fourthwallProduct({ ...p, images: [{ url: 'javascript:alert(1)' }] }, url).image, '');
});

test('Shopify import preserves canonical public links, images and decimal currencies without guessing variant prices', () => {
 const p = { title: 'Creator shirt', availableForSale: true, onlineStoreUrl: 'https://shop.example/products/shirt', featuredImage: { url: 'https://cdn.shopify.com/shirt.png' }, priceRange: { minVariantPrice: { amount: '2500', currencyCode: 'JPY' }, maxVariantPrice: { amount: '2500', currencyCode: 'JPY' } } };
 const result = M.shopifyProduct(p); assert.equal(result.amount, 2500); assert.equal(result.currency, 'JPY'); assert.equal(result.url, p.onlineStoreUrl); assert.equal(result.image, p.featuredImage.url);
 assert.equal(M.shopifyProduct({ ...p, availableForSale: false }), null);
 assert.equal(M.shopifyProduct({ ...p, onlineStoreUrl: null }), null);
 assert.equal(M.shopifyProduct({ ...p, priceRange: { ...p.priceRange, maxVariantPrice: { amount: '3000', currencyCode: 'JPY' } } }).amount, null);
 assert.equal(M.shopifyDomain('https://store.myshopify.com'), ''); assert.equal(M.shopifyDomain('store.myshopify.com.evil.test'), ''); assert.equal(M.shopifyDomain(' STORE.myshopify.com '), 'store.myshopify.com');
});
