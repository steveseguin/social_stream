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
  assert(['chat','featured','alerts'].includes(entry.category));
  assert(fs.existsSync(path.join(root,entry.path.split('?')[0])),entry.path);
  for(const image of [entry.image,entry.image.replace('.webp','-thumb.webp')]) {
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
for(const page of ['index.html','docs/index.html','docs/templates.html','themes/index.html'])assert(read(page).includes('overlay-gallery.html'),page+' discovery link');
console.log('PASS '+catalog.length+' gallery entries, screenshot pairs, preset coverage and navigation');
