# Chrome Web Store Policy Reference

Checked against official Chrome docs on 2026-06-21.

This branch is intended to be the stripped Chrome Web Store release build of
Social Stream Ninja. Treat the Chrome Web Store upload as its own product
surface: the submitted package, manifest, popup/options pages, extension pages,
screenshots, listing copy, privacy declarations, support links, landing pages,
ads, and any user-facing claims all need to agree with each other.

Google does not publish a complete reviewer checklist. The most useful public
sources are:

- Chrome Web Store Developer Program Policies:
  https://developer.chrome.com/docs/webstore/program-policies/policies
- Troubleshooting Chrome Web Store violations:
  https://developer.chrome.com/docs/webstore/troubleshooting/
- Deal with remotely hosted code violations:
  https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- Improve extension security / Manifest V3 migration:
  https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- Declare permissions:
  https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Fill out Chrome Web Store privacy fields:
  https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## Practical Release Rule

For each feature in the Chrome Web Store build, choose exactly one outcome:

1. Keep it, include only the code and permissions needed for it, and provide a
   repeatable reviewer test path.
2. Remove it from the package, manifest, UI, screenshots, listing text, and
   privacy declarations.

Do not keep disabled or desktop-only code in the package just because the normal
web/desktop app uses it. Reviewers and automated scanners inspect the submitted
files, not the intent of the branch.

## High-Risk Rejection IDs

### Blue Argon: Manifest V3 Remotely Hosted Code

MV3 extensions must have their executable logic inside the extension package.
Remote JavaScript, WASM, string execution from fetched code, CDN scripts, and
interpreters for remote commands are high-risk or prohibited.

Blockers:

- `<script src="https://...">`
- `script.src = "https://..."`
- `import("https://...")` or `from "https://..."`
- Fetching text and passing it to `eval`, `new Function`, dynamic script tags,
  or an interpreter.
- Third-party libraries that fetch code at runtime.
- Dead or unused code paths that still contain remote-code loading behavior.

Allowed with care:

- Remote data such as JSON or images, if the extension package contains all
  logic that interprets it.
- Server-side operations, if the server returns data/results and not executable
  client logic.
- Sandboxed iframes only when isolated from extension APIs and still fully
  explainable under the user data policies.

Fix pattern:

- Bundle third-party JS/WASM locally in `thirdparty/` or the release staging
  directory.
- Remove unused code paths rather than relying on reviewers to see they are
  disabled.
- Search the exact staged upload, not just the working tree.

### Red Titanium: Code Readability / Obfuscation

Code must not hide functionality. Minification is allowed, but obfuscation and
concealed logic are not.

Blockers:

- Base64-encoded JavaScript or config that becomes JavaScript.
- `atob(...)` used to decode hidden word lists, hidden logic, or injected code.
- Character-escaped strings used to conceal behavior.
- Generated blobs of unreadable custom logic without a clear source.

Fix pattern:

- Store lists and configuration as readable JSON or plain text.
- Remove URL-driven JavaScript injection paths from the Web Store package.
- If a third-party minified file is necessary, include its license/source note
  and ensure it does not fetch remote code.

### Purple Potassium: Permissions

The manifest must request the narrowest permissions needed for working,
prominently described features. Do not keep future-proof permissions.

Reviewers can reject permissions that are requested but not exercised by the
submitted package.

Fix pattern:

- Remove unused permissions.
- Move broad host access to optional host permissions where feasible.
- Keep a permission justification table for every manifest permission and major
  host permission pattern.
- Be especially cautious with `debugger`, `tabs`, `scripting`, `activeTab`,
  `tabCapture`, `<all_urls>`, `http://*/*`, and `https://*/*`.

### Red Potassium / Yellow Magnesium: Misleading Or Non-Functional Claims

Listing text, screenshots, title, icon, description, and developer dashboard
metadata must match the submitted build. A feature that only works in the main
site, desktop app, beta app, or a different branch should not be promised in the
Chrome Web Store listing.

Known historical claims to verify or remove:

- "Capture live chat to dashboard"
- "disable chat services"
- "Sound volume"

Fix pattern:

- Test each listed feature in a clean Chrome profile using the packed or staged
  extension.
- Provide reviewer instructions for any workflow that is not obvious.
- Remove listing text, screenshots, UI controls, and source files for features
  that are not reproducible in the Web Store build.

### Grey Lithium: Mature Or Sexually Explicit Material

Google policy rejects products that contain or drive traffic to sexually
explicit material or commercial pornography sites.

Fix pattern for this branch:

- Remove adult streaming providers from `manifest.json`, `content_scripts`,
  `host_permissions`, source lists, UI labels, docs, screenshots, and bundled
  source files in the Web Store upload.
- Avoid leaving dormant adult-site code in the package.
- Avoid host permissions that include adult domains, even if they are not shown
  in the UI.

### Purple Lithium / Purple Nickel / Purple Copper / Purple Magnesium: User Data

Chat capture can involve user-provided content, personal communications,
profile names, user IDs, page URLs, and browsing activity. The listing, privacy
policy, dashboard privacy fields, and UI must describe what is collected, how it
is used, what leaves the device, and who receives it.

Fix pattern:

- Keep privacy declarations consistent with actual behavior.
- Do not transmit user data over plain HTTP.
- Avoid putting sensitive user data in query strings or headers that become
  server logs.
- If data is only local, say that plainly in the listing/privacy policy.
- If remote services are used, disclose them and explain why they are necessary.

### Yellow Zinc / Yellow Argon: Metadata Quality And Keyword Spam

Listing metadata must be meaningful, current, and accurate. Long lists of
brands/sites can be considered keyword spam if they do not add substantial
value.

Fix pattern:

- Keep the description focused on the Web Store build's single purpose.
- Do not claim "100+ supported sites" unless the submitted package actually
  supports them and reviewer instructions demonstrate that.
- Prefer "selected supported live chat pages" or an accurate small list for the
  Web Store build.

### Grey Titanium: Affiliate Ads

Affiliate programs must be prominently disclosed in the listing and UI, and
each affiliate code/link/cookie needs a related user action and user benefit.

Fix pattern:

- Remove affiliate pages/code from the Web Store package unless they are core to
  the Web Store build and fully disclosed.
- If affiliate behavior remains, document the exact user action that triggers
  it.

### Blue Titanium: Enforcement Circumvention

Do not use packaging tricks, remote toggles, staged rollouts, or branch logic to
hide policy-sensitive behavior from review while delivering it to users later.

Fix pattern:

- Make the Web Store branch visibly and permanently limited in the submitted
  code.
- Do not leave policy-sensitive features dormant behind remote config.

## Current Branch Findings

These are quick local findings from the `chrome-web-store` branch on
2026-06-21. They are audit targets, not a full compliance verdict.

### Manifest Targets

- `manifest.json` description currently says: "Capture live chat from 100+
  supported sites and consolidate it into a single dashboard for live production
  workflows". This exact manifest description is present in the live `3.48.4`
  Web Store package that passed review. Preserve it unless the staged build can
  no longer support it; focus review effort on proving the dashboard capture
  flow in reviewer notes and screenshots.
- `manifest.json` requests `scripting` and `activeTab`, both previously flagged
  as unused. The prep script removes `activeTab`; preserve `scripting` only if
  the staged code path using `chrome.scripting.executeScript` remains.
- `manifest.json` also requests sensitive permissions including `debugger`,
  `tabs`, `tabCapture`, `identity`, broad `host_permissions`, `http://*/*`, and
  `https://*/*`. These need per-feature justification or removal.
- `manifest.json` currently includes adult-site host permissions and content
  scripts for `stripchat`, `bongacams`, and `cam4`. These are direct Grey
  Lithium risks for the Web Store package.
- `homepage_url` is `http://socialstream.ninja/`. Prefer HTTPS metadata and
  links in the Web Store context.

### Remote-Code / Dynamic-Code Targets

- `aiprompt.html` assigns `HTML2CANVAS_URL` to `script.src`; this is acceptable
  only while the URL remains local, currently `./thirdparty/html2canvas.min.js`.
- `bot.html` contains external JavaScript URL loading paths and an allowlist
  containing CDN hosts.
- `bot.html` supports URL/base64 JavaScript parameters such as `base64js`,
  `jsbase64`, and `jsb64`, then injects decoded code into a script element.
- `content.html` and `emotes.html` contain external JavaScript injection paths.
- `background.js` contains dynamic `script.src = url` behavior.
- `actions/EventFlowSystem.js` contains `new Function(...)` paths. Even if the
  UI says desktop-only, remove or exclude this code from the Web Store package
  unless it is impossible to reach and acceptable under MV3/CSP review.
- `manifest.json` allows `'wasm-unsafe-eval'`. If WASM is kept, document the
  exact feature and files that require it.
- Some third-party AI/ONNX/transformers files contain dynamic import/function
  patterns. If those files are not needed for the Web Store build, exclude them.

### Remote Resource Targets

- `index.html` links Font Awesome CSS from `cdnjs.cloudflare.com`. This is not
  the same as executable JavaScript, but the Web Store package should still
  prefer local bundled assets for deterministic review and CSP behavior. This
  page was present in the passing live package; keep it available unless all
  in-package references are removed.
- `map.html` previously had raw GitHub/jsDelivr JSON fallbacks. Main now uses
  bundled map data files, so keep those local-only fetches intact.
- `landing.html` currently references local `thirdparty/marked.umd.min.js`, but
  old rejections flagged CDN `marked` scripts. Keep this local in the staged
  upload if the page is restored or retained.

## Live Web Store Package Comparison

Checked on 2026-06-21 by downloading the live CRX for
`cppibjhfemifednoimlblfcmjgfhfjeg` and comparing it to
`origin/chrome-web-store`.

- Live package version: `3.48.4`.
- `origin/chrome-web-store` manifest version: `3.50.0`.
- Live manifest description:
  "Capture live chat from 100+ supported sites and consolidate it into a single
  dashboard for live production workflows".
- Live package file count: `684`.
- `origin/chrome-web-store` file count: `873`.
- Files added in `origin/chrome-web-store` compared with live: `212`.
- Files present only in live: `23`.

### Passing Baseline Lessons

- Do not rewrite the manifest description casually. The current wording already
  passed in the live package and should be paired with clear reviewer steps for
  proving chat capture into the dashboard.
- Live and `origin/chrome-web-store` both request `activeTab`, `scripting`,
  `debugger`, `tabs`, `tabCapture`, `identity`, `webNavigation`,
  `notifications`, and `storage`. Prior rejections still flagged `activeTab` and
  `scripting`; the prep script removes `activeTab`, but preserves `scripting`
  because `service_worker.js` uses `chrome.scripting.executeScript`.
- Be careful stripping files that are linked from `popup.html`, generated by
  `popup.js`, shown in screenshots, or described in the listing. Google can
  reject an unavailable advertised page as non-functional even when the file was
  removed for Web Store hardening.
- Live does not include the newly added adult-provider scripts for `stripchat`,
  `bongacams`, and `cam4`.
- Live does not include broad `http://*/*` and `https://*/*` host permissions
  that appear in `origin/chrome-web-store`.

### Notable Additions Since Live

- `origin/chrome-web-store` adds host permissions for `http://*/*`,
  `https://*/*`, `stripchat.com`, `bongacams.com`, `cam4.com`, `vpzone.tv`,
  `goodgame.ru`, and updated Sooplive hosts.
- It adds adult-provider content scripts for `stripchat`, `bongacams`, and
  `cam4`, plus additional scripts for `fc2`, `vpzone`, `sooplive`, `x`, and
  `goodgame`.
- It adds AI/local-model web-accessible resources:
  `shared/ai/browserModelCatalog.js`, `shared/ai/localBrowserLLM.js`,
  `shared/aiPrompt/overlayStore.js`, `local-browser-model-worker.js`, and
  `cohost-local-qwen-worker.js`.
- High-risk origin-only file categories found:
  - `tmp/`: `145` files.
  - AI/model/local-browser files: `22` files.
  - Adult-provider files/images: `8` files.
  - `local-tts-bridge/`: `2` files.
  - AI prompt/cohost-related paths: `150` matches.

### Remote Resource Differences

- The live `3.48.4` package contained `giveaway.html`, which loaded
  `https://cdn.tailwindcss.com` with a remote script tag. Main now removes that
  remote runtime; keep the page available and block any remote script regression.
- `origin/chrome-web-store` contained `aiprompt.html`, which referenced CDN
  `html2canvas`. Main now uses local `./thirdparty/html2canvas.min.js`; the Web
  Store prep script still strips the AI prompt feature until it is intentionally
  restored for review.
- Both live and `origin/chrome-web-store` contained `map.html` atlas JSON
  fallbacks from remote hosts. Main now uses bundled map data files; keep
  `map.html` available because it is advertised in the popup.
- Main now localizes the earlier `affiliate.html`, `vdo.html`, and
  `sources/websocket/bilibili.html` CDN script issues. Keep these files
  available in the staged package.
- `origin/chrome-web-store` still leaves remote CDN strings in `bot.html` and
  `streamelements-importer.js`. The prep script keeps the live-package pages and
  removes only the newer StreamElements importer link and files.

### Availability Rule

The current prep script should not remove broad page surfaces just because they
are website-hosted or overlay-oriented. If a page is linked from the popup,
generated by `popup.js`, shown in screenshots, or named in Web Store listing
copy, either keep it working in the staged package or remove/hide every
in-package reference to it.

- Keep the passing-package pages available by default, including `actions.html`,
  `dock.html`, `events.html`, `featured.html`, `giveaway.html`, `hype.html`,
  `index.html`, `landing.html`, `map.html`, `poll.html`, `ticker.html`,
  `timer.html`, `tipjar.html`, `waitlist.html`, `wordcloud.html`, `bot.html`,
  `chatbot.html`, `cohost.html`, `content.html`, `emotes.html`, `actions/`,
  `thirdparty/models/`, and `thirdparty/kitten-tts/`.
- If a kept page has a remote-script issue, repair it when possible. Main now
  localizes `qrcode`, `pako`, `html2canvas`, `sampleoverlay.html`, map data, and
  sample API CSS. The prep script still includes defensive repairs for
  `giveaway.html`, `sampleoverlay.html`, and `sampleapi.html`.
- If a stripped page is too risky to keep, hide or remove its UI references in
  the staged package. The prep script currently hides the AI prompt/stage
  overlay wrappers and removes their page mappings, and removes the
  StreamElements importer popup link.

### Prep Script Coverage For These Differences

The current prep script is intended to remove the comparison regressions before
upload:

- Removes adult providers/files/images and scans the staged package for adult
  provider strings.
- Removes `tmp/`, `local-tts-bridge/`, new AI/local-model files, AI
  prompt/stage-overlay pages, and the newer StreamElements importer files.
- Keeps passing-package overlay/tool pages available unless their UI references
  are also removed or hidden.
- Repairs kept pages where practical to avoid remote hosted code.
- Preserves the manifest description from the source branch. The current source
  description matches the live package that passed review.
- Removes `activeTab` from the generated manifest as a conservative response to
  prior rejection feedback, while preserving `scripting` because current code
  uses it.
- Blocks remaining remote executable script tags and known CDN JavaScript URLs.
- Warns on remaining remote CDN/resource URLs, dynamic-code strings, broad
  permissions, and stripped-feature references.

## Repeatable Local Audit Commands

Run these against the staged upload directory before zipping, not only against
the source checkout.

```powershell
rg -n "cdnjs|ajax\.googleapis|unpkg|jsdelivr|cdn\.tailwindcss|script\.src|<script src=|import\(" -S --glob "!tmp/**" .
rg -n "eval\(|new Function|atob\(|base64js|jsbase64|jsb64|wasm-unsafe-eval" -S --glob "!tmp/**" .
rg -n "activeTab|scripting|debugger|tabCapture|host_permissions|http://\*/\*|https://\*/\*" manifest.json
rg -n "stripchat|bongacams|cam4|chaturbate|onlyfans|porn|sex|adult" -S manifest.json sources actions popup.html popup.js background.js
rg -n "Capture live chat|dashboard|disable chat services|Sound volume|100\\+ supported" -S manifest.json *.html *.js
```

For every match:

1. Confirm whether the file is included in the final zip.
2. If it is executable logic from outside the package, bundle or remove it.
3. If it is hidden/dynamic code, remove it from the Web Store package.
4. If it is a permission or host pattern, map it to a working, listed feature.
5. If it is metadata/listing copy, prove it in a clean reviewer workflow or
   rewrite it.

## Pre-Submission Checklist

### Package

- Build into a clean staging directory.
- Exclude `tmp/`, local test outputs, desktop-only helpers, unused third-party
  libraries, adult providers, and unreferenced experiments.
- Search the staging directory for policy-sensitive strings.
- Zip only the staging directory contents.

### Manifest

- Remove unused permissions.
- Remove broad host permissions unless essential.
- Prefer optional permissions/hosts for non-core sites.
- Remove adult-site hosts and content scripts from the Web Store build.
- Use HTTPS for `homepage_url` and listing/support/privacy links.

### Functionality

- Load the staged extension in a clean Chrome profile.
- Open the popup/options page and verify no console errors.
- Open the dashboard through the normal UI.
- Use at least one reviewer-accessible source to send a test chat message into
  the dashboard.
- Verify claimed controls such as service enable/disable and sound volume, or
  remove those claims.
- Record exact reviewer instructions for all non-obvious flows.

### Listing

- Match listing text to this branch only.
- Avoid broad site-count claims unless the staged package proves them.
- Avoid long brand/site keyword lists.
- Ensure screenshots show only features in the submitted build.
- Do not mention desktop app, beta-only, remote-hosted, or hidden features as if
  they are part of the Web Store item.

### Privacy

- Privacy policy and dashboard privacy fields must match the build.
- Disclose chat message capture, usernames/user IDs, page URLs, browsing
  activity, account/auth data, AI/LLM calls, remote relays, and analytics if any
  are present.
- Use HTTPS for any user-data transmission.
- If chat data stays local, make the local-only boundary explicit.

### Reviewer Notes

Prepare a short note for the submission:

- Primary purpose of the Web Store build.
- Exact steps to verify "capture live chat to dashboard".
- Permissions table with one-line justifications.
- Statement that no remotely hosted executable code is used.
- Statement that adult-site integrations are excluded from the Web Store build.
- Statement that desktop-only features are excluded or unavailable in this
  package.

## Release Review Prompt

Use this prompt when reviewing the generated `chrome-web-store` branch or the
unzipped Chrome Web Store package.

```text
You are reviewing the stripped Chrome Web Store build of Social Stream Ninja.
Treat the staged package as the only product Google will review. Do not assume
the main branch, website version, desktop app, beta app, or external docs are
available unless the staged package explicitly includes and uses them.

Primary goal:
- Find anything that can cause Chrome Web Store rejection before I upload the
  ZIP manually.

Review order:
1. Inspect manifest.json first.
   - Confirm manifest_version is 3.
   - List every permission and host permission.
   - Flag unused, broad, future-proof, or hard-to-justify permissions,
     especially activeTab, scripting, debugger, tabs, tabCapture, identity,
     <all_urls>, http://*/*, and https://*/*.
   - Confirm homepage_url and support/privacy links are HTTPS.
   - Confirm adult-site domains and adult-provider content scripts are absent.
   - Confirm the description is accurate for the stripped build and does not
     overclaim site count or dashboard behavior.

2. Search for Manifest V3 remotely hosted code.
   - Block any <script src="https://...">.
   - Block any CDN JavaScript or WASM URL.
   - Block dynamic import from http/https.
   - Block fetched strings that are executed as JavaScript.
   - Distinguish remote data JSON/images from remote executable logic.

3. Search for obfuscation and hidden/dynamic logic.
   - Flag base64 JavaScript parameters, atob-decoded code, eval, new Function,
     custom JS upload/injection, URL-driven script loading, and string
     interpreters.
   - Minified third-party files are acceptable only if bundled locally and not
     fetching code.

4. Search for mature or sexually explicit provider remnants.
   - Flag domains, source files, UI labels, screenshots/docs, settings, arrays,
     source lists, and translation strings for adult providers.
   - Do not accept "not used" as enough if the code or host permission remains
     in the submitted package.

5. Check functionality claims against the staged package.
   - Verify or remove claims such as "Capture live chat to dashboard",
     "disable chat services", "Sound volume", "100+ supported sites", AI,
     TTS, OBS automation, payments/tip jar, affiliate, cohost, and desktop-only
     features.
   - If a UI control remains but the file/feature was stripped, flag it as a
     non-functional claim risk.

6. Check user data and privacy consistency.
   - Identify whether chat messages, usernames, user IDs, profile images, page
     URLs, browsing activity, account/auth data, AI prompts/responses, local
     model data, remote relay data, analytics, or payment data are collected or
     transmitted.
   - Confirm privacy policy, Web Store privacy fields, and UI disclosures match
     the staged build.
   - Flag any HTTP transmission of user data.

7. Check packaging hygiene.
   - Flag tmp files, test logs, scripts, docs, local server helpers,
     node_modules, package manager files, unused third-party libraries,
     desktop-only files, large model files, and generated artifacts.
   - Confirm every manifest-referenced file exists with exact case.
   - Confirm the ZIP root contains manifest.json directly.

Output format:
- Start with blockers that should stop upload.
- Then list warnings that need human decision.
- Then list suggested code or script changes.
- Include exact file paths and line numbers.
- Separate confirmed facts from assumptions.
```

## Current Automation Notes

The source workflow lives on `main`:

- `.github/workflows/chrome-web-store.yml`
- `scripts/prepare-chrome-web-store.sh`

The generated `chrome-web-store` branch should be treated as disposable output
from that script. Fix reusable stripping/audit behavior in the script on
`main`; fix Web Store-only product behavior either in the script or in source
code guarded so the normal app is not limited.

The script now writes `cws-policy-report.txt`. Review that report before using
the ZIP artifact.

The workflow installs `jq`, `rsync`, and `zip` explicitly before reading the
manifest, staging the package, and creating the ZIP. If the script gains new
tool dependencies, add them to that workflow step.
