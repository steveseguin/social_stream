# Action And Command Index

Status: heavy lookup pass from `api.md`, `docs/commands.html`, `background.js`, `dock.html`, `featured.html`, `poll.html`, `timer.html`, and Event Flow source on 2026-06-24.

Use this page when the user asks "what command/action do I send?" The narrative page `commands-and-actions.md` explains the command systems; this page is the lookup table. For source-checked handler caveats, use `command-action-source-trace.md`. For accepted-by-relay versus acted-on-by-target validation, use `api-command-validation-matrix.md`.

## Routing Rules

- API actions are sent through WebSocket, HTTP GET, POST, or PUT to `io.socialstream.ninja`.
- Viewer chat commands are typed into a platform chat and are not the same as API actions.
- Event Flow actions are node `actionType` values, not remote API actions.
- Some actions are public/documented. Others are implemented or internal and should be source-checked before recommending them.
- If an action targets a page, that page must be open, connected to the same session, and using the needed server/API mode.

## Transport Examples

| Transport | Pattern |
| --- | --- |
| WebSocket remote control | `wss://io.socialstream.ninja/join/SESSION_ID` then send `{"action":"nextInQueue"}` |
| WebSocket chat listener | `wss://io.socialstream.ninja/join/SESSION_ID/4` |
| HTTP GET action | `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE` |
| HTTP GET value with no target | Use `null` for target, such as `.../sendEncodedChat/null/Hello%20World` |
| POST/PUT action | POST/PUT JSON to `https://io.socialstream.ninja/SESSION_ID` or `/SESSION_ID/ACTION` |

## Required Toggles

| Use | Required Setup |
| --- | --- |
| Remote control actions | Enable remote API control of extension. |
| Dock commands through relay | Enable Dock to use and publish via API server, or open the dock with the correct server route. |
| Receive source chat on channel 4 | Enable remote API control and Send chat messages to API server. |
| Send chat back to platform | Source must support send-back, user must be signed in, and platform/chat permissions must allow it. |
| Waitlist/poll/timer control | Target page must be open on the same session. |

## Public API Action Lookup

These are documented in `api.md` and/or `docs/commands.html`.

| Action | Target | Value Shape | Purpose | Verify In |
| --- | --- | --- | --- | --- |
| `sendChat` | Extension/app source send path | string | Send message to connected chat platforms where send-back is supported. | `api.md`, `background.js` |
| `sendEncodedChat` | Extension/app source send path | URL-encoded string | Same as `sendChat`, but suited for GET URLs. | `api.md`, `background.js` |
| `blockUser` | Extension/source control | object with `chatname`, `type` | Block user where a source supports moderation. | `api.md`, `background.js` |
| `extContent` | Extension/background processing | JSON string/object | Inject external content as SSN message-like data. | `api.md`, `background.js` |
| `clear` | Dock/featured/page | none | Clear supported page content. | `api.md`, `dock.html`, `featured.html` |
| `clearAll` | Dock | none | Clear dock messages except pinned behavior where applicable. | `api.md`, `dock.html` |
| `clearOverlay` | Dock/featured overlay | none | Clear featured overlay without necessarily clearing dock history. | `api.md`, `dock.html`, `docs/commands.html` |
| `nextInQueue` | Dock | none | Feature the next queued message. | `api.md`, `dock.html`, `docs/commands.html` |
| `getQueueSize` | Dock | optional `get` callback token | Request current queue size. | `api.md`, `dock.html` |
| `autoShow` | Dock | `toggle`, boolean, or state-like value | Toggle or set automatic featuring. | `api.md`, `dock.html`, `docs/commands.html` |
| `feature` | Dock | optional content context | Feature next unfeatured/current message. | `api.md`, `dock.html` |
| `getChatSources` | Extension/app | none | Request active source list where supported. | `api.md`, `background.js` |
| `toggleVIPUser` | Dock/background user tools | object with `chatname`, `type` | Toggle VIP state for a user. | `api.md`, `dock.html`, `background.js` |
| `getUserHistory` | Dock/background user tools | object with `chatname`, `type` | Request user history. | `api.md`, `dock.html`, `background.js` |
| `drawmode` | Waitlist/giveaway/dock | boolean or `toggle` | Toggle/set draw mode. | `api.md`, `background.js` |
| `emoteonly` | Extension filter | boolean or `toggle` | Toggle/set global emote-only mode. | `api.md`, `background.js` |

## Channel Content Actions

| Action | Channel | Purpose |
| --- | ---: | --- |
| `content` | 1/default | Send custom content to default channel/listeners. |
| `content2` | 2 | Send custom content to channel 2. |
| `content3` | 3 | Send custom content to channel 3. |
| `content4` | 4 | Send custom content to channel 4. |
| `content5` | 5 | Send custom content to channel 5. |
| `content6` | 6 | Send custom content to channel 6. |
| `content7` | 7 | Send custom content to channel 7. |

Source: `api.md`. Verify current relay behavior against server/page settings before detailed integration support.

## Waitlist And Giveaway Actions

| Action | Value Shape | Purpose | Verify In |
| --- | --- | --- | --- |
| `waitlistmessage` | string | Set waitlist title/message. | `api.md`, `waitlist.html`, `background.js` |
| `removefromwaitlist` | index/id-like value | Remove an entry. | `api.md`, `background.js` |
| `highlightwaitlist` | index/id-like value | Highlight an entry. | `api.md`, `background.js` |
| `resetwaitlist` | none | Reset waitlist. | `api.md`, `background.js` |
| `stopentries` | none | Stop accepting new entries. | `api.md`, `background.js` |
| `downloadwaitlist` | none | Trigger waitlist download. | `api.md`, `background.js` |
| `selectwinner` | value/index/count | Select winner. | `api.md`, `background.js` |
| `drawmode` | boolean or `toggle` | Toggle/set draw mode. | `api.md`, `background.js` |

## Poll Actions

| Action | Value Shape | Purpose | Verify In |
| --- | --- | --- | --- |
| `resetpoll` | none | Reset current poll and clear votes. | `api.md`, `poll.html`, `background.js` |
| `closepoll` | none | Close current poll. | `api.md`, `poll.html`, `background.js` |
| `startpoll` | none | Start/open poll path observed in `poll.html`. | `poll.html` |
| `loadpoll` | object with `pollId` | Load saved poll preset. | `api.md`, `background.js` |
| `setpollsettings` | settings object | Update current poll settings. | `api.md`, `background.js` |
| `getpollpresets` | optional callback/get token | Request saved poll presets. | `api.md`, `background.js` |
| `createpoll` | object with `settings` | Create new poll. | `api.md`, `background.js` |

## Timer Actions

These are public/documented timer controls. `background.js` also blocks several host/timer commands when host control is disabled.

| Action | Value Shape | Purpose | Verify In |
| --- | --- | --- | --- |
| `starttimer` | none | Start timer. | `api.md`, `timer.html`, `background.js` |
| `pausetimer` | none | Pause timer. | `api.md`, `timer.html`, `background.js` |
| `toggletimer` | none | Toggle start/pause. | `api.md`, `timer.html`, `background.js` |
| `resettimer` | none | Reset timer. | `api.md`, `timer.html`, `background.js` |
| `timeradd` | number seconds | Add time. | `api.md`, `timer.html`, `background.js` |
| `timersubtract` | number seconds | Subtract time. | `api.md`, `timer.html`, `background.js` |
| `settimer` | object with timer state | Set timer state, such as seconds/label/mode/style. | `api.md`, `timer.html`, `background.js` |
| `gettimerstate` | `get` callback token | Request current timer state callback. | `api.md`, `timer.html`, `background.js` |

## Tip Jar And Map Actions

These are implemented in `background.js`; verify target pages before recommending as public API recipes.

| Action | Value Shape | Purpose |
| --- | --- | --- |
| `resettipjar` | none | Reset tip jar state. |
| `settipjaramount` | number/object-like amount input | Set tip jar amount. |
| `startmap` | none | Start map-related page/action flow. |
| `pausemap` | none | Pause map-related page/action flow. |
| `resetmap` | none | Reset map-related page/action flow. |

## Featured And Dock Page Actions

| Action | Page | Purpose |
| --- | --- | --- |
| `content` | `featured.html`, `dock.html` | Display/process custom content payload. |
| `clear` | `featured.html`, `dock.html` | Clear displayed content/messages. |
| `clearAll` | `dock.html` | Clear dock messages. |
| `clearOverlay` | `dock.html` | Clear overlay/featured output. |
| `nextInQueue` | `dock.html` | Feature next queued message. |
| `getQueueSize` | `dock.html` | Return queue size. |
| `autoShow` | `dock.html` | Toggle or set auto-show. |
| `feature` | `dock.html` | Feature message. |
| `toggleTTS` | `featured.html`, `dock.html` | Toggle TTS. |
| `tts` | `featured.html`, `dock.html` | Alias/path for TTS state/action. |
| `nextPinned` | `dock.html` | Observed dock action for pinned-message navigation. Source-check before public recipe. |

## Background/Internal Runtime Actions

These appear in background request/message handling. Do not present them as public API actions unless source-checked for the user's path.

| Action | Purpose |
| --- | --- |
| `eventFlowEvent` | Inject/forward Event Flow event payload. |
| `openChat` | Open chat UI/path. |
| `aiOverlay` | AI overlay request path. |
| `cohostOverlay` | Cohost overlay request path. |
| `skipTTS` | Skip current TTS item. |
| `getRecentHistory` | Request recent history. |
| `getHistoryBefore` | Request history before cursor/time. |
| `markUser` | Mark user role/state. |
| `deleteSourceMessage` | Delete source message where supported. |
| `obsCommand` | OBS command path. |
| `registerTimer` | Timer registration path. |
| `saveAiPromptOverlays` | Save AI prompt overlay config. |
| `getAiPromptOverlays` | Fetch AI prompt overlay config. |
| `cohostToolStatus` | Cohost tool status path. |
| `cohostTool` | Cohost tool action path. |
| `chatbot` | Chatbot request/response path. |

## Viewer Chat Commands

These are typed by viewers in a platform chat, not sent as API `action` values.

| Command | Purpose | Requirements |
| --- | --- | --- |
| `!joke` | Ask SSN to send a random joke. | Command toggle and platform send-back support. |
| `hi` | Auto-welcome response path. | Command toggle and platform send-back support. |
| `!cycle` | OBS scene cycle from chat. | OBS remote/cycle support enabled. |
| `!say` | Default TTS command trigger. | TTS command settings enabled. |
| `!pass` | Forward TTS to remote automation. | `passtts`, optionally `passttsmod`. |
| `!join` | Join older battle/game flows and some current mini-games. | Active game page/workflow; use `07-overlays-and-pages/game-pages.md` for current mini-game commands. |
| Game-specific commands/input | Inputs such as `!drop`, `!dig B5`, color/team commands, phrase guesses, beat words, emoji, or paint commands. | Exact `games.html` or `games/*.html` page open on the same session. |
| `selfqueue` values | Add viewer/message to queue. | `&selfqueue=...` on dock URL. |

## Event Flow Action Types

These are Event Flow node `actionType` values from `actions/EventFlowSystem.js` and `actions/EventFlowEditor.js`.

| Family | Action Types |
| --- | --- |
| Message control | `blockMessage`, `returnMessage`, `continueAsync`, `reflectionFilter`, `modifyMessage`, `setProperty`, `featureMessage`, `addPrefix`, `addSuffix`, `findReplace`, `removeText` |
| Send/relay/external | `sendMessage`, `relay`, `webhook`, `customJs` |
| Points/state | `addPoints`, `spendPoints`, `setGateState`, `resetStateNode`, `setCounter`, `incrementCounter`, `checkCounter` |
| Media/visual | `playTenorGiphy`, `showAvatar`, `showText`, `clearLayer`, `triggerOBSScene`, `playAudioClip`, `delay` |
| OBS | `obsChangeScene`, `obsToggleSource`, `obsSetSourceFilter`, `obsMuteSource`, `obsStartRecording`, `obsStopRecording`, `obsStartStreaming`, `obsStopStreaming`, `obsReplayBuffer` |
| Spotify | `spotifySkip`, `spotifyPrevious`, `spotifyPause`, `spotifyResume`, `spotifyVolume`, `spotifyQueue`, `spotifyToggle`, `spotifyNowPlaying`, `spotifyShuffle`, `spotifyRepeat` |
| TTS | `ttsSpeak`, `ttsToggle`, `ttsSkip`, `ttsClear`, `ttsVolume` |
| MIDI | `midiSendNote`, `midiSendCC` |

Event Flow custom JS has context restrictions. MV3 extension contexts disable direct eval-style custom JS; use supported app/page contexts or source-check the current implementation before advising.

## Event Flow Trigger Types

Common trigger types observed in Event Flow source:

- Message triggers: `anyMessage`, `messageContains`, `messageStartsWith`, `messageEndsWith`, `messageEquals`, `messageRegex`, `messageLength`, `wordCount`, `containsEmoji`, `containsLink`, `fromSource`, `fromChannelName`, `fromUser`, `userRole`, `hasDonation`, `channelPointRedemption`, `messageProperties`.
- Event triggers: `eventType`, `eventNewFollower`, `eventNewSubscriber`, `eventResub`, `eventGiftSub`, `eventDonation`, `eventRaid`, `eventCheer`, `eventOther`, `eventCustom`.
- OBS triggers: `obsStreamStarted`, `obsStreamStopped`, `obsRecordingStarted`, `obsRecordingStopped`, `obsSceneChanged`, `obsReplaybufferSaved`.
- Logic/time/input triggers: `compareProperty`, `randomChance`, `timeInterval`, `timeOfDay`, `midiNoteOn`, `midiNoteOff`, `midiCC`, `customJs`, `counter`, `userPool`, `accumulator`.

## Answer Checklist

Before giving a user a command:

1. Identify whether they mean API action, URL parameter, viewer chat command, Event Flow action, MIDI/hotkey, or custom script hook.
2. Identify the target page or extension/app path.
3. Confirm the required toggle/page/session/server mode.
4. Use URL encoding for HTTP GET values.
5. Warn if the command includes a session ID, password, API key, webhook URL, or private endpoint.
