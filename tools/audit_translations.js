const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function loadJSON(path) {
  return JSON.parse(read(path));
}

function htmlEntityDecode(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function normalizeText(html) {
  if (!html) return '';
  const noTags = html.replace(/<[^>]*>/g, '');
  const decoded = htmlEntityDecode(noTags);
  return decoded.replace(/[\s\n\t\r]+/g, ' ').trim();
}

function extractElementsWithDataTranslate(html) {
  const results = [];
  const regex = /<([a-zA-Z0-9]+)([^>]*?)data-translate=\"([^\"]+)\"([^>]*)>/g;
  let m;
  while ((m = regex.exec(html))) {
    const tag = m[1].toLowerCase();
    const key = m[3];
    const startIdx = m.index + m[0].length;
    let inner = '';
    if (tag === 'input' || tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'meta' || tag === 'link') {
      // self-closing or void elements
      inner = '';
    } else {
      // naive search for closing tag of same type
      const closeTag = new RegExp(`</${tag}\\s*>`, 'ig');
      closeTag.lastIndex = startIdx;
      const closeMatch = closeTag.exec(html);
      if (closeMatch) {
        inner = html.slice(startIdx, closeMatch.index);
      } else {
        inner = '';
      }
    }
    results.push({ tag, key, inner });
  }
  return results;
}

function main() {
  const html = read('popup.html');
  const en = loadJSON('translations/en-us.json');
  const de = loadJSON('translations/de.json');

  const innerEN = en.innerHTML || {};
  const innerDE = de.innerHTML || {};

  const els = extractElementsWithDataTranslate(html);

  const byKey = new Map();
  for (const el of els) {
    const n = normalizeText(el.inner);
    if (!byKey.has(el.key)) byKey.set(el.key, []);
    byKey.get(el.key).push({ text: n, tag: el.tag });
  }

  const report = {
    duplicatedKeyWithDifferentText: [],
    keyMissingInEN: [],
    keyMissingInENDetailed: [],
    keyENvsHTMLMismatch: [],
    germanSameAsEnglish: [],
    germanMissing: [],
    germanMissingDetailed: [],
    germanDuplicatesAcrossDifferentEnglish: []
  };

  // Determine duplicates where the same key maps to different text content in HTML
  for (const [key, arr] of byKey.entries()) {
    const set = new Set(arr.map(x => x.text));
    if (set.size > 1) {
      report.duplicatedKeyWithDifferentText.push({ key, variants: Array.from(set) });
    }

    // Compare EN canonical value (if present) with observed HTML text content
    if (key in innerEN || (en.placeholders && key in en.placeholders)) {
      const enValNorm = normalizeText(innerEN[key]);
      for (const t of set) {
        if (t && enValNorm && t !== enValNorm) {
          report.keyENvsHTMLMismatch.push({ key, htmlText: t, enText: enValNorm });
        }
      }
    } else {
      report.keyMissingInEN.push(key);
      // choose a representative raw inner (first occurrence)
      const htmlRaw = arr[0]?.inner || '';
      const htmlRawTrimmed = htmlRaw.replace(/[\s\n\t\r]+/g, ' ').trim();
      report.keyMissingInENDetailed.push({ key, htmlRaw: htmlRawTrimmed, htmlNorm: Array.from(set)[0] || '' });
    }

    // German checks
    const deHas = (innerDE && key in innerDE) || (de.placeholders && key in de.placeholders);
    if (!deHas) {
      report.germanMissing.push(key);
      const htmlRaw = arr[0]?.inner || '';
      const htmlRawTrimmed = htmlRaw.replace(/[\s\n\t\r]+/g, ' ').trim();
      report.germanMissingDetailed.push({ key, enValue: innerEN[key] || '', htmlRaw: htmlRawTrimmed, htmlNorm: Array.from(set)[0] || '' });
    } else {
      const deVal = normalizeText(innerDE[key]);
      const enVal = normalizeText(innerEN[key] || '');
      if (deVal && enVal && deVal === normalizeText(innerEN[key] || '')) {
        // German identical to English
        report.germanSameAsEnglish.push({ key, value: innerDE[key] });
      }
    }
  }

  // Build reverse map of German value -> keys, to detect duplicates across different English texts
  const usedKeys = Array.from(byKey.keys());
  const deReverse = new Map();
  for (const key of usedKeys) {
    if (!(key in innerDE)) continue;
    const v = normalizeText(innerDE[key]);
    if (!deReverse.has(v)) deReverse.set(v, []);
    deReverse.get(v).push(key);
  }

  for (const [val, keys] of deReverse.entries()) {
    if (val && keys.length > 1) {
      // check if English values differ
      const enVals = keys.map(k => normalizeText(innerEN[k] || '')); 
      const enSet = new Set(enVals);
      if (enSet.size > 1) {
        report.germanDuplicatesAcrossDifferentEnglish.push({ value: val, keys, enVals: Array.from(enSet) });
      }
    }
  }

  // Print concise report
  function printSection(title, arr, limit = 50) {
    console.log(`\n=== ${title} (${arr.length}) ===`);
    for (let i = 0; i < Math.min(arr.length, limit); i++) {
      console.log(arr[i]);
    }
    if (arr.length > limit) console.log(`... and ${arr.length - limit} more`);
  }

  printSection('Same key used with different HTML text', report.duplicatedKeyWithDifferentText, 200);
  printSection('Keys used in HTML but missing in en-us.json', report.keyMissingInEN, 200);
  printSection('Missing EN key details', report.keyMissingInENDetailed, 400);

  try {
    fs.writeFileSync('tools/missing_en_details.json', JSON.stringify(report.keyMissingInENDetailed, null, 2));
  } catch (e) {
    // ignore
  }
  printSection('HTML text vs EN text mismatches', report.keyENvsHTMLMismatch, 200);
  printSection('German translations missing', report.germanMissing, 200);
  printSection('Missing German key details', report.germanMissingDetailed, 400);
  try { fs.writeFileSync('tools/missing_de_details.json', JSON.stringify(report.germanMissingDetailed, null, 2)); } catch(e) {}

  // Multi-language audit for other locales vs EN (innerHTML only)
  const otherLangs = ['es', 'pt-br', 'tr', 'uk'];
  for (const lang of otherLangs) {
    const path = `translations/${lang}.json`;
    if (!fs.existsSync(path)) continue;
    const data = loadJSON(path);
    const inner = data.innerHTML || {};
    const missing = [];
    for (const key of Array.from(byKey.keys())) {
      if (!(key in inner)) missing.push({ key, en: innerEN[key] || '', html: (byKey.get(key)[0]?.inner || '').replace(/[\s\n\t\r]+/g, ' ').trim() });
    }
    try { fs.writeFileSync(`tools/missing_${lang}_details.json`, JSON.stringify(missing, null, 2)); } catch(e) {}
  }
  printSection('German equals English (likely untranslated)', report.germanSameAsEnglish, 200);
  try { fs.writeFileSync('tools/german_equals.json', JSON.stringify(report.germanSameAsEnglish, null, 2)); } catch(e) {}
  printSection('German duplicates across different English phrases', report.germanDuplicatesAcrossDifferentEnglish, 200);
}

main();
