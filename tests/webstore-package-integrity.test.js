const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
// A checkout also contains development files; an upload must match the
// reviewed package inventory exactly, with no hidden staging dependency.
const packageFiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/webstore-package-files.json'), 'utf8'));
const isCheckout = fs.existsSync(path.join(root, 'AGENTS.md')) && fs.existsSync(path.join(root, 'package.json'));
const files = isCheckout ? packageFiles : fs.readdirSync(root, { recursive: true }).filter(file => fs.statSync(path.join(root, file)).isFile()).map(file => file.split(path.sep).join('/'));
assert.deepEqual([...files].sort(), [...packageFiles].sort(), 'Upload files differ from the reviewed package inventory');
for (const file of packageFiles) assert.ok(fs.existsSync(path.join(root, file)), `Missing packaged file: ${file}`);
const missing = [], syntax = [];
function checkReference(owner, reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference) || /[{}<>]/.test(reference)) return;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean) return;
  const target = path.resolve(clean.startsWith('/') ? root : path.dirname(path.join(root, owner)), '.' + (clean.startsWith('/') ? clean : '/' + clean));
  if (!fs.existsSync(target)) missing.push({ owner, reference });
}
function parse(code, owner) {
  try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); }
  catch (error) {
    try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch (moduleError) { syntax.push({ owner, error: moduleError.message }); }
  }
}
for (const file of files) {
  const relative = file.replace(/\\/g, '/');
  if (!/\.(?:js|mjs|html|css|json)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\.json$/.test(file)) {
    try { JSON.parse(text); } catch (error) { syntax.push({ owner: relative, error: error.message }); }
  } else if (/\.(?:js|mjs)$/.test(file)) parse(text, relative);
  else if (/\.css$/.test(file)) {
    for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) checkReference(relative, match[1]);
  }
  else if (/\.html$/.test(file)) {
    const html = text.replace(/<!--[\s\S]*?-->/g, '');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = match[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (src) checkReference(relative, src[1]);
      else if (!/\btype\s*=\s*["'](?:application\/(?:ld\+)?json|text\/(?:template|html))["']/i.test(match[1]) && match[2].trim()) parse(match[2], relative + ' inline script');
    }
    for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag[0])) continue;
      const href = tag[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (href) checkReference(relative, href[1]);
    }
    // Inspect real markup, not HTML-looking strings inside JavaScript examples.
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    for (const tag of markup.matchAll(/<(?:a|img|source|video|audio|iframe|link)\b[^>]*>/gi)) {
      for (const attribute of tag[0].matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) {
        checkReference(relative, attribute[1]);
      }
    }
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const file of [manifest.background.service_worker, manifest.action.default_popup, ...manifest.content_scripts.flatMap(entry => entry.js)]) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing manifest file: ${file}`);
}
console.log(JSON.stringify({ files: files.length, missing, syntax }, null, 2));
assert.deepEqual(missing, [], 'Missing packaged scripts/styles');
assert.deepEqual(syntax, [], 'Packaged code/JSON parse failures');
