// Offline regression test of the shipped YouTube page, with a vulnerable helper as a positive control.
// Run with Playwright available: node tests/youtube-text-parser.test.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext } = require('./helpers/chat-security-harness.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sources/websocket/youtube.html'), 'utf8');
const parser = source.match(/function stripHtmlContent\(value\) \{[\s\S]*?\n\t\}/);
assert.ok(parser, 'Production helper must be found');
// Historical behavior, only in an isolated browser page with offline test data.
const vulnerableHelper = `function stripHtmlContent(value) {
  if (!value) return '';
  const temp = document.createElement('div');
  temp.innerHTML = value;
  return (temp.textContent || temp.innerText || '').trim();
}`;
const baselineSource = source.replace(parser[0], vulnerableHelper);
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const probe = '<img src="data:image/png;base64,broken" onerror="window.__parserHits++">';
const samples = [
  '', 'plain text', '  spaces\tand\nnewlines  ', 'A & B < 3 > 1',
  'café 👋🏽 🇺🇸', '&amp; &lt;b&gt; &#39; &quot; &#x1f44b;',
  '&amp;lt;b&amp;gt;', '<b>Hello</b> <i>world</i>', '<div>one</div><div>two</div>',
  'one<br>two<br/>three', 'a&nbsp;b', '<span style="display:none">hidden</span> visible',
  '<i><small>Alice: original&nbsp;</small></i> reply',
  'hello <img class="chat-emoji" src="' + pixel + '" alt="wave"> there',
  '<svg><title>Badge</title><text>VIP</text></svg> text', '<!--comment--> text',
  '<template>inert text</template> visible', '<textarea>&lt;tag&gt; &amp;</textarea>',
  '<select><option>one</option><option>two</option></select>', '<pre>\n a\n b </pre>',
  '<b>unfinished', '<span title="unfinished', '<p>one<p>two', '<b><i>one</b>two</i>',
  '<table><tr><td>one</td><td>two</td></tr></table>',
  'before<table>outside<tr><td>inside</td></tr>after</table>end',
  '<tr><td>one</td><td>two</td></tr>', '<td>cell</td> after',
  '<colgroup>before<col>after</colgroup>end', '<caption>title</caption> after',
  '<style>.x { color: red; }</style> text', '<script>inert script text</script>after',
  '<noscript><b>fallback</b></noscript>after', '<plaintext><b>literal</b>',
  '<math><mtext>math text</mtext></math>after', '\u0000before\r\nafter'
];
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/xss-corpus.json'), 'utf8'));
corpus.push(
  {name:'image error marker', input:probe},
  {name:'image load marker', input:'<img src="'+pixel+'" onload="window.__parserHits++">'},
  {name:'SVG handler', input:'<svg onload="window.__parserHits++"></svg>'},
  {name:'iframe srcdoc', input:'<iframe srcdoc="<script>parent.__parserHits++<\/script>"></iframe>'},
  {name:'unterminated handler image', input:probe.slice(0,-1)},
  {name:'nested SVG HTML', input:'<svg><foreignObject>'+probe+'</foreignObject></svg>'}
);

async function state(page) {
  return page.evaluate(() => ({hits:__parserHits, messages:__parserMessages, errors:__parserErrors}));
}
async function reset(page, textonly) {
  await page.evaluate(textonly => {
    __parserHits=0; __parserMessages=[]; __parserErrors=[];
    settings.textonlymode=textonly;
    delete settings.excludeReplyingTo;
    settings.memberchatonly=false;
    isPageVisible=true;
    resetRichChatCache();
    messageContextCache.clear(); messageCacheOrder.length=0;
    channelShortcutMap.clear(); shortcutMap.clear(); unicodeMap.clear();
    document.querySelector('#textarea').textContent='';
  }, textonly);
}

async function behavior(page, textonly) {
  await reset(page,textonly);
  return page.evaluate(({pixel,textonly}) => {
    const rich = {id:'rich-1',authorChannelId:'author-1',plainText:'Hi :_wave: & friends',
      html:'Hi <img class="chat-emoji" src="'+pixel+'" alt="wave"> &amp; friends',
      badges:[{type:'text',text:'Member'}],
      fallbackKeys:[buildRichMessageFallbackKey('author-1','Hi :_wave: & friends')]};
    rememberRichMessage(rich);
    const matches=[
      getRichMessageForMessageData({messageId:'rich-1'}),
      getRichMessageForMessageData({authorChannelId:'author-1',plainTextMessage:'Hi :_wave: & friends'}),
      getRichMessageForMessageData({authorChannelId:'author-1',message:'Hi :_wave: & friends'}),
      getRichMessageForMessageData({authorChannelId:'author-1',message:'<b>Hi :_wave: &amp; friends</b>'})
    ].map(value=>value && value.id);
    const rows=[
      {message:'Hello & <literal> 👋',plainTextMessage:'Hello & <literal> 👋'},
      {message:'A &amp; &lt;b&gt; & "quotes"'},
      {message:'Hi :_wave: & friends',plainTextMessage:'Hi :_wave: & friends',authorChannelId:'author-1',isChatSponsor:true},
      {message:'moderator',isChatModerator:true,isChatOwner:true},
      {message:'second message',plainTextMessage:'second message',replyMessageId:'message-0'}
    ];
    rows.forEach((row,index)=>processMessage(Object.assign({messageId:'message-'+index,
      authorChannelId:'other-author',authorName:'Alice & Bob',profileImageUrl:''},row)));
    rememberChatMessage('html-parent',{authorName:'Parent',channelId:'parent-channel',
      html:'<b>Original &amp; text</b> <img src="'+pixel+'" alt="wave">\n next line'});
    const reply=resolveReplyContext({replyMessageId:'html-parent'});
    processMessage({messageId:'html-reply',authorName:'Responder',authorChannelId:'reply-author',
      message:'Reply <literal> &amp;',plainTextMessage:'Reply <literal> &amp;',replyMessageId:'html-parent'});
    const shortcut={url:pixel,id:':_wave:',alt:'wave',isCustom:true};
    channelShortcutMap.set(':_wave:',shortcut);
    processMessage({messageId:'shortcut',authorName:'Emoji viewer',authorChannelId:'emoji-author',
      message:'Hello :_wave:!',plainTextMessage:'Hello :_wave:!'});
    const literalNoscript='<noscript><b>fallback</b></noscript>after';
    processMessage({messageId:'literal-noscript',authorName:'Literal viewer',authorChannelId:'literal-author',
      message:literalNoscript,plainTextMessage:literalNoscript});
    return {matches,reply,messages:__parserMessages,errors:__parserErrors,
      display:document.querySelector('#textarea').innerHTML,
      cached:lookupChatMessage('html-reply')};
  },{pixel,textonly});
}

(async()=>{
  const server=await createStaticServer();
  let browser;
  const summary={comparisonCases:samples.length,securityInputs:corpus.length};
  try {
    browser=await chromium.launch({headless:true});
    async function open(html) {
      const context=await browser.newContext();
      await configureContext(context,server.baseUrl);
      // Async declarations live inside the page's try block; expose the unchanged handler for the fixture.
      const anchor="document.addEventListener('DOMContentLoaded', initializePage);";
      assert.ok(html.includes(anchor));
      const served=html.replace(anchor,'window.__reviewProcessAPI = processLiveChatResponseData;\n'+anchor);
      await context.route('**/sources/websocket/youtube.html*',route=>route.fulfill({contentType:'text/html',body:served}));
      await context.addInitScript(()=>{
        window.__parserHits=0; window.__parserMessages=[]; window.__parserErrors=[];
        window.alert=window.confirm=window.prompt=()=>{window.__parserHits++;};
        window.addEventListener('youtubeMessage',event=>__parserMessages.push(event.detail));
        const originalError=console.error;
        console.error=(...args)=>{__parserErrors.push(args.map(String).join(' '));originalError(...args);};
      });
      const page=await context.newPage();
      page.on('pageerror',error=>{throw error;});
      await page.goto(server.baseUrl+'/sources/websocket/youtube.html?channel=LOCAL_VALIDATION',{waitUntil:'networkidle'});
      return page;
    }
    const baseline=await open(baselineSource);
    const candidate=await open(source);
    const oldText=await baseline.evaluate(values=>values.map(stripHtmlContent),samples);
    const newText=await candidate.evaluate(values=>values.map(stripHtmlContent),samples);
    summary.textDifferences=samples.flatMap((input,index)=>oldText[index]===newText[index]?[]:[{input,before:oldText[index],after:newText[index]}]);
    assert.deepEqual(summary.textDifferences,[{
      input:'<noscript><b>fallback</b></noscript>after',before:'<b>fallback</b>after',after:'fallbackafter'
    }],'Only the documented noscript difference is expected');

    for(const textonly of [false,true]) {
      const before=await behavior(baseline,textonly);
      const after=await behavior(candidate,textonly);
      assert.deepEqual(before.errors,[],'Baseline behavior must not throw');
      assert.deepEqual(after.errors,[],'Candidate behavior must not throw');
      assert.deepEqual(before.matches,['rich-1','rich-1','rich-1','rich-1'],'All lookup paths exercised');
      assert.equal(before.messages.length,8,'Every fixture must emit');
      assert.equal(before.reply.label,'Parent: Original & text next line');
      assert.equal(before.messages[5].initial,'Parent: Original & text next line','Reply formatting must be exercised');
      assert.equal(before.messages[6].textonly,textonly);
      if(!textonly) assert.ok(before.messages[6].chatmessage.includes('class="chat-emoji"'));
      assert.equal(before.messages[7].chatmessage,textonly
        ? '<noscript><b>fallback</b></noscript>after'
        : '&lt;noscript&gt;&lt;b&gt;fallback&lt;/b&gt;&lt;/noscript&gt;after',
      'Literal API text must be preserved even for the noscript edge case');
      assert.deepEqual(after,before,'Message, DOM, matching and reply parity; textonly='+textonly);
    }
    summary.behaviorComparisons={modes:2,emittedMessages:16,lookupPaths:8,replyContexts:2};
    summary.noscriptReplyComparison={};
    for(const [label,page] of [['baseline',baseline],['candidate',candidate]]) {
      summary.noscriptReplyComparison[label]=await page.evaluate(()=>{
        rememberChatMessage('noscript-parent',{authorName:'Parent',html:'<noscript><b>fallback</b></noscript>after'});
        return resolveReplyContext({replyMessageId:'noscript-parent'}).label;
      });
    }
    assert.deepEqual(summary.noscriptReplyComparison,{
      baseline:'Parent: <b>fallback</b>after',candidate:'Parent: fallbackafter'
    });

    summary.exploit=[];
    for(const [label,page] of [['baseline',baseline],['candidate',candidate]]) {
      for(const textonly of [false,true]) {
        await reset(page,textonly);
        await page.evaluate(probe=>queueMessage({messageId:'exploit',authorChannelId:'probe-author',
          authorName:'Viewer',message:probe,plainTextMessage:probe}),probe);
        await page.waitForTimeout(150);
        const result=await state(page);
        assert.deepEqual(result.errors,[]);
        assert.equal(result.messages.length,1);
        assert.equal(result.hits>0,label==='baseline','Exploit control: '+label+' textonly='+textonly);
        summary.exploit.push({version:label,textonly,executed:result.hits>0});
      }
    }

    await reset(candidate,false);
    for(const fixture of corpus) {
      await candidate.evaluate(input=>stripHtmlContent(input),fixture.input);
    }
    await candidate.waitForTimeout(250);
    assert.equal((await state(candidate)).hits,0,'No security corpus input may execute');
    summary.securityCorpusPassed=true;

    summary.parserNetworkRequests={};
    for(const [label,page] of [['baseline',baseline],['candidate',candidate]]) {
      const requests=[];
      await page.route('**/parser-resource-probe*',route=>{requests.push(route.request().url());return route.abort();});
      await page.evaluate(url=>stripHtmlContent('<img src="'+url+'">'),server.baseUrl+'/parser-resource-probe');
      await page.waitForTimeout(150);
      summary.parserNetworkRequests[label]=requests.length;
    }
    assert.equal(summary.parserNetworkRequests.baseline,1,'Baseline request control');
    assert.equal(summary.parserNetworkRequests.candidate,0,'Candidate parsing is inert');

    // Exercise the shared API response handler used by polling and streaming.
    summary.apiResponseCases=0;
    for(const textonly of [false,true]) {
      await reset(candidate,textonly);
      await candidate.evaluate(async probe=>{
        initialBacklogProcessing=false; initialBacklogTimestamp=0; lastMessageTime=null;
        await __reviewProcessAPI({items:[{id:'api-probe',
          snippet:{type:'textMessageEvent',publishedAt:new Date().toISOString(),displayMessage:probe,textMessageDetails:{messageText:probe}},
          authorDetails:{displayName:'API Viewer',channelId:'api-author',profileImageUrl:'',isChatSponsor:false,isChatModerator:false,isChatOwner:false}
        }],pollingIntervalMillis:5000},{scheduleNextPoll:false});
      },probe);
      await candidate.waitForTimeout(150);
      const result=await state(candidate);
      assert.deepEqual(result.errors,[]);
      assert.equal(result.hits,0);
      assert.equal(result.messages.length,1,'API message must emit');
      summary.apiResponseCases++;
    }
    console.log('PASS YouTube text parser: ' + summary.securityInputs + ' security inputs; ' + summary.behaviorComparisons.emittedMessages + ' message comparisons; both text modes and API response cases');
  } finally {if(browser)await browser.close();await closeServer(server.server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
