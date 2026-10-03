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
- Use a pinned `beta` commit as the upstream reference and review the differences before upload.

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

### 2026-10-02 - 3.50.25 final release validation

Revalidated the current build and upload at Steve's request. All ten focused
regression suites passed: popup search/link generation, Store settings/runtime
parity/featured/ad routing, package inventory, YouTube/Kick deletion timing,
TikFinity gift streaks, and generic capture. A fresh extraction of the release
ZIP matched all 974 current package files, hashes, paths and CRC checks.

Fresh Chromium profiles passed background startup, extension-to-Dock delivery
through an isolated local WebSocket relay, history deletion, default versus
showdeleted behavior, panel persistence and excluded choices, iframe recipients,
and the existing extension smoke test. Light/dark panel screenshots were
inspected. There were no page/console errors or unexpected missing package files;
settings.json, badwords.txt and goodwords.txt are absent optional user overrides.
Syntax/dependency checks passed for 327 JS files, 127 inline scripts and 25 JSON
files, with no remote executable references in the checked paths.

The existing social-stream-ninja-webstore-3.50.25.zip matches the tested build
byte-for-byte and is the release artifact. No rebuild or version change was
needed. Results are recorded under release_validation in WEBSTORE_VERIFICATION.json
and the ZIP's paired verification file. Live authenticated providers and Web
Store submission were not exercised.


### 2026-10-02 - 3.50.25 TikFinity gift completion fix

Backported the TikFinity fix from beta `8427009be74cdc1200e1e511d5bdc082e8a2938a`.
Explicitly streakable gifts with completion flags now forward only the final
count. This fixes the reproduced duplicate gift when the completion arrives
after the recent-message deduplication window. Copied the beta regression test
and updated the TikFinity paragraph in the event reference.

This is a selective backport on the `693641140de3da8323a2c78de195020feb1b1245` baseline,
recorded in WEBSTORE_PARITY.json. The baseline pin is not advanced to imply
that newer feature additions have been synchronized. The source matches its
recorded backport commit byte-for-byte. Inventory: 974 files, with only
sources/tikfinity.js and the manifest version changed in the upload. Permissions,
host permissions, resource exposure, content-script matches and CSP match 3.50.24.

Verification passed:

- The gift regression test on the working tree and exact extracted ZIP: final
  streak counts, 2/3/5-second completion delays with and without group IDs,
  immediate completion replay, independent groups, non-streak/legacy payloads,
  and string/numeric flags.
- Existing package hash/Store compatibility checks and TikFinity syntax check.
- Fresh-profile Chromium smoke on the extracted ZIP: Featured Chat settings
  in beginner/full mode, search, OBS tester, Spotify Copy/fallback/callback,
  and editor link. No runtime or CSP errors from the tested pages.
- Every ZIP entry and extracted byte matched the reviewed inventory.

Artifact: `social-stream-ninja-webstore-3.50.25.zip` in the beta checkout's
`webstore/releases/` directory. SHA-256:
`ce2e7b56676d4197a81e765bace53663c791cdb20e772b2760f1fd78f4d5e0ba`.
Results are in WEBSTORE_VERIFICATION.json and beside the ZIP. Gift tests use
the actual source listener with a simulated clock and transport; no live
TikFinity session or Store submission was tested.


### 2026-10-02 - 3.50.24 beta capture fixes and beginner visibility

Updated the upstream reference to beta `693641140de3da8323a2c78de195020feb1b1245`.
Copied the five reviewed source files verbatim: generic capture, YouTube and
Kick DOM capture, Kick websocket capture, and the YouTube API page. This brings
over cancellation of messages moderated during avatar/badge/emoji waits, plus
generic capture fixes for grouped messages, author attribution, duplicate
capture, delayed rendering, and text/emotes. Copied the two corresponding beta
regression tests. Applied only beta's popup HTML delta so Featured Chat sections
and the four preset settings groups appear in beginner mode.

The package remains 974 files: 895 exact beta copies, 74 Store adaptations and
five legacy assets. Seven package files changed. The manifest changes only
version to 3.50.24; permissions, host permissions, resource exposure and CSP
match 3.50.23. Every upstream path is accounted for in WEBSTORE_PARITY.json.

Verification passed:

- All 12 source-deletion timing cases, including later/unrelated chat delivery.
- Generic capture fixtures for Vaughn grouped messages, 11 other layouts,
  Twitch links/emotes, delayed/recycled rows, reinjection, text/HTML mode,
  shadow DOM and same-origin iframes.
- Popup search and package hash/Store compatibility checks.
- Fresh-profile Chromium smoke against the working tree and extracted ZIP:
  Featured Chat sections and all four preset settings groups in beginner/full
  mode, search, OBS tester, Spotify Copy/fallback/callback, and editor link.
  The tested pages emitted no runtime or CSP errors.
- Static syntax/dependency audit: 327 JS files, 127 inline scripts, 25 JSON
  files; no missing required references or remote executable references in
  the checked paths. All ZIP entries and extracted bytes match the inventory.

Artifact: `social-stream-ninja-webstore-3.50.24.zip` in the beta checkout's
`webstore/releases/` directory. SHA-256:
`32e67edc644ddbe52b0f82a2d0da39045cbe81f168054b2635a2f31fa9c25431`.
Current results are in WEBSTORE_VERIFICATION.json and beside the ZIP. Source
checks use local fixtures and mocked transport/timing; no live provider
sessions or Web Store submission were tested.


### 2026-10-02 - 3.50.23 packaged-page fixes

The packaged OBS WebSocket tester and Spotify setup page had inline scripts
blocked by the extension CSP. Moved each existing script byte-for-byte into a
packaged local classic script and referenced it from the same position in its
page. Restored the OBS guide's Event Flow Editor link to actions/index.html.
Updated the existing Chromium smoke test to use the current search input and
exercise these page behaviors.

The manifest comparison with 3.50.22 changes only version to 3.50.23. All
permissions, host permissions, resource exposure and CSP values are identical.
Local packaged scripts follow [Chrome's extension CSP documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).
The upstream pin remains `82b48ff323b8b89fb9e22ef110a9a228b4ba3cf1`.

Verification passed:

- Existing inventory/hash and Store compatibility checks.
- Chromium smoke test against both the working tree and exact extracted ZIP:
  popup search; OBS v5 connect, GetVersion request and disconnect using a local
  transport fixture; every Spotify Copy button's value; clipboard-denied text
  selection fallback; packaged Spotify error callback; packaged editor link.
  The tested pages emitted no runtime or CSP errors.
- All 974 package files matched their recorded hashes and extracted ZIP bytes.
  The scripts extracted from both HTML pages match their previous contents
  byte-for-byte. Only four existing package files changed, with two JS additions.
- Parsed 327 JS files, 127 inline scripts and 25 JSON files. Checked required
  manifest/script/stylesheet references resolve, with no remote executable
  script/import references or first-party eval/new Function in this audit.

Inventory: 895 exact beta files, 74 Store adaptations and five legacy assets.
Artifact: `social-stream-ninja-webstore-3.50.23.zip` in the beta checkout's
`webstore/releases/` directory. SHA-256:
`c5173c2aa6a2f85e2c5f4d8e8b425abe6d4a5fe65ab6e2b6c7d1905053b2116d`.
Current evidence is in WEBSTORE_VERIFICATION.json and the artifact's paired
verification file. These checks use simulated OBS replies and clipboard calls;
live OBS, Spotify authentication, OS clipboard and Store submission were not tested.


### 2026-10-02 — 3.50.22 current beta update

Updated from beta `82b48ff323b8b89fb9e22ef110a9a228b4ba3cf1`.
Seven packaged files changed upstream: background.js, dock.html, popup.js,
popup.html, popup-ui.css, sources/static/twitch_points.js and
sources/websocket/twitch.js. These changes bring panel section customization,
the Dock showdeleted option, confirmed-UI Twitch ad detection, pending Twitch
moderation suppression, source-URL validation and explicit iframe destinations.
The manifest version is now 3.50.22.

Browser testing found that the new panel editor listed the already-excluded
Map and Wordcloud pages. The Store adaptation now omits those two choices.
The existing announcement-routing fixture was updated for one source event per
confirmed ad transition, and the runtime parity fixture now includes Twitch's
pending-message state. A regression check exercises deletion, ban and timeout
during profile lookup, moderation delay and PluralMind processing, including
unrelated messages that must still be delivered.

The inventory remains 972 files: 897 exact beta copies, 70 documented Store
adaptations and five retained legacy assets. Package hashes and the complete
upstream inclusion/exclusion accounting now reference the new commit.

Verification passed:

- Ten focused test files: popup search, popup link generation, Twitch ad
  announcements, Store ad routing, Dock filtered history, pending Twitch
  moderation, Store featured routing (35 cases), settings compatibility,
  runtime parity and inventory/hash checks.
- The extracted ZIP ran in a fresh isolated Chromium profile. Verified panel
  choice persistence after reload, Show all sections, exclusion of unavailable
  Store choices, full-mode search, and light/dark panel appearance. Verified
  extension-to-Dock chat delivery, default deletion versus showdeleted marking,
  history deletion and explicit iframe destination/recipient routing.
- Background startup completed without script failures. No page or console
  errors or unexpected packaged-resource failures occurred. The three absent
  optional user override files are settings.json, badwords.txt and goodwords.txt.
- Parsed 325 JavaScript files, 129 inline scripts and 25 JSON files in the
  extracted package. Required manifest/script/stylesheet references resolved;
  the checked executable paths had no remote script/import references or
  first-party eval/new Function execution.
- Every ZIP entry and extracted file matched the reviewed SHA-256 inventory.
  The paired history, Bits, likes and Instagram checks matched current beta;
  the pending-moderation check also passed against the extracted ZIP.

Artifact: `social-stream-ninja-webstore-3.50.22.zip` in the beta checkout's
`webstore/releases/` directory. SHA-256:
`8f5470818f5f435980be191e3f09e0abf46960195e8e91015ac3894395783a93`.
Machine-readable results are in WEBSTORE_VERIFICATION.json and beside the ZIP.
Authenticated live-provider sessions and Store submission were not exercised.

### 2026-09-30 — 3.50.21 complete retained-feature synchronization

Reference: committed beta `4cb172d26f85e17bb7c04bb32a56f841eb334f6d`.
This supersedes the selective-backport candidate and the review findings below.
The reference does not include uncommitted beta working-tree changes.

The package contains 972 files: 897 byte-identical beta files, 70 files with
documented Web Store adaptations, and five existing Store assets absent from
beta. The inventory adds 161 dependencies, feature assets, language files and
library licenses. `WEBSTORE_PARITY.json` records each packaged file's SHA-256,
upstream blob/hash and disposition, plus the reasons for upstream exclusions.
There are no unclassified package differences or upstream omissions.

The background, service worker, popup, Event Flow, source adapters and their
shared dependencies now come from the same beta snapshot. This brings across
the missing like-event routing, Instagram inbox coordinator, Twitch IRC Bits
metadata, and complete history-deletion UI/worker/background path. It includes
the Twitch ad setting guard and the temporary Dock ad filter with its
2026-10-07 removal note. Event vocabulary documentation tracks the same beta.

Existing Store exclusions are recorded separately from functional parity:
adult/RPLAY/Velora integrations, arbitrary custom/URL JavaScript, local browser
AI/TTS runtimes, sentiment, Map/Wordcloud and the StreamElements importer.
Hosted docs, standalone applications and development files stay outside the
upload. Adaptations include complete disabled UI/runtime paths, packaged
theme dependencies, reviewed manifest permissions/CSP and the existing
Socket.IO global lookup without dynamic code. No release generator was added.

Verification of the final code and extracted upload:

- All 13 focused test files passed: popup search/link generation, Event Flow
  workflows and Store custom-code exclusions, points import/query behavior,
  unlimited history retention, Twitch GIF normalization, Store settings and
  featured routing, ad announcements, runtime parity, and package inventory.
- Matching fixtures against beta and the extracted ZIP passed for history
  deletion with background open/closed and extension on/off; Twitch IRC Bits
  thresholds; like events at default/off/on; and both Instagram capture paths,
  including polling, leasing and deduplication. Ad default/off/on, live setting
  changes, helper/API events and Event Flow routing passed on both versions.
- The extracted ZIP loaded in a fresh isolated Chromium profile. All background
  scripts reached ready with no failures. Actual extension runtime messaging
  delivered a test chat through a real local WebSocket relay to Dock; the
  history page then deleted the saved message through its confirmation UI.
  Full-mode popup search found the ad setting. Light/dark screenshots were
  inspected. No page errors or unexpected packaged-resource failures occurred.
- Parsed 325 JavaScript files, 129 inline scripts and 25 JSON files; verified
  manifest and static script/stylesheet dependencies. No missing required local
  files, remote executable script/import references, or first-party eval/new
  Function execution were found by these checks. Optional user override files
  (`settings.json`, `badwords.txt`, `goodwords.txt`) are absent in a clean profile.
- Every ZIP entry and extracted byte matched the reviewed inventory. The
  existing selective-update test now checks package hashes and the pinned
  revision instead of hard-coding an obsolete version. Stale popup and history
  fixtures were updated to exercise the current code paths.

Artifact: `social-stream-ninja-webstore-3.50.21.zip` in the beta checkout's
`webstore/releases/` directory. SHA-256:
`920d40d771a9de455565a683f652c4cfe5ab96ad18b8f9bbd3ba5cd8937e822b`.
`WEBSTORE_VERIFICATION.json` contains the machine-readable results and artifact
identity. Tests and review metadata are not included in the upload ZIP.

Limits: source services were represented by fixtures; no authenticated live
provider session or Chrome Web Store submission was performed. This verifies
the tested paths and package parity, not every beta feature in live operation.
The imported beta text retains its existing line endings and whitespace;
`git diff --check` is not a clean check for this synchronization.

For the next manual update, pin beta again, review each Store adaptation and
new dependency, update the inventory/hash accounting after review, run the
affected behavior checks, then verify the actual ZIP against those hashes.
Do not treat source-file equality or a successful syntax check alone as proof
that the corresponding worker, background, UI and packaged assets are present.

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
  - Kept `tabs`, `scripting`, `tabCapture`, `debugger`, `notifications`, and `storage` because they are used by extension code.
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

### 2026-07-07 Purple Potassium Rejection Review

- Chrome Web Store rejected version `3.50.3` for Use of Permissions:
  `webNavigation` was requested but not used.
- Confirmed source and all three 2026-07-06 package candidates declared
  `webNavigation`.
- Confirmed executable source has no `chrome.webNavigation` or
  `browser.webNavigation` calls; only `manifest.json`, this review file, and
  `docs/agents/03-extension-architecture.md` referenced the permission.
- Removed `webNavigation` from `manifest.json`.
- Corrected stale local documentation that still listed `webNavigation`,
  `activeTab`, and `identity`.
- Remaining requested API permissions were reviewed against executable usage:
  - `storage`: `service_worker.js`, `background.js`, `popup.js`,
    `settings/options.js`, and source adapters persist settings, state, tokens,
    overlays, source hints, and capture options.
  - `notifications`: `service_worker.js` and `background.js` surface background
    startup/injection and runtime errors.
  - `tabs`: `service_worker.js`, `background.js`, and `popup.js` create,
    query, update, focus, and message the background/dashboard/source tabs.
  - `scripting`: `service_worker.js` injects packaged source scripts selected
    by the user from the popup into the active tab.
  - `tabCapture`: `service_worker.js` and `sources/capturevideo.js` support
    tab audio/video capture workflows.
  - `debugger`: `background.js` attaches to tabs and sends input/runtime
    commands for host/chat automation features.
- No requested `identity`, `activeTab`, `webRequest`, `downloads`, `history`,
  `cookies`, `alarms`, `contextMenus`, `sidePanel`, or `offscreen` permissions
  are present in `manifest.json`.
- Residual permission risk: broad `http://*/*` and `https://*/*` host access
  remains. It is tied to user-selected packaged source injection and broad chat
  platform support, but it should be explained clearly in reviewer notes because
  it is still the highest-friction permission surface after this fix.
- Host-permission shape note: the two broad host entries subsume the other 228
  HTTP/HTTPS host entries. Removing only the specific entries would reduce
  manifest noise but would not materially reduce granted host access while the
  broad entries remain.
- Built replacement upload artifact:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.3-20260707-conservative-r3.zip`
- R3 artifact verification:
  - version: `3.50.3`
  - permissions: `notifications`, `storage`, `debugger`, `tabs`, `scripting`,
    `tabCapture`
  - host permissions: `230`
  - content scripts: `145`
  - scanned package text files: no `webNavigation`, `chrome.webNavigation`, or
    `browser.webNavigation` hits
  - manifest file references: all present
  - R3 differs from R2 only by `manifest.json` content

### 2026-07-07 Expanded Policy And Permission Audit

- Web policy sources checked:
  - https://developer.chrome.com/docs/webstore/program-policies/policies
  - https://developer.chrome.com/docs/webstore/program-policies/permissions
  - https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
  - https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines
  - https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
  - https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings
  - https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
  - https://developer.chrome.com/docs/extensions/reference/api/tabs
  - https://developer.chrome.com/docs/extensions/reference/permissions-list
- Common rejection areas relevant to this package:
  - unused or broader-than-needed permissions
  - remotely hosted executable JavaScript/WASM or fetched code execution
  - misleading or non-reproducible listing/UI claims
  - privacy policy or Developer Dashboard data-use mismatch
  - non-narrow single purpose or bundled unrelated functionality
  - spammy notifications or messages sent without user confirmation
  - adult/sexually explicit provider references
  - broken features, crashes, or missing packaged files
- Confirmed local ZIP status:
  - `social-stream-ninja-chrome-web-store-3.50.3-20260706-slim.zip`,
    `social-stream-ninja-chrome-web-store-3.50.3-20260706-conservative.zip`,
    and `social-stream-ninja-chrome-web-store-3.50.3-20260706-conservative-r2.zip`
    still declare rejected `webNavigation`; do not upload them.
  - `social-stream-ninja-chrome-web-store-3.50.3-20260707-conservative-r3.zip`
    has the corrected permission list, but was superseded by R4 cleanup below.
- R3 declared API permissions all have executable evidence:
  - `notifications`: `service_worker.js`, `background.js`
  - `storage`: `service_worker.js`, `background.js`, `popup.js`,
    `settings/options.js`, selected source/page helpers
  - `debugger`: `background.js`
  - `tabs`: `service_worker.js`, `background.js`, `popup.js`
  - `scripting`: `service_worker.js`
  - `tabCapture`: `service_worker.js`, `sources/capturevideo.js`
- Permissions/code found elsewhere but not declared:
  - `chrome.identity` appeared in `spotify.js` and a popup comment. Removed
    those Web Store branch references and kept the hosted/manual OAuth callback
    path, so `identity` should not be requested.
  - `chrome.webRequest` appeared only inside a commented-out block in
    `service_worker.js`; removed that dead block, so `webRequest` should not be
    requested.
  - `activeTab` string hits are variable/doc text, not permission usage; no
    `activeTab` permission should be requested.
  - Clipboard writes use the page `navigator.clipboard` API. No
    `clipboardRead` or `clipboardWrite` extension permission is requested.
- Additional R3 package scans:
  - first-party package files: no remote/dynamic executable-code pattern hits
  - package text scan: no removed adult-provider term hits, excluding the large
    emote JSON data file

### 2026-07-07 R4 Pre-Submit Cleanup

- Removed remaining Web Store reviewer-noise from source:
  - deleted the commented-out `chrome.webRequest` block from `service_worker.js`
  - removed the undeclared `chrome.identity` Spotify OAuth branch from
    `spotify.js`
  - updated popup OAuth helper wording to avoid `chrome.identity`
  - re-enabled the Spotify connect button after manual callback success/failure
    so the no-Identity manual flow cannot leave the popup stuck
  - removed obsolete `chromiumapp.org` Spotify redirect URI instructions from
    `spotify.html`
- Build to use after this cleanup and required version bump:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.4-20260707-conservative-r1.zip`
- SHA-256:
  `08FA583CD30E57C05F7B07C709C794D618245F82225B009046A3BD73922A6556`
- Do not upload any `3.50.3` package, including the previous R4 ZIP, because
  the rejected draft was already version `3.50.3`.
- `3.50.4` resubmission artifact verification:
  - version: `3.50.4`
  - permissions: `notifications`, `storage`, `debugger`, `tabs`, `scripting`,
    `tabCapture`
  - no first-party package hits for `webNavigation`, `chrome.webNavigation`,
    `browser.webNavigation`, `chrome.identity`, `browser.identity`,
    `chrome.webRequest`, `browser.webRequest`, or `chromiumapp.org`
  - manifest file references: all present
  - first-party package scan: no remote/dynamic executable-code pattern hits
  - package text scan: no removed adult-provider term hits, excluding the large
    emote JSON data file
  - edited package files in the extracted `3.50.4` ZIP byte-match current
    source for `manifest.json`, `popup.js`, `service_worker.js`,
    `spotify.html`, and `spotify.js`
  - `git diff --check`, `node --check spotify.js`,
    `node --check service_worker.js`, and `node --check popup.js` passed
  - targeted Node simulations passed for extension Spotify OAuth start and
    manual callback state handling
  - Playwright Chromium smoke passed against the final extracted `3.50.4` ZIP:
    service worker started, `popup.html`, `spotify.html`,
    `dock.html?session=smoketest`, and `featured.html?session=smoketest`
    loaded with Chrome extension APIs; Spotify setup contained hosted, beta,
    and loopback redirect instructions with no `chromiumapp.org` text
  - Playwright Chromium injection smoke passed against the final extracted
    `3.50.4` ZIP: a local `http://127.0.0.1` tab was found by
    `chrome.tabs.query`, `service_worker.js` handled `injectCustomSource`, and
    `chrome.scripting.executeScript` injected packaged `sources/generic.js`
    successfully
  - Additional checks passed: `npm run lint:js:background:strict`,
    `npm run test:xss:sanitizer`, and `node tests/eventflow-customjs.test.js`

### 2026-08-09 Selective 3.50.6 Update

- Reviewed the clean local `beta` checkout at `672a1328` read-only; no beta
  files, refs, or working-tree state were changed and no blanket merge was
  performed.
- Kept this release deliberately narrow. Included only:
  - the popup search crash fix from `0c1ab770`
  - the resilient manifest-derived source catalog from `e432dc6` and its
    retry/deduplication follow-up from `99f1a5ac`, adapted to keep the removed
    Velora provider out of this Web Store build
  - removal of retired Trovo and DLive quick-open controls from `3f4af753`
  - the tested Blaze capture/deduplication chain from `29615222`, `12fa9bfc`,
    and `23da2c79`; packaged `sources/blaze.js` byte-matches the final beta
    result for that chain
- Preserved the existing remote Web Store fixes from `55c05eb2` and
  `edc61217`: working `chrome.identity` Spotify OAuth, duplicate-flow
  prevention, callback instructions, and the prior `3.50.5` version bump.
- Deferred beta feature work, desktop/Stream Deck/OBS work, new provider and
  host additions, retention/database behavior changes, and source fixes that
  depend on broader untested chains.
- Bumped the Web Store package version from the existing remote `3.50.5` to
  `3.50.6` so the new upload is strictly newer.
- Permissions remain unchanged from the existing remote Web Store baseline:
  `notifications`, `storage`, `debugger`, `tabs`, `scripting`, `tabCapture`,
  and `identity`. No host permissions were added.
- Built conservative upload artifact:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.6-20260809-conservative-r1.zip`
- Artifact size: `34,731,248` bytes; SHA-256:
  `B4413015F6ACC97D31169A35C9A32C584692526949A411AC264379873ECC3A68`
- Extracted ZIP verification:
  - manifest at ZIP root with version `3.50.6`
  - `771` expected and extracted files; no missing, extra, or differing files
  - JSON parse errors: `0`
  - missing manifest references: `0`
  - missing local script/style references: `0`
  - remote executable-code hits: `0`
  - dynamic executable-code hits: `0`
  - removed-provider hits: `0`
- Focused checks passed:
  - `git diff --check`
  - JavaScript syntax checks for all edited JavaScript and tests
  - `npm run lint:js:background:strict`
  - `npm run test:xss:sanitizer`
  - `node tests/eventflow-customjs.test.js`
  - `node tests/webstore-selective-update.test.js`
  - `node tests/blaze-source.test.js`
  - real Chromium extension smoke against the extracted package: service
    worker startup, popup load, retired-control absence, and popup search
    execution without page errors

Release status: artifact checks are complete. A manual live-site capture test
in a clean Chrome profile remains recommended before Web Store upload.

### 2026-08-10 Selective 3.50.7 Update

- Reviewed the local `beta` checkout read-only, including its two uncommitted
  files; no beta files, refs, or working-tree state were changed.
- Synced only the independent VPZone websocket fix that prefers usernames over
  numeric actor IDs for user matching. Deferred the unrelated French strings
  for beta-only features that are not packaged in this conservative branch.
- Bumped the Web Store package version from `3.50.6` to `3.50.7`.
- Permissions and host access are unchanged.
- Built conservative upload artifact:
  `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.7-20260810-conservative-r1.zip`
- Artifact size: `34,731,249` bytes; SHA-256:
  `8921B0DFC0136D104F88837F0F66D4C4AB12697F515CA5CF0C2DBA2DDEFADAC1`
- Extracted ZIP verification:
  - manifest at ZIP root with version `3.50.7`
  - `771` files, all byte-matching the current branch package set
  - only `manifest.json` and `sources/websocket/vpzone.js` differ from the
    verified `3.50.6` artifact
  - all `19` packaged JSON files parse successfully
- Focused checks passed:
  - `git diff --check`
  - `node --check sources/websocket/vpzone.js`
  - `node tests/webstore-selective-update.test.js`
  - `npm run lint:js:background:strict`
  - `npm run test:xss:sanitizer`
  - `node tests/eventflow-customjs.test.js`
  - `node tests/blaze-source.test.js`
  - real Chromium extension smoke against the extracted `3.50.7` package

Release status: artifact checks are complete. A manual live VPZone capture test
remains recommended before Web Store upload.


### 2026-09-26 Selective 3.50.16 Update

- Updated this branch from its stale 3.50.7 state using the reviewed 3.50.16
  candidate, based on the actual installed 3.50.10 Web Store package. No beta
  merge was performed. Beta reference: `cf23f2b37c6941573fb2536f3ddf3dd6d311d6e2`,
  plus applicable source/security fixes in that working tree during review.
- Copied the 810 reviewed package files to the branch root and verified each
  against the candidate SHA-256 inventory before committing. The source
  snapshot and local beta working tree were not altered by this branch update.
- `WEBSTORE_PACKAGE_FILES.json` is the authoritative upload file list for this
  version. Package exactly those paths, relative to this branch root, with
  `manifest.json` at the ZIP root. Do not ZIP the entire checkout: this branch
  also retains development, documentation and previously excluded assets.
  Chrome-generated `_metadata/` files and these review notes are not upload
  files. This is a manual packaging list; no release automation was added.
- Fixed the server-mode switch exception: stripped Map/Wordcloud link targets
  can lack a `.raw` URL. `handleBothParam` now skips targets without a string
  URL, allowing server settings to save and Dock links to regenerate.
- Updated all 216 retained source/provider JS/HTML/CSS/JSON assets to the
  reviewed beta versions, plus required packaged helpers, source settings,
  manifest content scripts, icons and the Twitch Watch Streak control.
- Backported body/name/metadata/avatar/badge HTML protections, inert parsing,
  command/relay handling, history/leaderboard/export safeguards, donation USD
  overrides, settings/points import validation, and Event Flow property and
  schedule protections. Preserved custom-JavaScript execution restrictions.
- Backported AI co-host key and tool protections together: escaped Markdown
  input; removal of persisted API keys; keys held in memory; private capability
  generation/rotation, popup links, URL scrubbing and authorization of existing
  co-host tool requests. Reopen the popup's co-host link after updating and
  re-enter page-level API keys as needed. New AI runtimes were not imported.
- Manifest API permissions, host permissions, CSP, OAuth settings and extension
  key remain unchanged from the installed 3.50.10 package. Source match entries
  were updated for the reviewed capture sources. No `webNavigation` added.
- Upload exclusions remain: previously stripped adult integrations, RPLAY,
  Velora runtime, Map/Wordcloud, StreamElements importer, Lite, local browser AI
  runtimes, and local Kokoro/Kitten/eSpeak/Piper runtimes. Custom uploaded/URL
  JavaScript remains disabled or absent. New dependencies are local; Socket.IO's
  dynamic global lookup was replaced with a `globalThis` fallback.
- Final package checks: 266 JavaScript files and 133 inline scripts parsed; no
  remote script imports or direct eval/Function calls found; original 773-file
  installed snapshot remained unchanged. Two pre-existing Kokoro import strings
  remain in disabled popup code; excluded bundles were not restored. Optional
  settings.json/badwords.txt/goodwords.txt override requests remain absent as
  they were in the installed package.
- Candidate validation passed:
  - Real isolated Chromium extension: startup, all three server switches,
    storage and regenerated URLs, fake-message button through a local relay to
    the actual Dock, WhatsApp-shaped payload delivery, disabling/reopening,
    co-host tool authorization and capability URL edits, popup Watch Streak
    search; no popup/background/Dock page exceptions.
  - 17 source/sanitizer suites; 117 text-contract checks; 66 security-boundary
    checks; 67 final-HTML checks; 82 name-security checks and 144 comparisons.
  - 258 body checks on 42 retained pages; name/avatar checks on 24 pages each;
    46 badge cases; 23 inert-parser probes and 299 compatibility comparisons;
    35 TikTok gift cases; 30 emote-wall cases.
  - Secondary processing, command forwarding, Dock actions, multi-alerts,
    seven games, five leaderboard layouts, real IndexedDB/name history/export,
    co-host key/output security, all five points-import cases, schedule escaping.
- Candidate harness adaptations were limited to unshipped surfaces, old DB
  extraction anchors, the old Tip Jar goal/TTS wording and old Deuks viewport
  behavior. Security/rendering assertions remained. The new beta popup-search
  unit suite depends on absent beta helpers, so the retained search was tested
  in the actual extension instead; the required suite passed in beta.
- Branch files additionally passed the existing Web Store Event Flow custom-JS
  restriction suite and XSS sanitizer suite after synchronization.

Release status: GitHub source update only; no Chrome Web Store upload or website
publication was performed. Live provider authentication, all supported sites,
and the public relay were not exercised. Default Dock/overlay links use the
hosted website, whose corresponding fixes require a separate site deployment.


### 2026-09-26 Focused 3.50.17 Follow-up

- Applied the three validated follow-up fixes to the reviewed 3.50.16 package:
  - Restore legacy boolean server/server2/server3 settings into the popup's
    data-both controls, so generated Dock URLs retain the enabled flags.
  - Acknowledge saveSetting only after storage completes, report saved/error,
    and keep asynchronous runtime replies open with a synchronous listener.
  - Check rich bot chat HTML at display time using the packaged shared helper;
    plain-text and generated attachment paths keep their existing behavior.
- Bumped manifest and manual package inventory to 3.50.17. The upload list still
  contains exactly 810 files. Each branch package file was verified byte for
  byte against the updated candidate SHA-256 inventory.
- Added tests/webstore-settings-compat.test.cjs outside the upload list. It
  verifies legacy true/false flags, delayed success/error acknowledgements,
  and the runtime listener's asynchronous reply contract.
- Validation passed on the applied package:
  - Actual isolated extension: legacy settings restore, two-switch and
    three-switch server delivery, generated URLs and persisted controls,
    fake and WhatsApp-shaped messages reaching Dock, co-host authorization,
    and Watch Streak search; no popup/background/Dock page exceptions.
  - Six benign bot display cases covering plain/rich/default modes, normal
    and stacked output, shared sanitizer invocation and no page exceptions.
  - New settings compatibility regression and all 26 Web Store custom-JS
    restriction assertions.
  - 266 JS files and 133 inline scripts parsed; no new executable-code,
    dependency, permission or provider-exclusion findings. Existing disabled
    Kokoro references remain documented in the 3.50.16 notes.
  - Repository popup-search suite; the candidate's older search is covered
    by the actual extension test, as documented above.
- No broader beta feature merge was made. The prior source updates and Web
  Store exclusions remain in place. No Web Store upload or site deployment
  was performed; hosted receiver fixes still require website deployment.


### 2026-09-27 Selective 3.50.18 Backports

- Escaped bot attachment URLs at all four image/video insertion points.
- Rendered names as literal text in 12 featured themes, including the effect
  labels in Cyberpunk and Retro. Corrected entity handling for plain chat text
  in Bubbles, Cards, Neon Cyberpunk, Particles and Xacception.
- Fixed Event Flow import/duplicate node IDs and remapped connection/state
  references through the editor and template import paths; corrected daily
  scheduling, legacy schedule strings, null timer payload handling, boolean
  event names, raid/cheer minimums, throttle state initialization and fractional
  windows, zero send/relay timeouts, and MIDI note velocity/channel options.
- Fixed numeric active-page selection in saved AI overlays.
- Updated both packaged Twitch TMI variants to respect disabled auto-reconnect.
- Ported Flow Actions HTML audio playback and the keyboard-accessible retry
  button for blocked playback.
- Version and inventory updated to 3.50.18, using selected fixes present in beta
  a5dbd18a. The manifest diff is only its version string; all content-script
  entries, matching rules and injection order are byte-for-byte preserved.

Validation on the package:

- 16 applicable targeted Event Flow/saved-overlay regression cases passed.
  Two assertions were adapted in memory to the existing Web Store behavior:
  the donation-event trigger requires a named paid event, and custom JavaScript
  remains disabled. Beta-only Pin Message UI and the unshipped hourly OBS
  template were excluded. These were test applicability differences, not
  reasons to add those features. The shipped chat-relay template was separately
  imported twice, validating independent IDs and connected wires.
- 22 benign browser attachment cases passed: image/video, media-only/body,
  plain/rich bodies, ordinary and quoted/entity URL characters, stacked output,
  speech/file output and relay/iframe equivalence.
- 45 browser checks passed for the five plain-text themes, including rich
  formatting comparisons. All 12 modified featured themes passed literal-name
  and rich-body display checks; Cyberpunk/Retro effect labels were also checked.
- Flow Actions audio unit checks and a browser keyboard retry passed. Both TMI
  variants passed reconnect-enabled and reconnect-disabled checks.
- All 26 existing Web Store custom-JavaScript restriction assertions passed.
  Package audit parsed 266 scripts and 133 inline scripts with no syntax,
  remote-executable or new dependency findings. The two pre-existing disabled
  Kokoro import references remain the only reported missing dependencies.
- All 810 listed package files match the refreshed candidate SHA-256 inventory.

Verification used local fixtures and mocked services. Live provider sessions,
public relay behavior, Chrome Web Store approval and hosted website deployment
were not tested. Receiver changes reach hosted URLs only after site deployment.


### 2026-09-27 Featured Relay Fix, 3.50.19

- Reviewed beta 19ac439b and selectively backported the Featured routing fix.
  Dock now publishes selected messages and clear updates using a separate
  connection for existing server2/server3 links. This connection has no incoming
  command handler. The explicit Dock API connection is still controlled by server.
- Classic Featured and all 13 packaged Featured presets receive manual selections
  from the selection channel. Classic/Modern explicit auto-show consumes captured
  chat. Popup link refresh adapts beta's behavior to the older Web Store popup,
  including preset changes and returning from auto-show to manual selection.
- Bundled beta's js/local-server-url.js dependency locally and added it to the
  upload inventory, bringing the package to 811 files. It is loaded by extension
  pages and hosted overlays, not injected content scripts, so no web-accessible
  resource or permission entry is required.
- Added tests/webstore-featured-routing.test.cjs outside the upload inventory.
  It reuses beta's transport contracts for saved URLs, API opt-in and reconnects.
- Updated the package to 3.50.19. Manifest bytes differ only in the version value;
  content-script entries and YouTube injection order match 3.50.18 exactly.

Validation:

- Beta's 39 Featured routing unit cases passed before backporting.
- The adapted package passed 35 focused saved-link/transport regression cases
  and 39 browser routing/rendering checks across all 13 Featured presets.
- A clean unpacked Chromium extension passed 21 checks using native YouTube and
  Twitch fixture capture, packaged Dock/Featured receivers, and public transports:
  P2P; server2/server3 with P2P blocked; and explicitly enabled server/server2/server3.
  Selection, raw-chat exclusion, clear, fake messages, persistence, no duplicate
  fixture rows, receiver reload and Classic/Modern auto-show passed.
- In the server2/server3 case, there were zero P2P peers, the extension remote API
  setting was off, Dock's API socket was absent, and CDP inspection confirmed the
  new publishing socket had no incoming message handler.
- Popup search checks passed. Package audit parsed 267 JavaScript files and 133
  inline scripts with no syntax, remote executable, or new dependency findings.
  The two existing disabled Kokoro references remain documented above.
- All 811 upload files were verified against the candidate SHA-256 inventory.

Scope: source/package update only. The current receiver tests served packaged
assets at hosted URLs; they do not certify the currently deployed website.
Default extension links use the website, so the matching website receiver fix
must also be deployed for those links. No Web Store upload or website deployment
was performed. Live provider traffic and macOS were not retested in this update.

### 2026-09-27 YouTube Live Chat Setting, 3.50.20

Reviewed beta a3547113. Its new runtime changes primarily support AI Event
Overlays, a feature outside the current store package. The settings comparison
identified an incomplete earlier YouTube backport: the packaged capture script
reads disableAutoLiveYoutube, while the popup and notification hook still used
autoLiveYoutube.

- Ported beta's Do not auto-select Live Chat switch, tooltip, settings definition,
  background notification hook and 13 applicable packaged translation entries.
- Updated the package version and SHA-256/upload inventories to 3.50.20.

Verification: a clean unpacked Chromium extension passed seven focused checks
using a local YouTube DOM fixture and native manifest injection: default automatic
selection, popup search, saving and live-tab updates, persistence, new-popout
opt-out, re-enabling automatic selection, and legacy setting compatibility.
No popup, background or source-page exceptions occurred. The repository popup
search suite and edited JavaScript syntax checks passed. All translation JSON
parsed, and all 811 upload files matched the candidate inventory. Manifest bytes
differ only in the version value, including identical YouTube injection ordering.
Live YouTube traffic, Web Store upload and website deployment were not tested.


### 2026-09-30 Ad announcement fix and source/background compatibility review

Reviewed the current Web Store checkout at b21d19ad (3.50.20), the 3.50.16
update at b681e410 and its predecessor, and the update's recorded beta source
snapshot cf23f2b3. This review is about functional compatibility of the
selective update; it is not a new upload certification.

Applied change:

- Restored beta's central Twitch ad announcement check in sendToDestinations.
  With twichadannounce absent/off, ad_break, ad_request and ad_schedule are
  stopped before overlay/output delivery. The check remains after the existing
  Event Flow processing step.
- Added tests/webstore-ad-announcements.test.cjs outside the upload inventory.
  It exercises the actual Twitch helper, processIncomingMessage and
  sendToDestinations with local video events and mocked output transports.
  Default/off, object and legacy-boolean enabled states, live disabling,
  repeated start/stop notices, API ad events, Event Flow delivery and unrelated
  chat/event routing are covered. It failed on the unmodified checkout and
  passed on the corrected code. Edited background JavaScript syntax passed.

Confirmed additional findings, recorded for the next update decision:

1. Like-event routing is another incomplete source/background backport.
   sources/tiktok.js dropped its reactionsOnlyLikeEvent/capturelikeevent
   routing in 3.50.16, while the replacement routeIndividualLikeEvent logic
   is absent from the packaged background. Packaged MeetMe also sends actor
   likes through that main pipeline. In local executions of the production
   background functions, ordinary TikTok and MeetMe liked payloads reached
   Dock with capturelikeevent absent/off as well as on; Reactions received
   them too. The popup still advertises the main-feed toggle. This is pending.

2. Instagram account-activity polling has unmet background dependencies.
   Both sources/instagram.js and sources/instagramlive.js call
   claimInstagramInboxPoller and filterInstagramInboxStories. Neither command
   is implemented in the packaged background/service worker. Executing the
   packaged source helpers against the actual handleRuntimeMessage returned
   no polling grant and no story keys. pollNotifInbox exited without fetching
   the inbox. This affects account-activity capture; it does not establish a
   failure of the separate live-chat DOM parser. This is pending.

3. tests/webstore-selective-update.test.js is stale. Running it on this checkout
   fails immediately because it asserts manifest version 3.50.7. It cannot
   currently serve as a passing regression check for 3.50.20. Updating its
   assumptions requires reviewing the rest of its older feature expectations,
   rather than only replacing the version string. This is pending.

Review coverage and limits:

- Inspected the release records, complete retained-source inventory and the
  source/background changes responsible for the failures. Checked literal
  source and popup command names against background/service-worker handlers,
  and reviewed source setting references without matching controls/handlers.
  There are 216 packaged source/provider JS/HTML files. The two Instagram
  commands were the missing source cmd handlers; popup GIF preview uses the
  existing generic targeted-command route and is not a missing-handler bug.
- Reviewed all 811 upload paths: 267 JavaScript files, 133 executable inline
  scripts and 19 JSON files parsed successfully. Checked 539 literal manifest,
  script, stylesheet, getURL and dynamic-import dependency references.
- Missing literal references were the excluded local-browser-model worker and
  the two previously documented Kokoro bundles. The local model catalog/client
  are not packaged or loaded, and the popup's Web Store gates disable these
  providers. No new required static dependency failure was established.
- Generic-source learning-data commands are also absent in beta, so they are
  not classified as a regression introduced by this selective store update.
  Electron-only status messages and optional source settings without a new
  store control were not treated as verified failures.
- The functional reproductions used local fixtures and output stubs. No live
  authenticated provider session, exhaustive feature/UI matrix, hosted-site
  deployment or Web Store upload was tested. Syntax/dependency checks alone
  do not establish behavioral compatibility.

Why background.js was not copied wholesale:

The recorded release approach retained the installed 3.50.10 runtime and
selectively backported fixes while updating all 216 retained source assets.
The store package has explicit exclusions and disabled features, so copying
the whole beta background alone would not have been a complete update either.
The actual process error was failing to carry source-dependent background
changes with the source updates. The existing validation emphasized parsing,
rendering and selected chat flows but missed disabled ad/like announcements
and Instagram source/background coordination.

Recommended next approach, not implemented by this fix:

- Resolve the two confirmed runtime mismatches and the obsolete selective
  update test before preparing the next upload.
- Choose one upstream snapshot for the next comprehensive update. Review full
  current implementations for retained features, including background, popup,
  worker, providers and shared helpers together. Apply the documented Web Store
  exclusions explicitly, instead of recreating a current source layer on an
  older coordinator through unrelated file copies.
- For each retained feature, follow the full path: control/default and stored
  setting, source emission, runtime request handlers, Event Flow, output
  routing and receiver. Check both off and on states where a toggle exists.
- Run those integration checks against the exact extracted upload package,
  alongside the store-specific exclusion/dependency checks. Reconcile the
  package inventory and review notes only after that candidate passes.

This change does not prepare a new version or ZIP. The existing 3.50.20 ZIP
predates this correction; a future upload must be rebuilt from the corrected
checkout after the remaining findings are addressed.

### 2026-09-30 Second Review: Beta Parity Evidence

Compared all 811 inventory paths in the current 3.50.20 checkout against the
recorded initial beta cf23f2b3, last backport beta a3547113, and beta d62b1448.
The Web Store checkout includes the uncommitted ad-announcement correction
documented above. These are file comparisons, not a claim of full functional
equivalence. Line-ending-only differences were counted separately.

| Comparison to recorded last backport a3547113 | Identical | Line endings only | Substantive difference | Absent from beta |
| --- | ---: | ---: | ---: | ---: |
| All inventory files | 616 | 6 | 184 | 5 |
| Source/provider JS and HTML | 213 | 0 | 0 | 3 |
| All packaged JS and HTML | 253 | 6 | 149 | 3 |

The three retained source files absent from beta are grabvideo.js, trovo.js,
and xeenon.js. Their presence is not classified as a bug. Against beta
d62b1448, 152 packaged JS/HTML files differ substantively. A current source
layer therefore does not demonstrate that its consumers and controls were
updated. The differing files include intentional store changes and missing
backports; this review does not classify every differing hunk.

Additional findings:

1. Native Twitch Bits counts: the newer beta fix aa532ce0 is not present.
   A local fixture executed the actual provider's cheer handler, the full
   normalized-membership and IRC adapter functions, and the packaged Event
   Flow evaluator. For a 100-Bit cheer, the store emitted the display amount
   and USD value but lost the native count. A 50-Bit minimum failed; with the
   beta adapter it passed. Both versions matched a zero minimum and rejected
   a 150-Bit minimum. EventSub cheer capture is a separate path and already
   supplies meta.bits. This is a fix newer than the recorded store baseline,
   not evidence that the September 27 update omitted a then-existing fix.

2. Saved-history deletion is an incomplete feature port, not a broken visible
   button. The store's newer chathistory.js contains requestHistoryClear and
   its optional click handler, but chathistory.html has no clear-history
   button, background.js has no clearHistory action handler, and the worker
   lacks the corresponding disabled-state exception. These beta changes date
   to 3111bd9d (July 23), before the recorded snapshot. Directly invoking the
   copied request helper through the actual worker/background functions
   returned only state, never ok, with the extension on or off. Beta invoked
   a fake database successfully. No real history was deleted. Since the UI
   does not expose the action, the observed difference is an omitted beta
   capability requiring a disposition, not a reproduced user click failure.

3. The existing 3.50.20 ZIP still lacks the ad-announcement correction. Its
   811 paths exactly match the inventory, but its background.js differs from
   the current checkout; all other inventory files are byte-identical. ZIP
   SHA-256: bd3ec095749c160a8f3891a8f05a8617dc067a7b422226221a43477dcff99c57.
   Inventory/path agreement alone would not detect the missing correction.

The previously verified capturelikeevent and Instagram inbox-coordination
mismatches remain pending. The version-pinned selective-update test remains
stale. The separate release record's assertion of selected backports does
not establish complete coverage of beta changes.

Newer beta changes need separate tracking from missed older dependencies.
Code comparison also finds the newer YouTube membermilestone labeling and
Dock membership-queue changes absent from the store. These were not tested
as live behaviors in this review. The source diff also includes SSApp-only
YouTube status reporting and Rumble direct-fetch selection for file/Electron
contexts; their absence was not classified as a Chrome capture failure.

Recommended evidence for the next comprehensive update:

- Pin one beta commit as the target. For every substantive package difference
  and relevant beta-only dependency, record whether it is carried over,
  intentionally excluded with the existing store rationale, or pending.
  A snapshot hash by itself does not record which selective changes landed.
- Review retained features as a connected implementation: manifest/loading,
  popup/defaults, source/provider, service worker, background, Event Flow,
  receiver, and packaged assets. Use the pinned beta implementation as the
  reference and account explicitly for store-specific differences.
- Reuse targeted functional checks with identical inputs against beta and
  the store package. Include defaults/off/on for routing controls and source
  output passed to its actual consumer, rather than supplying an already
  idealized payload to the consumer test. Repair the stale store test's
  reviewed assumptions before relying on it.
- Verify the exact rebuilt upload ZIP: contents/hashes, packaged dependencies,
  the targeted behavior checks, and a clean Chrome startup/message-delivery
  check. Track hosted receiver deployment separately where applicable.

Review artifacts are in the beta checkout's ignored temporary directory
tmp/webstore-parity-review-20260930: comparison.json (all 811 paths),
verify-boundaries.cjs and boundary-results.json (paired local fixtures), and
archive-results.json (exact ZIP comparison). The history fixture explicitly
records the missing store UI to avoid mistaking helper execution for an
exposed user workflow. Provider transport, browser APIs, DOM display and
database operations were mocked; no live provider authentication was tested.
This second review changes only these notes, not the application or ZIP.


## Historical local checkout notes (superseded by 3.50.25)

The following local 3.50.12 notes are retained as history, not current release claims.

Release status: artifact checks are complete. A manual live VPZone capture test
remains recommended before Web Store upload.

### 2026-09-08 Existing-Package 3.50.9 Update

- Source: the clean local `C:\Users\steve\Code\social_stream` checkout at
  `833d92fa5989fb71ef2249a9aca4d8258a73c517`, version `3.50.9`.
  The source checkout was read only and remains clean. No branch, commit,
  push, deployment, or Web Store submission was made.
- Used the verified `3.50.7` ZIP's 771-file inventory as the package boundary.
  Updated 240 existing packaged files, retained the reduced README, and added
  58 dependencies/assets needed by the updated files. No existing package
  files were removed. This was a file-by-file three-way adaptation against
  the common `6be013f4` source baseline, not a merge of the full application.
- Added dependencies: popup bootstrap/style/capture reminder, dashboard
  questions, local-server URL and transport deduplication helpers, Stream Deck
  remote helper, Kick badges, page translations, sound library, sticker,
  monetization and audience-room helpers, theme styles, and word-chain styles.
  Added required sound/sticker/guide/celebration assets and Arabic/French
  translations. New helper API fetches carry data, not executable code.
- Preserved adult-provider exclusions, disabled Event Flow custom code,
  disabled local model/TTS providers, and the working Web Store Spotify OAuth
  callback and duplicate-flow guard. Removed incoming custom-JavaScript UI,
  upload handlers, custom-code syntax execution, and desktop HTTPS script
  download/execution. Removed the dormant popup Kokoro bundle imports because
  those runtimes are excluded. Extended local-AI gating to `localqwen2b`.
- Kept new documentation and preview links on the hosted site, matching the
  existing reduced build. Fixed a missing closing brace in the adapted hype
  overlay and retained extension-relative developer links.
- Manifest: `3.50.9`; still 145 content-script groups. Updated match patterns
  for existing source groups. API permissions and host permissions are
  identical to `3.50.7`; no new provider groups were added. Exposed the packaged
  `shared/kickBadges.js` helper for the existing Kick adapter.
- Permission evidence remains: `storage` for settings/session state;
  `notifications` for background startup/recovery notices; `tabs` for opening
  and messaging source/background tabs; `scripting` for packaged source
  injection (`service_worker.js`); `debugger` for chat input automation
  (`background.js`); `tabCapture` for tab audio/video (`service_worker.js`,
  `sources/capturevideo.js`); `identity` for Spotify OAuth (`spotify.js`).
  Broad host access remains required by user-selected packaged source injection.

Validation completed:

- 114 changed/added JavaScript files pass syntax checks; inline JavaScript in
  packaged HTML passes syntax checks; strict background lint and diff checks pass.
- Selective Web Store regression tests, 26 disabled-custom-code assertions,
  sanitizer corpus, Blaze, Twitch GIF/watch-streak/subgift, ChatGPT, and VK Video
  source tests pass.
- Clean Chromium extension smoke passes both against the working directory
  and against the final extracted ZIP. Popup search works; all background
  scripts load; real packaged YouTube and Twitch content scripts capture local
  DOM fixtures through extension messaging and background processing; both
  messages render in the packaged dashboard served at its normal web origin.
  The test substitutes the network bridge and blocks external HTTP requests.
- Twitch source-disable blocks subsequent fixture capture. All 17 sound-library
  files fetch and decode. System TTS reaches the speech API with the selected
  volume and respects mute; speech output is stubbed, not audibly verified.
- Final ZIP: all 21 JSON files parse, all manifest and local script/style
  references resolve inside the package, and every extracted file byte-matches
  the working tree. No removed-provider or first-party remote/custom executable
  code scan hits. Development files, tests, Git metadata, and preparation notes
  are excluded.

Upload artifact:

- `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.9-20260908-conservative-r1.zip`
- 829 files; 37,116,929 bytes.
- SHA-256: `8b6e0d92c342ec40660f2c35f40b7b9011c715cc31b183d134947e04ecd94b6b`

Before submitting: perform an authenticated live-site capture check in Chrome,
and confirm the actual listing/privacy declarations match the included features.
The automated tests use fixtures and do not verify third-party authentication,
paid API providers, audible speech, or Google approval. Reviewer instructions:
open the extension, enable capture, open the Main Chat dashboard, then open a
YouTube live-chat popout or Twitch chat popout and confirm a new message appears.
Use source-disable and sound/TTS controls to verify the advertised behavior.

### 2026-09-08 R2 Popup Width

- Added `min-width: 450px` to the `body` CSS in both Web Store and normal
  `popup.html` files, as requested. Neither checkout has a `main.css` file.
- Chromium extension checks confirm a 450px minimum and expansion to 800px;
  popup search still works.
- Use `social-stream-ninja-chrome-web-store-3.50.9-20260908-conservative-r2.zip`.
  Only `popup.html` differs from R1; all 829 entries pass ZIP integrity checks.
- Size: 37,116,937 bytes. SHA-256:
  `722870507fc43073a79145ac99ac9207b8dbced4b6f986f8b9fbe30bf8431b2b`.

### 2026-09-08 R3 Popup Layout Sync

- Synced the latest local normal-build `popup.html` and `popup-ui.css` edits:
  standard Audience Room accordion, simplified audience control styling, and
  games-selector overflow fix. Preserved 450px minimum width, Web Store feature
  exclusions, and the hosted audience setup guide link. No new dependencies.
- Chromium extension checks pass at 450px and 800px: audience panel opens,
  fields do not overflow, game selector overflow is visible, search and Escape
  work, removed controls remain absent, and no popup runtime errors occur.
- Use `social-stream-ninja-chrome-web-store-3.50.9-20260908-conservative-r3.zip`.
  Only `popup.html` and `popup-ui.css` differ from R2. All 829 entries byte-match
  the working tree; ZIP integrity and popup dependency checks pass.
- Size: 37,116,998 bytes. SHA-256:
  `046f8ce36387a1913da473a34192f72e9b6cba087550123bfde7004d0ada1bee`.

### 2026-09-08 R4 Final Package Review

Use `social-stream-ninja-chrome-web-store-3.50.9-20260908-conservative-r4.zip`.
The package is 28,185,529 bytes (28.2 MB; 26.9 MiB), 43,717,058 bytes unpacked,
with 838 files. It is 24.1% smaller than R3 and well below Chrome's documented
2 GB ZIP limit. SHA-256:
`eac42822a58b385e9adc93b6c9966a6dfc51cddea1f6435612ab35bfa9839792`.

Review fixes:

- Omitted `thirdparty/NotoColorEmoji.full.ttf` from the ZIP: no packaged text,
  script, style, or font loader references it. Kept the smaller referenced
  `NotoColorEmoji.ttf` and all runtime files. The full font remains in the source
  checkout; no file was deleted from either repository.
- Added the eight WebP images referenced by `themes/featured-styles/artwork.css`.
  Every image successfully decodes in Chromium.
- Fixed seven unbundled help-document links across the Event Flow guides and
  test-message page by pointing to the hosted documentation.
- Removed the stale `&js=` example in `seo.md` and unused translation properties
  advertising custom-JavaScript upload. Disabled Event Flow explanations remain.
- Added upstream SIL Open Font License copies for the packaged Noto emoji and
  Sora fonts. No font binaries were modified.
- Added the required Google API Limited Use statement to packaged `privacy.html`
  and updated its date. This local change has NOT been published to the website.

Final artifact validation:

- ZIP integrity passes; every entry byte-matches the reviewed working-tree file.
  All 21 JSON files parse. All 397 JavaScript files/inline script blocks parse.
- No missing manifest resources, static HTML script/style/media references,
  CSS URL assets, or static local help links. One documentation example containing
  an escaped placeholder image URL was excluded from the resource check.
- No removed adult-provider, remote script-tag/import, or base64-JavaScript
  loader scan hits. Reviewed dynamic loaders resolve packaged dependencies;
  local-model paths remain excluded and disabled. Static Circle injection is
  packaged code. VDO/StreamSaver/GitHub-button iframe paths are isolated web
  contexts, not remote scripts executing with extension APIs.
- No development folders, Git metadata, test suites, credentials files, ZIPs,
  or model weights are shipped. Only the previously reviewed seven API
  permissions remain; each has executable usage. Broad hosts and `debugger`
  still need the existing clear reviewer justification.
- Clean-profile Chromium tests against extracted R4 pass: initial extension
  startup, popup on/off toggle, search, Audience Room accordion, options
  save/reload, eight restored theme images, YouTube/Twitch DOM capture through
  actual extension messaging/background processing, dashboard rendering,
  Twitch source disable, all 17 sound files decoded, and system TTS volume/mute.
  External HTTP traffic is blocked and chat/bridge fixtures are substituted;
  speech API output is stubbed. No third-party channel was used.
- Selective-update tests, 26 custom-code-disabled assertions, and the 29-case
  sanitizer corpus pass. `git diff --check` passes. Source-specific regression
  results from the earlier 3.50.9 review remain applicable; source code is unchanged.

Outstanding before submission:

- The public `https://socialstream.ninja/privacy.html` inspected on September 8
  still lacks the affirmative Limited Use statement. Publish the prepared
  statement from local `privacy.html` to the public privacy policy (or another
  clearly linked extension-owned page). A statement inside the ZIP alone does
  not meet the website disclosure requirement.
- Verify the actual Store listing, screenshots, permission justifications, and
  privacy fields. The Developer Dashboard was not accessed, and its declarations
  cannot be certified from the ZIP. Run an authenticated live capture check;
  paid API/OAuth flows and audible voice quality were not exercised.
- No submission, website deployment, mainline edit, commit, or push was performed
  during this final review. Passing these checks is not a guarantee of Google approval.

Policy references checked:

- https://developer.chrome.com/docs/webstore/publish/
- https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements/
- https://developer.chrome.com/docs/webstore/program-policies/limited-use/
- https://developer.chrome.com/docs/webstore/program-policies/permissions
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/

Font license sources:

- https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/LICENSE
- https://raw.githubusercontent.com/google/fonts/main/ofl/sora/OFL.txt

## Live capture follow-up (2026-09-08)

- Loaded the extracted R4 ZIP in regular Chromium with a fresh isolated profile;
  enabled the extension through its popup. Background dependency loading completed
  with no failures. No package code was changed.
- Read public live chats without signing in or posting. Used YouTube Lofi Girl's
  current live video `rFZHOHl-L8A` and Twitch `yourragegaming`, selected from the
  live directory. Never accessed the excluded CamCam66Gaming channel.
- During a 60-second observation, actual packaged content scripts delivered 8
  YouTube messages and 57 Twitch payloads to background `sendDataP2P`. All 8
  YouTube messages had names and message content; 54 Twitch payloads had message
  content and 55 had names (counts include non-message payloads).
- Instrumentation counted payloads while calling the original sendDataP2P;
  no fixture DOM, synthetic messages, or mocked platform responses were used.
  This verifies live source-to-background capture, not remote dock delivery,
  authenticated account flows, or paid interactions.
- Initial headless YouTube attempt showed an unsupported-browser message;
  regular Chromium with the current live video succeeded. An older video URL
  had no active chat, and Monstercat produced no messages during observation.
- R4 ZIP remains unchanged. Temporary validation output is outside the package
  at `../.codex-tmp/live-capture-result.json`.

## Current working release: 3.50.12 (2026-09-10)

The authoritative build is now `C:\Users\steve\Code\webstore\social_stream`,
the folder Steve loads in Chrome. The reviewed rebuild has been applied here.
There is no separate newer staging build to load or maintain.

Current ZIP: `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.12.zip`.
It was rebuilt directly from this checkout: 951 files, 28,907,917 bytes.
SHA256: `7e701d3ae1f87ae2f4d3f61e862027bf53b416d74e994decf62b0ea0592f23b1`.
The old `3.50.12-staged-review` filename was replaced, not retained as another
release copy. Existing older release ZIPs remain; no new backup folder was made.

The reviewed official baseline remains `1c7e0422b9f53143c9af56184c0b9774df1e442b`.
The release version is explicitly 3.50.12. All 385 retained source/provider files
and all 154 non-adult manifest registrations, including their complete ordered
dependencies, match that baseline. Both distinct YouTube registrations and
Parti's full `https://parti.com/*` scope are preserved.

Applying the reviewed build copied 255 new/changed package files and removed
171 previously excluded or superseded package files. This preserves the reviewed
adult-provider exclusions, packaged executable dependencies, seven API permissions,
custom-code blocks, disabled local AI/TTS/sentiment runtimes, Spotify OAuth fixes,
font licenses and hosted-help changes. Repository instructions, tests, tooling and
development notes remain outside the upload inventory. The official checkout at
`C:\Users\steve\Code\social_stream` was not modified.

The regression tests and their baseline fixtures now live in this repository's
existing `tests/` and `tests/fixtures/` directories. They default to this checkout,
with no dependency on hidden staging directories. Run from this folder:

```powershell
node tests/webstore-source-manifest.test.js
node tests/webstore-upstream-parity.test.js
node tests/webstore-store-restrictions.test.js
node tests/webstore-package-integrity.test.js
node tests/eventflow-customjs.test.js
node tests/webstore-extension-smoke.test.js
node tests/webstore-help-runtime.test.js
node tests/webstore-review-functionality.test.js
.\tests\webstore-zip-parity.test.ps1
```

All nine checks passed on this checkout/release. Actual Chromium extension
fixtures cover YouTube regular/bare-domain popouts, Studio top-level and embedded
chat, explicit opt-in watch capture, and absence of ordinary watch live/replay
capture. YouTube, Twitch and Kick messages traverse the extension background and
render in the dock through an offline transport fixture. Popup opt-out controls
disable and re-enable each service without disabling another service. All 17
packaged sounds decode; popup volume reaches dock audio at 25%, 0% and 75%; the
source picker successfully injects packaged code using `scripting`. The remaining
checks cover dependency order, custom-code restrictions, help navigation and
credential isolation, and exact SHA256 equality of all 951 ZIP/checkout files.

Known remaining limits and rejection risk:

- The public privacy policy checked on September 10 includes the previously
  missing collection/use/storage/sharing sections and Limited Use statement.
  This supersedes the September 8 observation above. Store dashboard declarations,
  listing claims, screenshots and permission justifications were not inspected.
- The extension-linked public supported-sites catalog still contains adult-service
  URLs; public event-reference help also mentions Joystick.tv. This remains a
  Grey Lithium rejection risk. Resolve the Web Store help scope before submission;
  no public website was changed as part of this sync.
- Live end-to-end capture in Steve's Chrome/Streamlabs session remains unverified.
  The browser tool blocked extension pages and Chrome's extension manager. The
  actual loaded-folder confirmation and connected dock check are still pending.
  Offline fixtures and stubbed speech do not prove authenticated live delivery,
  audible output or every provider's account/API flow.
- No submission, commit, push, branch change or Cloudflare action was performed.
- Git's whitespace check still reports 65 formatting warnings after accounting
  for CRLF line endings. Runtime files were kept byte-identical to the reviewed
  build; no unrelated formatting cleanup was applied. The nine validation checks
  above passed, but `git diff --check` is not clean.

`AGENTS.md` now requires release updates to finish in this checkout, keeps current
ZIP naming explicit, and requires the ZIP-parity test before reporting completion.

Cleanup note: automatic approval review rejected deletion of the obsolete
`.codex-tmp/official-rebuild-review` directory as "blocked by policy", without a
more specific reason. That directory remains unused and is marked obsolete;
the checkout, its tests, and the current release ZIP do not depend on it.


## 2026-10-03 Rebase resolution

Resolved local snapshot c94392d6 onto incoming Web Store release 16cc170f.
The local snapshot was based on 3.50.7 and contained the September 3.50.12 build.
Application files, including cleanly merged files, use the incoming coherent
3.50.25 release so the older snapshot cannot partially downgrade runtime,
translations, source helpers or capture fixes. The manifest is unchanged from
16cc170f; both YouTube registrations and complete Twitch dependencies remain.
Incoming exclusions of Velora and developer-only URL matches are retained.
Local AGENTS.md instructions, local-only development files, historical fixtures
and regression tests remain outside the release inventory. Both source-routing
and incoming UI/OBS/OAuth smoke suites are retained as separate tests. The local
package fixture now mirrors the incoming reviewed 974-file inventory.
Older tests pinned to the 3.50.12 source/restriction baselines are historical
and must not be interpreted as verification of 3.50.25.

Package audit found one local exclusion worth preserving: the incoming popup
retained an already-hidden link to the excluded StreamElements importer. Kept
the local removal of that hidden design-note block. This changes popup.html
only; it does not enable a feature or alter manifest/runtime permissions.
The popup digest and disposition in WEBSTORE_PARITY.json record that exception.

Verification: 16 focused checks passed, including package syntax/dependencies,
source manifests, incoming runtime regressions, both browser smoke suites, and
ZIP byte parity. Manifest/integrity/source/UI smoke also passed against the
extracted ZIP. Browser checks used offline fixtures and the actual extension
manifest; no authenticated live-provider or submission claims are made.
Current local ZIP: `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.25.zip`.
SHA-256: `4fcccefa97c5dcaac537a1849d2761213ae8d120c54106e49892177a8fd6ce0b`. All 974 entries match this checkout.
Detailed results and the original incoming artifact provenance are in
WEBSTORE_VERIFICATION.json.


## 2026-10-03 Web Store packaging and help cleanup

Scope: C:\Users\steve\Code\webstore\social_stream only. The official
checkout, website and other delivery targets were not edited.

Behavioral change: the Creator Store provider setup link now opens the hosted
guide for Fourthwall, Ko-fi and Buy Me a Coffee instead of an excluded local
file. The change is guarded by WEBSTORE_CONSERVATIVE_RELEASE; without that
flag, the shared handler retains its existing relative link. The guide URL
contains the provider fragment only, without session or password parameters.
The hosted guide was checked at https://socialstream.ninja/docs/creator-store-setup.html.

Packaging and descriptions:

- Include the existing reviewed Noto Color Emoji and Sora licence files with
  the bundled fonts. The upload inventory grows from 974 to 976 files.
- Clarify the README's Web Store scope and retained capabilities, remove
  claims for the excluded widget importer/bundled local voices/custom code,
  and use hosted custom-overlay documentation.
- Remove the unsupported custom-JavaScript option from seo.md and remove an
  already-commented-out loader in featured.html. Neither was an active feature.
- Keep version 3.50.25, the entire manifest, CSP, permissions, defaults, source
  registrations, source code, capture behavior, message payloads and supported
  service integrations unchanged. No additional features were disabled.

Validation maintenance: preserve the old 3.50.12 fixtures as history and pin
current source/manifest parity to the independently reviewed incoming release
16cc170f. Test source hashes are taken from that release, not the working tree.
Retain all source-routing assertions, require font licences inside the upload,
and scan executable script bodies separately from documentation about disabled
code. Current Blaze fixtures insert history before startup settles. OpenCode
fixtures reflect the current free-model order/catalog lookup while preserving
cooldown, cache and paid-model exclusion assertions. No Blaze or AI runtime
code was changed to make tests pass.

Reviewer walkthrough: open the extension popup, turn SSN on, open a supported
chat popout, and open the generated Dock link. Select a captured message to
show it in the Featured overlay. Source disable controls should affect only
that service. System TTS uses the selected system voice; external APIs and
OAuth integrations require the reviewer's own optional accounts/credentials.
Creator Store setup help opens an ordinary hosted documentation page. Local
browser model bundles and arbitrary JavaScript are intentionally unavailable.

Policy references checked:
https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines

Executable extension dependencies remain packaged. The seven existing API
permissions still have direct use sites; no permission or host scope was added.
Store listing/account declarations, authenticated provider sessions, and Web
Store submission are not included in these local validation results.

Validation complete: all 39 checkout suites and all 8 extracted-upload suites
passed (47 runs), including actual extension routing, UI, Creator Store help,
font licences, provider exclusions, packaged code checks and full manifest/
source parity. The ZIP-parity PowerShell test also passed for all 976 files.
Current ZIP: `C:\Users\steve\Code\webstore\social-stream-ninja-chrome-web-store-3.50.25.zip`.
SHA-256: `4e13706acedcc019f6a2f519531d9a21c605e5111ebc7702d775ed6ebf286f4d`. Results are recorded in
WEBSTORE_VERIFICATION.json under webstore_compatibility_validation.

## 2026-10-03 public live capture check

Loaded this checkout's actual extension and unchanged manifest in headed
Chromium with a fresh signed-out profile, enabling capture through the popup.
Native manifest injection captured public chat from YouTube (Lofi Girl,
rFZHOHl-L8A), Twitch (yourragegaming), and Kick (gaules). No source scripts
were manually injected and no chat messages were posted.

Observed 97 YouTube, 83 Twitch, and 60 Kick named chat messages at the
background output, preserving the original output function and transport.
A 73.2-second observation interval added 80, 69, and 53 messages respectively.
Opened the popup-generated hosted dock and visually verified messages and
platform icons from all three services. Evidence is in
tmp/live-webstore-20261003; structured results are in WEBSTORE_VERIFICATION.json.

No application or manifest changes were required. Authenticated Studio/API
modes and actual Twitch ad events were not exercised by this public test.
Twitch's keyboard layout permission error did not prevent capture; a dock
link-inspection error in the harness was handled by visual verification.
