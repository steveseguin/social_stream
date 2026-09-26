const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { amendAndPush } = require('./safe-commit-push.cjs');

test('assistant attribution is rejected before any Git operation', async () => {
  for (const message of [
    'Fix parsing\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    'Update CLAUDE.md contribution guidance',
    'Fix parsing\n\nCo-authored-by: ChatGPT <noreply@openai.com>',
    'Fix parsing\n\nCo-authored-by: GitHub Copilot <copilot@github.com>',
    'Fix parsing\n\nCo-authored-by: Google Gemini',
    'Fix parsing\n\nCo-authored-by: OpenAI Codex',
    'Fix parsing\n\nCo-authored-by: Cursor',
    'Fix parsing\n\nCo-authored-by: Aider',
    'Fix parsing\n\nCo-authored-by: Windsurf',
    'Fix parsing\n\nCo-authored-by: Devin',
    'Fix parsing\n\nCo-authored-by: Cline',
    'Fix parsing\n\nCo-authored-by: Roo Code',
    'Fix parsing\n\nCo-authored-by: Tabnine',
    'Fix parsing\n\nCo-authored-by: Amazon Q',
    'Fix parsing\n\nCo-authored-by: Assistant <noreply@anthropic.com>',
    'Fix parsing\n\nAI-assisted',
    'Fix parsing\n\nAI generated',
    'Fix parsing\n\nGenerated with [ChatGPT](https://chatgpt.com)',
    'Fix parsing\n\nWritten by GitHub Copilot',
    'Fix parsing\n\nImplemented with help from Codex',
    'Fix parsing\n\nAssisted by an AI tool',
    'Fix parsing\n\nThanks to Gemini for the implementation'
  ]) {
    await assert.rejects(amendAndPush(message, 'not-a-sha', 'beta'), /Assistant.*not allowed/, message);
  }
});

test('product descriptions and human co-authors are not assistant attribution', async () => {
  for (const message of [
    'Fix ChatGPT source capture',
    'Add Gemini provider support',
    'Improve cursor focus in the editor',
    'Fix AI response rendering',
    'Fix parsing\n\nCo-authored-by: Alex Example <alex@example.invalid>'
  ]) {
    await assert.rejects(amendAndPush(message, 'not-a-sha', 'beta'), /Invalid original commit SHA/, message);
  }
});

test('amend preserves identities, dates and tree, and its lease rejects stale work', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'enhancer-lease-test-'));
  const remote = path.join(temp, 'remote.git');
  const local = path.join(temp, 'local');
  const other = path.join(temp, 'other');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(temp, 'init', '--bare', '--initial-branch=main', remote);
    git(temp, 'clone', remote, local);
    for (const dir of [local]) {
      git(dir, 'config', 'user.name', 'Test');
      git(dir, 'config', 'user.email', 'test@example.invalid');
    }
    fs.writeFileSync(path.join(local, 'file.txt'), 'original');
    git(local, 'add', '.'); git(local, 'commit', '-m', 'original'); git(local, 'push', 'origin', 'main');
    const sha = git(local, 'rev-parse', 'HEAD');
    const tree = git(local, 'rev-parse', 'HEAD^{tree}');
    const identityFormat = '%an <%ae>%n%aI%n%cn <%ce>%n%cI';
    const identities = git(local, 'show', '-s', '--format=' + identityFormat, sha);
    git(local, 'config', 'user.name', 'GitHub Actions Commit Enhancer');
    git(local, 'config', 'user.email', 'actions@github.com');
    fs.writeFileSync(path.join(local, 'staged.txt'), 'must not enter amended commit');
    git(local, 'add', 'staged.txt');
    assert.equal(await amendAndPush('enhanced', sha, 'main', { cwd: local, log() {} }), true);
    assert.equal(git(local, 'rev-parse', 'HEAD^{tree}'), tree);
    assert.equal(git(local, 'log', '-1', '--format=%B'), 'enhanced');
    assert.equal(git(local, 'show', '-s', '--format=' + identityFormat, 'HEAD'), identities);
    const enhanced = git(local, 'rev-parse', 'HEAD');
    git(temp, 'clone', remote, other);
    git(other, 'config', 'user.name', 'Other'); git(other, 'config', 'user.email', 'other@example.invalid');
    fs.writeFileSync(path.join(other, 'new.txt'), 'newer work');
    git(other, 'add', '.'); git(other, 'commit', '-m', 'newer'); git(other, 'push', 'origin', 'main');
    const newer = git(other, 'rev-parse', 'HEAD');
    git(local, 'fetch', 'origin');
    assert.equal(await amendAndPush('stale', enhanced, 'main', { cwd: local, log() {} }), false);
    assert.equal(git(remote, 'rev-parse', 'main'), newer);
    assert.equal(git(local, 'rev-parse', 'HEAD'), enhanced);
    // Introduce a remote update between the precheck and push using a local commit hook.
    fs.writeFileSync(path.join(local, '.git/hooks/post-commit'), '#!/bin/sh\ngit --git-dir="' + remote.replace(/\\/g, '/') + '" update-ref refs/heads/main ' + newer + '\n');
    fs.chmodSync(path.join(local, '.git/hooks/post-commit'), 0o755);
    git(remote, 'update-ref', 'refs/heads/main', enhanced);
    assert.equal(await amendAndPush('racing', enhanced, 'main', { cwd: local, log() {} }), false);
    assert.equal(git(remote, 'rev-parse', 'main'), newer);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
