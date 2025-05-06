const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const MAX_DIFF_SIZE = 20000; // Characters - truncate if larger
const MAX_FILES_TO_SAMPLE = 5; // Maximum number of files to include in the diff
const SAMPLE_LINES_PER_FILE = 200; // Maximum lines to include per file

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

// Initialize Gemini API
let model;
try {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' }); // Change to a version now supported.
  log('info', 'Gemini API initialized successfully.');
} catch (error) {
  log('error', 'Failed to initialize Gemini API', { error: error.message });
  process.exit(1); // Exit if API key is missing or init fails
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
    'sources': 'Platform Integrations',
    'themes': 'Theming',
    'dock.html': 'Consolidated Chat Dashboard and Overlay UI',
    'featured.html': 'Featured Overlay UI',
    'background.js': 'Extension Core Logic and Message Routing',
    'manifest.json': 'Extension Manifest',
    '.github': 'GitHub Actions/Workflows', // Added mapping
    'scripts': 'Utility Scripts' // Added mapping
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

  // Prepare recent commits string for the prompt
  const recentCommitLines = recentCommits.length > 0
     ? `* **Recent Steps on Branch (${branchName}):**\n${recentCommits.map(s => `        * ${s}`).join('\n')}`
     : `* **Recent Steps on Branch (${branchName}):** (This appears to be the first commit on this branch since merging from the base branch)`;

  // Construct the prompt for the AI
  const prompt = `
You are an expert developer assistant tasked with refining Git commit messages for the "Social Stream Ninja" project. Your goal is to create a message that follows Conventional Commits format (e.g., "feat:", "fix:", "chore:", "refactor:", "style:", "test:", "docs:", "build:", "ci:") and provides clear, concise, and informative context about the changes.

**Project Context: Social Stream Ninja**

* **Purpose:** Consolidates live social messaging streams (Twitch, YouTube, Facebook, etc.) for content creators into a unified interface.
* **Core Features:** Multi-platform chat aggregation, customizable chat overlay (for OBS/streaming), Text-to-Speech (TTS), bot commands & automation, API support (message ingest/egress, webhooks for donations like Stripe/Ko-Fi), theming, standalone desktop app, and browser extension.
* **Key Components:** \`dock.html\` (main dashboard/controller), \`featured.html\` (chat overlay), \`sources/\` directory (platform integrations), \`custom.js\` (user scripting), TTS functionality, API handling logic, \`.github/\` (workflows/actions), \`scripts/\` (utility scripts).
* **Technology Stack:** Primarily JavaScript, HTML, CSS, Node.js (for scripts/actions), Browser Extension APIs, WebRTC (via VDO.Ninja), potentially Electron.

**Task:**

Analyze the provided information (original message, code diff, branch context, directory summary, recent commits) and generate an improved commit message adhering to the following guidelines:

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
5.  **Focus:** The message should *only* contain the commit message itself, starting directly with the type/scope. Do not add introductions like "Here is the enhanced commit message:".

**Input Data:**

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

**Generate the improved commit message now:**
`;

  try {
    log('debug', 'Sending prompt to Gemini API.');
    // Ensure the model object is valid before calling
    if (!model) {
        throw new Error('Gemini model is not initialized.');
    }
    const result = await model.generateContent(prompt);
    // Basic validation of the response structure
    if (!result || !result.response || typeof result.response.text !== 'function') {
        log('error', 'Invalid response structure received from Gemini API.', { response: result });
        throw new Error('Invalid response structure from Gemini API.');
    }
    const enhancedMessage = result.response.text().trim();
    log('info', 'Successfully received enhanced commit message from Gemini API.');
    log('debug', 'Enhanced Message:', { message: enhancedMessage }); // Log the message itself for debugging
    // Basic check if the response seems like a commit message (starts with a common type)
    if (!/^(feat|fix|chore|refactor|style|test|docs|build|ci)/.test(enhancedMessage)) {
        log('warn', 'Generated message does not strictly follow Conventional Commit format.', { message: enhancedMessage });
        // Decide if you want to proceed anyway or return null/error
    }
    return enhancedMessage;
  } catch (error) {
    log('error', 'Error calling Gemini API', { errorMessage: error.message, promptLength: prompt.length });
    // Log more details if available (e.g., error response from API)
    if (error.response) {
        log('error', 'Gemini API Error Response:', { data: error.response.data });
    }
    return null; // Indicate failure
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
  const tempFilePath = path.join(process.cwd(), `.git-commit-msg-${Date.now()}.tmp`); // Unique temp file

  try {
    // Configure Git user for the action (important for amend)
    // Check if already configured to avoid redundant calls/warnings
    try {
        await runCommand('git config user.name');
        await runCommand('git config user.email');
        log('debug', 'Git user already configured.');
    } catch {
        log('info', 'Configuring Git user for commit amend...');
        await runCommand('git config --global user.name "GitHub Action (Commit Enhancer)"');
        await runCommand('git config --global user.email "actions@github.com"');
    }

    // Write the new message to a temporary file
    log('debug', `Writing new commit message to temporary file: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, newMessage);

    // Amend the commit using the message from the file
    log('info', 'Amending commit with new message...');
    await runCommand(`git commit --amend -F "${tempFilePath}"`); // Use quotes for path safety

    // Force push the amended commit
    // Use --force-with-lease as a slightly safer alternative if possible,
    // but standard --force is often needed in this CI amend scenario.
    // Adding --no-verify to skip any potential pre-push hooks.
    log('info', 'Force-pushing amended commit (with --no-verify)...');
    await runCommand('git push --force --no-verify');

    log('info', 'Commit amended and pushed successfully.');
    return true;
  } catch (error) {
    // Error is already logged by runCommand, just log the overall failure here
    log('error', 'Failed to update commit message and push.');
    return false;
  } finally {
    // Clean up the temporary file in all cases (success or failure)
    try {
      log('debug', `Cleaning up temporary file: ${tempFilePath}`);
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      // Log cleanup error but don't mask the original error
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

    // Generate enhanced description using Gemini
    const prompt = `
You are an expert developer assistant helping refine a Pull Request description for the "Social Stream Ninja" project.

**Project Context:** (Same as commit message context - consolidates social streams, features like overlay, TTS, API, etc.)

**Task:**

Review the existing PR information (title, original description, code diff) and generate an improved, comprehensive PR description. The goal is to clearly explain the PR's purpose, changes, and potential impact.

**Guidelines:**

1.  **Structure:** Organize the description logically (e.g., Purpose, Changes, How to Test, Considerations). Use Markdown formatting (headings, lists).
2.  **Purpose:** Clearly state the main goal of the PR. What problem does it solve or what feature does it add?
3.  **Key Changes:** Summarize the main modifications using bullet points. Mention affected components or features (e.g., "Updated Twitch integration", "Refactored API error handling", "Improved \`dock.html\` layout").
4.  **Context/Why:** Briefly explain the reasoning behind the changes if not obvious.
5.  **Testing:** (Optional but helpful) Suggest how reviewers can test the changes.
6.  **Relate to Diff:** Ensure the description accurately reflects the code changes shown in the diff summary.
7.  **Tone:** Professional and informative.
8.  **Output:** Provide *only* the enhanced PR description text in Markdown format. Do not include introductory phrases like "Here's the updated description:". If the original description is good, you can refine it or even state that no major changes are needed (though usually, adding structure is beneficial).

**Input Data:**

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

**Generate the improved PR description now:**
`;

    const enhancedDescriptionResult = await model.generateContent(prompt);
    if (!enhancedDescriptionResult || !enhancedDescriptionResult.response || typeof enhancedDescriptionResult.response.text !== 'function') {
        throw new Error('Invalid response structure from Gemini API for PR description.');
    }
    const enhancedDescription = enhancedDescriptionResult.response.text().trim();

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
      log('error', 'Failed to generate a valid enhanced commit message from Gemini API (empty response). Aborting update.');
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
