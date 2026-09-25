'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convertToUSD, getDonationValueUSD, getCreditsDonationValue } = require('../currency.js');
const monetization = require('../shared/monetization/core.js');
const fs = require('node:fs');
const vm = require('node:vm');

test('source USD overrides labels and original currency metadata without mutating either', () => {
  const message = { type: 'tiktok', hasDonation: '100 gifts', donoValue: 7.25, meta: { amount: 100, currency: 'coins' } };
  const before = JSON.stringify(message);
  assert.equal(getDonationValueUSD(message), 7.25);
  assert.equal(getCreditsDonationValue(message), 7.25);
  assert.equal(JSON.stringify(message), before);
  assert.equal(getDonationValueUSD({ ...message, donoValue: 0 }), 0);
  assert.equal(getDonationValueUSD({ ...message, donoValue: '0' }), 0);
  assert.equal(getDonationValueUSD({ donoValue: 0, donationValue: 50 }), 0);
  assert.equal(getDonationValueUSD({ donationValue: 5 }), 5);
  assert.equal(getDonationValueUSD({ hasDonation: '10 CAD', donationValue: 50 }), convertToUSD('10 CAD'));
});

test('missing or invalid overrides fall back to labelled conversion', () => {
  for (const value of [undefined, null, '', ' ', false, {}, NaN, Infinity, '10 coins']) {
    assert.equal(getDonationValueUSD({ type: 'twitch', hasDonation: '500 bits', donoValue: value }), 5);
  }
  assert.equal(getDonationValueUSD({ hasDonation: 'EUR 10' }), convertToUSD('10 EUR'));
  assert.equal(getDonationValueUSD({ hasDonation: 'tip', meta: { amount: 10, currency: 'CAD' } }), convertToUSD('10 CAD'));
});

test('unpriced TikTok gifts use one coin each, retaining known unit conversions', () => {
  for (const label of ['3 gifts', '3 Mystery Gifts', '3 roses', '3 coins']) {
    assert.equal(getDonationValueUSD({ type: 'tiktok', hasDonation: label }), 0.03);
    assert.equal(getCreditsDonationValue({ type: 'tiktok', hasDonation: label }), 0.03);
  }
  assert.equal(convertToUSD('1 gift', 'tiktok'), 0.01);
  assert.equal(convertToUSD('Mystery Gift', 'tiktok'), 0.01);
  assert.equal(convertToUSD('3 diamonds', 'tiktok'), 0.015);
  assert.equal(convertToUSD('3 coins', 'youtube'), 0.03);
  assert(Math.abs(convertToUSD('3 UnknownUnits', 'youtube') - 0.0003) < 1e-10);
  assert.equal(getDonationValueUSD({ type: 'tiktok' }), 0);
});

test('foreign-currency source adapters supply USD and retain original amounts', () => {
  const tip = monetization.tip({ type: 'tip', amount: 10, currency: 'EUR', name: 'Donor', tipId: 'eur-1' });
  assert(tip, 'valid NinjaBacker tip');
  assert.equal(tip.donoValue, convertToUSD('10 EUR'));
  assert.equal(tip.meta.ninjabacker.amount, 10);
  assert.equal(tip.meta.ninjabacker.currency, 'EUR');
  assert.equal(getDonationValueUSD(tip), tip.donoValue);
});

test('browser adapters defer foreign currency conversion when the shared helper is unavailable', () => {
  const context = { module: { exports: {} }, URL, require() { throw new Error('Browser require must not be used'); } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../shared/monetization/core.js'), 'utf8'), context);
  const tip = context.SSNMonetization.tip({ type: 'tip', amount: 10, currency: 'EUR', name: 'Donor', tipId: 'eur-2' });
  assert.equal(tip.donoValue, undefined);
  assert.equal(getDonationValueUSD(tip), convertToUSD('10 EUR'));
});

test('standalone server packaging without currency.js retains a convertible foreign amount', () => {
  const context = { module: { exports: {} }, URL, require() { throw new Error('Module not packaged'); } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../shared/monetization/core.js'), 'utf8'), context);
  const tip = context.module.exports.tip({ type: 'tip', amount: 10, currency: 'EUR', tipId: 'eur-3' });
  assert.equal(tip.donoValue, undefined);
  assert.equal(getDonationValueUSD(tip), convertToUSD('10 EUR'));
});
