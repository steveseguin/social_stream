'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
let tests = [
    'blaze-source.test.js', 'discord-streamkit-source.test.js', 'castyr-source.test.js',
    'kick-websocket-assets.test.js', 'kick-replies.test.js', 'kick-gifts-dom.test.js',
    'openai-source.test.js', 'sooplive-source.test.js', 'twitch-watch-streak.test.js',
    'twitch-watch-streak-dom.test.js', 'twitch-gif-message.test.js', 'streamspace-source.test.js',
    'vkvideo-source.test.js', 'whatnot-source.test.cjs', 'wtv-prime-sources.test.js', 'worldswave-source.test.js',
    'xss-sanitizer.test.js'
];
const reportPath = path.join(__dirname, 'source-test-results.json');
const results = process.argv.includes('--failed') ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : [];
if (process.argv.includes('--failed')) tests = tests.filter(name => results.some(result => result.test === name && result.exit !== 0));
for (const name of tests) {
    const run = cp.spawnSync(process.execPath, ['-r', './webstore/review/use-candidate.cjs', 'tests/' + name], { cwd: root, encoding: 'utf8', timeout: 90000 });
    const log = (run.stdout || '') + (run.stderr || '');
    fs.writeFileSync(path.join(__dirname, name + '.log'), log);
    const old = results.findIndex(result => result.test === name);
    if (old !== -1) results.splice(old, 1);
    results.push({ test: name, exit: run.status, error: run.error?.message });
    console.log((run.status === 0 ? 'PASS ' : 'FAIL ') + name);
}
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2) + '\n');
if (results.some(result => result.exit !== 0)) process.exitCode = 1;
