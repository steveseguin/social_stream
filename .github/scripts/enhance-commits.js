const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Configuration
const MAX_DIFF_SIZE = 20000; // Characters - truncate if larger
const MAX_FILES_TO_SAMPLE = 5; // Maximum number of files to include in the diff
const SAMPLE_LINES_PER_FILE = 200; // Maximum lines to include per file

// OpenCode Zen API Configuration
const ZEN_RESPONSES_ENDPOINT = 'https://opencode.ai/zen/v1/responses';
const ZEN_CHAT_COMPLETIONS_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
const ZEN_MODELS_ENDPOINT = "https://opencode.ai/zen/v1/models";
const OPENCODE_ZEN_FREE_MODEL_ORDER = [
    "big-pickle",
    "deepseek-v4-flash-free",
    "mimo-v2.5-free",
    "qwen3.6-plus-free",
    "minimax-m3-free",
    "nemotron-3-ultra-free",
    "nemotron-3-super-free"
];
const ZEN_API_KEY = process.env.ZEN_API_TOKEN;

let openCodeZenModelFreeMetadata = {};
let openCodeZenModelApiOrder = {};

// --- Error Handling ---
class ScriptError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ScriptError';
    this.context = context;
  }
}

// --- Logging ---
// Simple logger function
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context);
}

// Validate OpenCode Zen API key
if (!ZEN_API_KEY) {
  log('error', 'ZEN_API_TOKEN environment variable is not set.');
  process.exit(1);
}
log('info', 'OpenCode Zen API configuration loaded successfully.');

function extractResponseText(responseData) {
  if (responseData?.output?.length) {
    for (const item of responseData.output) {
      const content = item?.content || [];
      for (const block of content) {
        if (typeof block?.text === 'string' && block.text.trim()) {
          return block.text.trim();
        }
      }
      if (typeof item?.text === 'string' && item.text.trim()) {
        return item.text.trim();
      }
    }
  }
  return responseData?.choices?.[0]?.message?.content?.trim() || null;
}

function isOpenCodeZenFreeModel(modelId) {
  modelId = String(modelId || "").toLowerCase();
  return modelId === "big-pickle" || /-free$/.test(modelId);
}

function inferOpenCodeZenModelFreeFlag(modelId, entry = {}) {
  const normalized = String(modelId || "").toLowerCase();
  if (!normalized) {
    return false;
  }
  if (entry && typeof entry === "object") {
    if (typeof entry.is_free === "boolean") return entry.is_free;
    if (typeof entry.free === "boolean") return entry.free;
    if (entry.meta && typeof entry.meta === "object" && typeof entry.meta.is_free === "boolean") {
      return entry.meta.is_free;
    }
    const pricing = entry.pricing && typeof entry.pricing === "object" ? entry.pricing : null;
    if (pricing) {
      const pricingValues = [pricing.input, pricing.output, pricing.prompt, pricing.completion];
      for (const value of pricingValues) {
        if (value === undefined || value === null) continue;
        const numeric = Number(String(value).trim());
        if (!Number.isNaN(numeric) && numeric <= 0) {
          return true;
        }
      }
    }
  }
  return isOpenCodeZenFreeModel(normalized);
}

function getOpenCodeZenModelListRank(modelId) {
  const lower = String(modelId || "").toLowerCase();
  const index = OPENCODE_ZEN_FREE_MODEL_ORDER.indexOf(lower);
  return index === -1 ? OPENCODE_ZEN_FREE_MODEL_ORDER.length : index;
}

function isOpenCodeZenFreeFromMetadata(modelId) {
  const key = String(modelId || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(openCodeZenModelFreeMetadata, key)) {
    return !!openCodeZenModelFreeMetadata[key];
  }
  return isOpenCodeZenFreeModel(modelId);
}

function sortOpenCodeZenModels(modelIds) {
  return modelIds.slice().sort(function (a, b) {
    const aFree = isOpenCodeZenFreeFromMetadata(a);
    const bFree = isOpenCodeZenFreeFromMetadata(b);
    if (aFree !== bFree) {
      return aFree ? -1 : 1;
    }
    const aOrder = Object.prototype.hasOwnProperty.call(openCodeZenModelApiOrder, String(a || "").toLowerCase())
      ? openCodeZenModelApiOrder[String(a || "").toLowerCase()]
      : Number.MAX_SAFE_INTEGER;
    const bOrder = Object.prototype.hasOwnProperty.call(openCodeZenModelApiOrder, String(b || "").toLowerCase())
      ? openCodeZenModelApiOrder[String(b || "").toLowerCase()]
      : Number.MAX_SAFE_INTEGER;

    if (aFree) {
      const rankDiff = getOpenCodeZenModelListRank(a) - getOpenCodeZenModelListRank(b);
      if (rankDiff) return rankDiff;
    }
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return String(a).localeCompare(String(b));
  });
}

async function getZenModelCandidates() {
  const fallbackModels = OPENCODE_ZEN_FREE_MODEL_ORDER.slice();
  try {
    const response = await axios.get(ZEN_MODELS_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZEN_API_KEY}`
      },
      timeout: 30000
    });
    const payload = response?.data || {};
    const entries = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = entries
      .map(function (entry, index) {
        const id = entry && entry.id ? String(entry.id).trim() : "";
        if (!id) return null;
        return {
          id,
          isFree: inferOpenCodeZenModelFreeFlag(id, entry),
          order: index
        };
      })
      .filter(Boolean);
    if (!normalized.length) {
      return fallbackModels;
    }
    const ids = [];
    openCodeZenModelFreeMetadata = {};
    openCodeZenModelApiOrder = {};
    normalized.forEach(function (entry) {
      const id = String(entry.id || "").trim();
      if (!id) return;
      const lower = id.toLowerCase();
      openCodeZenModelApiOrder[lower] = Number.isFinite(entry.order) ? entry.order : Number.MAX_SAFE_INTEGER;
      openCodeZenModelFreeMetadata[lower] = !!entry.isFree;
      ids.push(id);
    });
    return sortOpenCodeZenModels(ids);
  } catch (error) {
    log('warn', 'Failed to load Zen model list, using built-in free model order.', {
      status: error?.response?.status,
      message: error?.message
    });
    openCodeZenModelFreeMetadata = {};
    openCodeZenModelApiOrder = {};
    OPENCODE_ZEN_FREE_MODEL_ORDER.forEach(function (modelId) {
      openCodeZenModelFreeMetadata[String(modelId || "").toLowerCase()] = true;
      openCodeZenModelApiOrder[String(modelId || "").toLowerCase()] = Number.MAX_SAFE_INTEGER - 1;
    });
    return fallbackModels;
  }
}

function getOpenCodeZenCandidateModels(models) {
  const onlyChatModels = models.filter(function (modelId) {
    const normalized = String(modelId || "").toLowerCase();
    if (!normalized) return false;
    if (normalized === "big-pickle" || normalized.indexOf("deepseek-") === 0 || normalized.indexOf("minimax-") === 0 || normalized.indexOf("glm-") === 0 || normalized.indexOf("kimi-") === 0 || normalized.indexOf("mimo-") === 0 || normalized.indexOf("nemotron-") === 0 || normalized.indexOf("grok-build") === 0) {
      return true;
    }
    return false;
  });
  return sortOpenCodeZenModels(onlyChatModels.length ? onlyChatModels : OPENCODE_ZEN_FREE_MODEL_ORDER.slice());
}

async function callZenModelWithFallback(endpoint, payload) {
  const response = await axios.post(endpoint, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZEN_API_KEY}`
    },
    timeout: 60000
  });
  return extractResponseText(response?.data || {});
}

/**
 * Calls the OpenCode Zen API with system and user prompts.
 * Tries the Zen responses endpoint first, then falls back to chat/completions.
 * @param {string} systemPrompt - The system instructions.
 * @param {string} userPrompt - The user message/data.
 * @returns {Promise<string|null>} - The API response content or null if failed.
 */
async function callZaiApi(systemPrompt, userPrompt) {
  const allModels = await getZenModelCandidates();
  const candidates = getOpenCodeZenCandidateModels(allModels);
  const tried = {};
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const model = String(candidates[i] || "").trim();
    if (!model || tried[model]) continue;
    tried[model] = true;

    const responsesPayload = {
      model,
      instructions: systemPrompt,
      input: [{ role: 'user', content: userPrompt }],
      temperature: 0.7
    };

    try {
      const responsesText = await callZenModelWithFallback(ZEN_RESPONSES_ENDPOINT, responsesPayload);
      if (responsesText) {
        return responsesText;
      }
      log('warn', 'Zen responses request returned no text, trying chat/completions fallback on same model.', { model });
    } catch (responseError) {
      log('warn', 'Zen responses endpoint failed for model, trying chat/completions fallback.', {
        model,
        status: responseError?.response?.status,
        statusText: responseError?.response?.statusText
      });
    }

    const chatPayload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      stream: false
    };
    try {
      const chatText = await callZenModelWithFallback(ZEN_CHAT_COMPLETIONS_ENDPOINT, chatPayload);
      if (chatText) {
        return chatText;
      }
    } catch (chatError) {
      lastError = chatError;
      log('warn', 'Zen chat/completions endpoint failed for model, trying next model.', {
        model,
        status: chatError?.response?.status,
        statusText: chatError?.response?.statusText
      });
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

// --- Git Operations ---
/**
 * Runs a shell command and returns its stdout.
 * @param {string} command - The command to execute.
 * @returns {Promise<string>} - The stdout of the command.
 * @throws {ScriptError} - If the command fails.
 */
async function runCommand(command) {
  log('debug', `Running command: ${command}`);
  return new Promise((resolve, reject) => {
    // Increased maxBuffer just in case, though diff limiting should help
    exec(command, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        log('error', `Command failed: ${command}`, { error: error.message, stderr });
        reject(new ScriptError(`Command failed: ${command}`, { stderr, error }));
        return;
      }
      // Log stderr as warning, as some git commands output info here (like fetch)
      if (stderr) {
        log('warn', `Command stderr: ${command}`, { stderr });
      }
      log('debug', `Command success: ${command}`);
      resolve(stdout.trim());
    });
  });
}

/**
 * Gets the SHA of the last commit.
 * @returns {Promise<string>} - The commit SHA.
 */
async function getLastCommit() {
  return await runCommand('git log -1 --pretty=%H');
}

/**
 * Gets the full message of a specific commit.
 * @param {string} commitSha - The SHA of the commit.
 * @returns {Promise<string>} - The commit message.
 */
async function getLastCommitMessage(commitSha) {
  return await runCommand(`git log -1 --pretty=%B ${commitSha}`);
}

/**
 * Gets the current branch name.
 * @returns {Promise<string>} - The branch name.
 */
async function getBranchName() {
  try {
    const branch = await runCommand('git rev-parse --abbrev-ref HEAD');
    // Handle detached HEAD state
    if (branch === 'HEAD') {
        log('warn', 'Running in detached HEAD state.');
        // Optionally try to get branch name from GITHUB_REF
        const ref = process.env.GITHUB_REF; // e.g., refs/heads/feature-branch
        if (ref && ref.startsWith('refs/heads/')) {
            return ref.substring(11);
        }
        return 'detached-HEAD';
    }
    return branch;
  } catch (error) {
    log('warn', 'Could not get branch name, defaulting to "unknown".', { error: error.message });
    return 'unknown';
  }
}

/**
 * Gets the list of changed files (status and path).
 * @param {string} commitSha - The commit SHA to analyze.
 * @returns {Promise<Array<{status: string, file: string}>>} - List of changed files.
 */
async function getChangedFiles(commitSha) {
  // Use --no-renames to simplify status (M, A, D, T)
  const diffOutput = await runCommand(`git show ${commitSha} --oneline --name-status --no-renames`);
  // Output format:
  // <sha> <subject>
  // M       path/to/modified/file.txt
  // A       path/to/added/file.txt
  // D       path/to/deleted/file.txt
  return diffOutput
    .split('\n')
    .slice(1) // Skip the first line (commit subject)
    .filter(line => /^[MADT]\t/.test(line.trim())) // Filter for valid status lines
    .map(line => {
      const [status, file] = line.trim().split('\t');
      return { status, file };
    });
}

/**
 * Generates a summary of changed directories based on file paths.
 * @param {Array<{status: string, file: string}>} changedFiles - List of changed files.
 * @returns {string} - A summary string.
 */
function getDirectorySummary(changedFiles) {
  const directories = new Set();
  const componentMapping = {
    'publish.py': 'Main pythong script for publishing and viewing WebRTC streams using Gstreamer'
  };
  const knownComponents = new Set();

  for (const { file } of changedFiles) {
    const dirname = path.dirname(file);
    const topLevelDir = file.split('/')[0];

    // Check direct file mapping
    if (componentMapping[path.basename(file)]) {
        knownComponents.add(componentMapping[path.basename(file)]);
    }
    // Check top-level directory mapping
    else if (componentMapping[topLevelDir]) {
        knownComponents.add(componentMapping[topLevelDir]);
    }
    // Check specific nested dirs like .github/scripts
    else if (dirname.startsWith('.github/scripts')) {
        knownComponents.add('GitHub Action Scripts');
    } else if (dirname.startsWith('.github')) {
        knownComponents.add(componentMapping['.github']);
    }
     // Add directory if not root
    else if (dirname !== '.') {
      directories.add(dirname);
    }

    // Simple keyword check (can be expanded)
    if (file.includes('tts') || dirname.includes('tts')) knownComponents.add('TTS Module');
    if (file.includes('api') || dirname.includes('api')) knownComponents.add('API Handling');
  }

  let summary = 'Areas changed: ';
  if (knownComponents.size > 0) {
      summary += [...knownComponents].join(', ');
  } else if (directories.size > 0) {
      // Fallback to directories if no specific components identified
       summary += [...directories].slice(0, 3).join(', ') + (directories.size > 3 ? ', ...' : '');
  } else {
      summary += 'Root level files.'; // More specific fallback
  }
  return summary;
}


/**
 * Gets a summarized diff for a commit, handling large files and binary files.
 * @param {string} commitSha - The commit SHA.
 * @param {Array<{status: string, file: string}>} changedFiles - List of changed files.
 * @returns {Promise<string>} - The summarized diff string.
 */
async function getCommitDiff(commitSha, changedFiles) {
  log('info', `Generating diff summary for ${changedFiles.length} files.`);
  // Limit number of files to process for the diff content
  const filesToDiff = changedFiles.slice(0, MAX_FILES_TO_SAMPLE);
  let combinedDiff = '';
  let currentSize = 0;

  for (const { status, file } of filesToDiff) {
    if (currentSize >= MAX_DIFF_SIZE) {
        log('warn', 'Reached MAX_DIFF_SIZE limit while collecting diffs.');
        combinedDiff += `\n\n[Diff truncated: MAX_DIFF_SIZE (${MAX_DIFF_SIZE} chars) reached]`;
        break; // Stop processing more files if limit reached
    }

    let fileDiffContent = '';
    try {
      // Check if the file is binary *before* trying to get diff content
      // Using `git diff --numstat` is a safer way to check type before `git show`
      // Use commitSha^! which means "diff between parent and commitSha"
      const diffStat = await runCommand(`git diff --numstat ${commitSha}^! -- "${file}"`);
      const isBinary = diffStat.startsWith('-\t-'); // Binary files show as "- -" for added/deleted lines

      if (isBinary) {
        fileDiffContent = `[Binary file (${status}): ${file}]`;
      } else if (status === 'D') {
        // For deleted files, just indicate deletion
        fileDiffContent = `[File deleted: ${file}]`;
      } else if (status === 'A' || status === 'M' || status === 'T') {
        // For added, modified, or type-changed text files, get the diff
        // Use --unified=5 for a bit more context around changes
        const rawDiff = await runCommand(`git show --unified=5 ${commitSha} -- "${file}"`);
        const diffLines = rawDiff.split('\n');

        // Sample the diff if it's too large
        if (diffLines.length > SAMPLE_LINES_PER_FILE) {
          log('debug', `Sampling large diff for file: ${file} (${diffLines.length} lines)`);
          const headerLines = diffLines.findIndex(line => line.startsWith('@@')); // Find start of first hunk
          const header = diffLines.slice(0, headerLines >= 0 ? headerLines : 4).join('\n'); // Keep header
          const hunkStartIndex = headerLines >= 0 ? headerLines : 4;

          // Try to get lines from the start and end of the actual changes
          const changeLines = diffLines.slice(hunkStartIndex);
          const firstChunk = changeLines.slice(0, Math.floor(SAMPLE_LINES_PER_FILE / 2)).join('\n');
          const lastChunk = changeLines.slice(-Math.floor(SAMPLE_LINES_PER_FILE / 2)).join('\n');
          fileDiffContent = `${header}\n${firstChunk}\n... [Diff truncated due to line count] ...\n${lastChunk}`;
        } else {
          fileDiffContent = rawDiff;
        }
      } else {
        // Handle other statuses like R (rename), C (copy) if needed, or just note them
         fileDiffContent = `[File status ${status}: ${file}]`; // Generic fallback
      }

      // Check size before adding
      if (currentSize + fileDiffContent.length > MAX_DIFF_SIZE) {
          const remainingSpace = MAX_DIFF_SIZE - currentSize;
          combinedDiff += `\n\n=== ${status}: ${file} ===\n${fileDiffContent.substring(0, remainingSpace)}... [Truncated file diff]`;
          currentSize = MAX_DIFF_SIZE; // Mark as full
          log('warn', `Truncated diff content for file ${file} to fit MAX_DIFF_SIZE.`);
      } else {
          combinedDiff += `\n\n=== ${status}: ${file} ===\n${fileDiffContent}`;
          currentSize += fileDiffContent.length;
      }

    } catch (error) {
      // Log error but continue processing other files
      log('error', `Error processing diff for file: ${file}`, { error: error.message });
      const errorMsg = `\n[Error processing diff for ${file}: ${error.message}]\n`;
       // Add error message if space allows
      if (currentSize + errorMsg.length <= MAX_DIFF_SIZE) {
          combinedDiff += errorMsg;
          currentSize += errorMsg.length;
      }
    }
  }

  // Add info about omitted files if any
  if (changedFiles.length > MAX_FILES_TO_SAMPLE) {
    const omitted = changedFiles.length - MAX_FILES_TO_SAMPLE;
    const omittedMsg = `\n\n[...and ${omitted} more file(s) changed, not included in diff summary...]`;
    if (currentSize + omittedMsg.length <= MAX_DIFF_SIZE) {
        combinedDiff += omittedMsg;
    }
  }

  log('info', `Generated diff summary, final size: ${combinedDiff.length} chars.`);
  return combinedDiff;
}


/**
 * Gets recent commit subjects from the current branch since merging from main/master.
 * @param {string} branchName - The current branch name.
 * @returns {Promise<string[]>} - Array of recent commit subjects.
 */
async function getRecentBranchCommits(branchName) {
  // Avoid showing history relative to the base branch itself
  if (['main', 'master', 'develop'].includes(branchName) || branchName === 'unknown' || branchName === 'detached-HEAD') {
    log('info', `Skipping recent commit history check for branch: ${branchName}`);
    return [];
  }
  try {
    // Determine the base branch (try origin/main, then origin/master)
    let baseBranch = 'origin/main';
    try {
        await runCommand(`git show-ref --verify refs/remotes/${baseBranch}`);
        log('debug', `Using base branch: ${baseBranch}`);
    } catch {
        log('debug', `Base branch ${baseBranch} not found, trying origin/master.`);
        baseBranch = 'origin/master';
        try {
            await runCommand(`git show-ref --verify refs/remotes/${baseBranch}`);
            log('debug', `Using base branch: ${baseBranch}`);
        } catch {
            log('warn', `Could not find standard base branches (origin/main, origin/master). Cannot determine recent commits accurately.`);
            return [];
        }
    }

    // Find the merge base with the determined base branch
    const mergeBase = await runCommand(`git merge-base ${baseBranch} HEAD`);
    log('debug', `Merge base with ${baseBranch}: ${mergeBase.substring(0, 8)}`);

    // Get log subjects since the merge base, limit to 5 (excluding the current one being amended)
    // Use a format that helps distinguish commits if needed
    // Ensure HEAD~1 doesn't cause an error if there's only one commit since merge base
    const commitRange = `${mergeBase}..HEAD`;
    const logCheck = await runCommand(`git rev-list --count ${commitRange}`);
    const commitCount = parseInt(logCheck, 10);

    let logCommand = `git log --pretty="format:%h %s" ${commitRange} -n 5`;
    if (commitCount > 1) {
        // Only use HEAD~1 if there's more than one commit to avoid errors
        logCommand = `git log --pretty="format:%h %s" ${mergeBase}..HEAD~1 -n 5`;
    } else {
         log('info', 'Only one commit found since merge base, cannot exclude HEAD~1.');
         // If only one commit, there are no *previous* commits on the branch
         return [];
    }


    const logOutput = await runCommand(logCommand);
    if (!logOutput) {
        log('info', 'No previous commits found on this branch since merge base.');
        return [];
    }
    const commits = logOutput.split('\n').filter(s => s.trim() !== '');
    log('info', `Found ${commits.length} recent commit(s) on branch "${branchName}".`);
    return commits;
  } catch (error) {
    // Log error but don't fail the whole script
    log('warn', 'Could not get recent branch commits.', { error: error.message });
    return [];
  }
}


// --- AI Enhancement ---

/**
 * Enhances the commit message using the Gemini API.
 * @param {string} originalMessage - The original commit message.
 * @param {string} diff - The summarized code diff.
 * @param {string} branchName - The current Git branch name.
 * @param {string} dirSummary - A summary of changed directories/components.
 * @param {string[]} recentCommits - A list of recent commit subjects on the branch.
 * @returns {Promise<string|null>} - The enhanced commit message or null if failed.
 */
async function enhanceCommitMessage(originalMessage, diff, branchName, dirSummary, recentCommits) {
  log('info', 'Generating enhanced commit message...');

  const recentCommitLines = recentCommits.length > 0
     ? `* **Recent Steps on Branch (${branchName}):**\n${recentCommits.map(s => `        * ${s}`).join('\n')}`
     : `* **Recent Steps on Branch (${branchName}):** (This appears to be the first commit on this branch since merging from the base branch)`;

  const systemPrompt = `You are an expert developer assistant tasked with refining Git commit messages for the "Social Stream Ninja" project. Your goal is to create a message that follows Conventional Commits format (e.g., "feat:", "fix:", "chore:", "refactor:", "style:", "test:", "docs:", "build:", "ci:") and provides clear, concise, and informative context about the changes.

**Project Context: Social Stream Ninja**
* **Purpose:**  Real-time chat aggregation and overlay tooling for live streams across platforms; supports Chrome extension, Electron app, and standalone Lite web apps
* **Technology Stack:** JavaScript/HTML/CSS, Browser Extension APIs, Electron IPC, WebSockets/WebRTC integrations, shared provider cores (YouTube/Twitch/Kick), static web deployment.

**Guidelines:**

1.  **Format:** Use the Conventional Commits specification (<type>[optional scope]: <description>). Choose the most appropriate type (feat, fix, chore, refactor, style, test, docs, build, ci). The scope (e.g., \`feat(api)\`, \`fix(twitch)\`, \`chore(deps)\`) is optional but encouraged if the change primarily affects a specific component.
2.  **Subject Line:**
    * Start with the Conventional Commit type/scope.
    * Provide a concise summary of the change (imperative mood, e.g., "Add user authentication" not "Added user authentication").
    * Keep the subject line under 72 characters.
3.  **Body (Optional but Recommended):**
    * Separate the subject from the body with a blank line.
    * Explain the *what* and *why* of the change in more detail.
    * Use bullet points (-) for distinct changes if applicable.
    * Reference specific files, components (e.g., \`dock.html\`, TTS module, GitHub Actions), or features affected.
    * Incorporate context from the branch name, directory summary, and recent commits if relevant (e.g., "Continues work on feature X from previous commits").
4.  **Tone:** Professional and clear.
5.  **Focus:** The message should *only* contain the commit message itself, starting directly with the type/scope. Do not add introductions like "Here is the enhanced commit message:". Crucially, do not include bracketed tags like '[skip ci]', '[auto-enhanced]', '[skip pages]', etc., in your generated message text.`;

  const userPrompt = `Analyze the provided information and generate an improved commit message:

* **Original Commit Message:**
    \`\`\`
    ${originalMessage}
    \`\`\`
* **Branch Context:** Currently on branch \`${branchName}\`.
* **Directory/Component Summary:** ${dirSummary}
${recentCommitLines}
* **Code Diff Summary:**
    \`\`\`diff
    ${diff}
    \`\`\`

**Generate the improved commit message now:**`;

  try {
    log('debug', 'Sending prompt to OpenCode Zen API.');
    const enhancedMessage = await callZaiApi(systemPrompt, userPrompt);
    if (!enhancedMessage) {
        throw new Error('Empty response from OpenCode Zen API.');
    }
      log('info', 'Successfully received enhanced commit message from OpenCode Zen API.');
    log('debug', 'Enhanced Message:', { message: enhancedMessage });
    if (!/^(feat|fix|chore|refactor|style|test|docs|build|ci)/.test(enhancedMessage)) {
        log('warn', 'Generated message does not strictly follow Conventional Commit format.', { message: enhancedMessage });
    }
    return enhancedMessage;
  } catch (error) {
    log('error', 'Error calling OpenCode Zen API', { errorMessage: error.message });
    if (error.response) {
        log('error', 'OpenCode Zen API Error Response:', { data: error.response.data });
    }
    return null;
  }
}

// --- Git Update ---

/**
 * Amends the last commit with a new message and force-pushes.
 * @param {string} newMessage - The new commit message.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function updateCommitMessage(newMessage) {
  log('info', 'Updating commit message...');
  const tempFilePath = path.join(process.cwd(), `.git-commit-msg-${Date.now()}.tmp`); 

  try {
    try {
        await runCommand('git config user.name');
        await runCommand('git config user.email');
        log('debug', 'Git user already configured.');
    } catch {
        log('info', 'Configuring Git user for commit amend...');
        await runCommand('git config --global user.name "GitHub Action (Commit Enhancer)"');
        await runCommand('git config --global user.email "actions@github.com"');
    }

    log('debug', `Writing new commit message to temporary file: ${tempFilePath}`);
    const finalMessage = `${newMessage}\n\n[auto-enhanced]`; 
    await fs.writeFile(tempFilePath, finalMessage);

    log('info', 'Amending commit with new message...');
    await runCommand(`git commit --amend -F "${tempFilePath}"`); 

    log('info', 'Force-pushing amended commit (with --no-verify)...');
    await runCommand('git push --force --no-verify');

    log('info', 'Commit amended and pushed successfully.');
    return true;
  } catch (error) {
    log('error', 'Failed to update commit message and push.');
    return false;
  } finally {
    try {
      log('debug', `Cleaning up temporary file: ${tempFilePath}`);
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      log('warn', `Failed to delete temporary commit message file: ${tempFilePath}`, { error: cleanupError.message });
    }
  }
}

// --- PR Description Update (Optional) ---

/**
 * Updates the Pull Request description using the Gemini API (if applicable).
 * This function is designed to run only in a PR context.
 */
async function updatePRDescription() {
  // Only run for PR events specified in the workflow
  if (!process.env.GITHUB_EVENT_NAME || !['pull_request', 'pull_request_target'].includes(process.env.GITHUB_EVENT_NAME)) {
    log('info', 'Not a pull_request event, skipping PR description update.');
    return;
  }
  // Check for necessary environment variables
  if (!process.env.GITHUB_EVENT_PATH || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_TOKEN || !process.env.GITHUB_SHA) {
      log('warn', 'Missing necessary GitHub environment variables for PR update. Skipping.');
      return;
  }

  log('info', 'Pull Request event detected, attempting to update PR description...');

  try {
    // Get PR information from the event payload
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const eventData = JSON.parse(await fs.readFile(eventPath, 'utf8'));

    if (!eventData.pull_request || !eventData.pull_request.number) {
        log('warn', 'Could not find PR number in event payload. Skipping PR update.');
        return;
    }
    const prNumber = eventData.pull_request.number;
    const repoFullName = process.env.GITHUB_REPOSITORY;
    const prDescription = eventData.pull_request.body || '';
    const prTitle = eventData.pull_request.title || '';
    const prSourceBranch = eventData.pull_request.head.ref;
    const prTargetBranch = eventData.pull_request.base.ref;

    log('info', `Processing PR #${prNumber} ('${prTitle}') from ${prSourceBranch} to ${prTargetBranch}.`);

    // Get the diff for the PR (compare target branch base with current PR head)
    // Fetch necessary refs first to ensure diff is accurate
    log('debug', `Fetching target branch ${prTargetBranch} and PR head...`);
    await runCommand(`git fetch origin ${prTargetBranch}:${prTargetBranch}`); // Fetch target branch
    await runCommand(`git fetch origin pull/${prNumber}/head:pr-${prNumber}`); // Fetch PR head ref

    log('debug', `Generating diff between ${prTargetBranch} and pr-${prNumber}...`);
    // Diff between the merge base of target and PR head, and the PR head itself
    const mergeBase = await runCommand(`git merge-base ${prTargetBranch} pr-${prNumber}`);
    const prDiff = await runCommand(`git diff ${mergeBase} pr-${prNumber}`);

    // Limit diff size for the prompt
    const diffSnippet = prDiff.length > MAX_DIFF_SIZE
        ? prDiff.substring(0, MAX_DIFF_SIZE) + '\n\n[Diff truncated due to size]'
        : prDiff;

    log('info', `Generating enhanced PR description (diff size: ${diffSnippet.length} chars)...`);

    // Generate enhanced description using OpenCode Zen
    const systemPrompt = `You are an expert developer assistant helping refine a Pull Request description for the "Social Stream Ninja" project.

**Project Context: Social Stream Ninja**
* **Purpose:**  Real-time chat aggregation and overlay tooling for live streams across platforms; supports Chrome extension, Electron app, and standalone Lite web apps
* **Technology Stack:** JavaScript/HTML/CSS, Browser Extension APIs, Electron IPC, WebSockets/WebRTC integrations, shared provider cores (YouTube/Twitch/Kick), static web deployment.

**Guidelines:**

1.  **Structure:** Organize the description logically (e.g., Purpose, Changes, How to Test, Considerations). Use Markdown formatting (headings, lists).
2.  **Purpose:** Clearly state the main goal of the PR. What problem does it solve or what feature does it add?
3.  **Key Changes:** Summarize the main modifications using bullet points. Mention affected components or features (e.g., "Updated Twitch integration", "Refactored API error handling", "Improved \`dock.html\` layout").
4.  **Context/Why:** Briefly explain the reasoning behind the changes if not obvious.
5.  **Testing:** (Optional but helpful) Suggest how reviewers can test the changes.
6.  **Relate to Diff:** Ensure the description accurately reflects the code changes shown in the diff summary.
7.  **Tone:** Professional and informative.
8.  **Output:** Provide *only* the enhanced PR description text in Markdown format. Do not include introductory phrases like "Here's the updated description:". If the original description is good, you can refine it or even state that no major changes are needed (though usually, adding structure is beneficial).`;

    const userPrompt = `Review the existing PR information and generate an improved, comprehensive PR description:

* **PR Title:** ${prTitle}
* **Target Branch:** ${prTargetBranch}
* **Source Branch:** ${prSourceBranch}
* **Original PR Description:**
    \`\`\`markdown
    ${prDescription}
    \`\`\`
* **Summary of Code Changes (Diff):**
    \`\`\`diff
    ${diffSnippet}
    \`\`\`

**Generate the improved PR description now:**`;

    const enhancedDescription = await callZaiApi(systemPrompt, userPrompt);
    if (!enhancedDescription) {
        throw new Error('Empty response from OpenCode Zen API for PR description.');
    }

    // Update PR description via GitHub API
    const [owner, repo] = repoFullName.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    log('info', `Sending PATCH request to update PR #${prNumber} description.`);

    await axios({
      method: 'patch',
      url: apiUrl,
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Action-Enhance-Commits' // Good practice
      },
      data: {
        body: enhancedDescription // Send the generated description
      }
    });

    log('info', `PR #${prNumber} description updated successfully.`);

  } catch (error) {
    log('error', 'Failed to update PR description.', {
        errorMessage: error.message,
        response: error.response ? { status: error.response.status, data: error.response.data } : 'N/A'
    });
    // Do not exit the script here, allow commit enhancement to proceed if possible
  }
}


// --- Main Execution ---

/**
 * Main function to orchestrate the commit enhancement process.
 */
async function main() {
  log('info', 'Starting commit enhancement process...');

  // Ensure we are in a git repository
  await runCommand('git rev-parse --is-inside-work-tree');

  // Configure safe directory (needed in GitHub Actions)
  await runCommand(`git config --global --add safe.directory ${process.env.GITHUB_WORKSPACE}`);

  // --- PR Description Update (Run First) ---
  // Attempt to update PR description if applicable. Continue even if it fails.
  await updatePRDescription();

  // --- Commit Message Enhancement ---
  log('info', 'Proceeding with commit message enhancement...');
  try {
    // Get context: latest commit, original message, branch, recent commits
    const commitSha = await getLastCommit();
    log('info', `Processing commit: ${commitSha.substring(0,8)}`);
    const originalMessage = await getLastCommitMessage(commitSha);
    const branchName = await getBranchName();
    log('info', `Current branch: ${branchName}`);

    // Fetch history needed for diffs and recent commits
    // Fetch depth might need adjustment in checkout step if merge base is far back
    log('debug', 'Fetching remote history (needed for diffs/merge-base)...');
    try {
        // Use --quiet to reduce stderr noise unless there's an actual error
        await runCommand('git fetch --prune --unshallow --tags --quiet');
    } catch {
        log('debug', 'Repository likely not shallow or unshallow failed, proceeding with standard fetch.');
        // Use --quiet here too
        await runCommand('git fetch --prune --tags --quiet');
    }


    const recentCommits = await getRecentBranchCommits(branchName);

    // Get changed files and directory summary
    const changedFiles = await getChangedFiles(commitSha);
    if (changedFiles.length === 0) {
        log('warn', `No changed files detected for commit ${commitSha}. This might indicate an issue or an empty commit. Skipping enhancement.`);
        process.exit(0); // Exit gracefully if no files changed
    }
    const dirSummary = getDirectorySummary(changedFiles);
    log('info', `Directory summary: ${dirSummary}`);

    // Get the summarized diff
    const diff = await getCommitDiff(commitSha, changedFiles);

    // Generate the enhanced commit message
    const enhancedMessage = await enhanceCommitMessage(
      originalMessage,
      diff,
      branchName,
      dirSummary,
      recentCommits // Pass the list of recent commit subjects
    );

    // Check if enhancement was successful (API returned something)
    // REMOVED: || enhancedMessage.toLowerCase().includes("error")
    if (!enhancedMessage || enhancedMessage.trim() === '') {
      log('error', 'Failed to generate a valid enhanced commit message from OpenCode Zen API (empty response). Aborting update.');
      process.exit(1); // Exit with error if enhancement failed critically
    }

    // Compare original and enhanced messages (prevents unnecessary amends/loops)
    if (enhancedMessage.trim() === originalMessage.trim()) {
        log('info', 'Enhanced message is identical to the original. No update needed.');
        process.exit(0); // Exit gracefully
    }

    // Update the commit message and force push
    const updated = await updateCommitMessage(enhancedMessage);

    if (updated) {
      log('info', 'Commit message enhanced and pushed successfully.');
      process.exit(0); // Explicitly exit with success code
    } else {
      log('error', 'Failed to update and push the enhanced commit message.');
      process.exit(1); // Exit with error code
    }
  } catch (error) {
    // Catch errors from the main enhancement logic (e.g., git commands failing)
    log('error', 'An unexpected error occurred during commit enhancement.', {
        errorMessage: error.message,
        stack: error.stack,
        context: error instanceof ScriptError ? error.context : undefined
    });
    process.exit(1); // Exit with error code
  }
}

// --- Script Entry Point ---
// Execute the main function and handle top-level promise rejection
main().catch(error => {
  // This catch is a fallback, errors should ideally be handled within main()
  log('error', 'Unhandled error in main execution', {
      errorMessage: error.message,
      stack: error.stack
  });
  process.exit(1);
});
