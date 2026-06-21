# Chrome Web Store Policy Notes

This file is branch-only guidance for the `chrome-web-store` branch.

Scope boundary: these notes apply only inside this branch and the Chrome Web
Store upload package made from it. They are not instructions for `main`, `beta`,
the website, Electron, Firefox, or non-Web-Store releases.

Do not add automation scripts for Web Store preparation here. This branch is
maintained manually with written review rules, checklists, and agentic review.
Do not copy these Web Store-only files or branch limitations back to `main` or
`beta`.

## Core Rule

For every feature in the upload package, choose one:

1. Keep it, verify it works in the packed extension, and make the listing match.
2. Remove it from code, manifest, UI, docs, screenshots, and listing text.

Do not leave broken links, hidden half-features, missing files, dormant source
claims, or UI controls for stripped functionality.

## Evidence Gate Before Removing Anything

Do not over-cleanse. Do not remove a feature, page, permission, dependency, or
provider based only on category, filename, vibes, or past fear.

Before deleting or disabling anything, identify the exact concrete problem:

- the file is missing or broken in this branch
- the feature is claimed but not reproducible in a clean Chrome profile
- the code loads remote executable JavaScript/WASM
- the manifest requests permission that this branch does not use
- the code points to adult/sexually explicit services
- the privacy policy/listing does not match actual data behavior
- the dependency cannot be redistributed or reviewed

If the problem can be fixed by bundling local dependencies, changing wording,
adding reviewer instructions, or narrowing a permission, prefer that over
deletion.

Do not classify a page as removable just because it is AI-related. For example,
`aiprompt.html` is not automatically a local-model feature. Inspect the page and
its actual dependencies before deciding anything.

## Known Chrome Web Store Rejection Areas

### Remotely Hosted Code

Manifest V3 extensions cannot include remotely hosted executable code.

Review for:

- `<script src="https://...">`
- dynamic remote script creation
- `import("https://...")`
- `importScripts("https://...")`
- CDN libraries
- remote WASM/code loaders
- fetched code passed into `eval`, `new Function`, script tags, or interpreters
- URL parameters that load JavaScript, including base64 JavaScript

Remote data, images, and API results are different from remote executable code,
but they still need privacy review.

Do not treat every remote URL as remotely hosted code. Images, API calls, VDO
bridge iframes, fonts, and JSON/data endpoints need review, but they are not the
same as remote executable JavaScript.

### Non-Functional Or Misleading Claims

Google has previously rejected this extension for advertised features they could
not reproduce.

Review for claims such as:

- capture live chat to dashboard
- disable chat services
- sound volume
- supported site counts
- overlays, bots, AI tools, TTS, or services that are not included here

Every claim in the manifest, listing, screenshots, popup UI, docs, and source
should match what this branch actually ships.

### Adult Or Sexually Explicit Sites

Remove adult streaming providers from the Web Store package.

Review:

- manifest host permissions
- content scripts
- source files
- provider lists
- docs
- UI labels
- screenshots

### Permissions

Request only permissions used by this package.

Review each manifest permission, especially:

- `debugger`
- `tabs`
- `scripting`
- `tabCapture`
- `identity`
- `activeTab`
- broad host permissions
- `http://*/*`
- `https://*/*`

If a permission stays, document the exact feature and file path that uses it.

### Code Readability

Avoid anything that looks hidden or obfuscated.

Review for:

- `JSON.parse(atob(...))`
- encoded executable logic
- unreadable generated blobs without a clear reason
- `eval`
- `new Function`
- base64 JavaScript

Minified third-party libraries are acceptable only when they are bundled locally
and do not fetch remote code.

### Privacy And Data Use

Chat capture can include personal communications, usernames, profile images,
URLs, platform IDs, and browsing activity.

The Web Store privacy fields, privacy policy, UI, and behavior must agree.

## Manual Review Checklist

Before upload:

- Load the unpacked extension from this branch in a clean Chrome profile.
- Test the popup.
- Test capture into the dashboard.
- Test at least YouTube and Twitch if they are listed.
- Test disable/source controls if listed.
- Test sound/TTS controls if listed.
- Search for remote script/code patterns.
- Search for stripped or missing feature references.
- Search for adult provider references.
- Verify every local script reference exists.
- Verify `manifest.json` parses.
- Verify all translation JSON parses.
- Zip only the extension files, excluding `.git`, local temp files, and notes
  that should not ship.

## Search Terms

Use these as review prompts, not deletion instructions. A hit means inspect the
surrounding code and decide from evidence.

```text
<script src="https://
script.src
import("https://
importScripts("https://
eval(
new Function(
JSON.parse(atob(
base64js
jsb64
cdn.jsdelivr.net
cdnjs.cloudflare.com
ajax.googleapis.com
unpkg.com
raw.githubusercontent.com
aioverlay.html
cohost-overlay.html
local-browser-model-worker
shared/ai
stripchat
bongacams
cam4
chaturbate
onlyfans
```
