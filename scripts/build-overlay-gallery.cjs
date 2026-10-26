'use strict';
// Rebuild the static, crawlable cards after changing docs/data/overlay-gallery.json.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/data/overlay-gallery.json'),'utf8'));
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const categories={chat:'Combined chat',featured:'Featured message',alerts:'Multi-alerts & events',widgets:'Widgets'};
const cards=catalog.map(entry=>{
  const title=escape(entry.name),image=escape(entry.image),community=entry.tier==='community';
  // Near-identical styles share one card; the select swaps its path and preview.
  const variants=entry.variants?`<label class="gallery-variant">Variant <select>${entry.variants.map(v=>`<option value="${escape(v.path)}" data-image="${escape(v.image)}">${escape(v.label)}</option>`).join('')}</select></label>`:'';
  const search=entry.name+' '+entry.description+' '+entry.tags+' '+categories[entry.category]+(community?' community':'')+(entry.variants?' '+entry.variants.map(v=>v.label).join(' '):'');
  const thumb=image.replace(/\.webp$/,'-thumb.webp');
  return `<article class="gallery-card"${entry.collection && entry.category === 'featured' ? ` id="pack-${escape(entry.collection)}"` : ''} data-kind="${entry.category}"${entry.collection ? ` data-collection="${escape(entry.collection)}"` : ''} data-path="${escape(entry.path)}"${community ? ' data-tier="community"' : ''} data-search="${escape(search.toLowerCase())}">
  <a class="gallery-preview" href="${image}" data-screenshot data-title="${title}" aria-label="Enlarge ${title} screenshot"><img src="${thumb}" width="800" height="480" loading="lazy" decoding="async" alt="${title} overlay with sample messages"></a>
  <div class="gallery-card-content"><span class="gallery-category">${escape(categories[entry.category])}${community ? '<span class="gallery-tier"> &middot; Community</span>' : ''}</span><h2>${title}</h2><p class="gallery-description">${escape(entry.description)}</p>${variants}
  <div class="gallery-card-actions"><a class="gallery-open" href="overlay-template-quick-start.html" target="_blank" rel="noopener">Open overlay</a><a href="${image}" data-screenshot data-title="${title}">View screenshot</a>${entry.collection ? '<button type="button" class="gallery-use-set" hidden>Use matching set</button>' : ''}</div></div>
</article>`;
}).join('\n');
const file=path.join(root,'docs/overlay-gallery.html');
const html=fs.readFileSync(file,'utf8').replace(/<!-- GALLERY_CARDS_START -->[\s\S]*?<!-- GALLERY_CARDS_END -->/,'<!-- GALLERY_CARDS_START -->\n'+cards+'\n<!-- GALLERY_CARDS_END -->');
fs.writeFileSync(file,html);
console.log('Built '+catalog.length+' gallery cards');
