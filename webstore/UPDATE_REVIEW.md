# Web Store 3.50.18 candidate

Version **3.50.18** adds the selective Event Flow, rendering, Twitch reconnect, saved-overlay and audio fixes detailed in [`FOLLOWUP_REVIEW.md`](FOLLOWUP_REVIEW.md). The 3.50.17 notes below describe the previous release.

The candidate fixes the server-switch exception, updates the retained capture sources and providers, and backports applicable security fixes from beta. The package is synchronized to the GitHub `chrome-web-store` branch; it has not been uploaded to the Chrome Web Store.

Version 3.50.17 also includes the validated follow-up: restoring legacy boolean server settings, acknowledging settings only after storage completes, preserving asynchronous runtime replies, and checking rich bot-message HTML at display time. See [`FOLLOWUP_REVIEW.md`](FOLLOWUP_REVIEW.md).

## Baseline and scope

- Original: installed extension `cppibjhfemifednoimlblfcmjgfhfjeg`, manifest **3.50.10**. All **773** original files were rechecked against the saved SHA-256 inventory and remain unchanged.
- Candidate: [`candidate/`](candidate/), manifest **3.50.17**, **810 files**. Only Chrome's two generated `_metadata/` files were dropped from the original package.
- Upstream: beta commit `cf23f2b37c6941573fb2536f3ddf3dd6d311d6e2`, including the applicable local security/source fixes present during this review.
- **216** retained source/provider JS, HTML, CSS and JSON assets match the current working beta files byte for byte. Common application pages were patched selectively; they were not replaced wholesale.
- Exact contents: [`candidate.sha256.json`](candidate.sha256.json). Changed-file hashes and static checks: [`review/package-audit.json`](review/package-audit.json). There are **367 added or modified files** relative to the installed snapshot.

## Server-mode defect

`handleBothParam` iterates link targets including Map and Wordcloud, whose links were stripped from the Web Store UI. Some remaining target containers therefore have no `.raw` URL. Calling `updateURL` on that undefined value throws before settings are saved and links are refreshed.

The candidate only updates targets with a string URL. The actual extension test confirms all three server switches save, add the expected URL flags, survive reopening, and disable cleanly. Both the fake-message button and a WhatsApp-shaped captured payload reach the actual Dock through an isolated WebSocket relay.

This validates the reported delivery failure and fix under controlled conditions. It does not test the reporting user's Mac, network, or live WhatsApp account.

## Backported changes

- Retained capture/provider fixes, plus packaged helpers needed by updated Twitch, Kick, YouTube, TikTok, Whatnot and other sources. New allowed sources include Worldswave, Seal Team Sloth, Castyr, Gosh, Livacha, Stream.space, W.tv, Prime, FLEX TV, X-Studio, Discord Streamkit and XPSync. Source settings, icons, injection scripts and WebSocket dependencies were updated where required.
- Chat-body, name, metadata, avatar and badge protections across the Dock, featured overlays, alerts, games and other retained receivers. Plain-text messages stay literal; HTML messages receive the final HTML check after rendering transformations. Extraction uses inert parsing to prevent image handlers executing during string processing.
- Relay/command forwarding and reflection/deduplication handling; safe history, leaderboard and export rendering; donation USD overrides including zero.
- Settings import/export error handling, IndexedDB error handling, and point-backup validation. Malformed rows cannot replace balances, while valid old records receive scoring defaults. New giveaway/economy features were not imported.
- AI co-host output is escaped before the existing Markdown formatting. Old persisted API keys are removed and newly entered keys stay in memory. Existing co-host tool requests require the private capability from the popup link; unauthorized requests are rejected. Capability generation, expiry/scope handling, popup links and page-side URL scrubbing were backported together. Query edits preserve the capability fragment. Users must reopen the co-host link from the popup and re-enter any page-level API key after upgrading.
- Event Flow schedule values are escaped in attributes. Nested event-property access is limited to own JSON properties and rejects prototype-related keys. The Whatnot source fixtures validate the nested event data against this implementation.
- The Twitch Watch Streak control was added for the updated source; broader beta popup/search redesigns were not imported.

Security port references include `68e6d6e9`, `d17363e2`, `6df37259`, `cf23f2b3`, `ad9ce316`, `130b0051`, `57ad8e56`, `c29d2b5a`, `335ce7e1`, `5bbc03d3`, the applicable parts of `28a54438` and `5ada6bbf`, and the reviewed working-tree fixes. Earlier AI patch-parser protection was already present. Fixes for surfaces absent from the package were not added as new features.

## Web Store restrictions retained

- Manifest permissions, host permissions, CSP, OAuth configuration and extension key are unchanged. No `webNavigation` or local-file/localhost match permissions were introduced.
- Custom uploaded JavaScript, URL-driven JavaScript and Event Flow JavaScript execution remain disabled or absent. No remote executable dependency was added.
- Local browser AI runtimes and Kokoro/Kitten/eSpeak/Piper runtimes remain excluded, with the existing provider guards retained.
- Map, Wordcloud, StreamElements importer, Lite and the previously excluded adult-source integrations remain absent. RPLAY was also excluded; Velora's runtime dependency was not added.
- Required dependencies are packaged locally. Socket.IO's dynamic global lookup was replaced with a `globalThis` fallback; its existing `window`/`self` paths and license header remain intact.

The static scan found no remote script imports or direct `eval`/`Function` calls. Two unresolved Kokoro import strings remain inside the pre-existing disabled popup code, exactly as in the installed package; the excluded runtime files were not restored. Browser startup also requests optional `settings.json`, `badwords.txt` and `goodwords.txt` overrides that were absent in the installed package.

These checks preserve the reviewed restrictions; they do not represent a Chrome Web Store approval. Relevant official guidance: [remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code), [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).

## Validation

All listed candidate checks passed after resolving the backport conflicts:

| Check | Result |
| --- | --- |
| Actual unpacked extension, popup, background and Dock | Server flags persist and regenerate; fake/captured messages reach Dock; no page exceptions |
| Actual extension co-host authorization | Missing/wrong capability rejected, valid capability accepted; fragment retained by URL edits |
| Shipped popup search | Finds Watch Streak control and clears correctly |
| Source/sanitizer suites | 17 suites passed; detailed results in `review/source-test-results.json` |
| Chat text contract | 117 checks |
| Chat security boundaries | 66 checks |
| Final HTML checks | 67 checks |
| Name display | 82 security checks and 144 compatibility comparisons |
| Retained overlay body rendering | 258 checks across 42 pages |
| Overlay names / avatar attributes | 24 retained pages each |
| Badge rendering | 46 overlay cases and shared badge corpus |
| Inert parsers | 23 parser probes, 299 compatibility comparisons; 35 TikTok gift cases |
| Emote wall | 30 cases |
| Secondary processing / command forwarding / Dock actions | 23 / 6 / 8 checks |
| Multi-alert HTML | 11 cases |
| Game names / leaderboard / stored names | 7 games, all 5 leaderboard layouts, real IndexedDB/history and export checks |
| Co-host security UI | Persisted key cleanup, escaped AI output, private capability URL scrubbing |
| Points imports | All 5 malformed/legacy/merge/replace cases |
| Additional security | Schedule attribute injection and memory-only co-host keys |
| Static syntax | 266 JavaScript files and 133 inline scripts parsed |

The required repository `node tests/popup-search.test.js` passes on beta. Running that exact suite against this candidate stops at missing helpers from beta's newer search implementation. It is not a passing candidate test; the retained search implementation was verified in the actual extension browser test instead.

Tests use the candidate via `review/use-candidate.cjs` and `review/run-test.cjs`. Harness adaptations omit only unshipped surfaces (Lite, Joystick, StreamElements importer and overlay-credits); account for the shipped Tip Jar amount goals and spoken TTS prefix; adapt old DB/function extraction anchors; and use a taller viewport for the old grouped Deuks overlay. Rendering/security assertions remain in place. The co-host UI test explicitly navigates to the candidate file.

Useful reruns from the repository root:

```powershell
node --experimental-vm-modules webstore/review/audit-package.cjs
node webstore/review/extension-relay.test.cjs
node webstore/review/source-tests.cjs
node webstore/review/run-test.cjs tests/overlay-body-security.test.cjs
node webstore/review/run-test.cjs tests/chat-security-boundaries.test.cjs
node webstore/review/run-test.cjs tests/cohost-security-ui.test.js
node -r ./webstore/review/use-candidate.cjs tests/points-import-validation.test.cjs
node webstore/review/additional-security.test.cjs
```

Browser tests use the sibling `ssn_app` Playwright installation and its Chromium. Acorn is a test-only dependency installed under the temporary `ssn-webstore-review-dependencies` directory; neither dependency is packaged.

The patch application JSON and `review/rejected-patches/` retain intermediate conflict diagnostics. Rejected hunks were handled selectively or excluded where their feature/surface does not exist; those historical logs are not a list of unresolved failures. No `.rej` files are included in the candidate.

## Deployment limits

Version 3.50.17 was pushed to GitHub `chrome-web-store` as `aca003af`. No Chrome Web Store upload or website deployment was performed. Live provider authentication, capture on every supported site, and public relay behavior were not exercised.

Default Dock/overlay links open the hosted website. Packaged receiver changes do not update that site: the corresponding beta website fixes must also be deployed for users opening hosted pages. The extension-side server-switch fix is included in this candidate.
