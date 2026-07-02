# Common Support Questions

Status: heavy extraction pass started. This page is source-backed from current repo docs and should be expanded with mined Discord/KB history in later passes.

For first-stop routing, use `docs/agents/11-support-kb/index.md`. For objective coverage by question family, use `common-question-coverage-map.md`. For concise support-response patterns, use `support-answer-bank.md`.

## Source Anchors

- `README.md`
- `api.md`
- `parameters.md`
- `docs/commands.html`
- `docs/download.html`
- `docs/js/sites.js`
- `custom_sample.js`
- `custom_actions.js`
- `sample_wss_source.html`
- `docs/agents/08-platform-sources/*.md`
- Future support-mining pass: `<stevesbot repo>/data/sqlite/*.sqlite`

## Fast Reference Pages

Use these cross-topic pages before repeating long answers:

- `docs/agents/13-reference/commands-and-actions.md`
- `docs/agents/13-reference/url-parameters.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/agents/13-reference/free-paid-and-support-boundaries.md`
- `docs/agents/13-reference/custom-plugins-and-extensions.md`
- `docs/agents/13-reference/support-resources-and-escalation.md`
- `docs/agents/13-reference/settings-and-toggles.md`
- `docs/agents/13-reference/features-and-capabilities.md`
- `docs/agents/13-reference/how-to-recipes.md`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`
- `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`
- `docs/agents/08-platform-sources/websocket-source-pages.md`
- `docs/agents/08-platform-sources/communication-and-sensitive-sources.md`
- `docs/agents/08-platform-sources/embedded-chat-widget-sources.md`
- `docs/agents/08-platform-sources/live-commerce-sources.md`
- `docs/agents/08-platform-sources/webinar-and-event-sources.md`
- `docs/agents/08-platform-sources/creator-live-cam-sources.md`
- `docs/agents/08-platform-sources/popout-chat-only-sources.md`
- `docs/agents/08-platform-sources/event-and-community-sources.md`
- `docs/agents/11-support-kb/support-answer-bank.md`

## Product And Cost

### Is Social Stream Ninja free?

Yes. The core project is described as completely free and open-source. Most platform capture modes also avoid platform API keys, special permissions, or separate logins beyond the normal logged-in browser/app page.

Important boundaries:

- Third-party premium services can still cost money. This includes cloud TTS, some AI services, and platform services outside SSN.
- System TTS is free but can be harder to capture in OBS because browser pages may use the operating-system voice output.
- Donations to Steve are gifts. They are not payment for support, feature work, or guaranteed integrations.

### Is it a Chrome extension or a standalone app?

Both are supported product surfaces.

- Browser extension: best when the user already has normal browser sessions, cookies, and site access working. It captures chat from supported web pages and popout chats through content scripts.
- Standalone desktop app: Electron app that loads Social Stream source files and manages source windows without requiring the extension. It can avoid some browser visibility/throttling problems and organize sources better, but some platform sign-in flows may block embedded browsers.
- Hosted/overlay pages: `dock.html`, `featured.html`, alert pages, games, API examples, and tool pages can be used with either surface as long as the session ID and transport settings match.

If the extension and standalone app use the same session ID at the same time, do not assume both can publish/control the same workflow cleanly. For support, isolate one surface first.

### Which version should users install?

Common guidance:

- Use the Chrome Web Store build for easiest install, but expect it to lag behind GitHub because store review takes time.
- Use manual GitHub install when the user needs the newest fixes or wants full source control.
- Use Firefox only when the missing features are acceptable. Firefox lacks some Chromium-only capabilities such as debugger/tab-capture behavior and some TTS/model support.
- Use the standalone app when users want managed source windows, always-on-top style workflows, or fewer problems from hidden/minimized browser windows.
- Use Lite only for quick/lightweight sessions. Current download docs describe Lite as having a very limited feature set and only a handful of core services.

## Capture And Overlay Basics

### Chat is not appearing. What should be checked first?

Use the same first-pass checks before platform-specific debugging:

1. Confirm SSN is enabled. In the extension, red means off and green means enabled.
2. Confirm the chat source page was reloaded after installing/reloading the extension.
3. Confirm the source page is a supported URL/mode. Many sites require popout chat, while some require the normal watch page.
4. Confirm the dock/overlay session ID matches the extension/app session ID.
5. Keep the source chat visible and not minimized. Browsers can throttle hidden or minimized pages.
6. Disable conflicting extensions or test in an isolated browser/incognito profile.
7. Confirm WebRTC/VDO.Ninja connectivity works in the browser/network.
8. For Discord, Slack, Telegram, WhatsApp, Google Meet, ChatGPT/OpenAI, and similar sensitive pages, confirm the required capture toggle is enabled.
9. If the file is a static/helper source, confirm it is not only a manual capture, page helper, scout, or injected WebSocket helper before treating it as broken chat capture.
10. If it is a WebSocket/API source page, confirm the source page itself is connected and has valid room/channel/token/OAuth setup before debugging overlays.

For platform-specific checks, start with:

- `docs/agents/08-platform-sources/youtube.md`
- `docs/agents/08-platform-sources/tiktok.md`
- `docs/agents/08-platform-sources/twitch.md`
- `docs/agents/08-platform-sources/kick.md`
- `docs/agents/08-platform-sources/discord.md`
- `docs/agents/08-platform-sources/communication-and-sensitive-sources.md`

### Overlay or dock is open but not updating. What usually causes it?

Most common causes:

- Session ID mismatch between source and page URL.
- The extension/app source is off, disconnected, or on a different session.
- Browser source in OBS is stale and needs a refresh.
- The wrong target label is being used. Pages can be labeled with `&label=NAME`, and API commands can target that label.
- The user opened a local page but expected hosted-page behavior, or opened the hosted page but expected a local `custom.js` file to load.
- API server toggles are not enabled for WebSocket/HTTP workflows.

### Which page should be used for event logs, hype counts, word clouds, leaderboards, or confetti?

Use the page that matches the payload:

- `events.html?session=...` for an event dashboard/log with metadata and filters.
- `hype.html?session=...` for viewer/chatter counts from hype or viewer-update payloads.
- `wordcloud.html?session=...` for chat word aggregation. Its default mode counts one-word messages; add `&allwords` for sentences.
- `leaderboard.html?session=...` for accumulated chatters, donors, gifters, contributors, or loyalty snapshots.
- `confetti.html?session=...` for waitlist draw winner celebration.

If the page is blank, do not assume capture is broken until the matching payload family has been tested on the same session.

See `docs/agents/07-overlays-and-pages/event-effect-overlays.md`.

### Which page should be used for emotes, reactions, scoreboards, ticker text, or maps?

Use the page that matches the intended payload:

- `emotes.html?session=...` for floating emoji, image emotes, and SVGs from chat content.
- `reactions.html?session=...` for like/reaction event bursts.
- `scoreboard.html?session=...` for points snapshots or local score counters.
- `ticker.html?session=...` for explicit `ticker` payloads.
- `map.html?session=...` for viewer-location voting from chat text.

If the page is blank, first send the matching payload. These pages are not all-purpose chat overlays.

See `docs/agents/07-overlays-and-pages/live-display-utilities.md`.

### What are `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html`?

These are specialized pages, not ordinary platform sources:

- `chat-overlay.html` redirects into `aioverlay.html` with `overlay=chat-overlay`.
- `minecraft.html` is a Minecraft-styled alert overlay using `multi-alerts.js`.
- `septapus.html` renders chat with YouTube-like DOM structure for CSS experiments.
- `shop_the_stream.html` is a product-list display surface using direct SSN WebSocket/API messages and `sessionId` or `streamid`.

Do not treat any of them as all-purpose chat capture pages. See `docs/agents/07-overlays-and-pages/specialized-legacy-pages.md`.

### Which helper pages are for testing, recovery, imports, replay, or Spotify?

Use the page that matches the support task:

- `createtestmessage.html?session=...` creates synthetic SSN chat/event payloads.
- `simple_api_client.html` is a minimal raw WebSocket/API smoke client.
- `replaymessages.html` replays locally stored chat history by time range.
- `recover.html` converts a `dock.html` URL into importable settings JSON.
- `urleditor.html` edits and saves overlay URLs in a browser UI.
- `streamelements-importer.html` exports a standalone OBS HTML file from StreamElements/Streamlabs widget files.
- `spotify-overlay.html?session=...&label=spotify` displays Spotify now-playing payloads.
- `test-giveaway-webrtc.html?session=...` tests local giveaway page communication.

Most of these are diagnostic or helper pages, not OBS outputs. The main exceptions are `spotify-overlay.html` and the HTML file exported by `streamelements-importer.html`. See `docs/agents/07-overlays-and-pages/diagnostic-helper-pages.md`.

### Why does chat stop after a while or when hidden?

Browser tabs/windows may throttle or stop JavaScript when minimized, hidden, discarded, or considered backgrounded. The README recommends keeping chat windows visible and active where possible. Even a small visible strip is often better than a minimized window.

Support steps:

- Do not minimize source chat windows.
- Keep chat scrolled to the newest messages.
- Check browser performance/background tab settings.
- Check `chrome://discards/` and turn off auto-discard for source pages.
- For Chromium, the README mentions disabling flags related to hidden cross-origin iframe throttling and native window occlusion when needed.
- Consider the standalone app for workflows that frequently hit browser throttling.

## Installing And Updating

### How do users manually install the extension?

High-level flow:

1. Download the current GitHub source archive.
2. Extract it to a folder.
3. Open the browser extensions page, such as `chrome://extensions/`.
4. Enable Developer Mode.
5. Load the extracted folder as an unpacked extension.
6. Reload chat pages after extension reload/install.

Do not tell users to uninstall as an update method unless they have exported settings first.

### How should users update without losing settings?

Replace the extension files and reload the extension/browser. Do not uninstall, because uninstalling deletes extension settings. If uninstall is unavoidable, export settings first and import them after reinstalling.

### Why does Manifest V2 show a warning?

The README says the Manifest V2 warning can be ignored for current function. Manifest V3 builds exist through the Chrome Web Store and GitHub branches, but MV3 has restrictions and may require a small browser tab to stay open.

## Platform Setup Answers

### Which sites are supported?

The README states 120+ sites, and `docs/js/sites.js` currently contains 139 public site cards. Focused metadata validation found duplicate `On24`/`ON24` cards, so treat 139 as a public-card count rather than a unique-live-platform count. The repo source files and manifest are the more complete implementation inventory.

The site metadata breaks down roughly as:

- 100 standard/open-page entries
- 23 popout entries
- 9 toggle-required entries
- 4 WebSocket-source entries
- 3 manual-pick entries

Always verify a specific site against the source file and manifest entry before promising exact support.

For a public setup lookup, use `docs/agents/08-platform-sources/supported-sites-lookup.md`. For what the listing proves and how strong a support claim can be, use `docs/agents/08-platform-sources/public-site-support-status.md`.

### Is this source file a normal chat parser or a helper?

Check `docs/agents/08-platform-sources/manual-static-and-helper-sources.md` before answering detailed questions about `sources/static/*`, `sources/inject/*`, `sources/autoreload.js`, `sources/capturevideo.js`, or `sources/grabvideo.js`.

Common examples:

- `sources/static/youtube_static.js` is a YouTube watch-page/static comment helper, not the main live chat parser.
- `sources/static/kick_chatroom_scout.js` scouts or seeds Kick chatroom IDs; it does not capture chat.
- `sources/static/twitch_points.js` can handle Twitch points/ad helper behavior; Twitch chat capture is separate.
- `sources/inject/*` files must be paired with their consumer content scripts before they produce SSN payloads.

### Is this WebSocket/API source page a capture source or an overlay?

It is a capture source. Pages under `sources/websocket/*.html` are setup/control pages that connect to a platform socket, API, or source service and then forward normalized SSN messages. They are not normal OBS overlays.

Use `docs/agents/08-platform-sources/websocket-source-pages.md` for Bilibili, IRC, Joystick, Nostr, Social Stream Chat, StageTEN, Streamlabs, Velora, VPZone, and shared WebSocket assets. YouTube, Twitch, Kick, Rumble, and Facebook WebSocket/API source pages route to their dedicated platform docs.

For send-back questions, do not assume support just because a source page exists. Bilibili, IRC, Joystick, Velora, and VPZone have inspected send paths; Nostr is read-only; Streamlabs is event ingestion; Social Stream Chat and StageTEN need source-checking before promising extension/API send-back.

### Is this embedded chat widget supported?

For CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, and Online Church, use `docs/agents/08-platform-sources/embedded-chat-widget-sources.md`.

Common checks:

- Exact widget/page URL matches the public setup and manifest.
- The widget has loaded and new messages are rendering.
- Chat is inside an iframe only when the manifest/source supports that path.
- The page was reloaded after SSN install/reload.
- The user is not expecting rich platform events or send-back.

Online Church can emit viewer updates when viewer-count or hype settings apply; KiwiIRC can mark traffic/system rows as events. Do not generalize that to all embedded widgets.

### How do Amazon Live, eBay Live, and Whatnot work?

Use `docs/agents/08-platform-sources/live-commerce-sources.md`.

Short version:

- Amazon Live is mostly rendered chat capture in the inspected source.
- eBay Live can emit rendered chat plus viewer, reaction, auction, commerce, and seller follower metadata where page data is available.
- Whatnot can capture rendered chat and also parse selected WebSocket frames through its injected interceptor.
- `shop_the_stream.html` is a display/control page, not the same thing as an Amazon/eBay/Whatnot source.
- Do not promise send-back from these source scripts.

When a user asks about products or auctions, ask whether they mean source capture, product-list display, API actions, or OBS overlay output.

### How do webinar and event sources work?

Use `docs/agents/08-platform-sources/webinar-and-event-sources.md` for Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, Wave Video, and WebinarGeek.

Common checks:

- Exact webinar/event URL matches the manifest.
- Chat, Q&A, or sidebar panel is open and visible.
- The page was reloaded after SSN install/reload.
- The user tests with a new message or question.
- For ON24, Q&A rows are marked with `question: true`.
- For Wave Video, messages may emit as the upstream platform type such as YouTube, Twitch, Facebook, Instagram, LinkedIn, or Amazon.
- For Riverside, check whether Riverside capture was disabled in settings.

Do not promise attendee lists, registrations, poll analytics, webinar analytics, or send-back from these source scripts.

### Can Social Stream Ninja do a specific feature?

Usually the answer depends on mode, source, and setup. Start with `docs/agents/13-reference/features-and-capabilities.md`, then route to the exact feature page.

High-level rules:

- Core chat capture, dock, featured overlay, URL/CSS customization, API control, Event Flow, polls/waitlist/giveaway/games, and custom overlays are part of SSN.
- AI, cloud TTS, payment/donation services, and some platform API modes can require third-party accounts, keys, quotas, or costs.
- Two-way chat, moderation, richer events, and reward/gift coverage are platform/mode-specific. Check the platform doc before promising support.

For games, route to `docs/agents/07-overlays-and-pages/game-pages.md`. Use `games.html?session=...` for Spam Power or `games/FILE.html?session=...` for individual mini-games. They still need a source on the same session, and each game has its own command or input rule. Most reset on reload, but Spam Power, Chicken Royale, and Phrase Guess have localStorage-backed state.

For prebuilt visual themes, route to `docs/agents/07-overlays-and-pages/theme-pages.md`. Normal chat themes render incoming chat, `themes/featured-styles/*` pages wait for selected/featured messages, and wrapper themes such as Pretty or Neutron embed `dock.html`.

### Where is a setting or toggle?

Start with `docs/settings.html` or `docs/agents/13-reference/settings-and-toggles.md`.

Use this support pattern:

1. Search the public settings reference for the setting name or behavior.
2. Confirm whether it is a persistent popup setting or a URL parameter.
3. If the user says it does not work, check whether the source page or overlay needs a reload.
4. Check whether another filter, opt-out, duplicate/relay, source toggle, or URL parameter is overriding the expected behavior.
5. Hide keys, webhooks, passwords, and session IDs in screenshots.

### YouTube is not working. What should I ask?

Ask which YouTube mode:

- Live chat DOM mode: use the YouTube popout chat, studio chat, guest view, or a supported `live_chat` URL.
- YouTube watch page shortcut: the README mentions adding `&socialstream` to the YouTube link.
- Static comments: click the SS control on YouTube and manually select comments.
- WebSocket/API mode: requires source-page setup and is the better route for richer events. Some YouTube events require WebSocket mode and Google API permissions.

Also check that the user reloaded the YouTube chat after extension reload and that permissions/auth are valid for sending chat or moderation actions.

For `youtube_static.js` helper behavior, use `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`.

### TikTok is not working. What should I ask?

Ask whether they are using extension capture or standalone/TikTok connector mode.

- Extension capture requires the TikTok live chat page to remain visible/open.
- App/connector workflows may use additional signing, connection manager, or fallback behavior from the standalone app.
- Donation/gift/member fields vary by capture mode and by what TikTok exposes.

Start with visibility, live status, account/session access, and whether the source page is being throttled.

### Twitch is not working. What should I ask?

Ask whether the user opened the Twitch popout chat. The README says Twitch requires popout chat to trigger extension capture.

Also determine whether they are using:

- DOM/popout mode
- WebSocket/source page mode
- Twitch IRC/WebSocket source
- Channel points/static helper scripts

For richer event coverage, WebSocket mode may be required.

For `sources/static/twitch_points.js`, use `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`; it is not the main Twitch chat parser.

### Kick is not working. What should I ask?

Ask which Kick URL and mode:

- Popout/chatroom page capture
- Source scout/static helper
- WebSocket source page
- Standalone app OAuth or WebSocket helper behavior

Kick event coverage can depend on WebSocket mode. Check the Kick-specific agent doc before answering details.

For `sources/static/kick_chatroom_scout.js`, use `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`; it scouts/cache-seeds chatroom IDs and does not capture chat.

### Discord, Slack, Telegram, WhatsApp, Google Meet, Teams, Zoom, Webex, Chime, or ChatGPT capture is not working. What is the common fix?

Many sensitive/private-message surfaces require an explicit settings toggle before SSN injects or captures from them. Tell the user to enable the relevant source toggle where one exists, then reload the site.

Also check:

- The user is using the web version of the service.
- The chat or meeting side panel is open and visible.
- They test with a new message, not only old history.
- Screenshots, URLs, channel names, workspace names, meeting IDs, DMs, and AI conversation content are redacted before support sharing.

For ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Teams, Zoom, Webex, and Chime, use `docs/agents/08-platform-sources/communication-and-sensitive-sources.md`. Do not promise send-back from these inspected source scripts; they expose `focusChat`, but no source-level `SEND_MESSAGE` handler was found in this pass.

### Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, or Stripchat capture is not working. What should I ask?

Start by confirming the exact live room/chat URL and that a visible chat panel is open. These source scripts capture rendered chat rows from the page, not a platform API.

Also check:

- The URL matches the manifest pattern for that site.
- The user reloaded the page after installing, updating, or reloading the extension.
- They tested with a new message, because several scripts skip preloaded history.
- They clarify whether they expect plain chat, token/tip rows, private messages, notices, viewer counts, or send-back.
- Screenshots and logs are redacted because room URLs, private-message text, usernames, and paid-room context can be sensitive.

For Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat, use `docs/agents/08-platform-sources/creator-live-cam-sources.md`. Do not promise send-back from these inspected source scripts; they expose `focusChat`, but no source-level `SEND_MESSAGE` handler was found in this pass.

### A smaller popout/chat-only platform is not working. What should I ask?

For Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, or VK chat-only paths, start with the exact URL. These sources usually need a chat-only URL, not the normal stream/video page.

Also check:

- The URL matches the public setup and manifest pattern.
- The chat list has actually loaded, and a new message was sent after SSN connected.
- The user is not expecting a platform API, full event coverage, or send-back from a DOM popout parser.
- Donation/tip and viewer-count support is source-specific. Chzzk, Parti, RokFin, Mixcloud, and VK Video have extra paths worth checking, but they still need live validation before exact field claims.
- For standalone app users, verify the app source window opens the chat-only URL and not the normal video page.

Use `docs/agents/08-platform-sources/popout-chat-only-sources.md` for the grouped source behavior.

### Arena Social, CI.ME, LinkedIn Events, Slido, or other event/community capture is not working. What should I ask?

Start with the exact URL and visible panel. These sources capture rendered event/community chat or question rows, not a full event API.

Also check:

- The source URL matches the public setup route and the manifest row.
- The chat, comments, UGC, or Q&A panel is visible.
- The user tested with a new rendered message or question after SSN connected.
- The user clarifies whether they expect plain chat, Q&A question flags, viewer counts, donations, upstream source type, or send-back.
- For LinkedIn, confirm the path is a live/event path, not an ordinary LinkedIn page.
- For LivePush, remember the payload type can be `twitch`, `youtube`, `facebook`, or `livepush` depending on the source icon.

Use `docs/agents/08-platform-sources/event-and-community-sources.md` for the grouped behavior and caveats.

### BandLab, Blaze, Locals, LFG, Loco, or another independent live platform is not working. What should I ask?

Start with the exact page URL and whether the chat panel is visibly rendering new rows. These sources are rendered-page DOM captures, not full platform APIs.

Also check:

- The URL matches the public setup and manifest row; Castr uses a chat-room URL, Locals and BandLab use broad domain/subdomain matches, and Loco has several domain forms.
- A new message appeared after SSN connected. Old history is not a reliable test.
- The user clarifies whether they expect plain chat, tips/donations, replies, viewer counts, joins, stickers/content images, or send-back.
- Blaze, LFG, and Locals have source-backed `viewer_update` paths, but only when the viewer-count/hype setting is enabled and the page exposes a parsable count.
- Cherry TV joined rows are forwarded, but gift/Lovense/VIP rows were only detected/logged in this pass, not confirmed as forwarded SSN events.
- DLive has a source file in this pass, but public/manifest routing still needs reconciliation before making a public support promise.

Use `docs/agents/08-platform-sources/independent-live-platform-sources.md` for the grouped behavior and caveats.

### Vimeo, Restream, PeerTube, Steam, Trovo, Truffle, or another video/broadcast source is not working. What should I ask?

Start with the exact supported URL and whether the chat panel is visibly rendering new rows. These sources are mostly rendered chat parsers, not full platform APIs.

Also check:

- The URL shape is correct: Steam uses chat-only broadcast URLs, PeerTube uses livechat plugin room URLs, Restream uses the Restream chat page, and OpenStreamingPlatform is documented here only for the manifest demo `chatOnly=True` URL.
- The user tested with a new message after SSN connected; old history may be skipped.
- Vimeo users clarify whether they expect normal chat or Q&A rows; Q&A can set `question: true`, but that is not full event analytics.
- Truffle and Restream users clarify whether they care about upstream platform identity; Truffle may emit `type: "twitch"` or `type: "youtube"`, while Restream may include `sourceImg`.
- PeerTube and Mixlr users confirm login/access/paywall state.
- Trovo and OpenStreamingPlatform are source/manifest-backed in this pass, but public-card routing still needs reconciliation.

Use `docs/agents/08-platform-sources/video-broadcast-platform-sources.md` for the grouped behavior and caveats.

### Patreon, Circle, Whop, Wix, Roll20, or another community/member web-app source is not working. What should I ask?

Start with the exact URL, the user access state, and whether a new message row appears after SSN connects. These sources capture rendered web-app pages; they are not official bot/API integrations.

Also check:

- Patreon requires the Patreon source toggle, then a page reload.
- NextCloud support is domain-specific in the current manifest; do not assume every NextCloud instance is supported.
- Wix normal live pages and embedded Wix/Annoto widgets use different source files but both emit `type: "wix"`.
- Current Workplace URL handling should start with the Facebook/Workplace DOM source; `sources/workplace.js` is legacy/unreferenced in this pass.
- Patreon, Simps, and Whop can emit viewer counts only when viewer-count/hype settings are enabled and the page exposes a parseable count.
- Tellonym may only provide message text, with no name/avatar.
- Community/member/game/workspace evidence should be redacted before sharing.

Use `docs/agents/08-platform-sources/community-membership-webapp-sources.md` for the grouped behavior and caveats.

### Bilibili, Favorited, Kwai, Pump.fun, SharePlay, Substack, Tikfinity, or another regional/emerging source is not working. What should I ask?

Start with the exact URL form and whether the chat/activity panel is visibly rendering new rows after SSN connects. These sources are mostly rendered-page captures or activity-feed ingests, not official platform APIs.

Also check:

- Bilibili.tv and live.bilibili.com use different source files and slightly different source identities.
- Pilled currently needs the `/comment/` URL path before its observer processes rows.
- Substack must be a live-stream URL, either with `liveStream=` or `/live-stream/`.
- Tikfinity is a read-only activity-feed ingest and emits TikTok-style SSN payloads; it is not a send-back target.
- SharePlay has extra shoutout and Blitz/raid behavior that should be tested separately from normal chat.
- Portal, Pump.fun, Retake, and Xeenon have viewer helper code, but viewer-count emission is not proven in the active inspected path.
- Crypto/trading, paid/community, app account, avatar, and tip evidence should be redacted before sharing.

Use `docs/agents/08-platform-sources/regional-and-emerging-platform-sources.md` for the grouped behavior and caveats.

### Joystick, Velora, VPZone, X, Vertical Pixel Zone, or a top-level YouTube helper is confusing. What should I ask?

First separate the mode:

- Joystick, Velora, and VPZone rendered website scripts are not the same as their WebSocket/API source pages.
- Joystick/Velora/VPZone send-back belongs to the source-page/API path, not the rendered website DOM scripts.
- VPZone site capture can use both a WebSocket interceptor and DOM fallback; duplicates suggest checking whether WebSocket capture suppressed DOM rows.
- X live chat uses `sources/x.js`; static/manual X post grabbing uses `sources/static/x.js`.
- The `detweet` setting changes X payload/source identity to `twitter`.
- `sources/youtube_comments.js` and top-level `sources/youtube_static.js` are not manifest-loaded in the current matrix; normal YouTube live chat starts with `sources/youtube.js`.
- Vertical Pixel Zone has a source identity caveat: `getSource` returns `verticalpixelzone`, while inspected payloads use `type: "arena"`.

Use `docs/agents/08-platform-sources/special-case-platform-and-helper-sources.md` for the grouped behavior and caveats.

## Customization

### How do users customize the overlay quickly?

Common simple URL parameters:

- `&lightmode` or `&darkmode`
- `&scale=1.5`
- `&compact`
- `&font=FONTNAME`
- `&speech=en-US`
- `&hidesource`
- `&showtime=10000`
- `&transparent`
- `&limit=100`

For the full parameter inventory, see `parameters.md`.

### How should users add custom CSS?

Options:

- Add CSS through the OBS browser-source custom CSS field.
- Use URL parameters such as `&css=...` or base64 CSS parameters.
- Use hosted/forked pages for durable custom templates.
- Use local pages on Windows when local-file behavior works for the workflow.

The README notes OBS local-file CSS limitations on macOS/Linux. For those systems, prefer the OBS browser-source CSS field or hosted pages.

### Can users build a custom overlay from scratch?

Yes. The README points to `sampleoverlay` as a minimal HTML overlay. It can be used as a featured-message overlay or all-message dock alternative depending on the template mode.

Use custom overlays when the user wants full layout/rendering control. Use URL parameters/CSS first when they only need styling changes.

## Commands, API, And Automation

### What built-in chat commands exist?

Current public command docs list at least:

- `!joke`: sends a random geeky dad joke when enabled.
- `hi`: welcomes users who say hi when enabled.
- `!cycle`: can cycle OBS scenes when OBS remote support and permissions are configured.

Do not assume every command is enabled by default. Many command features require toggles in the extension/app settings or URL parameters.

### How can StreamDeck or Companion control SSN?

Enable remote API control, then use either:

- HTTP GET commands such as `https://io.socialstream.ninja/SESSIONID/clearOverlay`
- WebSocket commands to `wss://io.socialstream.ninja/join/SESSIONID`
- Bitfocus Companion's Social Stream Ninja module

Common actions include `clearOverlay`, `nextInQueue`, `autoShow`, `sendChat`, `sendEncodedChat`, poll controls, waitlist controls, and TTS controls.

See `docs/agents/09-api-and-integrations/websocket-http-api.md` and `streamdeck-companion.md`.

### How can an external app receive chat?

Enable both:

- `Enable remote API control of extension`
- `Send chat messages to API server`

Then connect to channel 4:

```text
wss://io.socialstream.ninja/join/SESSION_ID/4
```

Chat messages normally include `chatname`, `chatmessage`, and `type`.

### Are donation webhooks secure?

Treat webhook URLs and session IDs as secrets. The API docs state webhook URLs do not use signature verification, so anyone with the session ID/webhook URL can send fake donation events.

Supported webhook paths documented in `api.md` include Stripe, Ko-Fi, Buy Me A Coffee, and Fourthwall.

## TTS And AI

### Which TTS options are free?

- System/browser TTS is free but harder to capture in OBS because it may play through system audio.
- Kokoro is described in README as browser-based free/premium-quality TTS but can require a powerful computer.
- Cloud providers such as Google Cloud, ElevenLabs, Speechify, Gemini, and OpenAI-compatible endpoints may require accounts, keys, paid usage, or local hosting depending on provider.

### Does SSN support AI?

Yes. Public docs mention Ollama/local AI and premium AI services for chatbot/moderation/cohost workflows. AI features are optional and depend on settings, local model availability, or API keys.

When answering exact provider/setup questions, check `docs/commands.html`, `docs/agents/09-api-and-integrations/ai-features.md`, and the current settings definitions/code.

## Custom Plugins, Scripts, And New Integrations

### Can users make their own plugin?

The public wording says SSN has scriptable plugin/custom logic support, but for support answers be precise:

- There is no single packaged "plugin marketplace" flow documented for normal users.
- Users can customize behavior with URL parameters, CSS, custom overlays, API integrations, `custom.js`, uploaded custom user functions, and custom sources.
- Developers can add a real source by adding a content script/source file and manifest entries.

### What is `custom.js`?

`custom_sample.js` can be renamed to `custom.js`. It is for local dock/featured-page behavior such as `applyCustomActions(data)` and `applyCustomFeatureActions(data)`.

Important limitation: the sample says the local file path must be used for the dock to load local `custom.js`. Hosted `https://socialstream.ninja/dock.html` will not load a local `custom.js`.

### What is `custom_actions.js`?

`custom_actions.js` is an uploaded custom user-function template. It defines:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

When custom JS is enabled, the background processing path calls `customUserFunction(data)`. Returning modified data continues processing; returning `false` can block a message in the template examples.

### Can users request a new site?

Yes, through GitHub issues or Discord. The README says requests are not guaranteed. Steve generally prioritizes publicly accessible social chat sites with meaningful communities, but support can be declined or left to forks when legal, quality, or maintenance concerns exist. Steve does not accept payment for adding integrations or support.

## Support Etiquette And Escalation

### Where should users get support?

The public support path is Discord:

```text
https://discord.socialstream.ninja
```

The README names `#chat.overlay-support` for free support. GitHub issues are also appropriate for bugs and feature requests.

### What should an agent collect before escalating?

Collect:

- Surface: extension, standalone app, hosted page, local page, Lite.
- Browser/app version and install path.
- Session ID match confirmation, but do not ask for a private session ID unless necessary.
- Platform/source URL pattern and whether it is popout, standard, toggle-required, manual, or WebSocket mode.
- Relevant toggles enabled.
- OBS/browser-source URL when the problem is overlay display.
- Console errors or screenshots, if available.
- Whether the source works in a clean browser profile.

Do not promise fixes for platform breakages without checking current code/issues, because supported sites can change or break when third-party platforms change.
