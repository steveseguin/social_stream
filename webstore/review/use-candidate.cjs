'use strict';
// Run the repository's regressions against candidate assets, not beta assets.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const repo = path.resolve(__dirname, '../..');
const candidate = path.resolve(__dirname, '../candidate');
function redirect(value) {
    if (typeof value !== 'string' && !(value instanceof URL)) return value;
    if (value instanceof URL) return value;
    const absolute = path.resolve(value);
    const relative = path.relative(repo, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return value;
    if (/^(tests|scripts|webstore|node_modules|\.git|\.codex-tmp)([\\/]|$)/.test(relative)) return value;
    return path.join(candidate, relative);
}
for (const name of ['readFileSync', 'readFile', 'existsSync', 'statSync', 'stat', 'lstatSync', 'lstat', 'readdirSync', 'readdir', 'createReadStream', 'accessSync', 'access']) {
    const original = fs[name];
    fs[name] = function (file, ...args) { return original.call(this, redirect(file), ...args); };
}
for (const name of ['readFile', 'stat', 'lstat', 'readdir', 'access']) {
    const original = fs.promises[name];
    fs.promises[name] = function (file, ...args) { return original.call(this, redirect(file), ...args); };
}
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
    if (request === 'acorn') return resolve.call(this, path.join(require('node:os').tmpdir(), 'ssn-webstore-review-dependencies/node_modules/acorn'), parent, ...args);
    if (request === 'playwright') return resolve.call(this, path.resolve(repo, '../ssn_app/node_modules/playwright-core'), parent, ...args);
    const resolved = resolve.call(this, request, parent, ...args);
    return path.isAbsolute(resolved) ? redirect(resolved) : resolved;
};

// Two harness anchors refer to refactors that the old package never shipped.
// Extract the old DB record-building statements unchanged; aliases are absent.
const loadCjs = Module._extensions['.cjs'] || Module._extensions['.js'];
Module._extensions['.cjs'] = function (loaded, filename) {
    if (!filename.endsWith(path.join('tests', 'helpers', 'chat-security-harness.cjs'))) return loadCjs(loaded, filename);
    let source = fs.readFileSync(filename, 'utf8');
    source = source.replace('  const from = source.indexOf(start);', `
  if (file === 'background.js' && start === 'function getUserDisplayAliasEntries()' && !source.includes(start)) return '';
  if (file === 'background.js' && start === 'async function processIncomingMessage(' && !source.includes(end)) {
    const from = source.indexOf(start), to = source.indexOf('\\n}', from) + 2;
    assert.ok(from >= 0 && to > from, 'Old package ingress function');
    return source.slice(from, to);
  }
  if (file === 'db.js' && start === '    createMessageRecord(' && !source.includes(start)) {
    const from = source.indexOf('const now = Date.now();', source.indexOf('async addMessage(message)'));
    const to = source.indexOf('return new Promise', from);
    assert.ok(from >= 0 && to > from, 'Old package database record builder');
    return 'createMessageRecord(message) {\\n' + source.slice(from, to) + 'return messageData;\\n}';
  }
  const from = source.indexOf(start);`);
    loaded._compile(source, filename);
};
