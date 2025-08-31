const fs = require('fs');

function loadJSON(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function saveJSON(p,o){fs.writeFileSync(p, JSON.stringify(o,null,2));}

const src = loadJSON('translations/en-us.json');
const locales = process.argv.slice(2);
if (!locales.length) {
  console.log('Usage: node tools/fill_missing_from_en.js <locale> [locale2...]');
  process.exit(0);
}

for (const loc of locales) {
  const p = `translations/${loc}.json`;
  const data = loadJSON(p);
  data.innerHTML = data.innerHTML || {};
  let added=0;
  for (const [k,v] of Object.entries(src.innerHTML||{})){
    if (!(k in data.innerHTML)) { data.innerHTML[k]=v; added++; }
  }
  // Also merge placeholders/titles if present
  data.placeholders = data.placeholders || {};
  for (const [k,v] of Object.entries(src.placeholders||{})){
    if (!(k in data.placeholders)) { data.placeholders[k]=v; }
  }
  data.titles = data.titles || {};
  for (const [k,v] of Object.entries(src.titles||{})){
    if (!(k in data.titles)) { data.titles[k]=v; }
  }
  saveJSON(p, data);
  console.log(`${loc}: added ${added} innerHTML keys from en-us`);
}

