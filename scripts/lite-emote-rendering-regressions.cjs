const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

(async () => {
  const server = await startStaticServer({ root: process.cwd(), port: 4248 });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4248/') ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:4248/lite/index.html');
    const results = await page.evaluate(async () => {
      const { EmoteManager } = await import('/lite/utils/emoteManager.js');
      const manager = new EmoteManager();
      manager.fetchChannelEmotes = async () => ({ Wave: '/wave.png', Overlay: { url: '/overlay.png', zw: true } });
      const input = '<i><small>Wave</small></i> <img src="/native.png" alt="hello Wave there"> Wave';
      const rendered = await manager.render(input, { platform: 'twitch', userId: 'fixture' });
      const container = document.createElement('div');
      container.innerHTML = rendered;
      const plain = await manager.render('hello &amp; &lt;world&gt; Wave Overlay', { platform: 'twitch', userId: 'fixture' });
      const plainContainer = document.createElement('div');
      plainContainer.innerHTML = plain;
      return {
        rendered,
        nativeAlt: container.querySelector('img[src="/native.png"]')?.getAttribute('alt'),
        waveCount: container.querySelectorAll('img[src="/wave.png"]').length,
        replyWave: !!container.querySelector('i small img[src="/wave.png"]'),
        plainText: plainContainer.textContent,
        zeroWidth: !!plainContainer.querySelector('.zero-width-span img.zero-width-emote'),
        unchanged: await manager.render('<b>ordinary text</b>', { platform: 'twitch', userId: 'fixture' })
      };
    });
    assert.equal(results.nativeAlt, 'hello Wave there', 'Emote names inside existing attributes must remain text');
    assert.equal(results.waveCount, 2, results.rendered);
    assert.equal(results.replyWave, true, 'Emotes at the edge of reply markup must render');
    assert.equal(results.plainText, 'hello & <world>  ');
    assert.equal(results.zeroWidth, true);
    assert.equal(results.unchanged, '<b>ordinary text</b>');
    console.log('Lite emote rendering: attributes, reply markup, escaping, zero-width and unchanged text pass');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
