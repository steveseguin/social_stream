# Transport migration audit — 2026-09-11

This is the pre-implementation audit. Findings below describe the audited baseline, including defects subsequently addressed. Consult the [current implementation status](transport-migration-status.md) before treating a finding as still open.

Implementation sequencing and completion gates are defined in the [transport migration plan](transport-migration-plan.md). The plan separates safe additive publishing from full server-only support for specialized/private protocols.

The intended migration is additive background publishing with receiver-specific transport selection. It is not a global switch from WebRTC to WebSocket, and it is not complete. The current pending fixes address real gaps but do not establish whole-system server parity.

This audit covers the current `beta` working tree, including the other agent's uncommitted changes. Runtime code was not changed. The inventory scans all 155 HTML files at the repository root and under `themes/` and `games/`, reads their directly referenced local scripts, and classifies transport consumers, wrappers, controllers, and non-transport pages. Shared helpers, popup URL generation, background send/receive paths, and the SSApp local relay implementation were also inspected. Platform capture clients, provider WebSockets, Lite's independent provider integrations, and third-party service connections are not overlay relay consumers.

Evidence levels below matter: a static route exists; a pure-JavaScript contract check passes; and a complete workflow works in the real runtime are different claims. This audit did not launch SSApp, OBS, or live source channels, contact hosted relays, or inspect Cloudflare. Earlier runtime reports in `local-server-review.md` are prior evidence, not tests rerun here.

## Recovered contract

The July 4 migration added version/capability guards. Commit `d6874fcf` on July 7 explicitly records the temporary additive toggle and the planned post-September-1 transition. The dated TODO is still present in [background.js](../background.js).

1. The host remains capable of publishing chat to connected P2P receivers while also forwarding to an enabled relay. An external API listener must not implicitly disconnect unrelated P2P displays.
2. Each receiving page chooses its required routes. Updated, fully capable pages may omit the bridge on supported server links; pages needing bridge-only controls or private replies retain it.
3. Existing links without `v`, older hosts, saved OBS URLs, labels, passwords, custom channels, and custom relay endpoints remain compatibility cases. `v=3.52.0` is an eligibility guard, not proof of complete feature support.
4. Mirrored chat must render/count once. Retried or mirrored commands need a stable command identity. Genuine subsequent identical messages/actions must still work.
5. Command requests need one authoritative handler and correlated replies. Additive **publishing** does not authorize duplicating every upstream mutation on both transports.
6. `localserver` selects the loopback relay default (with `localserverport`); it is not a promise of offline operation or permission to enable all host receivers. Explicit relay URLs take precedence where supported.
7. SDK versus iframe is an independent implementation choice within the P2P path. Keep their routing and envelope contracts aligned.

### Directions and channels

These are the common default routes, not a rule that every page accepts every flag. Numeric channels are relay routing channels, not WebRTC labels.

| Route | Host/page behavior |
| --- | --- |
| Background chat, `settings.server2` | `setupSocketDock`: publishes channel 4, receives channel 3; broadcasts enter `sendDataP2P`. |
| Dock upstream, URL `server3` + host receiver | Dock publishes commands on 3. Background gates ordinary inbound processing on `settings.server3`. This flag alone does not enable host chat publication. |
| Background control API, `settings.socketserver` | `setupSocket`: receives 1, replies/publishes on 2. This setting is distinct from the page URL `server`. |
| Dock/Featured, URL `server` | Dock's API connection and Featured publishing/receipt; typical Dock out 2/in 1, Featured receives 2. Several ordinary chat overlays use `server` to listen on 1 instead. |
| Targeted P2P | `sendTargetP2P` and specialized senders route to labels such as `poll`, `actions`, `map`, `ticker`, `timer`; explicit UUID replies must remain private. |
| Pending Actions controls | Enabled relay sends on 6, plus connected P2P `actions` peers. `ssnControl.id` suppresses duplicate execution in updated receivers. |
| Pending Poll/Credits/Hype controls | Separate subscription on 7; request/ack back on 1 or 3. Target and optional snapshot client select the intended consumer. Poll settings are allowlisted. |
| Other specialized routes | Bot output uses 12; legacy giveaway entries use 5/6; Ticker and Spotify permit custom channels. Preserve these protocols until deliberately migrated. |

An open signaling connection is not an open WebRTC data channel. An open relay socket is not proof a receiver applied a command. A receipt acknowledgement is not proof of OBS visibility or successful external action completion.

## Findings and next steps

### 1. Additive background chat is still opt-in

**Confirmed; rollout incomplete.** `sendDataP2P` still returns after successful server2 publication unless `server2additivedelivery` is enabled. Stream Deck is specially served before this return, and independently targeted feature traffic can still travel by P2P. This mixture explains why some pages work while others become idle under the same host settings.

Do not remove the early return merely because September 1 passed. First close the duplicate/counting and receiver compatibility gaps below, then deliberately make additive publication the default and retire the temporary control. Preserve explicit UUID responses and target filtering. Update the popup wording and documentation together.

### 2. Map can count mirrored chat twice

**Confirmed in code and a pure-JavaScript reproduction; not newly tested in a browser.** Background independently calls `sendTargetP2P(message, "map")` after ordinary relay chat publishing. Map retains its bridge and can also receive the same captured message on channel 4. Both feed `processInput`/`handleChatMessage`; there is no transport-message identity check. With `settings.multiVote` enabled, passing the same message ID twice through the real `processInput` → `handleChatMessage` → `registerVote` chain produced two entries and one unique viewer. Country resolution and rendering were stubbed; message handling and counting used the actual functions.

This is possible even before enabling the additive toggle, because the Map-specific P2P send is outside the ordinary chat early return. The new Poll fix addresses this pattern for Poll only.

Add source-aware transport deduplication at Map's common message ingress before queuing or counting. Reuse the existing shared helper where appropriate. Verify repeated real messages remain valid and test ID-less messages as well as messages with IDs. Poll's new ID-only cache does not cover ID-less mirrored inputs and differs from the shared cross-source dedupe policy; document or resolve that remaining case before general rollout.

Sources: [background.js](../background.js) `sendToDestinations`; [map.html](../map.html) `processInput`, `handleChatMessage`, `registerVote`; [poll.html](../poll.html) `isDuplicatePollDelivery`; [js/transport-dedupe.js](../js/transport-dedupe.js).

### 3. Most new games and the commerce display have local-only direct captured-chat support

**Confirmed.** `getChatRelayConfig` enables the direct channel-4 feed only when both `localserver` and `server2` are present. A hosted `?server2` returns `enabled: false` and those consumers start their P2P fallback. With the current default host early return, that P2P chat feed can be suppressed. `?server` instead selects the channel-1 API feed; it is not equivalent to direct captured chat.

The helper is shared by 33 newer mini-games and `shared/monetization/overlay.js`. Popup generation intentionally offers server2 to these games only in local mode. Monetization link generation similarly preserves the captured-chat flag only for local links.

Extend the existing helper's direct captured-chat route to hosted/custom relays as a deliberate scoped change, then align the game and commerce link generators. Preserve an explicit `server` API-feed choice and its channel rather than silently redirecting it to channel 4. Test captured chat with no Dock open.

Sources: [js/local-server-url.js](../js/local-server-url.js) `getChatRelayConfig`; [popup.js](../popup.js) `getGameServerParamSupport`; [shared/monetization/overlay.js](../shared/monetization/overlay.js); [shared/monetization/popup.js](../shared/monetization/popup.js).

### 4. Legacy Featured themes are advertised more broadly than their hosted implementation supports

**Confirmed.** All 13 `themes/featured-styles/*.html` pages use `connectLocalRelay`; the helper immediately declines outside `localserver`. They then use their legacy P2P bridge. Popup's `getFeaturedServerParamSupport()` nevertheless returns support for all three server flags without inspecting the selected template.

Thus a generated hosted server URL is not evidence that the selected Featured theme can work when P2P is unavailable. This is a pre-existing capability mismatch, not fixed by the current four-feature control patch. LuckyLootTube is also local-adapter/P2P, with a narrower popup exception.

Add hosted/custom relay support to the established legacy adapter and verify feature/clear behavior, or narrow advertised support until that work is done. Keep channel-2 featured selections distinct from channel-4 raw captured chat. Test both with actual generated links.

Sources: [popup.js](../popup.js) `getFeaturedServerParamSupport`; [js/local-server-url.js](../js/local-server-url.js) `connectLocalRelay`; [featured-modern.html](../themes/featured-styles/featured-modern.html) and its 12 sibling templates.

### 5. Control parity remains partial, including Timer and alert/bot clearing

**Confirmed static routes.** `prepareOverlayControl` only enables the new relay control envelope for Actions, Credits commands, Poll settings/commands, and Hype snapshots. Other `sendTargetP2P` calls do not automatically gain server delivery. These remaining paths require explicit work:

| Feature | Remaining P2P dependency |
| --- | --- |
| Map | Host Start/Pause/Reset and configuration delivery. |
| Reactions | Targeted reaction payloads; direct relay/chat input is a separate path. |
| Multi-alerts / Minecraft | Host `clearAlerts`; ordinary alert receipt already has its own duplicate suppression. |
| Bot display | Host `clearBotOverlay`; bot output uses a separate relay channel. |
| Ticker | `sendTickerP2P`, custom channel configuration. |
| Spotify | `sendSpotifyOverlay`, custom channel configuration. |
| Timer | Background `initializeTimer`/`sendTimerP2P` publishes state only by P2P. Direct `server` commands to Timer itself are a separate working route; their success does not verify popup/background state delivery. |
| Tip Jar | Host reset/set, distinct from contribution reception. |
| Events dashboard | Feature/clear clicks target iframe peers. |
| Waitlist / Confetti | Waitlist/draw updates and controls. |
| Word Cloud / custom GIF / private chatbot | P2P-specific protocols; popup correctly withholds general server flags. |
| AI builder/runtime / co-host | Chat feed can use relay in some pages, but saved-overlay loading, private chatbot replies, capabilities, credentials and tools still need the host bridge/UUID. `aiprompt` itself is not relay-enabled by adding a URL flag. |

Extend the existing control route feature by feature, with allowed fields, label/channel mapping, duplicate identity, acknowledgement semantics and state reads appropriate to each feature. Do not broadcast settings wholesale or put private AI responses on public chat/control channels. Keep bridge-required declarations until both directions actually work.

### 6. Explicit relay addresses are not handled consistently by giveaway surfaces

**Confirmed.** Managed giveaway's hosted branch reads `server` but ignores the explicit value of `server2`, even when channel 4 was selected. `giveaway-obs-entries.html` chooses localhost before an explicit `server` value when `localserver` is also present. The latter also uses the older channel-5/6 protocol, so it cannot be treated as the managed giveaway consumer.

Use the existing endpoint resolver consistently while preserving each surface's selected channel and protocol. Check `server=URL`, `server2=URL`, and combinations with `localserver`/custom ports independently. Do not infer custom-address support from a successful default-localhost test.

Sources: [shared/giveaway/managed.js](../shared/giveaway/managed.js) lines around 119–123; [giveaway-obs-entries.html](../giveaway-obs-entries.html) `setupWebSocketConnection`.

### 7. Hosted controller replies need a wider audit than Giveaway Manager

**High-priority suspected compatibility gap, not freshly reproduced against the hosted service.** The pending code and prior review report that the hosted relay consumes `callback` packets intended for browser clients. The new workaround requests `commandResult` only for Giveaway Manager. OBS control dock and portions of `sampleapi.html` still request/expect `callback`, including timer and commerce operations. The nested Stream Deck plugin's `ssn-client.ts` also resolves requests through `message.callback`; its HTTP fallback can mask a WebSocket callback failure for some operations, so verify each path separately. The local relay explicitly forwards callbacks that do not belong to its own pending HTTP calls, so local success cannot establish hosted success.

Verify the hosted callback behavior with an isolated protocol fixture before claiming these browser controllers work hosted. If confirmed, extend an explicitly negotiated, correlated browser reply format to the affected clients and host dispatchers. Preserve existing HTTP callbacks and external client contracts. Avoid a blanket callback-format change.

Sources: [background.js](../background.js) `sendStreamDeckCommandResult`; [obs-control-dock.html](../obs-control-dock.html) `handleResponse`/request senders; [sampleapi.html](../sampleapi.html); sibling `ssapp/main.js` local relay callback handling; prior [local-server-review.md](local-server-review.md).

### 8. The broad compatibility test no longer runs through its initial contracts

**Reproduced without launching a browser.** The current `setupSocketDock` calls `handleOverlayControlRequest`, but `simulateBackgroundRemoteCommand` extracts only `setupSocketDock` and does not provide that helper. The historical/current preflight now fails with `working-tree: remote API command was not processed once` and an asynchronous `handleOverlayControlRequest is not defined` error. This is a test-harness integration failure, not evidence that the production handler is missing.

Repair the current-build harness while preserving historical fixtures, then expand its coverage beyond chat rendering to controls, return replies, mixed displays and explicit endpoint combinations. The earlier SSApp 111-page sweep joined with all flags enabled; it establishes neither isolated-flag behavior nor every feature's controls.

Source: [tests/background-overlay-compat-matrix.test.cjs](../tests/background-overlay-compat-matrix.test.cjs).

### 9. Recovery and readiness need explicit completion criteria

**Static limitations of the pending protocol.** Poll/Hype request fresh snapshots every five seconds. Poll snapshots carry settings and a closed flag; the receiver only applies `closed: true`. There is no round/reset revision to reconcile a missed Reset/Start while an existing page was disconnected. Do not replay mutations on reconnect, but also do not claim those missed transitions are recovered by a settings snapshot. Timer/Spotify/Ticker and other future snapshot consumers need similarly explicit state ownership.

Define a revision/epoch or equivalent per-feature state contract before promising recovery. Test a command issued *during* disconnection, rather than only stopping/restarting the relay without a state transition. A page retaining its own votes/roll during reconnect is a different case from catching up with host changes.

## Assessment of the pending changes

Keep the useful direction: additive Actions delivery, stable control IDs, feature-specific Poll/Credits/Hype controls, allowlisted Poll settings, stale-socket/session guards, and explicit Giveaway Manager reply negotiation. These changes are consistent with the migration's intent. They are not sufficient reason to mark all server links socket-only, remove the compatibility bridge globally, or turn on the global additive default immediately.

The pending metadata stays in a control envelope rather than normal captured events, and a separate channel prevents ordinary chat listeners receiving Poll settings. The new helper is listed in the extension manifest. Hosted page deployment must include `shared/overlay-control-transport.js` together with the consuming pages and background changes; an app version number alone cannot establish which hosted page revision a saved OBS link loads.

## Recommended sequence

1. Fix the compatibility-test harness and the confirmed Map mirror-counting defect; keep runtime changes scoped to the affected paths.
2. Correct giveaway endpoint precedence and the Featured capability mismatch. Add hosted direct-feed support to the existing game/commerce helper and update generated links in the same change.
3. Verify the hosted browser-reply gap and resolve it through negotiated correlation. Complete the most-used missing controls (Map, Timer, alerts, Tip Jar, Ticker/Spotify), then the remaining feature protocols.
4. Run a matrix with no flags, each server flag separately, combined flags, local/custom-port mode, explicit remote addresses, old/no/new `v`, P2P-only plus relay-only displays together, and old/new hosts/pages. Cover SDK and iframe hosts independently. Test chat, feature/clear, repeated commands, ID-less messages, reconnect, missed state transitions and session changes.
5. Only after those checks, make host chat forwarding additive by default, remove the temporary toggle, and update capability declarations/docs. Receiver socket-only eligibility remains per page and per required feature.

Real extension tests should use the unpacked extension's actual capture/background configuration. SSApp tests require an explicit request under the repository's testing rule; none were launched by this audit. OBS, packaged releases and LAN/custom-host behavior need their own evidence before being called verified.

## Checks run in this audit

| Check | Result and limit |
| --- | --- |
| `node scripts/transport-dedupe-regression.test.cjs` | Pass: 39 listed consumers' dedupe functions. Not 39 complete runtime workflows. |
| `node tests/popup-search.test.js` | Pass: popup search/keyword checks. Does not test generated transport URLs. |
| `node tests/ninja-transport.test.js` | Pass: 12 SDK/bridge contract tests. Mock SDK, not a live WebRTC connection. |
| Existing compatibility test's historical/current preflight, evaluated without its browser runner | Fail: current-build helper missing from the extracted test context (finding 8). |
| Real Map ingress/counting chain, isolated state | The same message ID delivered twice produced count 2, total entries 2, unique viewers 1; country lookup/rendering stubbed. |
| Real `getChatRelayConfig` | Hosted `server2` disabled; local `server2` enabled on channel 4; explicit `server` retains channel 1 (finding 3). |
| Real control-envelope/helper functions | Map/Reactions/Tip Jar/alerts do not get relay control envelopes; Actions does. Local Poll control helper joins out 3/in 7 and requests a snapshot. |

## Complete page inventory

The appendix below lists all scanned pages, including wrappers and non-relay tools, so omissions are visible. Classifications are source audit results, not blanket runtime certifications. Shared-helper names identify code families; the findings above distinguish their supported directions and known gaps. Pages can recognize a URL parameter yet still require P2P for controls.

Additional component checks outside the root/themes/games HTML inventory:

| Component | Audit result |
| --- | --- |
| `actions/index.html`, `loader.js`, `EventFlowSystem.js`, `EventFlowEditor.js` | Configuration/execution system, distinct from the audience `actions.html`. Host injects `sendTargetP2P`; wrapped action payloads are handled by the receiver. Keep flow storage/origin and runtime bootstrap separate from relay migration. |
| `js/ninja-transport.js`, `thirdparty/vdoninja-sdk.js` loading | SDK is an optional P2P implementation; 12 contract tests pass. This audit does not certify live SDK/iframe interoperability. |
| `js/streamdeck-remote-control.js` | Shared protocol-2 command router; scope/correlation rules must remain consistent across P2P and API dispatch. |
| `ssn-streamdeck/plugin/src/api/{ssn-client,p2p-transport,chat-feed-client,settings}.ts` | Nested plugin inspected read-only. Defaults to P2P; configured WebSocket commands use out 1/in 2, feed uses channel 4. Callback/HTTP fallback caveat in finding 7. No plugin runtime was launched. |
| `streamdeck/index.html`, `streamdeck/guide.html` | Setup/documentation surfaces, not the plugin's transport implementation. |
| `settings/index.html`, `settings/options.html`, `actions/*-guide.html`, `translations/index.html` | Configuration/documentation, not audience relay consumers. |
| `shared/overlay-control-transport.js` | Pending channel-7 subscription, control-ID acceptance and acknowledgements; per-feature state limitations described above. |
| `shared/giveaway/{popup,control,managed}.js` | Distinct native manager, remote manager and audience-state routes; endpoint and callback findings above. |
| `shared/monetization/{popup,overlay,obs-controls,background}.js` | One existing host state/control API; viewer overlay uses chat helper, operator dock uses API requests. Do not move operator/private configuration into viewer traffic. |
| `combine.js`, `streamelements-importer.js` | Nested/exported child URLs are part of the release matrix; testing only the editor page is insufficient. |
| sibling `ssapp/main.js` local relay and test source | Room/channel filtering and callback forwarding reviewed. Prior test source deliberately sweeps all flags together, with stronger per-feature cases elsewhere; no fresh SSApp runtime claim. |
| Background/manifest/standalone packaging | New shared control helper is exposed in manifest; publish it alongside hosted consumers. No deployed/package contents were checked. |


Inventory totals: 155 pages scanned; 125 contain a transport-related path in the page or directly referenced script (including host/tools); 33 game pages use the shared chat-relay helper. Pattern matches are an inventory aid, not capability tests.

| Page | Source-audited routing / outstanding work |
| --- | --- |
| [404.html](../404.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [TOS.html](../TOS.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [actions.html](../actions.html) | Pending additive control route: channel 6 + P2P; control-ID suppression. |
| [affiliate.html](../affiliate.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [aioverlay.html](../aioverlay.html) | Relay chat feed; bridge still required to obtain saved overlay HTML/private responses. |
| [aiprompt.html](../aiprompt.html) | Builder: host overlay storage/chatbot workflow is bridge-only; URL server flags do not implement it. |
| [automix.html](../automix.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [background.html](../background.html) | Host bootstrap; background.js routing reviewed above. |
| [baretempate.html](../baretempate.html) | P2P-only example; no general server/local receiver. |
| [battle.html](../battle.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [beta.html](../beta.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [bot.html](../bot.html) | Bot display channel 12 or bridge; host clear remains P2P. |
| [chat-overlay.html](../chat-overlay.html) | Redirect/wrapper surface; receiver behavior belongs to destination page. |
| [chatbot.html](../chatbot.html) | Private chatbot bridge workflow; no general server/local receiver. |
| [chathistory.html](../chathistory.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [cohost-overlay.html](../cohost-overlay.html) | Stage display: targeted payload filtering, relay and capability-gated bridge; custom channels retained. |
| [cohost.html](../cohost.html) | Relay live-chat feed or fallback bridge; host AI/tool/private control remains bridge-dependent. |
| [combine.html](../combine.html) | Wrapper preserves complete child URLs; each child retains its own transport requirements. |
| [confetti.html](../confetti.html) | Relay input exists; waitlist/draw updates still require bridge. |
| [content.html](../content.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [createtestmessage.html](../createtestmessage.html) | Message-injection tool; server/local API route, not viewer overlay. |
| [credits.html](../credits.html) | Chat + pending channel-7 controls; bridge retained for old hosts/labels. |
| [dock.html](../dock.html) | Relay chat + P2P bridge; upstream prefers server3 on new links; Featured publication is separate. |
| [emotes.html](../emotes.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [events.html](../events.html) | Chat sockets/dedupe; feature/clear delivery still depends on iframe peers. |
| [featured.html](../featured.html) | Featured receiver: existing socket/iframe selection and duplicate guard; do not equate channel 2 and 4. |
| [fonts.html](../fonts.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [games.html](../games.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [games/beaconrelay.html](../games/beaconrelay.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/chaosmode.html](../games/chaosmode.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/chatgarden.html](../games/chatgarden.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/chatwars.html](../games/chatwars.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/chickenroyale.html](../games/chickenroyale.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [games/colorsymphony.html](../games/colorsymphony.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/colorwars.html](../games/colorwars.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/cometrally.html](../games/cometrally.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/crewkitchen.html](../games/crewkitchen.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/crowdquest.html](../games/crowdquest.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/dancingparade.html](../games/dancingparade.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/emojirain.html](../games/emojirain.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/emojitower.html](../games/emojitower.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/fireflycatch.html](../games/fireflycatch.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/mazeraid.html](../games/mazeraid.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/memorylane.html](../games/memorylane.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/memoryparade.html](../games/memoryparade.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/meteorshield.html](../games/meteorshield.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/minorityclub.html](../games/minorityclub.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/numberhunt.html](../games/numberhunt.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/oddoneout.html](../games/oddoneout.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/petrace.html](../games/petrace.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/phraseguess.html](../games/phraseguess.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/pixelbattle.html](../games/pixelbattle.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/quickcall.html](../games/quickcall.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/rhythmpulse.html](../games/rhythmpulse.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/rockpapershowdown.html](../games/rockpapershowdown.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/signallock.html](../games/signallock.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/sumsquad.html](../games/sumsquad.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/treasurehunt.html](../games/treasurehunt.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/tugofwar.html](../games/tugofwar.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/wordchain.html](../games/wordchain.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/wordshuffle.html](../games/wordshuffle.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [games/wordstorm.html](../games/wordstorm.html) | Shared chat relay helper: P2P or server API feed; direct server2 feed currently local-only. |
| [gif.html](../gif.html) | Custom GIF bridge workflow; no general server/local receiver. |
| [giveaway-control.html](../giveaway-control.html) | Native extension or relay/P2P manager; pending negotiated commandResult for relay replies. |
| [giveaway-obs-entries.html](../giveaway-obs-entries.html) | Legacy channel-5/6 entries workflow; local default overrides explicit server URL. |
| [giveaway.html](../giveaway.html) | Legacy base plus managed adapter; managed relay/P2P state; explicit hosted server2 override defect. |
| [hype.html](../hype.html) | Pending channel-7 snapshot/update route + P2P; bridge retained. |
| [index.html](../index.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [input.html](../input.html) | User-specified external input WebSocket; excluded from SSN overlay relay parity. |
| [landing.html](../landing.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [leaderboard.html](../leaderboard.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [map.html](../map.html) | Chat sockets + P2P; host controls bridge-only; confirmed mirrored-vote defect. |
| [message-ai-export.html](../message-ai-export.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [meta.html](../meta.html) | Relay feed or bridge selection; inspect mixed API+captured feeds separately for duplicate state effects. |
| [midimonitor.html](../midimonitor.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [minecraft.html](../minecraft.html) | Shared multi-alerts.js theme; same transport/control limits as multi-alerts. |
| [monetization.html](../monetization.html) | Shared game-style chat helper; hosted server2 direct feed unsupported; state/event dedupe exists. |
| [multi-alerts.html](../multi-alerts.html) | Shared multi-alerts.js: relay/chat + P2P, existing alert dedupe; host clear remains P2P. |
| [obs-control-dock.html](../obs-control-dock.html) | API WebSocket controller, channel 1/2; hosted callback compatibility needs verification. |
| [obs-websocket-test.html](../obs-websocket-test.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [poll.html](../poll.html) | Chat + pending channel-7 controls; bridge retained; ID-less mirror and recovery limitations. |
| [popup.html](../popup.html) | URL/settings producer; per-target maps and local-only exceptions reviewed. |
| [privacy.html](../privacy.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [reactions.html](../reactions.html) | Relay input + P2P; targeted host payloads remain P2P; existing payload signature checks. |
| [recover.html](../recover.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [replaymessages.html](../replaymessages.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [sample_wss_source.html](../sample_wss_source.html) | Source/API injection example with local default; not a generic overlay. |
| [sampleapi.html](../sampleapi.html) | HTTP/WebSocket API client; local endpoint support; browser callback paths need hosted verification. |
| [sampleemote.html](../sampleemote.html) | Protocol-specific consumer: source scanned; no full server/control parity certification. Requires dedicated runtime case. |
| [samplefeatured.html](../samplefeatured.html) | Protocol-specific consumer: source scanned; no full server/control parity certification. Requires dedicated runtime case. |
| [sampleoverlay.html](../sampleoverlay.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [scoreboard.html](../scoreboard.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [septapus.html](../septapus.html) | Legacy P2P consumer; no general server/local receiver. |
| [shop.html](../shop.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [shop_the_stream.html](../shop_the_stream.html) | Standalone shop/chat consumer; local/API feed support; separate from managed commerce overlay. |
| [simple_api_client.html](../simple_api_client.html) | API WebSocket example/client; not an overlay receiver capability declaration. |
| [spotify-overlay.html](../spotify-overlay.html) | Custom-channel socket + P2P; background Spotify updates remain P2P. |
| [spotify.html](../spotify.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [stickers.html](../stickers.html) | P2P consumer; no general server/local receiver. |
| [streamelements-importer.html](../streamelements-importer.html) | Builder/exporter: inspect generated widget transport in streamelements-importer.js; dedupe guard present. |
| [streamerbot.html](../streamerbot.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [test-giveaway-webrtc.html](../test-giveaway-webrtc.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [themes/LuckyLootTube/luckyloottube.html](../themes/LuckyLootTube/luckyloottube.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/Neutron/chatOnly.html](../themes/Neutron/chatOnly.html) | Dock iframe wrapper; forwards server/server2/server3/localserver/localserverport; inherits Dock requirements. |
| [themes/Neutron/stream.html](../themes/Neutron/stream.html) | Dock iframe wrapper; forwards server/server2/server3/localserver/localserverport; inherits Dock requirements. |
| [themes/Windows3.1/index.html](../themes/Windows3.1/index.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/compact-classic.html](../themes/compact-classic.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/compact-clean.html](../themes/compact-clean.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/compact-glass.html](../themes/compact-glass.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/deuks_overlay/overlay1.html](../themes/deuks_overlay/overlay1.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/deuks_overlay/overlay2.html](../themes/deuks_overlay/overlay2.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/events/index.html](../themes/events/index.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/featured-styles/featured-3d.html](../themes/featured-styles/featured-3d.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-animated.html](../themes/featured-styles/featured-animated.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-cyberpunk.html](../themes/featured-styles/featured-cyberpunk.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-dynamic.html](../themes/featured-styles/featured-dynamic.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-elegant.html](../themes/featured-styles/featured-elegant.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-gaming.html](../themes/featured-styles/featured-gaming.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-glass.html](../themes/featured-styles/featured-glass.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-gradient.html](../themes/featured-styles/featured-gradient.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-modern.html](../themes/featured-styles/featured-modern.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-neon.html](../themes/featured-styles/featured-neon.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-particles.html](../themes/featured-styles/featured-particles.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-retro.html](../themes/featured-styles/featured-retro.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/featured-styles/featured-slide.html](../themes/featured-styles/featured-slide.html) | Legacy display adapter: local relay only; hosted links retain P2P. Featured flag support mismatch applies to Featured styles. |
| [themes/horizontal.html](../themes/horizontal.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/huan-kiara/index.html](../themes/huan-kiara/index.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/index.html](../themes/index.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [themes/notimeoutmessages.html](../themes/notimeoutmessages.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-bubbles.html](../themes/overlay-bubbles.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-cards.html](../themes/overlay-cards.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-comic-classic.html](../themes/overlay-comic-classic.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-comic-pop.html](../themes/overlay-comic-pop.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-credits.html](../themes/overlay-credits.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-danmaku.html](../themes/overlay-danmaku.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-neon-cyberpunk.html](../themes/overlay-neon-cyberpunk.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-particles.html](../themes/overlay-particles.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-ticker-news.html](../themes/overlay-ticker-news.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-typewriter.html](../themes/overlay-typewriter.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/overlay-xacception.html](../themes/overlay-xacception.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/pretty.html](../themes/pretty.html) | Dock iframe wrapper; forwards server/server2/server3/localserver/localserverport; inherits Dock requirements. |
| [themes/rainbowpuke/index.html](../themes/rainbowpuke/index.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/sampleoverlay_reverse.html](../themes/sampleoverlay_reverse.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/spiritoverlay.html](../themes/spiritoverlay.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [themes/t3nk3y/index.html](../themes/t3nk3y/index.html) | Capability-gated relay/bridge chat receiver with duplicate guard; eligible server2 links can omit bridge. Custom/API modes still require separate checks. |
| [ticker.html](../ticker.html) | Custom-channel socket + P2P; background ticker updates remain P2P. |
| [timer.html](../timer.html) | Direct server commands + P2P; background state publication/register flow remains P2P. |
| [tipjar-preview.html](../tipjar-preview.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [tipjar.html](../tipjar.html) | Relay contributions + P2P; contribution dedupe; host reset/set remain P2P. |
| [tts.html](../tts.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [urleditor.html](../urleditor.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [vdo.html](../vdo.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [voice-control.html](../voice-control.html) | No direct SSN overlay transport found; setup, preview, storage/export, documentation or unrelated tool. Not a relay parity claim. |
| [waitlist.html](../waitlist.html) | Legacy custom bridge protocol; no general server parity advertised. |
| [wordcloud.html](../wordcloud.html) | P2P settings/chat workflow; no general server/local receiver. |
