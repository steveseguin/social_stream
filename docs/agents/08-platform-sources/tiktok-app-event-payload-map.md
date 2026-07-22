# TikTok App Event → SSN Payload Map

Status: deep extraction pass on 2026-07-22 from `ssapp/tiktok/connection-manager.js`, `ssapp/tiktok-badges.js`, `ssapp/tiktok/gift-mapping.json`, and `social_stream/background.js`. Source-backed line anchors; payload field names follow the canonical contract in `docs/event-reference.html`. Not live-validated against a real TikTok stream.

## Purpose

Use this page when you need to know exactly which SSN payload a TikTok standalone-app connector event produces — for overlay building, Event Flow rules, or debugging "wrong field" reports. For connector modes/signing/fallbacks, use `tiktok-standalone-app.md`. For extension DOM-mode TikTok, use `tiktok.md`.

## Pipeline Reminder

Connector event → `MessageProcessor`/`GiftProcessor`/event handlers (`connection-manager.js:6598-7257`) → formatter (`composeTikTokChatMessage` `:2277`, `sendGiftMessage` `:3996`, `sendEventMessage` `:9338`) → `sendToBackground` (`:10247`) → `frame.postMessage('fromMain', ...)` → `background.js:751-780` → standard SSN routing. All payloads below carry `type: "tiktok"` unless noted.

## Event Map

| TikTok connector event | Handler | SSN output | Key fields / notes |
| --- | --- | --- | --- |
| `chat` | `MessageProcessor.addToQueue` (`:6685-6689`), batched | Chat message | `chatname`, `chatmessage` (via `composeTikTokChatMessage` `:2277`/`formatChatMessage` `:3606`), badges from `tiktok-badges.js` (`collectTikTokBadges` `:337`) |
| `gift` | `GiftProcessor` (`:3829`, wired `:6690-6694`) | Donation-style chat row | Streak aggregation; `hasDonation` + `donoValue` (diamond totals), gift image as `contentimg`; tray-hidden gifts → `event: "reaction"` (`:3996-4128`). Gift name/coins resolved via `gift-mapping.json` |
| `like` | event map | Likes | `liked`; routed to the `reactions` target when capture-liked is off (`:9356-9358`) |
| `member` (join) | `:6793` | Join event | `event: "joined"` |
| `follow` | event map | Follow | follow event row |
| `share` | event map | Share | share event row |
| `subscribe` | `:6721` | Subscription | Includes tenure when present |
| `roomUser` | `:6928-6941` | Viewer count | `event: "viewer_update"`; zeroed on stream end (`:8809-8817`); plus interval broadcaster `startViewerUpdateInterval` (`:7368`) |
| `linkMicBattle` / `linkMicArmies` | `:6842-6873` | Battle updates | Meta-style battle payloads |
| `oecLiveShopping` | `:6942-7128` | Shopping | `event: "shopping_purchase"` |
| `goalUpdate` | `:7130` | Goal progress | Normalized via `normalizeGoalUpdate` (`:6310`) |
| `poll` | `:7138` | Poll updates | |
| `roomPin` | `:7200` | Pinned message | |
| `questionNew` | `:6828` | Q&A question | |
| `envelope` | `:6891` | Treasure/envelope | |
| `emote` | `:6904` | Emote events | |
| `liveIntro` | `:6874` | Live intro | |
| social events | `:1760-1842`, `:6747` | Classified/suppressed | Low-value social spam filtered before formatting |

Support implication: per the repo message contract, gift rows use `hasDonation`/`donoValue` and must not set `event: "donation"`; tray-hidden gift reactions are the exception (`event: "reaction"`).

## Cross-Cutting Behaviors

| Behavior | Where | Effect on payloads |
| --- | --- | --- |
| Dedupe | `:1426-1594`, `:9298` | Duplicate connector events dropped before background |
| Startup history cutoff | `:4288-4310` | Pre-connect backlog not emitted |
| Reply-only mode | connection config | Capture forwarding suppressed; status/reply paths stay live |
| Account roles / host meta | `:10134-10165` | Role metadata folded into payload meta |
| Badge resolution | `tiktok-badges.js:337-403`, `:1867-2028` | `chatbadges` URLs, moderator/subscriber/level markers |
| Batch sends | `sendBatchToBackground` `:10285`; `background.js:760-769` | Chat queue flushed as message arrays |

## Outbound Chat (dock → TikTok)

- `sendChatMessage` (`:10012`) with three routes: direct `SendRoomChatRoute` (`:9828`), Euler endpoint (`:9941`), webcast API (`:9529`).
- Entry paths: virtual tab `webContents.send('sendToTab')` shim (`main.js:17955-17985`), `sendTikTokMessage` IPC (`main.js:18425` — see `../issues/ISSUE-003-sendtiktokmessage-virtual-tab-id.md`), `sendToTikTok` (`main.js:2646`).
- Known defect: send-failure event `tiktokSendResult` has no renderer listener (`../issues/ISSUE-004-tiktoksendresult-no-listener.md`).

## Do Not Overclaim

- Field-level output (`subtitle`, `nameColor`, exact `meta` keys per event) is not yet extracted line-by-line; verify against a live capture or `tests/tiktok/*` fixtures before documenting per-field guarantees.
- The connector's protobuf decode is v2 with v1 fallback (`:278-289`); event availability depends on what TikTok's webcast actually sends.

## Follow-Up Extraction Needs

- Per-event exact payload field tables (needs live capture or fixture extraction).
- `gift-mapping.json` regeneration process when TikTok adds gifts.
