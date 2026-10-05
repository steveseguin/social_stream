'use strict';

// Run with an installed Electron binary. Uses an isolated profile and local iframe
// bridge; never connects to a live SSN session or posts to a platform chat.
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow, session } = require('electron');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-contentimg-e2e-'));
app.setPath('userData', path.join(output, 'profile'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let delivery = { sequence: 0, payload: null };
let bridgePolls = 0;
let base;
const fixture = Buffer.from('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', 'base64');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/bridge') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<script>let sequence = 0; setInterval(async () => {
      const data = await (await fetch('/delivery')).json();
      if (data.sequence > sequence) {
        sequence = data.sequence;
        parent.postMessage({dataReceived:{overlayNinja:data.payload}}, '*');
      }
    }, 50);</script>`);
  }
  if (pathname === '/delivery') {
    bridgePolls++;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(delivery));
  }
  if (pathname === '/fixture.gif') {
    res.setHeader('Content-Type', 'image/gif');
    return res.end(fixture);
  }
  const file = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.statusCode = 404;
    return res.end();
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function until(check, label, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(75);
  }
  throw new Error('Timed out: ' + label);
}

async function runPage(relativePath) {
  delivery = { sequence: 0, payload: null };
  const initialPolls = bridgePolls;
  const window = new BrowserWindow({ width: 1000, height: 800, show: true, webPreferences: { backgroundThrottling: false } });
  const wc = window.webContents;
  try {
    await window.loadURL(base + '/' + relativePath + '?session=local-contentimg-test&showtime=60000&duration=30');
    await until(() => bridgePolls > initialPolls, relativePath + ' bridge ready');
    const payload = { id: 'gif-1', mid: 'gif-1', type: 'twitch', chatname: 'GIF fixture', chatbadges: [], chatmessage: '', contentimg: base + '/fixture.gif', meta: { gifLabel: 'Animated GIF fixture' }, textonly: true };
    if (relativePath.includes('/events/')) payload.event = 'superchat';
    delivery = { sequence: 1, payload };
    const imageInfo = () => wc.executeJavaScript(`Array.from(document.images).filter(img => img.src.includes('/fixture.gif')).map(img => { const r = img.getBoundingClientRect(); return { loaded: img.complete && img.naturalWidth > 0, width: r.width, height: r.height, display: getComputedStyle(img).display }; })`);
    await until(async () => (await imageInfo()).some(img => img.loaded && img.width > 0 && img.height > 0 && img.display !== 'none'), relativePath + ' GIF rendering');
    await delay(700);
    const first = await imageInfo();
    assert(first.every(img => img.width <= 1000 && img.height <= 800), relativePath + ' image bounds');
    if (/deuks_overlay|huan-kiara|t3nk3y/.test(relativePath)) {
      assert(first[0].height > 24, relativePath + ' must not use emote sizing');
    }
    // The bridge receives a second real message, including the same sender for grouping.
    delivery = { sequence: 2, payload: { ...payload, id: 'gif-2', mid: 'gif-2', chatmessage: 'Text with GIF' } };
    await until(() => wc.executeJavaScript(`document.body.textContent.includes('Text with GIF')`), relativePath + ' text with GIF');
    await until(async () => (await imageInfo()).some(img => img.loaded), relativePath + ' second GIF');
    if (relativePath.includes('overlay2.html')) {
      assert.strictEqual((await imageInfo()).length, 2, 'grouped sender retains both GIFs');
    }
    delivery = { sequence: 3, payload: { event: 'viewer_updates', meta: { twitch: 12 } } };
    await delay(200);
    assert(!(await wc.executeJavaScript(`document.body.textContent.includes('viewer_updates')`)), relativePath + ' metadata-only update');
    if (/horizontal|overlay2|featured-3d|featured-particles|t3nk3y/.test(relativePath)) {
      await delay(1800); // Let the entrance animation settle before visual review.
      fs.writeFileSync(path.join(output, relativePath.replace(/[\/]/g, '_') + '.png'), (await wc.capturePage()).toPNG());
    }
    // Reload and deliver again, exercising initialization and connection recovery.
    const polls = bridgePolls;
    delivery = { sequence: 0, payload: null };
    await wc.reload();
    await until(() => bridgePolls > polls, relativePath + ' reload bridge');
    delivery = { sequence: 4, payload: { ...payload, id: 'gif-reload', mid: 'gif-reload' } };
    await until(async () => (await imageInfo()).some(img => img.loaded && img.width > 0), relativePath + ' GIF after reload');
    console.log('PASS ' + relativePath);
  } finally {
    window.destroy();
  }
}

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (details.url.startsWith(base) || url.protocol === 'data:' || url.protocol === 'about:') return callback({});
    if (url.hostname === 'vdo.socialstream.ninja') return callback({ redirectURL: base + '/bridge' });
    if (url.hostname === 'socialstream.ninja' && fs.existsSync(path.join(root, url.pathname))) return callback({ redirectURL: base + url.pathname });
    callback({ cancel: true });
  });
  // pretty.html is a decorative iframe wrapper around dock.html, not a renderer.
  const themePages = fs.readdirSync(path.join(root, 'themes')).filter(name => name.endsWith('.html') && name !== 'pretty.html').map(name => 'themes/' + name);
  const featured = fs.readdirSync(path.join(root, 'themes/featured-styles')).filter(name => name.endsWith('.html')).map(name => 'themes/featured-styles/' + name);
  const requested = process.argv.slice(2).filter(value => value.endsWith('.html'));
  const pages = requested.length ? requested : ['sampleoverlay.html', 'samplefeatured.html', ...themePages, ...featured, 'themes/deuks_overlay/overlay1.html', 'themes/deuks_overlay/overlay2.html', 'themes/huan-kiara/index.html', 'themes/t3nk3y/index.html', 'themes/Windows3.1/index.html', 'themes/rainbowpuke/index.html', 'themes/events/index.html', 'themes/LuckyLootTube/luckyloottube.html'];
  const failures = [];
  for (const page of pages) {
    try { await runPage(page); } catch (error) { failures.push({ page, error: error.message }); console.error('FAIL ' + page + ': ' + error.message); }
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ pages: pages.length, failures }, null, 2));
  console.log('Results: ' + output);
  server.close();
  app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
