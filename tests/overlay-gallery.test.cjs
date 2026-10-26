const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('docs/data/overlay-gallery.json'));
const ids=new Set(),paths=new Set(catalog.map(e=>e.path));
const collections=new Map();
for(const entry of catalog) {
  if(entry.collection) {
    assert(/^[a-z]+$/.test(entry.collection),'Invalid collection key');
    if(!collections.has(entry.collection))collections.set(entry.collection,new Set());
    assert(!collections.get(entry.collection).has(entry.category),'Duplicate collection surface');
    collections.get(entry.collection).add(entry.category);
  }
  assert(!ids.has(entry.id),'Duplicate gallery ID');ids.add(entry.id);
  assert(['chat','featured','alerts','widgets'].includes(entry.category));
  assert(!entry.tier||entry.tier==='community','Unknown tier: '+entry.tier);
  assert(fs.existsSync(path.join(root,entry.path.split('?')[0])),entry.path);
  const variants=entry.variants||[];
  if(variants.length) {
    assert(variants.length>1,'Single variant: '+entry.id);
    assert.strictEqual(variants[0].path,entry.path,'First variant must match the card: '+entry.id);
    variants.forEach(variant=>{assert(variant.label&&variant.path.split('?')[0]===entry.path.split('?')[0],'Variant page: '+entry.id);paths.add(variant.path);});
  }
  for(const image of [entry.image,...variants.map(v=>v.image)].flatMap(image=>[image,image.replace('.webp','-thumb.webp')])) {
    const file=path.join(root,'docs',image);
    assert(fs.existsSync(file),'Missing '+image);
    assert(fs.statSync(file).size>100,'Empty '+image);
  }
}
for(const [key,kinds] of collections)assert.deepStrictEqual([...kinds].sort(),['alerts','chat','featured'],'Incomplete matching set: '+key);
assert.strictEqual((read('docs/overlay-gallery.html').match(/class="gallery-use-set"/g)||[]).length,catalog.filter(e=>e.collection).length);
const popup=read('popup.html');
for(const id of ['overlay-preset-select','featured-preset-select']) {
  const block=popup.match(new RegExp('<select[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</select>'))[1];
  for(const match of block.matchAll(/<option value="([^"]*)"/g)) {
    const target=match[1]||'featured.html';
    if(paths.has(target))continue;
    const source=read(target);
    const style=source.match(/const style = urlParams.get\('style'\) \|\| '([^']+)'/);
    assert(style&&paths.has(target+'?style='+style[1]),'Preset missing from gallery: '+target);
  }
}
assert.strictEqual((read('docs/overlay-gallery.html').match(/class="gallery-card"/g)||[]).length,catalog.length);
assert.strictEqual((read('docs/overlay-gallery.html').match(/class="gallery-variant"/g)||[]).length,catalog.filter(e=>e.variants).length);
for(const kind of new Set(catalog.map(e=>e.category)))assert(read('docs/overlay-gallery.html').includes('data-category="'+kind+'"'),'Missing filter: '+kind);
for(const page of ['index.html','docs/index.html','docs/templates.html','themes/index.html'])assert(read(page).includes('overlay-gallery.html'),page+' discovery link');
console.log('PASS '+catalog.length+' gallery entries, screenshot pairs, preset coverage and navigation');
