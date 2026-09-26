const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const exec = promisify(execFile);

function hasAssistantAttribution(message) {
  if (/\bclaude\b/i.test(message)) return true;
  const assistants = /\b(?:chatgpt|openai|anthropic|codex|copilot|gemini|cursor|aider|windsurf|codeium|devin|cline|roo[ -]?code|tabnine|amazon[ -]?q|deepseek|grok|ai|llm|artificial intelligence)\b/i;
  const credit = /\b(?:co[- ]?authored[- ]?by|(?:generated|written|authored|created|developed|implemented|coded|assisted|reviewed|powered)\s+(?:by|with)|with\s+(?:help|assistance)\s+from|thanks\s+to)\b/i;
  const genericCredit = /\b(?:ai|llm|artificial intelligence)[ -]+(?:assisted|generated|authored|written|created|developed|implemented|powered)\b/i;
  return message.split(/\r?\n/).some(line => genericCredit.test(line) || (credit.test(line) && assistants.test(line)));
}

async function amendAndPush(message, expectedSha, branch, { cwd = process.cwd(), log = console.log } = {}) {
  if (hasAssistantAttribution(message)) throw new Error('Assistant attribution is not allowed in commit messages');
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
  const identityFields = (await git('show', '-s', '--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI', expectedSha)).split('\0');
  if (identityFields.length !== 6 || identityFields.some(value => !value)) throw new Error('Original commit identity is incomplete');
  const commitEnv = { ...process.env };
  ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_DATE', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_DATE'].forEach((key, index) => {
    commitEnv[key] = identityFields[index];
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'commit-enhancer-'));
  try {
    const file = path.join(dir, 'message');
    await fs.writeFile(file, message);
    // --only prevents unrelated staged changes from entering the amended commit.
    await exec('git', ['commit', '--amend', '--only', '-F', file], { cwd, env: commitEnv });
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
