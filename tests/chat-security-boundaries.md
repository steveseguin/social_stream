# Chat security boundary review

An inspectable test page is available at `tests/chat-security-demo.html`. Start its local server:

```sh
node tests/serve-chat-security-demo.cjs
```

Open `http://127.0.0.1:8765/tests/chat-security-demo.html` and click **Run all 8 comparisons**. This server needs only Node; the automated page validation additionally needs Playwright:

```sh
node tests/chat-security-demo.test.cjs
```

The page loads the complete Twitch capture script into its top-level DOM (the source intentionally ignores embedded chat). It passes the captured payload through the real `processIncomingMessage`, `applyBotActions`, `sendToDestinations`, and `sendDataP2P` functions, with optional integrations disabled and I/O mocked. It shows both payloads, actual body-sanitizer call counts, receiver rendering, and stacks for HTML assignments. Production source and receiver files are not edited.

Before the fixes, validation on 2026-09-26 reproduced downstream execution with text-only capture in Dock with TTS, Featured with TTS, and Dock with normalization. Five controls passed: default Dock/Featured with text-only capture, plus all three affected configurations with HTML-mode capture. After the fixes, all eight comparisons pass: messages render, speech runs where enabled, and no receiver executes or parses the literal probe as HTML. The automated test now requires this safe behavior. These are local source-to-receiver tests, not live Twitch or OBS sessions.

The demo source fixture blocks inline handlers via CSP. Twitch's message-ID acknowledgement previously parsed literal bodies after capture. That path and reply extraction now bypass HTML conversion in plain mode; rich input uses inert template contents. `chat-text-contract.test.cjs` additionally checks the actual Twitch source without relying on CSP. Receiver documents allow the inline scripts used by the actual pages and count execution independently.

Run from the repository root with Node, Playwright and its Chromium browser installed:

```sh
node tests/chat-security-boundaries.test.cjs
node tests/chat-security-boundaries.test.cjs --group=compatibility
node tests/chat-security-boundaries.test.cjs --group=security
node tests/chat-text-contract.test.cjs
node tests/chat-command-forwarding.test.cjs
node tests/chat-final-html-check.test.cjs
node tests/chat-name-display-security.test.cjs
node tests/overlay-badges.test.cjs
node tests/lite-chat-previews.test.cjs
node tests/chat-secondary-processing.test.cjs
node tests/dock-chat-actions-security.test.cjs
node tests/dock-reply-color.test.js
node tests/tts-tiktok-gifts.test.js
node scripts/overlay-textonly-regressions.cjs
node tests/xss-sanitizer.test.js
```

If Playwright is installed outside this checkout, set `NODE_PATH` to that installation's `node_modules`. The final Dock/Featured HTML check uses the existing packaged sanitizer through `shared/utils/chatHtml.js`; it adds no external dependency.

The default command runs both groups and exits nonzero for any failure. Security cases assert safe behavior; there are no expected-failure exemptions. A timeout, missing receiver, or setup error is not evidence that a payload is safe.

## Upstream protection matters

The [event contract](../docs/event-reference.html) says `textonly` applies only to `chatmessage`. Plain text must remain literal; HTML-mode chat may contain sanitized formatting and emotes. Metadata does not become trusted HTML because it passed through the relay.

| Route | Protection already present | Remaining boundary |
| --- | --- | --- |
| Twitch DOM → extension relay | HTML-mode capture escapes text; `background.js:sendToDestinations` runs `filterXSS` for HTML-mode chat and `sanitizeRelayPayloadFields` for supported fields. | Text-only chat intentionally stays raw text. Receivers must render it as text. |
| Relay → history | `db.js:createMessageRecord` copies the message and adds storage metadata; it does not sanitize text-only chat. | History displays and exports must retain the message's text/HTML distinction. |
| Whatnot auction → relay → alerts | The source reads the product title with `textContent`; relay field sanitization does not treat `meta.title` as HTML. `sendTargetP2P` adds no chat sanitizer. | Auction alerts must display that title as text. The tested path requires `&auctionwins`. |
| Twitch/YouTube/Kick → Lite | Outgoing `chatmessage` is escaped independently of raw preview text. Lite publishes through `DockMessenger`, bypassing `background.js`. | Fixed: raw previews stay plain text; HTML fallback conversion uses inert template contents. |
| Twitch provider → WebSocket adapter | The provider supplies literal `rawMessage` separately from HTML `chatmessage`. | Fixed: literal input is never HTML-parsed. Only legacy HTML without a raw body is converted using an inert template. Preview output is escaped, independently of capture mode. |
| Relay → Dock/Featured TTS | Display rendering already respects text-only chat by default. | Fixed: speech reads text-only bodies directly; rich bodies use inert template contents for media removal and text extraction. |

**Plain bodies are not HTML-sanitized.** Use text nodes or one HTML-template escape for `textonly=true`, and keep raw-text previews separate from HTML-to-text conversion. After profiling and approval, Dock and Featured now check HTML-mode body display copies once at rendering, including Dock user history. These surfaces can receive older/custom senders, and a link's `v` parameter does not establish which sender checked a particular message. Featured checks only after its existing stale-render cancellation. The relay's policy and stored/wire bodies are unchanged by this final check.

The display policy reuses the packaged HTML/SVG/URL checks and CSS parser, retaining ordinary formatting, reply italics/colors, emote wrappers and positioning, image dimensions, links, and inline SVG presentation. Page-generated media and controls remain separate. If the helper is unavailable, HTML is displayed as literal text instead of being inserted unchecked.

Dock and Featured also check the displayed name, independently of the body's `textonly` flag. This closes direct-sender name injection while preserving legacy entity-encoded names and permitted name formatting/emotes. Unsupported custom name HTML is stripped by the same policy. Dock's stored name and identity fields are unchanged. `chat-name-display-security.test.cjs` exercises direct iframe delivery, both Featured layouts, Dock name layouts, missing-helper fallback, and isolated positive controls that disable only the new name check.

## Reproduced failures

Baseline on 2026-09-25: **43/43 compatibility checks pass; 21/25 security checks fail by executing the harmless marker.** The 21 checks cover 20 distinct configurations because Horizontal is tested over both iframe and WebSocket delivery. The original three fixes pass all their new security checks.

The Lite preview fix also covers the subsequently reproduced YouTube polling and Kick socket paths. `lite-chat-previews.test.cjs` exercises real source handlers and publishing with offline input, plus literal tags/entities, native and third-party emotes, missing-preview fallbacks, and inert HTML conversion. It asserts no script execution without relying on CSP and verifies that plain previews are not parsed as HTML. Text-only outgoing bodies are not re-sanitized. The historical Lite Twitch failure below is now covered as a passing regression check.

After the Lite fix alone, 20/25 broader security checks still failed. The first Dock, TTS, normalization, and history fixes reduced that to 15. After the remaining renderer and source fixes, **43/43 compatibility checks and 25/25 security checks pass (68/68 total).** Every finding in the table below is now covered by a passing regression check.

Additional passing coverage:

- **67 final-display checks:** direct unsanitized legacy HTML in Dock, trimming/normalization, Featured and stacking; zero body-filter calls for plain text; one call for HTML; unchanged stored Dock bodies; stale Featured renders skipped; generated attachments retained; safe fallback without the helper; three history modes; formatting stability; and 36 sanitizer fixtures, including malformed nesting and CSS probes. The five direct legacy injection configurations executed the harmless marker before this final check was added.
- **117 text-contract checks:** literal text and entities through three relay passes; zero body-filter calls in plain mode; event italics without payload markup; strip-HTML conversion and reply metadata; Dock filters; Twitch DOM and WebSocket replies/emotes; YouTube membership/gift/sticker capture; plain donation labels; generated event summaries; tip-jar history; legacy styles. HTML mode and missing legacy flags retain formatting. Tests require usable output as well as no execution.
- **47 badge overlay cases plus 29 sanitizer probes:** legacy badge strings, URL/array/SVG/text forms, ordinary membership rows, and malicious badge fields. Text badges carry literal `rawText` plus the existing escaped `text` for older receivers; repeated relay passes do not double-escape their labels.
- **23 secondary-processing checks:** cohost Read/Answer/Roast with text-only, HTML, and legacy messages; DOM fallback; AI approval text; TTS media removal; normalization, trimming, and original-payload preservation; background normalization before relay sanitization. Parsing counters require no HTML parsing for plain text and avoid repeated conversion of rich bodies.
- **8 source-to-Dock action checks:** real Twitch capture and relay delivery followed by cohost Read/Answer/Roast or TTS, in both capture modes. Each check requires usable output as well as no execution. Running this test against saved pre-fix production contents fails on `CohostRead textonly=true` because the marker executes; repository files are not changed for that comparison.
- **8 inspectable demo comparisons**, **26 Lite preview/fallback checks**, the reply-color suite, overlay text-only suite, and sanitizer corpus all pass. The TikTok TTS suite also passes all 23 speech cases, its isolated-world bridge, and native completion transitions. Its extracted-source fixture now supplies the settings closure used by the production capture code.
- **6 command-forwarding checks:** literal tags/entities in plain commands, one inert HTML conversion for rich/legacy commands, unchanged original bodies, preserved command-prefix/punctuation rules, and no probe execution. The plain-tag case failed before the fix. Lite's two newly tested nonempty plain-body fallbacks also failed before their flag-aware correction.

| Affected path | Condition reproduced |
| --- | --- |
| `themes/events/index.html` | Text-only subscription body |
| `themes/horizontal.html` | Text-only body, iframe and WebSocket |
| `themes/notimeoutmessages.html` | Text-only body |
| `themes/overlay-comic-classic.html` | Text-only body |
| `themes/overlay-comic-pop.html` | Text-only body |
| `themes/rainbowpuke/index.html` | Text-only body |
| `themes/sampleoverlay_reverse.html` | Text-only body |
| `themes/spiritoverlay.html` | Text-only body |
| `themes/t3nk3y/index.html` | Text-only body |
| `themes/Windows3.1/index.html` | Text-only body |
| `septapus.html` | Text-only body |
| `dock.html?tts`, `featured.html?tts` (fixed) | TTS reinterpreted text-only chat |
| `dock.html?normalize` (fixed) | Normalization reinterpreted text-only chat and overwrote the escaped body |
| `multi-alerts.html` | Text-only subscription body |
| `multi-alerts.html?auctionwins` | Plain auction title from actual Whatnot extraction |
| Dock user history (fixed) | Stored text-only message rendered as HTML |
| HTML history export (fixed) | Opening the exported document executed text-only message markup |
| Lite Twitch preview (fixed) | Actual provider → handler → decoration → preview → publish |
| Twitch WebSocket adapter | Actual provider → legacy conversion → message processing, before relay |

## Regression controls and limits

- All 14 tested overlays receive both a malicious HTML-mode fixture **after real relay sanitization** and permitted rich HTML. They preserve bold text, reply markup, entity decoding, image emotes and stacking wrappers. The sanitized probe does not execute.
- The three fixed overlays preserve literal angle brackets, entity-looking text, quotes and Unicode; legacy HTML without `textonly` still renders. Typewriter completion is awaited.
- Default Dock and Featured display the text-only probe safely. Their TTS paths now also pass the source-to-receiver execution checks.
- Normalization preserves accents-to-ASCII behavior and emotes. TTS still speaks formatted message text without HTML tags. Rich history/export and donation display remain intact; relay preserves a numeric `donoValue: 0` override.
- Sources receive literal input via `textContent`, not pre-injected executable DOM. Twitch capture runs its actual script and observer. Whatnot extraction and Twitch provider normalization use production code.
- The harness executes unmodified relay functions, the bundled sanitizer, outgoing WebSocket JSON serialization, and the database record factory. Optional services, authentication, database I/O and external transports are mocked. Alert routing is recorded at `sendTargetP2P`; its transport is source-reviewed, not booted. Subscriber event metadata used to select the event-only theme is a fixture.
- Receivers use real iframe `postMessage` listeners from the expected frame. Representative WebSocket listeners are also exercised. Export tests open the actual generated HTML. Merely failing to render never counts as protection.
- Network access is blocked or locally fulfilled, sockets are offline, and probes only set a boolean. No live Twitch messages, real sessions, user databases, OBS exploit, or native-code payload are used.
- These are browser-level application tests, not an OBS/Electron release certification or an extension CSP bypass demonstration. Packaged extension CSP can block inline handlers; the adapter result establishes unsafe DOM parsing without claiming execution under every host policy.

Plain metadata stays plain on the wire. Updated receivers use text nodes or output escaping instead of repeatedly decoding and stripping labels. Deploy the updated receiver pages and shared assets before distributing the updated background: old/custom receivers that insert plain metadata as HTML need the same correction. This is not a claim that an updated background repairs old receiver code.

The existing sanitizer corpus and overlay text-only suite remain complementary checks. Test harnesses do not modify production files during execution.

## Name and avatar display sweep

The name/avatar sweep fixes confirmed sinks in 37 receiver pages. Displayed HTML names use the existing `SocialStreamChatHTML` policy; avatar attributes are escaped for their HTML context, including a separate CSS-string escape for background-image URLs. Seven game pages now parse names inside inert template content. Payload names, database records, donor aggregation, and avatar lookup inputs are not rewritten.

Browser regressions reproduce execution in isolated copies with the display checks disabled, then verify the shipped pages. Run:

```text
node tests/overlay-name-security.test.cjs
node tests/avatar-attribute-security.test.cjs
node tests/leaderboard-name-security.test.cjs
node tests/game-name-security.test.cjs
node tests/name-storage-security.test.cjs
```

The checks cover name entities, joined emoji and flags, supported name formatting/emotes, missing sanitizer fallback, avatar URLs, asynchronous Twitch avatar lookup, all five leaderboard layouts, repeated player/donor updates, persistence/reload, the original IndexedDB username index, and JSON versus HTML exports. The existing text-only overlay, Supporter Showcase, and Tip Jar goal suites also pass.

Compatibility limits: unsafe or unsupported name HTML is filtered at display time. Inert game parsing retains the div context and tested player keys; raw custom `<noscript>` markup is parsed with scripting disabled, so its extracted text can differ from the old live-div parser. Ordinary names and encoded literal markup do not use that path. These tests run in Chromium with isolated storage and offline transports, not live OBS sessions.

## Inert text-extraction sweep

The Joystick capture helper and 26 additional extraction sites in 21 files now allocate their scratch div inside template contents before assigning `innerHTML`. This retains the div parsing context, including table handling, while preventing handlers from executing during extraction. The additional sites cover nine games, Event Flow, polls, Lite speech, chatbot speech, Instagram fingerprints, Streamplace, Rumble/VPZone/Whatnot feed conversion, the StreamElements shim, and TikTok gift/text parsing. Parsed elements are never moved into the displayed document.

```text
node tests/joystick-parser-security.test.cjs
node tests/inert-text-parsers.test.cjs
node tests/joystick-source.test.js
node tests/streamelements-importer-shim.test.js
node tests/game-name-security.test.cjs
```

The Joystick browser regression runs the actual capture script in an isolated world. It reproduces execution through the WebSocket receiver in both text modes and through DOM fallback fingerprinting in text-only mode, then verifies the fix. A page policy that blocks attribute handlers also blocks the original probe. The live joystick.tv page returned a Cloudflare challenge during review, so live-site exploitability remains unverified.

The additional helper tests require an executing positive control at each of the 26 sites and no execution after the fix. They compare 338 extraction results, including flags, joined emoji, entities, whitespace, emote alt text, table markup, and gift parsing. These are helper-level reproductions, not claims that every caller accepts attacker input under its live host's policy; Lite's dormant Facebook speech path is included as preventive hardening. The separate Joystick WebSocket client's tag-stripping helper did not execute the tested corpus and was left unchanged.

An additional 35 comparisons cover TikTok gift prices and streak identities, including source-row alt text, relative image URLs, native message/group IDs, coin values, and diamond values. Template contents use an `about:blank` base URL, so the gift-image comparison explicitly resolves against the page to preserve the existing source-row lookup. Joystick adds 34 message/name compatibility comparisons. Existing Joystick capture, StreamElements shim, and seven game identity regressions pass as well. The changes do not rewrite stored names or cache structures.

As with the earlier game-name fix, raw `<noscript><b>Viewer</b></noscript>` now extracts `Viewer` instead of `<b>Viewer</b>` (escaped in Joystick HTML mode). This is the observed compatibility exception; ordinary text, encoded literal tags, flags, and joined emoji match the prior outputs in the tested cases.

## Multi-alerts direct HTML bodies

Multi-alerts now checks HTML-mode alert bodies with the same packaged display sanitizer used by Dock and Featured. Direct senders with session access can bypass relay sanitization; the previous renderer executed the local image-handler probe through both iframe and WebSocket delivery, with `textonly` false or absent. Only the display copy is checked. Plain bodies and generated metadata labels use `textContent`; a missing helper or sanitizer dependency also falls back to literal text.

Run `node tests/multi-alerts-html-security.test.cjs`. Its 11 browser cases cover executing positive controls, the production receivers, permitted formatting and stacked emotes, flags and joined emoji, literal text-only bodies, auction metadata, both missing dependencies, and removal of unsupported custom HTML. The compatibility change is that unsupported custom HTML no longer renders as supplied. These checks run offline with test sessions and never modify production files.

## Overlay HTML-body display sweep

The same display check now covers 46 rendering expressions in 44 additional pages: Sample Overlay, Sample Featured, Septapus, Events, both emote walls, all 13 featured styles, and 25 other chat themes. `tests/overlay-body-security.test.cjs` contains the complete receiver list. Existing packaged dependencies are loaded before the renderers; no new shared utility or remote script is introduced. The check applies to the HTML display expression, not the payload, stored names, grouping keys, or generated attachment HTML.

```text
node tests/overlay-body-security.test.cjs
node scripts/overlay-textonly-regressions.cjs
node tests/chat-final-html-check.test.cjs
```

All 264 new browser cases pass. Every page receives direct iframe input in HTML and legacy modes, requires an executing positive control with only its body check disabled, and verifies the fixed receiver. Comparisons cover formatted text, image/SVG emotes, stacking styles, flags and joined emoji, existing text-only output, and a blocked helper-script request. The emote-wall/text-only suite and all 67 shared-sanitizer/Dock/Featured checks also pass. WebSocket delivery uses the same renderers; this sweep's new receiver tests use iframe delivery, while Multi-alerts separately tests both transports.

The emote-wall suite exposed a redundant sanitizer option inherited from the already-initialized base filter. Removing the redundant hook before constructing the display filter eliminates the setup warning; 32 before/after sanitizer outputs matched exactly, and the existing display corpus passes. The historical emote-wall positive control now disables both body protections only in its served copy.

Unsupported custom HTML is filtered at display time. A missing display helper falls back to escaped text. Source adapters, generated StreamElements exports, and archived Web Store copies are outside this receiver list. Bot is covered separately below.

## Literal text in five chat themes

Bubbles, Cards, Neon Cyberpunk, Particles, and Xacception now use the existing text-escaping helper for their text-only display expression. Previously they escaped angle brackets but decoded entities: a viewer typing `&#128512;` saw an emoji instead of those literal characters. The correction escapes ampersands as well, without rewriting the payload or its identity fields.

Run `node tests/theme-plain-text.test.cjs`. All 50 browser checks pass, covering literal entities, quotes, typed markup, country flags (including the England tag sequence), joined emoji with skin tones, and HTML/legacy rendering. Each page has an isolated historical control that reproduces the old decoding behavior. This corrects the separate text-only issue recorded during the HTML-body sweep.

## Bot HTML bodies

Bot now checks HTML-mode body display copies with the existing packaged sanitizer in both its default and stacked layouts. Plain bodies still use `textContent`; image/video attachments generated from `contentimg` are handled separately. The change does not replace the original body supplied to speech preparation or JSON file output. Unsupported custom body HTML, such as `<marquee>`, loses its formatting; a missing display helper falls back to literal text.

Run `node tests/bot-body-security.test.cjs`. The browser checks exercise real iframe and WebSocket receivers, require execution in an isolated historical control, and compare the actual fixed page against that control for supported formatting, emote positioning, flags, joined emoji, literal text, repeated stacked/replacement messages, and loaded image/video attachments with and without a body. Speech preparation and JSON serialization run their production functions with audio/file I/O mocked. Attachment URL construction is covered separately below. These checks use local fixtures, not live OBS sessions or speech services.

## Bot attachment URLs

All four Bot image/video templates now escape literal attribute delimiters in the displayed `contentimg` URL. The local helper deliberately preserves the single HTML-entity decode these existing quoted attributes performed, including `&amp;` URLs from legacy senders. Entity-decoded quotes remain attribute data rather than ending the quoted value. This avoids the encoded-URL compatibility problem found in the initial full-escaping candidate. Do not reuse this compatibility helper for plain text or unquoted attributes; other fields retain their existing escaping policy.

Run `node tests/bot-attachment-compat.test.cjs`. It compares ordinary media with an isolated historical copy and checks quotes/angle brackets as URL data, named/numeric/nested entities, relative and data URLs, both layouts, all three text-only flag states, repeated stacking, image/video loading and playback attributes, iframe/WebSocket delivery, message formatting and joined emoji, speech preparation, and original values in saved JSON. The page receives only benign local fixtures; audio and file I/O are mocked. The fix changes display construction without rewriting `contentimg`, names, or saved payloads.

## StreamElements importer HTML bodies

New previews and downloaded overlays embed the existing display sanitizer and its packaged dependencies. The fallback renderer and the `renderedText` supplied to widgets check HTML-mode bodies before rendering or extracting emotes. Text-only bodies remain literal, and the original payload stays intact. Unsupported custom message HTML is removed. Existing downloaded overlays must be re-exported to receive this fix.

Run `node tests/streamelements-importer-display.test.cjs` and `node tests/streamelements-importer-shim.test.js`. The display suite checks fallback and widget rendering in previews and offline local-file exports: 16 rendering checks cover supported formatting, stacked image/SVG emotes, joined emoji, flags, unsupported tags/attributes, and literal fallback. Eight additional checks cover either missing sanitizer dependency. Exports require no external sanitizer scripts. These tests use benign local fixtures, not live OBS sessions.
