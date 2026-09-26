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

Validation on 2026-09-26 reproduced downstream execution with text-only capture in Dock with TTS, Featured with TTS, and Dock with normalization. Five controls passed: default Dock/Featured with text-only capture, plus all three affected configurations with HTML-mode capture. This is a local source-to-receiver reproduction, not a live Twitch or OBS session. Its automated test asserts reproduction; the separate security suite below asserts the desired safe behavior.

The source fixture blocks inline handlers via CSP. Twitch's message-ID acknowledgement calls `rememberTrackedMessageId` → `getTrackedMessageKey` → `stripHtmlContent`, which can also parse the literal body after capture; the fixture's CSP blocks that handler. The test verifies the source counter remains zero after downstream delivery. Receiver documents allow the inline scripts used by the actual pages and count execution independently. This models differing source/receiver policies, not a full extension runtime or a claim that every host permits execution.

Run from the repository root with Node, Playwright and its Chromium browser installed:

```sh
node tests/chat-security-boundaries.test.cjs
node tests/chat-security-boundaries.test.cjs --group=compatibility
node tests/chat-security-boundaries.test.cjs --group=security
node scripts/overlay-textonly-regressions.cjs
node tests/xss-sanitizer.test.js
```

If Playwright is installed outside this checkout, set `NODE_PATH` to that installation's `node_modules`. No new dependency or production script is introduced here.

The default command runs both groups and exits nonzero for any failure. Security cases assert the desired safe behavior; there are no expected-failure exemptions. They remain red until the corresponding production bugs are fixed. A timeout, missing receiver, or setup error is not evidence that a payload is safe.

## Upstream protection matters

The [event contract](../docs/event-reference.html) says `textonly` applies only to `chatmessage`. Plain text must remain literal; HTML-mode chat may contain sanitized formatting and emotes. Metadata does not become trusted HTML because it passed through the relay.

| Route | Protection already present | Remaining boundary |
| --- | --- | --- |
| Twitch DOM → extension relay | HTML-mode capture escapes text; `background.js:sendToDestinations` runs `filterXSS` for HTML-mode chat and `sanitizeRelayPayloadFields` for supported fields. | Text-only chat intentionally stays raw text. Receivers must render it as text. |
| Relay → history | `db.js:createMessageRecord` copies the message and adds storage metadata; it does not sanitize text-only chat. | History displays and exports must retain the message's text/HTML distinction. |
| Whatnot auction → relay → alerts | The source reads the product title with `textContent`; relay field sanitization does not treat `meta.title` as HTML. `sendTargetP2P` adds no chat sanitizer. | Auction alerts must display that title as text. The tested path requires `&auctionwins`. |
| Twitch provider → Lite | The provider escapes `chatmessage` but also retains `rawMessage`. Lite publishes through `DockMessenger`, bypassing `background.js`. | `formatChatPreview` passes raw preview text to `htmlToText`, which parses it in a live detached element. |
| Twitch provider → WebSocket adapter | The provider escapes `chatmessage`. | The adapter selects `rawMessage` and its `escapeHtml` first parses it in a live detached element, before outbound relay sanitization. |
| Relay → Dock/Featured TTS | Display rendering already respects text-only chat by default. | `TTS.speechMeta` independently parses the original text-only body in a live detached element. Removing media afterward is too late. |

**No blanket re-sanitization is proposed.** For a verified relay path, keep rendering the already-sanitized HTML. For text-only bodies and plain metadata, use text nodes or escape at the HTML output boundary. Keep raw-text previews separate from HTML-to-text conversion; any conversion of untrusted HTML must avoid active parsing. An alternate ingress that bypasses the relay needs its own explicit trust boundary.

## Reproduced failures

Baseline on 2026-09-25: **43/43 compatibility checks pass; 21/25 security checks fail by executing the harmless marker.** The 21 checks cover 20 distinct configurations because Horizontal is tested over both iframe and WebSocket delivery. The original three fixes pass all their new security checks.

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
| `dock.html?tts`, `featured.html?tts` | TTS reinterprets text-only chat |
| `dock.html?normalize` | Normalization reinterprets text-only chat and overwrites the escaped body |
| `multi-alerts.html` | Text-only subscription body |
| `multi-alerts.html?auctionwins` | Plain auction title from actual Whatnot extraction |
| Dock user history | Stored text-only message rendered as HTML |
| HTML history export | Opening the exported document executes text-only message markup |
| Lite Twitch preview | Actual provider → handler → decoration → preview → publish |
| Twitch WebSocket adapter | Actual provider → legacy conversion → message processing, before relay |

## Regression controls and limits

- All 14 tested overlays receive both a malicious HTML-mode fixture **after real relay sanitization** and permitted rich HTML. They preserve bold text, reply markup, entity decoding, image emotes and stacking wrappers. The sanitized probe does not execute.
- The three fixed overlays preserve literal angle brackets, entity-looking text, quotes and Unicode; legacy HTML without `textonly` still renders. Typewriter completion is awaited.
- Default Dock and Featured display the text-only probe safely. Enabling TTS demonstrates a separate vulnerable consumer of the same payload.
- Normalization preserves accents-to-ASCII behavior and emotes. TTS still speaks formatted message text without HTML tags. Rich history/export and donation display remain intact; relay preserves a numeric `donoValue: 0` override.
- Sources receive literal input via `textContent`, not pre-injected executable DOM. Twitch capture runs its actual script and observer. Whatnot extraction and Twitch provider normalization use production code.
- The harness executes unmodified relay functions, the bundled sanitizer, outgoing WebSocket JSON serialization, and the database record factory. Optional services, authentication, database I/O and external transports are mocked. Alert routing is recorded at `sendTargetP2P`; its transport is source-reviewed, not booted. Subscriber event metadata used to select the event-only theme is a fixture.
- Receivers use real iframe `postMessage` listeners from the expected frame. Representative WebSocket listeners are also exercised. Export tests open the actual generated HTML. Merely failing to render never counts as protection.
- Network access is blocked or locally fulfilled, sockets are offline, and probes only set a boolean. No live Twitch messages, real sessions, user databases, OBS exploit, or native-code payload are used.
- These are browser-level application tests, not an OBS/Electron release certification or an extension CSP bypass demonstration. Packaged extension CSP can block inline handlers; the adapter result establishes unsafe DOM parsing without claiming execution under every host policy.

The existing sanitizer corpus and overlay text-only suite remain complementary checks. No production behavior is changed by this review.
