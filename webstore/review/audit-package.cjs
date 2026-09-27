'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../candidate'), baseline = path.resolve(__dirname, '../3.50.10');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const report = { syntax: [], missing: [], remoteCode: [], dynamicCode: [], permissions: {}, changed: [], scripts: 0, inline: 0 };
function parse(code, file, module) {
    try { module ? new vm.SourceTextModule(code) : new vm.Script(code); }
    catch (error) {
        if (!module && /(?:import|export)/.test(error.message)) {
            try { new vm.SourceTextModule(code); return; } catch (_) {}
        }
        report.syntax.push({ file: relative(file), error: error.message });
    }
}
function dependency(file, target) {
    if (!target || /^(?:https?:|wss?:|data:|chrome-extension:|#)/.test(target)) return;
    const clean = target.split(/[?#]/)[0];
    if (!clean || /[${}*]/.test(clean)) return;
    const local = path.resolve(path.dirname(file), clean.startsWith('/') ? '.' + clean : clean);
    if (!fs.existsSync(local)) report.missing.push({ file: relative(file), target });
}
for (const file of walk(root)) {
    const rel = relative(file), ext = path.extname(file), data = fs.readFileSync(file);
    const old = path.join(baseline, rel);
    if (!fs.existsSync(old) || !data.equals(fs.readFileSync(old))) report.changed.push({ file: rel, status: fs.existsSync(old) ? 'modified' : 'added', sha256: crypto.createHash('sha256').update(data).digest('hex') });
    if (!['.js', '.html'].includes(ext)) continue;
    const code = data.toString('utf8');
    if (ext === '.js') { parse(code, file, false); report.scripts++; }
    if (ext === '.html') {
        for (const match of code.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            const attr = match[1], src = /\bsrc\s*=\s*["']([^"']+)/i.exec(attr);
            if (src) {
                if (/^(?:https?:)?\/\//.test(src[1])) report.remoteCode.push({ file: rel, target: src[1] });
                else dependency(file, src[1]);
            } else if (match[2].trim() && !/type=["'](?:application\/ld\+json|application\/json|importmap)/.test(attr)) {
                parse(match[2], file, /type=["']module/.test(attr)); report.inline++;
            }
        }
    }
    for (const match of code.matchAll(/(?:\bimport\s*\(\s*|\bfrom\s+)["']([^"']+)["']/g)) {
        if (/^https?:\/\//.test(match[1])) report.remoteCode.push({ file: rel, target: match[1] });
        else if (match[1].startsWith('.')) dependency(file, match[1]);
    }
    for (const match of code.matchAll(/(?<![\w.$])(?:eval|Function)\s*\(/g)) report.dynamicCode.push({ file: rel, offset: match.index, snippet: code.slice(Math.max(0, match.index - 25), match.index + 80) });
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const original = JSON.parse(fs.readFileSync(path.join(baseline, 'manifest.json'), 'utf8'));
for (const key of ['permissions', 'host_permissions', 'content_security_policy', 'oauth2', 'key']) report.permissions[key] = JSON.stringify(manifest[key]) === JSON.stringify(original[key]) ? 'unchanged' : 'CHANGED';
for (const entry of manifest.content_scripts) for (const file of [...(entry.js || []), ...(entry.css || [])]) dependency(path.join(root, 'manifest.json'), file);
for (const group of manifest.web_accessible_resources) for (const file of group.resources) dependency(path.join(root, 'manifest.json'), file);
report.excluded = ['joystick', 'stripchat', 'bongacams', 'cam4', 'chaturbate', 'fansly', 'camsoda', 'cherrytv', 'myfreecams', 'velora', 'rplay'].filter(name => fs.existsSync(path.join(root, 'sources', name + '.js')));
fs.writeFileSync(path.join(__dirname, 'package-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scripts: report.scripts, inline: report.inline, syntax: report.syntax, missing: report.missing, remoteCode: report.remoteCode, dynamicCode: report.dynamicCode, permissions: report.permissions, excludedPresent: report.excluded, changed: report.changed.length }, null, 2));
if (report.syntax.length || report.remoteCode.length || report.dynamicCode.length || report.excluded.length || Object.values(report.permissions).includes('CHANGED')) process.exitCode = 1;
