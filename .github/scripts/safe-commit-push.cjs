const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const exec = promisify(execFile);

async function amendAndPush(message, expectedSha, branch, { cwd = process.cwd(), log = console.log } = {}) {
  const git = async (...args) => (await exec('git', args, { cwd })).stdout.trim();
  if (!/^[a-f0-9]{40,64}$/.test(expectedSha)) throw new Error('Invalid original commit SHA');
  await git('check-ref-format', `refs/heads/${branch}`);
  const ref = `refs/heads/${branch}`;
  const remoteSha = async () => (await git('ls-remote', '--refs', 'origin', ref)).split(/\s/)[0];
  if (await git('rev-parse', 'HEAD') !== expectedSha) throw new Error('Local HEAD changed during enhancement');
  if (await remoteSha() !== expectedSha) {
    log('Remote branch moved; skipping enhancement to preserve newer commits.');
    return false;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'commit-enhancer-'));
  try {
    const file = path.join(dir, 'message');
    await fs.writeFile(file, message);
    // --only prevents unrelated staged changes from entering the amended commit.
    await git('commit', '--amend', '--only', '-F', file);
    try {
      await git('push', '--no-verify', `--force-with-lease=${ref}:${expectedSha}`, 'origin', `HEAD:${ref}`);
    } catch (error) {
      if (await remoteSha() !== expectedSha) {
        log('Remote branch moved during push; lease protected newer commits.');
        return false;
      }
      throw error;
    }
    return true;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
module.exports = { amendAndPush };
