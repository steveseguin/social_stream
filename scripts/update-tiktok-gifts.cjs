'use strict';

// Refresh the embedded browser table and SSApp's JSON together. No runtime network dependency.
// node scripts/update-tiktok-gifts.cjs --ssapp ../ssn_app
// Optional offline inputs: --catalog current-catalog.json --archive archived-tiktok-gifts.json
const fs = require('fs');
const path = require('path');

const CATALOG_URL = 'https://beetgames.com/tiktok-gifts.json';
const ARCHIVE_URL = 'https://gist.githubusercontent.com/alberand/ce890338db1a97af07802d5d59c72309/raw/0aec5100235ab5ed7ad399315aa333275ea8c45a/tiktok-gifts-list.json';
const TABLE_PATTERN = /let giftMapping = (\{[\s\S]*?\n\s*\});/;

function normalizeName(value) {
  return String(value || '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function imageKey(value) {
  return String(value || '').split(/[?#]/)[0].split('/').pop().split(/[.~]/)[0];
}

function buildMapping(existing, catalog, archive) {
  if (!Array.isArray(catalog.gifts) || catalog.gifts.length < 100) throw new Error('Missing or incomplete current catalog');
  if (!Array.isArray(archive.gifts)) throw new Error('Missing archived TikTok gift list');
  // Generated name entries are rebuilt, while existing image/ID aliases remain available.
  const mapping = Object.fromEntries(Object.entries(existing).filter(([key]) => !key.startsWith('name:')));
  const names = new Map();
  for (const gift of catalog.gifts) {
    const name = normalizeName(gift.name);
    if (!name || !Number.isSafeInteger(gift.coins) || gift.coins <= 0) continue;
    if (!names.has(name)) names.set(name, new Map());
    const prices = names.get(name);
    if (!prices.has(gift.coins)) prices.set(gift.coins, { name: gift.name.trim(), coins: gift.coins, regions: new Set() });
    // The publisher identifies RU as a historical listing, not a current regional catalog.
    for (const region of gift.regions || []) if (region !== 'RU') prices.get(gift.coins).regions.add(region);
  }
  if (names.size < 100) throw new Error('Too few valid named gift prices to replace the current catalog');
  let ambiguousNames = 0;
  let correctedAliases = 0;
  for (const [name, prices] of names) {
    if (prices.size > 1) ambiguousNames++;
    const candidates = [...prices.values()].sort((a, b) => b.regions.size - a.regions.size || a.coins - b.coins);
    mapping['name:' + name] = { name: candidates[0].name, coins: candidates[0].coins };
  }
  for (const [key, gift] of Object.entries(mapping)) {
    if (key.startsWith('name:')) continue;
    const name = normalizeName(gift.name);
    const prices = names.get(name);
    if (prices && prices.size === 1) {
      const coins = [...prices.keys()][0];
      if (coins !== gift.coins) { mapping[key] = { ...gift, coins }; correctedAliases++; }
    }
    if (name && !mapping['name:' + name]) mapping['name:' + name] = { ...mapping[key] };
  }
  let verifiedIds = 0;
  for (const gift of archive.gifts) {
    const prices = names.get(normalizeName(gift.name));
    // Archived identities help only when their price is corroborated by the current catalog.
    if (!Number.isSafeInteger(gift.id) || !prices || !prices.has(gift.diamond_count)) continue;
    const entry = { name: gift.name.trim(), coins: gift.diamond_count };
    mapping[String(gift.id)] = entry;
    verifiedIds++;
    for (const image of [gift.image, gift.icon]) {
      for (const url of [image && image.uri, ...((image && image.url_list) || [])]) {
        const key = imageKey(url);
        if (/^[a-f0-9]{16,64}$/i.test(key) && !Object.prototype.hasOwnProperty.call(mapping, key)) mapping[key] = entry;
      }
    }
  }
  return { mapping, stats: { currentNames: names.size, ambiguousNames, correctedAliases, verifiedIds, lookupEntries: Object.keys(mapping).length } };
}

async function readInput(file, url) {
  if (file) return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Catalog request failed: ' + response.status + ' ' + url);
  return response.json();
}

async function main() {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; };
  const appRoot = option('--ssapp');
  if (!appRoot) throw new Error('Specify --ssapp PATH so both capture tables are updated together');
  const sourcePath = path.resolve(__dirname, '../sources/tiktok.js');
  const appPath = path.resolve(appRoot, 'tiktok/gift-mapping.json');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(TABLE_PATTERN);
  if (!match) throw new Error('Browser gift table not found');
  const current = JSON.parse(match[1]);
  const appMapping = JSON.parse(fs.readFileSync(appPath, 'utf8'));
  const inputs = await Promise.all([readInput(option('--catalog'), CATALOG_URL), readInput(option('--archive'), ARCHIVE_URL)]);
  const { mapping, stats } = buildMapping({ ...appMapping, ...current }, ...inputs);
  const json = '{\n' + Object.entries(mapping).map(([key, gift]) => '  ' + JSON.stringify(key) + ': ' + JSON.stringify(gift)).join(',\n') + '\n}';
  const newline = match[0].includes('\r\n') ? '\r\n' : '\n';
  const replacement = 'let giftMapping = ' + json.replace(/\n/g, newline + '\t') + ';';
  // Use a callback so dollar signs in gift names cannot become replacement tokens.
  fs.writeFileSync(sourcePath, source.replace(TABLE_PATTERN, () => replacement));
  fs.writeFileSync(appPath, json + '\n');
  console.log(JSON.stringify({ catalogUpdatedAt: inputs[0].updated_at, ...stats }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildMapping, normalizeName, imageKey };
