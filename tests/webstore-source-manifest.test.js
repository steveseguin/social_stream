const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.resolve(__dirname, '..'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const normalize = file => file.replace(/^\.\//, '');
const groupsFor = file => manifest.content_scripts.filter(entry => (entry.js || []).some(script => normalize(script) === file));

// Different registrations may share a source file, but must not duplicate its URL scope.
const scopesByScript = new Map();
for (const entry of manifest.content_scripts) {
  for (const script of entry.js || []) {
    const file = normalize(script);
    assert.ok(fs.existsSync(path.join(root, file)), `Missing packaged content script: ${file}`);
    assert.equal((entry.js || []).filter(candidate => normalize(candidate) === file).length, 1, `Duplicate dependency: ${file}`);
    if (!file.startsWith('sources/')) continue;
    const previous = scopesByScript.get(file) || new Set();
    for (const match of entry.matches) {
      assert.ok(!previous.has(match), `${file} repeats ${match}; review each registration instead of matching by filename`);
      previous.add(match);
    }
    scopesByScript.set(file, previous);
  }
}

const youtube = groupsFor('sources/youtube.js');
assert.equal(youtube.length, 2, 'YouTube needs separate regular and Studio registrations');
const studio = youtube.find(entry => entry.matches.includes('https://studio.youtube.com/live_chat*'));
assert.ok(studio, 'YouTube Studio live chat lost its registration');
assert.deepEqual(studio.matches, ['https://studio.youtube.com/live_chat*']);
assert.equal(studio.all_frames, true, 'Studio chat must work inside the Studio iframe');
const regular = youtube.find(entry => entry !== studio);
assert.deepEqual(regular.matches, [
  'https://www.youtube.com/watch?v=*&socialstream',
  'https://youtube.com/live_chat*',
  'https://www.youtube.com/live_chat*'
]);
assert.equal(Boolean(regular.all_frames), false, 'Regular YouTube capture must not attach to other watch-page live/replay frames');
for (const entry of youtube) {
  assert.equal(Boolean(entry.match_about_blank), false);
  assert.equal(Boolean(entry.match_origin_as_fallback), false);
  assert.equal(entry.world || 'ISOLATED', 'ISOLATED');
  assert.deepEqual(entry.exclude_matches || [], []);
  assert.equal(entry.run_at || 'document_idle', 'document_idle');
}

const twitch = groupsFor('sources/twitch.js');
assert.equal(twitch.length, 1);
assert.deepEqual(twitch[0].matches, ['https://*.twitch.tv/popout/*']);
assert.equal(twitch[0].run_at, 'document_start');
assert.equal(Boolean(twitch[0].all_frames), false);
assert.deepEqual(twitch[0].exclude_matches || [], []);
for (const file of ['sources/twitch.js', 'sources/websocket/twitch.js']) {
  const entries = groupsFor(file);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].js.map(normalize), [
    'shared/vendor/pluralmind.iife.js', 'shared/integrations/pluralmind.js', file
  ], `${file} must load the packaged helpers for its visible PluralMind setting`);
}

const kick = groupsFor('sources/kick.js');
assert.equal(kick.length, 1);
assert.deepEqual(kick[0].matches, [
  'https://kick.com/*/chatroom', 'https://kick.com/*/*/chatroom',
  'https://kick.com/popout/*/chat', 'https://kick.com/*/popout/*/chat'
]);
assert.equal(Boolean(kick[0].all_frames), false);
assert.equal(kick[0].run_at || 'document_idle', 'document_idle');
assert.deepEqual(kick[0].exclude_matches || [], []);
assert.ok(fs.existsSync(path.join(root, 'shared/kickBadges.js')));
assert.ok(manifest.web_accessible_resources.some(entry => entry.resources.includes('shared/kickBadges.js')));

const video = groupsFor('sources/capturevideo.js');
assert.equal(video.length, 1);
assert.deepEqual(video[0].js.map(normalize), ['thirdparty/vdoninja-sdk.js', 'sources/capturevideo.js'], 'Discord video capture exits immediately without its SDK');
assert.deepEqual(video[0].matches, ['https://discord.com/channels/*']);
assert.equal(Boolean(video[0].all_frames), false);

console.log(`Web Store source manifest checks passed (${manifest.content_scripts.length} registrations).`);
