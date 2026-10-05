'use strict';
// Rebuild the static, crawlable cards after changing docs/data/overlay-gallery.json.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/data/overlay-gallery.json'),'utf8'));
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const categories={chat:'Combined chat',featured:'Featured message',alerts:'Multi-alerts & events'};
const cards=catalog.map(entry=>{
  const title=escape(entry.name),image=escape(entry.image);
  const thumb=image.replace(/\.webp$/,'-thumb.webp');
  return `<article class="gallery-card" data-kind="${entry.category}"${entry.collection ? ` data-collection="${escape(entry.collection)}"` : ''} data-path="${escape(entry.path)}" data-search="${escape((entry.name+' '+entry.description+' '+entry.tags+' '+categories[entry.category]).toLowerCase())}">
  <a class="gallery-preview" href="${image}" data-screenshot data-title="${title}" aria-label="Enlarge ${title} screenshot"><img src="${thumb}" width="800" height="480" loading="lazy" decoding="async" alt="${title} overlay with sample messages"></a>
  <div class="gallery-card-content"><span class="gallery-category">${escape(categories[entry.category])}</span><h2>${title}</h2><p class="gallery-description">${escape(entry.description)}</p>
  <div class="gallery-card-actions"><a class="gallery-open" href="overlay-template-quick-start.html" target="_blank" rel="noopener">Open overlay</a><a href="${image}" data-screenshot data-title="${title}">View screenshot</a>${entry.collection ? '<button type="button" class="gallery-use-set" hidden>Use matching set</button>' : ''}</div></div>
</article>`;
}).join('\n');
const file=path.join(root,'docs/overlay-gallery.html');
const html=fs.readFileSync(file,'utf8').replace(/<!-- GALLERY_CARDS_START -->[\s\S]*?<!-- GALLERY_CARDS_END -->/,'<!-- GALLERY_CARDS_START -->\n'+cards+'\n<!-- GALLERY_CARDS_END -->');
fs.writeFileSync(file,html);
console.log('Built '+catalog.length+' gallery cards');
