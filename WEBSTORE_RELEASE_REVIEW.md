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
