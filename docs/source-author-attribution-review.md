# Chat author attribution review

Reviewed on 2026-09-23 after a report of Piczel messages appearing under other people's names while combined with Picarto.

## Cause and changes

Piczel's source searched upward for a container whose first button contained an image, then used its second button as the author. The current Piczel client can render an avatar as initials in spans. When that happened, the search could reach the message list and select an earlier user's header. The previous fix stopped at `#PiczelChat`, but the shared list is nested inside that container.

`sources/piczel.js` now reads the header beside the message's own content wrapper, checks the `data-chat-row` boundary when present, and never searches ancestor button lists. Names no longer depend on avatar images. Missing headers produce an empty author rather than another person's identity. Direct username text excludes nested status badges. Consecutive messages, batched additions, and the older layout without `data-chat-row` remain supported.

The review also identified and fixed two related cases:

- **Teams:** missing avatars could trigger a search that overwrote an explicit author; the alternate layout could also overwrite `threadBodyDisplayName`. Explicit authors now win, and continuation rows stop at the nearest author header, even without an avatar. Avatars come from the same row/header.
- **Riverside:** the ancestor search could enter another sender's group. It now rejects headers nested with another group's messages and ambiguous multiple headers. Missing authors no longer fall back to the studio owner's name from the page title.

## Validation

- Opened a public Piczel chat in a fresh Chromium session as a guest, without sending chat messages. Inspected the rendered DOM and the [public client implementation](https://piczel.tv/assets/Chat-CN_hsuPy.js). The observed layout has `data-chat-row` wrappers and initials-only avatars while images load.
- Replayed 66 messages from that captured DOM through the old and changed scripts: the old script left all 66 authors blank; the changed script matched all 66 visible authors. Image conversion was stubbed to isolate capture from avatar downloads. This was a replay of real DOM, not an AppImage test or a test of Reku's specific room.
- Repeated the capture after allowing avatars to load: both old and changed scripts matched all 67 messages. This verifies the loaded-avatar path still works and narrows the failure to missing/loading avatars or missing headers. Wrong-name selection was reproduced with mixed-avatar fixtures, not observed directly in this public room.
- Reproduced wrong-name selection with mixed image/initials avatars: the old script assigned the backlog author's name to Bob. Regression tests also fail against the original Teams and Riverside sources and pass with the fixes.
- `node tests/source-author-attribution.test.js` checks Piczel plain-text/HTML output, missing avatars and headers, badges, nested lists, consecutive messages, batches, duplicate mutations, both Teams layouts, Riverside groups, and Picarto group isolation. Requires local Playwright.
- `node tests/user-display-aliases.test.js` checks interleaved Picarto/Piczel messages and platform-specific aliases without changing canonical identities. Updated the existing test harness to load the current overlay-control dependencies.

## Wider review and limits

Searched active capture sources for ancestor searches, page-wide author queries, previous-sender state, and sibling fallbacks; reviewed relevant matches and the background alias/deduplication paths.

Picarto restricts fallback names to its message group; the new test covers two interleaved groups. Mixcloud and Joystick's upward searches locate chat containers rather than assigning authors. SOOP's legacy fallback requires a single author. No corresponding cross-platform identity state was found in the reviewed merge path; alias matching is platform-scoped unless explicitly configured otherwise.

Discord, Slack, Chime, Zoom, Webex, and WhatsApp have separate logic for layouts that omit repeated author headers. Several infer an author from earlier rows or saved state. These remain areas to validate with authenticated sessions and current DOM samples, especially around missing headers, reordered history, or conversation changes. They were not rewritten based on Piczel's layout. This review does not certify every supported platform against every possible attribution error.

For future source changes: an avatar is optional identity decoration, an explicit author must never be replaced by a fallback, and an unknown author must not be guessed from a different message group or page header.
