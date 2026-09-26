#!/usr/bin/env node
// Local-only, dependency-free server for the inspectable source-to-overlay demo.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { section } = require('./helpers/chat-security-harness.cjs');
const root = path.resolve(__dirname, '..');
const prefix = '/__chat-security/';
const bootstrap = '/tests/fixtures/chat-security-demo/bootstrap.js';

function relayCode() {
  return [
    section('background.js', 'function getUserDisplayAliasEntries()', 'function getCommandAliases('),
    section('background.js', 'async function processIncomingMessage(', 'async function handleRuntimeMessage('),
    section('background.js', 'async function applyBotActions(', 'function loadScript(url)'),
    section('background.js', 'async function sendToDestinations(', 'async function replayMessagesFromTimestamp('),
    section('background.js', 'function sendDataP2P(', 'var users = {};')
  ].join('\n');
}

function fixture(role) {
  const contents = '<p>Local ' + role + ' fixture</p>';
  const scripts = role === 'relay' ? '<script src="/libs/objects.js"></script><script src="/tests/fixtures/chat-security-demo/relay.js"></script><script src="/__chat-security/relay-production.js"></script>' : '';
  return '<!doctype html><html><head><meta charset="utf-8"><title>Chat security fixture</title>' +
    '<script data-role="' + role + '" src="' + bootstrap + '"></script></head><body>' + contents + scripts + '</body></html>';
}

async function createDemoServer(port = 0) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      // This server never proxies live services. Only local code and inert assets load.
      res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; object-src 'none'");
      // The capture fixture blocks inline handlers, as packaged extension code
      // does. Receiver documents retain the inline scripts their real pages use.
      if (url.pathname === '/tests/chat-security-demo.html') {
        res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; object-src 'none'");
      }
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/') {
        res.writeHead(302, { Location: '/tests/chat-security-demo.html' }); return res.end();
      }
      if (url.pathname === prefix + 'relay-production.js') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); return res.end(relayCode());
      }
      const role = /^\/__chat-security\/(relay|bridge)\.html$/.exec(url.pathname);
      if (role) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fixture(role[1]));
      }
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
      const ext = path.extname(file);
      res.setHeader('Content-Type', (types[ext] || 'application/octet-stream') + (/^\.(html|js|css|json)$/.test(ext) ? '; charset=utf-8' : ''));
      if (url.searchParams.get('securityDemo') === '1' && ['/dock.html', '/featured.html'].includes(url.pathname)) {
        const html = fs.readFileSync(file, 'utf8').replace(/<head[^>]*>/i, match => match + '<script data-role="receiver" src="' + bootstrap + '"></script>');
        return res.end(html);
      }
      fs.createReadStream(file).pipe(res);
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, baseUrl: 'http://127.0.0.1:' + server.address().port };
}

module.exports = { createDemoServer };
if (require.main === module) {
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  createDemoServer(portArg ? Number(portArg.slice(7)) : 8765).then(({ baseUrl }) => console.log('Open ' + baseUrl + '/tests/chat-security-demo.html')).catch(error => { console.error(error); process.exitCode = 1; });
}
