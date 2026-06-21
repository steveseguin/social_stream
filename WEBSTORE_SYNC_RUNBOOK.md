# Chrome Web Store Sync Runbook

Use this when updating the `chrome-web-store` branch from `main`.

This is a manual process. Do not replace it with a script or GitHub Action.

Scope boundary: this runbook applies only to the `chrome-web-store` branch.
Cleanup decisions here are for the Chrome Web Store upload package only. Do not
apply Web Store-specific removals or limitations to `main`, `beta`, the website,
Electron, Firefox, or any other release target unless Steve explicitly asks.

## Goal

Bring in current app changes from `main`, resolve conflicts, then manually
review the branch for Chrome Web Store policy risks before creating the upload
zip.

## Before Pulling

- Confirm you are on `chrome-web-store`.
- Confirm the working tree is clean or intentionally save current work first.
- Read `WEBSTORE_POLICY.md`.
- Read `WEBSTORE_RELEASE_REVIEW.md`.
- Confirm you are not editing `main` or `beta`.

## Pull From Main

Recommended manual flow:

```text
git fetch origin main
git merge origin/main
```

If there are conflicts:

- Prefer current `main` behavior for normal app functionality.
- Preserve Web Store-only Markdown files on this branch.
- Do not reintroduce Web Store automation scripts.
- Do not keep broken references to stripped features.
- Resolve conflicts file by file, then review the final file, not just conflict
  markers.

After conflicts:

```text
git status
git diff --check
```

## Post-Merge Review

Review the merged branch for new policy risks.

Important: search hits are prompts for human review, not instructions to delete.
Do not remove a file or feature until the actual code path and dependency chain
prove there is a Web Store problem.

### Must Search For

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
stripchat
bongacams
cam4
chaturbate
onlyfans
```

### Must Inspect

- `manifest.json`
- `popup.html`
- `popup.js`
- `background.js`
- `service_worker.js`
- `loader.js`
- source/provider files added or changed by the merge
- overlay/chatbot/TTS/AI pages added or changed by the merge
- docs and translation files that mention removed or Web Store-sensitive
  features

## Cleanup Decisions

For each risky feature found:

- Keep it if its executable code is packaged locally, its dependencies are
  present, it is testable, and it is accurately described.
- Otherwise remove it from the package surface:
  - manifest
  - popup/options UI
  - docs
  - translations
  - generated links
  - source references
  - screenshots/listing claims

Do not hide broken features with CSS only. Remove or fix the source references.

Do not over-cleanse during conflict resolution or review. If a file or feature
looks risky, identify the exact risk first. Keep the feature when the issue can
be solved by local bundling, wording changes, reviewer instructions, or a narrow
permission fix.

Specific lesson: do not strip a page just because its name or UI is AI-related.
Check whether it actually ships a local model, loads remote executable code, or
depends on missing files. If it is a normal API/page-builder feature with local
code, keep it and make the listing/reviewer notes accurate.

## Required Tests

Run these before creating a zip:

- Parse `manifest.json`.
- Parse translation JSON files.
- Check edited JavaScript syntax.
- Check local `<script src="...">` references point to existing files.
- Load unpacked extension in a clean Chrome profile.
- Open popup.
- Open dashboard.
- Verify capture to dashboard with at least one listed source.
- Verify no missing-file errors in extension pages.
- Verify any listed sound/TTS/source-disable features work.

## Upload Zip Review

Before uploading:

- Zip from the branch working tree only.
- Exclude `.git`.
- Exclude temporary local folders.
- Exclude notes that should not ship if they are not intended for reviewers.
- Open the zip and confirm `manifest.json` is at the root.
- Confirm no Web Store automation scripts are included.

## Release Notes

Before upload, add dated notes to `WEBSTORE_RELEASE_REVIEW.md` covering:

- main commit merged from
- files/features removed for Web Store policy
- permissions reviewed
- tests performed
- known remaining risks
