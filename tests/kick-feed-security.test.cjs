// Offline regression test of the actual Kick capture and preview.
// Run with Playwright available: node tests/kick-feed-security.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'sources/websocket/kick.js'),'utf8');
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const probe='<img src="data:image/png;base64,broken" onerror="window.__feedHits++">';
const samples=[
 'Hello world', '  whitespace\tand\nnewlines  ', 'A & B < 3 > 1', 'Quotes "and\'"',
 'café 👋🏽', 'Hello [emote:123:Wave]!', '[STICKER:456:Party]',
 '[emote:123:Wave][sticker:456:Party]', '[emote:123:R&D "quote" <label>]',
 '[emote:123:&quot; &amp; &lt;b&gt;]', '[emote:bad:not-an-emote]',
 '<b>typed tags</b>', '&lt;b&gt; &amp; &#39;', '[emote:123:unfinished'
];
const corpus=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/xss-corpus.json'),'utf8'));
corpus.push({name:'message image handler',input:probe},
 {name:'emote label breakout',input:'[emote:123:" onload="window.__feedHits++" x="]'},
 {name:'sticker label markup',input:'[sticker:123:'+probe+']'});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const summary={};
 try {
  async function open(legacyPreview = false) {
   const page=await browser.newPage();
   await page.route('**/*',route=>route.abort());
   await page.setContent('<!doctype html><div id="review-feed"></div>');
   await page.evaluate(()=>{window.__kickWsBootstrapped=true;window.__feedHits=0;window.__feedErrors=[];
    window.alert=window.confirm=window.prompt=()=>window.__feedHits++;
    console.error=(...args)=>window.__feedErrors.push(args.map(String).join(' '));});
   await page.addScriptTag({content:source});
   await page.evaluate(()=>{
    applyKickCoreFallbacks();els.chatFeed=document.querySelector('#review-feed');
    window.__outbound=[];pushMessage=message=>__outbound.push(JSON.parse(JSON.stringify(message)));
   });
   if (legacyPreview) {
    // Positive control: reproduce the old preview behavior by treating its body as rich HTML.
    // The copied flag only affects the preview; capture and outgoing payloads remain real.
    await page.evaluate(()=>{
     const render=appendChatFeedMessage;
     appendChatFeedMessage=(message,plainText)=>render(Object.assign({},message,{textonly:false}),plainText);
    });
   }
   return page;
  }
  const baseline=await open(true),fixed=await open();
  async function run(page,content,textonly,replyText) {
   return page.evaluate(async ({content,textonly,replyText,pixel})=>{
    __outbound=[];__feedHits=0;__feedErrors=[];els.chatFeed.textContent='';state.chatMessageCache.clear();
    extension.settings.textonlymode={setting:textonly};settings.excludeReplyingTo=false;
    const message={id:'review-message',content};
    if(replyText!==undefined) message.reply_to={id:'review-parent',content:replyText,sender:{username:'Parent'}};
    await forwardChatMessage({message,sender:{id:1,username:'Viewer',display_name:'Viewer',profile_picture:pixel}});
    await new Promise(resolve=>setTimeout(resolve,50));
    const body=els.chatFeed.querySelector('.chat-message');
    return {outbound:__outbound,errors:__feedErrors,hits:__feedHits,body:body && body.innerHTML,
      text:body && body.textContent,
      unsafeElements:body ? Array.from(body.querySelectorAll('*')).filter(el=>
        el.localName!=='img' || Array.from(el.attributes).some(attr=>/^on/i.test(attr.name))
      ).map(el=>el.outerHTML):[],images:body ? Array.from(body.querySelectorAll('img')).map(img=>({src:img.src,alt:img.alt,title:img.title,className:img.className})):[]};
   },{content,textonly,replyText,pixel});
  }
  summary.exploits=[];
  for(const [version,page] of [['baseline',baseline],['fixed',fixed]]) {
   for(const reply of [false,true]) {
    const result=await run(page,reply?'Reply':probe,true,reply?probe:undefined);
    assert.deepEqual(result.errors,[]);assert.equal(result.outbound.length,1);
    assert.equal(result.hits>0,version==='baseline');
    summary.exploits.push({version,reply,executed:result.hits>0});
   }
  }
  summary.messageComparisons=0;summary.textOnlyDisplayChanges=[];
  for(const textonly of [false,true]) for(const content of samples) {
   const before=await run(baseline,content,textonly),after=await run(fixed,content,textonly);
   assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);
   assert.equal(after.outbound.length,1);assert.deepEqual(after.outbound,before.outbound,'Outbound payload: '+content);
   assert.deepEqual(after.images,before.images,'Emote image attributes: '+content);
   if(!textonly) assert.equal(after.body,before.body,'Rich feed: '+content);
   else {
    const expected=after.outbound[0].chatmessage.replace(/\[(emote|sticker):(\d+):([^\]]+)\]/gi,'');
    assert.equal(after.text,expected,'Literal preview text: '+content);
    assert.deepEqual(after.unsafeElements,[],'Only recognized emote images may become elements');
    if(after.text!==before.text) summary.textOnlyDisplayChanges.push({input:content,before:before.text,after:after.text});
   }
   assert.equal(after.hits,0);summary.messageComparisons++;
  }
  summary.replyComparisons=0;
  for(const textonly of [false,true]) for(const parent of ['Original message','Original &amp; <b>text</b> [emote:123:Wave]']) {
   const before=await run(baseline,'My reply [sticker:456:Party]',textonly,parent);
   const after=await run(fixed,'My reply [sticker:456:Party]',textonly,parent);
   assert.deepEqual(after.errors,[]);assert.equal(after.outbound.length,1);
   assert.deepEqual(after.outbound,before.outbound);
   assert.deepEqual(after.images,before.images);
   if(!textonly) assert.equal(after.body,before.body);
   else assert.equal(after.text,after.outbound[0].chatmessage.replace(/\[(emote|sticker):(\d+):([^\]]+)\]/gi,''));
   summary.replyComparisons++;
  }
  for(const fixture of corpus) {
   const result=await run(fixed,fixture.input,true);
   assert.deepEqual(result.errors,[]);assert.equal(result.outbound.length,1,fixture.name);
   assert.equal(result.hits,0,fixture.name);assert.deepEqual(result.unsafeElements,[],fixture.name);
  }
  summary.securityCases=corpus.length;
  console.log('PASS Kick feed: '+summary.securityCases+' security cases and '+(summary.messageComparisons+summary.replyComparisons)+' message/reply comparisons');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
