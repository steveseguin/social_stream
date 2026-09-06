// Static shared navigation: no fetch, framework, or client-side header replacement.
// Run after changing this template; --check verifies published HTML is in sync.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const files=['index.html',...fs.readdirSync(path.join(root,'docs')).filter(n=>n.endsWith('.html')).map(n=>'docs/'+n)];
const links=[['Home','index.html'],['Features','docs/features.html'],['Inspiration','docs/inspiration.html'],['Gallery','docs/overlay-gallery.html'],['Guides','docs/guides.html'],['API','docs/commands.html'],['Supported sites','docs/supported-sites.html'],['Support','docs/support.html'],['Download','docs/download.html']];
let count=0,stale=[];
for(const file of files){
 const absolute=path.join(root,file),original=fs.readFileSync(absolute,'utf8');
 if(!original.includes('css/styles.css')&&!original.includes('css/inspiration.css')&&!['docs/index.html','docs/chat-games.html'].includes(file))continue;
 const reader=file==='docs/index.html',gallery=file==='docs/overlay-gallery.html';
 if(!reader&&!gallery&&!/<header(?:\s[^>]*)?>[\s\S]*?<\/header>/.test(original))continue;
 const href=target=>path.posix.relative(path.posix.dirname(file),target)||'index.html';
 const active=target=>file===target||(target==='docs/inspiration.html'&&file==='docs/sticker-gallery.html')||(target==='docs/guides.html'&&!links.some(l=>l[1]===file)&&file!=='docs/sticker-gallery.html');
 const header=`<!-- SSN shared header -->\n<header class="site-header"><div class="site-bar"><a class="site-brand" href="${href('index.html')}"><img src="${href('icons/logo.svg')}" width="32" height="32" alt=""><span>Social Stream Ninja</span></a><nav class="site-nav" id="ssn-site-nav" aria-label="Main navigation">${links.map(([label,target])=>`<a href="${href(target)}"${active(target)?' aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="site-actions"><a class="site-download" href="${href('docs/download.html')}">Get SSN</a><button class="site-theme" type="button" aria-label="Switch theme">Theme</button><button class="site-menu" type="button" aria-expanded="false" aria-controls="ssn-site-nav">Menu</button></div></div></header>\n<!-- /SSN shared header -->`;
 const footLinks=[...links.slice(1),['Sticker packs','docs/sticker-gallery.html'],['Games','docs/chat-games.html'],['Hire','docs/services.html'],['GitHub','https://github.com/steveseguin/social_stream'],['Discord','https://discord.socialstream.ninja'],['Donate','https://github.com/sponsors/steveseguin']];
 const footer=`<!-- SSN shared footer -->\n<footer class="site-footer"><div class="site-footer-top"><div><strong>Social Stream Ninja</strong><p>Bring your chats together. Make the stream your own. Free and open source.</p></div><div class="site-footer-links">${footLinks.map(([label,target])=>`<a href="${target.startsWith('https:')?target:href(target)}">${label}</a>`).join('')}</div></div><div class="site-legal"><span>© <span id="current-year">2026</span> Social Stream Ninja · GPLv3</span><a href="${href('privacy.html')}">Privacy</a><a href="${href('TOS.html')}">Terms</a><a href="https://github.com/steveseguin">Created by Steve Seguin &amp; the community</a></div></footer>\n<!-- /SSN shared footer -->`;
 let text=original.replace(/<!-- SSN shared header -->[\s\S]*?<!-- \/SSN shared header -->/,header);
 if(!original.includes('<!-- SSN shared header -->'))text=reader?text.replace(/<body([^>]*)>/,`<body$1>\n${header}`):gallery?text.replace(/<div class="gallery-topbar"[\s\S]*?<\/div>/,header):text.replace(/<header(?:\s[^>]*)?>[\s\S]*?<\/header>/,header);
 if(text.includes('<!-- SSN shared footer -->'))text=text.replace(/<!-- SSN shared footer -->[\s\S]*?<!-- \/SSN shared footer -->/,footer);
 else if(!reader){ const at=text.lastIndexOf('<footer');if(at>=0){const end=text.indexOf('</footer>',at)+9;text=text.slice(0,at)+footer+text.slice(end);}else text=text.replace('</body>',footer+'\n</body>'); }
 if(!text.includes('css/site-shell.css'))text=text.replace('</head>',`<link rel="stylesheet" href="${href('docs/css/site-shell.css')}">\n<script src="${href('docs/js/site-shell.js')}"></script>\n</head>`);
 if(!/class="[^"]*site-page/.test(text))text=text.replace(/<body([^>]*)>/,(_,attrs)=>'<body'+(attrs.includes('class="')?attrs.replace('class="','class="site-page '):attrs+' class="site-page'+(reader?' site-reader':'')+'"')+'>');
 if(['docs/inspiration.html','docs/sticker-gallery.html'].includes(file)&&!text.includes('site-editorial'))text=text.replace('class="site-page','class="site-page site-editorial');
 if(file==='docs/chat-games.html'&&!text.includes('site-game-guide'))text=text.replace('class="site-page','class="site-page site-game-guide');
 if(text!==original){stale.push(file);if(!process.argv.includes('--check'))fs.writeFileSync(absolute,text);}
 count++;
}
console.log(`${count} public pages; ${stale.length} ${process.argv.includes('--check')?'out of sync':'updated'}`);
if(process.argv.includes('--check')&&stale.length){console.error(stale.join('\n'));process.exitCode=1;}
