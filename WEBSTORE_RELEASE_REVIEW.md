# Chrome Web Store Release Review

This is the working review file for preparing a manual Web Store upload from
the `chrome-web-store` branch.

Scope boundary: this file applies only to the `chrome-web-store` branch. Do not
apply these removals, limitations, or review assumptions to `main`, `beta`, the
website, Electron, Firefox, or any non-Web-Store build unless Steve explicitly
asks for that specific target.

## Branch Rules

- Keep this branch manually maintained.
- Do not add GitHub Actions, release scripts, or branch-generation scripts.
- Keep Web Store policy/review Markdown files on this branch only.
- Do not merge these Web Store-only docs back into `main` or `beta`.
- Do not let Web Store-specific feature removals bleed into `main` or `beta`.
- When pulling from `main`, review the diff manually before upload.

## What To Remove Or Verify

Do not remove features just because they are complicated. First identify the
specific Web Store problem. Prefer keeping useful working functionality when it
can be made compliant and accurately described.

Every proposed deletion needs a short reason:

- exact policy risk
- exact broken dependency or missing file
- exact misleading claim
- exact permission/privacy mismatch

If the reason is only "AI", "large", "complex", "reviewer might dislike it", or
"this looks scary", do not delete it. Inspect and fix the specific issue.

### Remove From This Branch If Present

- Adult-provider files, host permissions, UI labels, docs, and source references.
- Confirmed remote executable code paths.
- CDN script references.
- URL-driven JavaScript loading.
- Base64 JavaScript loading.
- Obfuscated hidden config or word lists after confirming they are not ordinary
  readable data.
- Broken links to pages not included in this branch.
- UI for features not included in this branch.
- Listing/docs claims that cannot be reproduced in a clean Chrome profile.

### Verify Before Keeping

- Dashboard capture works.
- Popup opens without missing-file errors.
- Main dashboard opens without missing-file errors.
- Supported source capture works for listed sites.
- Sound/TTS controls work if claimed.
- Disable/source controls work if claimed.
- Every requested permission is used.
- Every bundled third-party dependency is local and reviewable.

### Preserve When Safe

- Working pages with all dependencies included locally.
- AI/API features that use user-provided or server-side API calls without
  shipping remote executable code.
- AI pages that do not depend on stripped local model assets.
- Remote images, data, or iframe bridges when they are disclosed and needed.
- Features present in the listing only when they are reproducible in review.

## Reviewer Notes To Prepare

For each release, write short reviewer instructions:

- How to open the extension.
- How to open the dashboard.
- How to connect a supported chat source.
- Which features are intentionally not included in the Web Store build.
- Why each sensitive permission is needed.

## Current Manual Prep Notes

Add dated notes here as this branch is reviewed.

### 2026-06-21 Chrome Web Store Prep

- Branch reviewed: `chrome-web-store`.
- Runbook sync: `git fetch origin main` then `git merge origin/main`; merge reported already up to date. `origin/main` was `2c0de09ac2a411d6fda551e0a5669fdb784f2b41`; branch head before prep was `10c8acb211b2a492588b42d2b3ead9ff78ada1cf`.
- Policy basis checked against Chrome Web Store Program Policies and MV3 remotely hosted code guidance:
  - https://developer.chrome.com/docs/webstore/program-policies/policies
  - https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
  - https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Removed adult-provider Web Store surface with source/docs evidence: Stripchat, Bongacams, CAM4, Chaturbate, Fansly, Camsoda, Cherry.tv, MyFreeCams, and Joystick.tv. This included manifest host/content-script entries, source scripts, icons, docs/site cards, event styles, relay/source options, and Joystick WebSocket settings.
- Removed executable user/custom-code paths from the Web Store branch:
  - `&js=` and base64-JavaScript URL parameters.
  - Popup custom-JavaScript upload/delete UI and message plumbing.
  - `custom.js` auto-loader and sample files.
  - Event Flow Custom JS execution; nodes remain visible as disabled Web Store build options and tests now enforce no-op behavior.
- Replaced remote executable script references:
  - Neutron theme Day.js CDN load replaced with local time formatting.
  - Theme `https://socialstream.ninja/libs/colours.js` loads replaced with bundled `../libs/colours.js`.
  - Piper phonemizer changed from fetch/rewrite/inline script injection to a packaged module import while preserving the ESM export used by the web TTS entry point.
- Permissions reviewed:
  - Removed unused `identity` and redundant `activeTab`.
  - Kept `tabs`, `scripting`, `tabCapture`, `debugger`, `webNavigation`, `notifications`, and `storage` because they are used by extension code.
  - Kept broad `http://*/*` / `https://*/*` host permissions because `injectCustomSource` supports user-selected packaged source injection beyond static content-script matches.
- Remote model/data hosts retained: `largefiles.socialstream.ninja` is used for ONNX/model/voice data, while WASM/JS runtime files are bundled locally. Tests confirm Hugging Face/CDN executable fallbacks are not present for the checked model paths.
- Residual adult-name scan result: `sources/websocket/emotes.json` contains only a `joystick` / `:joystick:` emote name, not the removed provider integration.

Verification run:

- `git diff --check`
- JSON parse check for all `.json` files
- Manifest content-script, web-accessible-resource, service worker, and popup file-reference check
- Local HTML script-reference resolution check
- JS syntax checks for edited core files, config files, Event Flow files, Piper files, and tests
- `node tests/eventflow-customjs.test.js`
- `node tests/piper-local-assets.test.js`
- `node tests/kokoro-local-assets.test.js`
- `node tests/kitten-tts-assets.test.js`
- `node tests/transformers-local-defaults.test.js`
- `node tests/local-browser-model-registry.test.js`
- Remote executable scan for `https://*.js|mjs|wasm`, CDN script imports, `import("https://")`, `importScripts("https://")`, `JSON.parse(atob(...))`, URL/base64 JS parameters, and `custom.js` loaders
- Adult provider scan for removed site names

Browser smoke limitation:

- Google Chrome in this environment ignored command-line extension filtering (`--disable-extensions-except is not allowed in Google Chrome`) and did not load the unpacked extension for CDP page inspection.
- Playwright Chromium was installed via ignored `node_modules`; headed Chromium closed before inspection, and headless Chromium did not load extension service workers.
- Manual clean-profile Chrome verification of popup, dashboard, and one supported chat-source capture is still required before upload.

### 2026-06-21 Main Pull Test

- Fetched `origin/main`; it advanced to `6685075daf0b0acbf6486bf33fbe5386cd1707b1`.
- Tested the merge first in detached worktree `tmp/webstore-main-pull-test`: `origin/main` merged cleanly and the Web Store prep patch reapplied cleanly.
- Applied the same flow on `chrome-web-store` with `git stash push`, `git merge --no-edit origin/main`, and `git stash pop`.
- Resulting local merge commit: `9a419e398eab5ab6abfe489ff1b8ca6f3769053d`.
- Incoming main changes covered featured YouTube channel-title lookup, Chzzk selector fixes, and URL parameter metadata updates; Web Store removals still reapplied cleanly over the overlapping files.
- Post-merge checks run:
  - `git diff --check`
  - `node --check popup.js`
  - `node --check shared/config/urlParameters.js`
  - `node --check sources/chzzk.js`
  - `node --check actions/EventFlowSystem.js`
  - `node --check tests/eventflow-customjs.test.js`
  - `node tests/eventflow-customjs.test.js`
  - `node tests/piper-local-assets.test.js`
  - `node tests/local-browser-model-registry.test.js`
  - Custom-code marker scan

### 2026-07-06 Main Pull Final Review

- Fetched `origin/main`; it advanced to `6be013f4`.
- Merged `origin/main` into `chrome-web-store`; resolved `libs/objects.js`
  by keeping the newer local `xss` sanitizer path from `main`.
- Reapplied the Web Store branch changes after stashing; resolved conflicts in
  `manifest.json`, `docs/event-reference.html`, and removed Joystick files.
- Removed the leftover `joystickFetchJson` background message handler.
- Confirmed manifest version `3.50.3`, no missing manifest file references, no
  removed provider host/content-script entries, and no remote executable script
  references in the package candidate set.
- Release status: not a final submit pass yet. The package candidate still
  contains bundled vendor files with executable string construction patterns
  (`eval`, `new Function`, or `Function("return this")`). These are local
  third-party dependencies rather than the removed custom-JS feature, but they
  are a Chrome Web Store review and MV3 runtime risk until each is replaced,
  rebuilt with dynamic execution disabled, sandboxed where appropriate, or
  excluded together with the UI that depends on it.

Blocking files observed in the package candidate set:

- `thirdparty/espeakng.worker.js`
- `thirdparty/ort.min.js`
- `thirdparty/d3.min.js`
- `thirdparty/jszip.min.js`
- `thirdparty/tf.min.js`
- `thirdparty/transformersjs/transformers.min.js`
- `thirdparty/transformersjs/ort/ort-wasm-simd-threaded.asyncify.mjs`
- `thirdparty/transformersjs/ort/ort-wasm-simd-threaded.jsep.mjs`
- `thirdparty/kitten-tts/kitten-tts-lib.js`
- `thirdparty/kokoro-bundle.es.js`
- `thirdparty/kokoro-bundle.es.ext.js`
- `shared/vendor/socket.io.min.js`
- `lite/vendor/socket.io.min.js`

Verification run:

- `git diff --check`
- `git diff --cached --check`
- conflict-marker scan
- manifest parse and manifest reference check
- package-candidate removed-provider scan
- package-candidate remote executable scan
- package-candidate dynamic-code scan
- `node --check background.js`
- `node --check popup.js`
- `node --check service_worker.js`
- `npm run lint:js:background:strict`
- `npm run test:xss:sanitizer`
- `node tests/eventflow-customjs.test.js`

### 2026-07-06 Conservative Web Store Package Pass

- Built conservative upload artifact:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.3-20260706-conservative.zip`
- Package size: `34,730,411` bytes; extracted file count: `771`.
- Conservative exclusions applied to the upload artifact:
  - local browser AI worker/model/catalog assets
  - local browser TTS runtimes/assets for Kokoro, Kitten, eSpeak, and Piper
  - map/wordcloud assets and pages
  - StreamElements importer assets
  - Velora source files
  - docs, tests, scripts, node modules, git metadata, and development-only files
- UI/runtime gates applied for the conservative build:
  - disabled Kokoro, Kitten, eSpeak, and Piper TTS selections
  - disabled local browser AI provider selections
  - hid map/wordcloud/importer links
  - removed local AI catalog script loads
  - removed dev-only `file://` and localhost content-script matches from `manifest.json`
- Extracted-zip scan results:
  - missing manifest references: `0`
  - local/dev content-script matches: `0`
  - forbidden packaged files: `0`
  - dynamic executable code hits: `0`
  - remote executable script/import/worker hits: `0`
  - removed-provider term hits: `0`
  - missing local script/style references: `0`
- Focused checks passed:
  - `node --check background.js`
  - `node --check popup.js`
  - `node --check service_worker.js`
  - `node --check tts.js`
  - `node --check loader.js`
  - `git diff --check`
  - `git diff --cached --check`
  - `npm run lint:js:background:strict`
  - `npm run test:xss:sanitizer`
  - `node tests/eventflow-customjs.test.js`

Release status: conservative package passed the critical Web Store artifact
checks above. Remaining recommended manual check is loading the zip unpacked in
Chrome and smoke-testing popup open, background page startup, one supported
content source, and one overlay URL before upload.

### 2026-07-06 Conservative Web Store R2 Fix Pass

- Built replacement upload artifact:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.3-20260706-conservative-r2.zip`
- Package size: `34,730,383` bytes; extracted file count: `771`.
- Fixes applied after final issue review:
  - removed unsupported sentiment/karma controls from the popup UI
  - removed the sentiment status row from the background diagnostics page
  - guarded background sentiment calls so stale saved settings cannot call the removed sentiment runtime
  - replaced local packaged docs/test/importer links with hosted links
  - fixed packaged subdirectory favicon links that pointed at missing nested `favicon.ico` files
  - removed the hard-coded local development path from `popup.js`
- R2 extracted-zip scan results:
  - missing manifest references: `0`
  - local/dev content-script matches: `0`
  - unsupported sentiment UI markup hits: `0`
  - local developer path hits: `0`
  - local dead href hits: `0`
  - static missing hrefs: `0`
  - dynamic executable code hits: `0`
  - remote executable script/import/worker hits: `0`
  - removed-provider term hits: `0`
- R2 focused checks passed:
  - `node --check background.js`
  - `node --check popup.js`
  - `node --check dashboard.js`
  - `git diff --check`
  - `git diff --cached --check`
  - `npm run lint:js:background:strict`
  - `npm run test:xss:sanitizer`
  - `node tests/eventflow-customjs.test.js`

Release status: use the R2 conservative artifact for Chrome Web Store upload.
The remaining recommended manual check is loading the R2 zip unpacked in Chrome
and smoke-testing popup open, background page startup, one supported content
source, and one overlay URL before upload.
