const fs = require('fs');

function loadJSON(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }
function saveJSON(path, obj) { fs.writeFileSync(path, JSON.stringify(obj, null, 2)); }

const missing = loadJSON('tools/missing_en_details.json');
const en = loadJSON('translations/en-us.json');

if (!en.innerHTML) en.innerHTML = {};

let added = 0;
for (const item of missing) {
  const { key, htmlNorm } = item;
  if (!key) continue;
  if (!htmlNorm) continue; // skip empty
  if (!(key in en.innerHTML)) {
    en.innerHTML[key] = htmlNorm;
    added++;
  }
}

saveJSON('translations/en-us.json', en);
console.log(`Added ${added} keys to en-us.json`);

