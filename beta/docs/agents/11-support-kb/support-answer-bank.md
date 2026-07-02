# Support Answer Bank

Status: heavy support-answer pass from current agent docs, public docs, source inventories, and support-mining summaries on 2026-06-24.

Use this page when an AI agent needs a short, practical answer to a common SSN support question. For first-stop routing by user intent, start with `question-intent-router.md` or `docs/agents/11-support-kb/index.md`. For a compact "answer shape, must-check, do-not-say" matrix, use `common-question-fast-path.md`. For command/option/setting/mode confusion, use `../13-reference/control-surface-crosswalk.md`. For paraphrased real-world wording patterns, use `support-question-phrasebook.md`. For ready-to-send support templates, use `support-response-playbook.md`. For SSN-filtered macro-style replies from curated support playbooks, use `support-macro-routing.md`. For evidence-strength and runtime-proof status, use `common-question-evidence-status.md`. For what proof is required before stronger answers, use `common-question-proof-pack.md`. For coverage auditing across the whole docs objective, use `common-question-coverage-map.md`. These are answer patterns, not final proof. For fragile platform behavior, follow the linked source docs before making a hard claim.

## Ground Rules For Answers

- Start with the direct answer.
- Mention the mode or surface: extension, standalone app, hosted page, local page, Lite, API, or WebSocket source.
- For broad claims, check `common-misconceptions-and-boundaries.md` and `../13-reference/public-claims-boundary-matrix.md` before answering.
- Do not promise platform-specific send-chat, reward, gift, moderation, or auth support without checking the platform page/source.
- Treat session IDs, passwords, API keys, webhook URLs, OAuth data, and private endpoints as secrets.
- Say "SSN integrates with that provider" when an external provider controls pricing, accounts, quotas, or limits.
- For app/Electron issues, do not call something tested unless real in-app/e2e testing was done.

## Product Basics

| User Question | Short Answer | Route To |
| --- | --- | --- |
| What is Social Stream Ninja? | SSN captures live chat and stream events from supported sources and sends them to dock, overlay, API, TTS, AI, and automation surfaces. | `01-product-map.md` |
| Is SSN free? | Yes, SSN itself is free and open source. Third-party AI, TTS, payment, graphics, or platform services can still cost money. | `13-reference/free-paid-and-support-boundaries.md`, `13-reference/public-claims-boundary-matrix.md` |
| Is support paid? | No. Support is best-effort through Discord, GitHub, and docs. Donations are gifts, not service contracts. | `13-reference/support-resources-and-escalation.md` |
| Should I use the extension or app? | Use the extension for normal browser sessions and cookies. Use the app for managed source windows or when browser throttling is a problem. | `13-reference/modes-and-capability-matrix.md` |
| Does Lite have all features? | No. Lite is for lightweight workflows and does not have full extension/app parity. | `02-installation-and-surfaces.md` |
| Can I use Firefox? | Sometimes. Firefox support exists, but some Chromium-only features are limited or missing. Reproduce in Chrome when diagnosing those features. | `13-reference/modes-and-capability-matrix.md` |

## Installation And Updates

| User Question | Short Answer | Route To |
| --- | --- | --- |
| How do I manually install the extension? | Download the repo/source archive, extract it to a stable folder, open the browser extensions page, enable Developer Mode, Load unpacked, then reload source chat pages. | `13-reference/how-to-recipes.md` |
| Should I uninstall to update? | No, not unless settings are exported first. Uninstalling can delete extension settings. Replace files and reload the extension instead. | `10-troubleshooting/settings-loss-and-backups.md` |
| Why is the Chrome Web Store version behind GitHub? | Store review can lag behind GitHub. Use manual install when the latest source fixes are needed. | `02-installation-and-surfaces.md` |
| Can I move the unpacked extension folder? | Avoid moving it after loading; the browser points at that folder. If moved, reload the extension from the new path. | `02-installation-and-surfaces.md` |
| Do I need to distribute a zip for these AI docs? | No. The AI docs live directly under `docs/agents` in the repo and are meant as working markdown, not a packaged release artifact. | `AGENT.md` |

## Capture Troubleshooting

| User Question | Short Answer | Route To |
| --- | --- | --- |
| Chat is not appearing anywhere. | First confirm SSN is enabled, reload the source page after extension reload/install, verify the source URL/mode, keep chat visible, and confirm the session ID matches. | `10-troubleshooting/diagnostic-decision-tree.md` |
| The dock opens but has no messages. | It is usually a source/session problem: source not capturing, wrong session, unsupported URL, missing source toggle, hidden/throttled page, or extension off. | `10-troubleshooting/extension-not-capturing.md` |
| OBS overlay is blank but dock works. | Test the overlay URL in a normal browser, check session ID, refresh OBS browser source, and verify transparency/CSS is not hiding content. | `10-troubleshooting/obs-overlay-display.md` |
| Chat stops when minimized or hidden. | Browser tabs can throttle hidden/minimized pages. Keep source chat visible or try the standalone app/WebSocket source mode where available. | `13-reference/modes-and-capability-matrix.md` |
| The platform is listed but not working. | "Supported" still depends on exact URL, mode, surface, and feature. Check whether it is standard, popout, toggle, manual, or WebSocket setup before promising more. | `08-platform-sources/public-site-support-status.md` |
| A private/sensitive page is not captured. | Many sensitive sources require an explicit toggle before capture. Enable the source toggle, reload the site, keep the chat panel open, and redact private page details. | `08-platform-sources/communication-and-sensitive-sources.md` |

## Platform Quick Answers

| Platform | First Answer | Route To |
| --- | --- | --- |
| YouTube | Ask DOM popout/studio/watch/static comments vs WebSocket/API mode. Reload chat after extension reload and check API mode for richer events. | `08-platform-sources/youtube.md` |
| TikTok | Ask extension DOM mode vs standalone connector/app mode. Check live status, username, visibility, app version, and signing/connector path. | `08-platform-sources/tiktok.md` |
| Twitch | Twitch commonly needs popout chat for DOM capture. WebSocket/EventSub mode is the path for richer events such as channel points and raids. | `08-platform-sources/twitch.md` |
| Kick | Ask chatroom/popout vs WebSocket source vs app/OAuth helper mode. Login/CAPTCHA/source mode often decides success. | `08-platform-sources/kick.md` |
| Rumble | DOM and API/source paths differ. API source is useful for read workflows; do not promise send-chat without checking current source. | `08-platform-sources/rumble.md` |
| Facebook | Viewer/page/producer context matters. Managed Page API/Graph paths differ from DOM capture. | `08-platform-sources/facebook.md` |
| Instagram | Ask live vs post/feed comments. These are different source paths and payload types. | `08-platform-sources/instagram.md` |
| Discord | Confirm the Discord source toggle, web Discord access, channel/page visibility, and privacy boundary. | `08-platform-sources/discord.md` |
| Communication/private sources | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, and Chime are rendered web-page captures. Check web version, toggle where required, reload, chat panel visibility, and do not promise send-back. | `08-platform-sources/communication-and-sensitive-sources.md` |
| Static/manual/helper scripts | Some source files are helpers, not live chat parsers. Check whether it is manual capture, a page helper, a WebSocket interceptor, Kick scout, Twitch points/ad helper, or VDO media publisher. | `08-platform-sources/manual-static-and-helper-sources.md` |
| WebSocket/API source pages | These are source setup pages, not OBS overlays. Check source-page connection, room/channel/token/OAuth setup, and whether the inspected bridge supports send-back. | `08-platform-sources/websocket-source-pages.md` |
| Embedded chat widgets | CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, and Online Church are rendered widget/page captures. Check exact widget URL, iframe/all-frame behavior, new-message rendering, and do not promise send-back. | `08-platform-sources/embedded-chat-widget-sources.md` |
| Live commerce | Amazon Live is mostly rendered chat capture; eBay and Whatnot can emit selected viewer, reaction, auction, product, giveaway, tip, raid, or commerce metadata. Check exact mode before promising fields. | `08-platform-sources/live-commerce-sources.md` |
| Webinars/events | Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, and WebinarGeek are rendered event-page captures. Check chat/Q&A/sidebar visibility and do not promise analytics or send-back. | `08-platform-sources/webinar-and-event-sources.md` |
| Creator/live-cam sources | Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat are rendered room/chat captures. Check exact URL, visible chat, token/tip/private-message expectations, and do not promise send-back. | `08-platform-sources/creator-live-cam-sources.md` |
| Popout/chat-only sources | Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, and VK chat paths usually require the exact popout/chat-only URL. Check URL shape before debugging selectors. | `08-platform-sources/popout-chat-only-sources.md` |
| Event/community sources | Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, and TradingView are rendered event/community captures. Confirm exact URL, visible chat/Q&A panel, and source-specific extras before promising fields. | `08-platform-sources/event-and-community-sources.md` |
| Independent live platform sources | BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, and Loco.gg are rendered-page captures. Confirm exact URL, visible chat, new rows, and source-specific viewer/tip/reply/join behavior before promising fields. | `08-platform-sources/independent-live-platform-sources.md` |
| Video/broadcast platform sources | Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, and Zap.stream are mostly rendered chat captures. Confirm exact URL shape, visible chat, new rows, and source-specific Q&A/upstream-type/source-icon/login caveats. | `08-platform-sources/video-broadcast-platform-sources.md` |
| Community/membership web-app sources | Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, and Workplace legacy routing are rendered page captures. Confirm login/membership access, exact URL, visible chat/message panel, toggles where required, and privacy redaction. | `08-platform-sources/community-membership-webapp-sources.md` |
| Regional/emerging platform sources | Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, and Xeenon are rendered-page or activity-feed captures. Confirm exact URL form, visible chat/activity panel, new rows, and source-specific viewer/tip/raid/join behavior before promising fields. | `08-platform-sources/regional-and-emerging-platform-sources.md` |
| Special-case platform/helper sources | Joystick, Velora, and VPZone have separate rendered-site and source-page/API paths; X live chat is separate from X static/manual capture; top-level YouTube helper copies are not current manifest-loaded live chat routes. Confirm mode and exact URL before troubleshooting. | `08-platform-sources/special-case-platform-and-helper-sources.md` |

## OBS And Overlays

| User Question | Short Answer | Route To |
| --- | --- | --- |
| How do I add chat to OBS? | Add `dock.html?session=...` or `featured.html?session=...` as an OBS browser source, using the same session as the source side. | `13-reference/how-to-recipes.md` |
| Which SSN URL should I open? | Pick the page by job: dock for control, featured for selected messages, source pages for capture/API setup, sampleapi for API tests, and actions for Event Flow output. | `13-reference/surface-url-cheatsheet.md` |
| Which page supports polls, timers, giveaways, alerts, tip jar, credits, Event Flow output, or cohost overlays? | Use the page capability matrix. It states the target page, what else must be open, whether it belongs in OBS, and the first failure check. | `07-overlays-and-pages/page-capability-matrix.md` |
| How do SSN chat games work? | Open `games.html?session=...` for Spam Power or `games/FILE.html?session=...` for a specific mini-game, then keep a source side open on the same session. Each game has its own command or input pattern. | `07-overlays-and-pages/game-pages.md` |
| Why does a chat game ignore messages? | Check the same session first, then check the exact input: many games require a command, color, plant word, emoji, coordinate, beat word, or valid chained word instead of any random chat. | `07-overlays-and-pages/game-pages.md` |
| Can game bot responses send to real platform chat? | Do not assume that. Most game responses are page-local `postMessage` output; real platform send-back depends on the specific page, send mode, source, and platform support. | `07-overlays-and-pages/game-pages.md` |
| How do I reset a chat game? | Most reset on reload. Clear localStorage for persistent exceptions: Spam Power history, `chickenRoyaleDinners`, `ssnPhraseGameSettings`, or `ssnPhrases`. | `07-overlays-and-pages/game-pages.md` |
| Why is my tip jar or credits roll empty? | Check that the page is open on the same session, that the source/webhook emits donation/supporter payloads, and that filters or persistence are not hiding data. | `07-overlays-and-pages/tipjar-credits.md` |
| Why is my word cloud blank? | Use `wordcloud.html?session=...`, keep the source side on the same session, and test with a one-word chat message. Add `allwords` if viewers type full sentences. | `07-overlays-and-pages/event-effect-overlays.md` |
| Why is my leaderboard empty or stale? | Confirm incoming payloads include `chatname` and `type`, check the selected ranking mode, and clear or disable `persistdata` if old names keep returning. | `07-overlays-and-pages/event-effect-overlays.md` |
| Why is my hype/viewer counter blank? | `hype.html` needs hype or viewer-count payloads, not ordinary chat. Confirm the source/app can send viewer counts and that the same session is used. | `07-overlays-and-pages/event-effect-overlays.md` |
| Why does confetti not fire? | `confetti.html` only reacts to waitlist draw winner state. Make sure the waitlist draw is running and sending `drawmode` plus winner payloads. | `07-overlays-and-pages/event-effect-overlays.md` |
| Should I use `events.html` or `multi-alerts.html`? | Use `multi-alerts.html` for animated alert popups. Use `events.html` for an event log/dashboard with metadata and filters. | `07-overlays-and-pages/event-effect-overlays.md` |
| Why is my emotes overlay blank? | `emotes.html` needs chat messages containing emoji, image emotes, or SVG emotes. Plain text messages will not visibly trigger it. | `07-overlays-and-pages/live-display-utilities.md` |
| Why do reactions not show? | `reactions.html` ignores ordinary chat. It needs event names `reaction`, `liked`, or `like`, and that support depends on the source/platform mode. | `07-overlays-and-pages/live-display-utilities.md` |
| Why is my scoreboard waiting for points? | Send a `points_leaderboard` snapshot, or enable local scoring with `chatpoints`, `donationpoints`, or `customtriggers`. | `07-overlays-and-pages/live-display-utilities.md` |
| Why does ticker not update? | `ticker.html` only reacts to a top-level `ticker` payload. Send `ticker` as a string, newline-separated string, or array. | `07-overlays-and-pages/live-display-utilities.md` |
| Why does the map ignore chat? | Test with a simple country name first, confirm the map is not paused/disabled, and check `allowchanges` or multi-vote settings if users repeat answers. | `07-overlays-and-pages/live-display-utilities.md` |
| What is `chat-overlay.html`? | It is a redirect helper that opens `aioverlay.html` with `overlay=chat-overlay`; debug the generated overlay runtime, not the wrapper. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| Is `minecraft.html` a Minecraft chat integration? | No. It is a Minecraft-styled alert overlay powered by `multi-alerts.js`; use normal source/event troubleshooting. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| What is `septapus.html` for? | It renders chat in a YouTube-like DOM so YouTube-style CSS can be applied. It is not the operator dock and does not support every dock option. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| Why does `shop_the_stream.html` not connect? | Use `sessionId` or `streamid` in the URL, check the WebSocket channel pair, and send `displayProductList`/`hideProductList` actions or supported chat commands. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| Does Amazon/eBay/Whatnot automatically power product overlays? | Not automatically. Source capture and product-list display are separate paths; validate the source payload and the target `shop_the_stream.html` or API action. | `08-platform-sources/live-commerce-sources.md` |
| How do I send a fake test message or event? | Use `createtestmessage.html?session=...`. For normal testing choose Extension API ingest and enable remote API control; direct modes need the matching server/channel target. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Is `simple_api_client.html` the main API test page? | No. It is a tiny WebSocket smoke client. Use `sampleapi.html` and the API docs for broad command testing. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| How do I replay old chat messages? | Use `replaymessages.html`, but treat stored chat history as private and test on a safe session. Extension replay uses local message history; Electron replay is limited unless verified. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Can I recover settings from an old dock URL? | Use `recover.html` to convert URL params into an importable `.data` settings file. It cannot recover settings that were not in the URL. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Can I edit a long overlay URL without hand-editing query params? | Use `urleditor.html`, then verify the target page actually supports the chosen parameters. The editor catalog may lag generated config. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Can I use a StreamElements or Streamlabs chat widget with SSN? | Use `streamelements-importer.html` to create a standalone OBS HTML file. Put the exported file in OBS, not the importer page. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| How do I show Spotify now playing? | Use `spotify-overlay.html?session=...&label=spotify` and make sure a Spotify payload sender is feeding that session/label. Ordinary chat will not display. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| How do I test giveaway page sync? | Use `test-giveaway-webrtc.html?session=...` with `giveaway.html` and `giveaway-obs-entries.html` in the same browser context. It tests local sync, not entrant capture. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| How do I show only selected messages? | Use the dock to select/feature messages and add `featured.html?session=...` to OBS. | `07-overlays-and-pages/featured.md` |
| How do I use a prebuilt chat theme? | Open a theme URL such as `themes/compact-clean.html?session=...` or `themes/t3nk3y/?session=...`. Keep the source side on the same session. | `07-overlays-and-pages/theme-pages.md` |
| Why is a featured-style theme blank? | `themes/featured-styles/*` pages wait for a selected/featured message. Confirm dock can see chat, then feature a message or send a known featured payload. | `07-overlays-and-pages/theme-pages.md` |
| Why does a theme work in Chrome but not OBS? | Prefer hosted theme URLs first. For local files in OBS v31, iframe restrictions can break VDO mode; use `server`/`localserver&server` only when that theme supports it. | `07-overlays-and-pages/theme-pages.md` |
| How do I make the overlay transparent? | Use transparent page/settings where supported and OBS browser source transparency. Check CSS if content disappears. | `13-reference/url-parameter-index.md` |
| Can I have multiple overlays? | Yes. Use the same session for shared data and `&label=...` when API commands need to target a specific page. | `13-reference/url-parameters.md` |
| Can I use custom CSS? | Yes. Use OBS custom CSS, URL CSS parameters, or a custom overlay. Avoid editing core source for normal styling. | `13-reference/customization-path-decision-matrix.md`, `07-overlays-and-pages/custom-overlays.md` |
| Can hosted pages load my local custom JS? | No, not as a normal local disk file. Use local/forked pages or trusted hosted custom code paths. | `13-reference/customization-path-decision-matrix.md`, `13-reference/custom-plugins-and-extensions.md` |

## API, Commands, And Automation

| User Question | Short Answer | Route To |
| --- | --- | --- |
| What command clears the overlay? | Use API action `clearOverlay` for featured/overlay output. Use `clear` or `clearAll` for page/dock clearing where supported. | `13-reference/action-command-index.md` |
| What command features the next queued message? | Use `nextInQueue` against the dock/session. The dock must be open and connected to the right session/server path. | `13-reference/action-command-index.md` |
| How do I send chat from API? | Use `sendChat` or `sendEncodedChat`; platform send-back support, login, and permissions still matter. | `13-reference/action-command-index.md` |
| Can a WebSocket source page reply to chat? | It depends. Bilibili, IRC, Joystick, Velora, and VPZone have inspected send paths; Nostr is read-only; Streamlabs is event ingestion; other pages need source-checking. | `08-platform-sources/websocket-source-pages.md` |
| How do I receive chat in my app? | Enable remote API control and Send chat messages to API server, then listen on WebSocket channel 4. | `09-api-and-integrations/websocket-http-api.md` |
| Why does my API command do nothing? | Check remote API toggle, session ID, target page open/connected, correct channel, URL encoding, and page label. | `09-api-and-integrations/websocket-http-api.md` |
| Why does a tool page or Event Flow output do nothing? | Check whether the target page is open, on the same session, and is the right page family for that action. Event Flow media/audio/text needs `actions.html`. | `07-overlays-and-pages/page-capability-matrix.md` |
| Is `!joke` an API command? | No. It is a viewer chat command. API actions, viewer commands, URL parameters, and Event Flow actions are different systems. | `13-reference/commands-and-actions.md` |
| Can StreamDeck control SSN? | Yes. Use HTTP GET buttons or Bitfocus Companion with the SSN session and remote API enabled. | `09-api-and-integrations/streamdeck-companion.md` |
| Can Streamer.bot control SSN? | Yes, through the SSN API/WebSocket routes and Streamer.bot setup. | `09-api-and-integrations/streamerbot.md` |
| Can Event Flow automate this? | Often yes. Event Flow supports triggers, actions, state nodes, OBS, TTS, media, webhooks, and custom JS where supported. | `09-api-and-integrations/event-flow-editor.md` |
| Does Kick chatroom scout capture chat? | No. It only helps find or seed Kick chatroom IDs for bridge/WebSocket workflows. Use Kick source troubleshooting for actual chat capture. | `08-platform-sources/manual-static-and-helper-sources.md` |
| Why did Twitch send ad alerts but no chat? | The Twitch points helper can emit ad-break helper events. Twitch chat capture is a separate source path. | `08-platform-sources/manual-static-and-helper-sources.md` |
| Why does YouTube static capture not catch live chat? | `youtube_static.js` is a watch-page/static comment helper. Use YouTube live chat or WebSocket/API mode for live chat. | `08-platform-sources/manual-static-and-helper-sources.md` |

## TTS And AI

| User Question | Short Answer | Route To |
| --- | --- | --- |
| Can SSN read chat aloud? | Yes. Built-in/system TTS and provider-backed TTS paths exist. OBS audio capture depends on the chosen path. | `09-api-and-integrations/tts.md` |
| Is TTS free? | System/browser TTS is generally free. Cloud/provider TTS can require accounts, keys, quotas, or payment. | `13-reference/free-paid-and-support-boundaries.md` |
| Can I use ElevenLabs/Google/Speechify/Gemini/OpenAI TTS? | SSN has provider integrations, but each provider controls account access, keys, pricing, and limits. | `09-api-and-integrations/tts.md` |
| Can SSN run a chatbot? | Yes, if chatbot/AI settings are configured. Local and cloud provider paths have different costs, privacy, and performance. | `09-api-and-integrations/ai-features.md` |
| Which AI/cohost page do I need? | Use `cohost.html` for the control/conversation page, `cohost-overlay.html` for OBS stage output, `aiprompt.html` to build generated overlays, and `aioverlay.html` to display saved generated overlays. | `07-overlays-and-pages/ai-cohost-pages.md` |
| Can AI moderate or censor chat reliably? | Treat it as best-effort automation, not guaranteed moderation. Source-check exact settings and warn about AI mistakes. | `09-api-and-integrations/ai-features.md` |
| Can I add custom knowledge? | Yes where the current AI/RAG settings support it, but users should not paste private data into public support channels. | `09-api-and-integrations/ai-features.md` |

## Customization And Development

| User Question | Short Answer | Route To |
| --- | --- | --- |
| Can I make a plugin? | Be precise: SSN supports custom overlays, API clients, Event Flow, custom JS hooks, uploaded user functions, and custom sources. It is not primarily a one-click plugin marketplace. | `13-reference/customization-path-decision-matrix.md`, `13-reference/custom-plugins-and-extensions.md` |
| How do I add a new platform? | Add or modify a source script, update manifest/docs/site metadata, preserve event contracts, and test extension/app behavior. | `12-development/adding-a-source.md` |
| Should I edit `ssapp/resources/social_stream_fallback`? | No. It is disposable/rebuilt fallback content, not the source of truth. Edit `social_stream` source instead. | `04-standalone-app-architecture.md` |
| Can I change the event payload shape? | Only carefully. `docs/event-reference.html` is the payload vocabulary anchor and should be updated when fields change. | `05-message-flow-and-event-contracts.md` |
| Can I load remote scripts in extension code? | No. Extension executable code should stay packaged/local. Remote fetches can load data/assets, not executable logic. | `12-development/shared-code-rules.md` |

## Settings And URL Parameters

| User Question | Short Answer | Route To |
| --- | --- | --- |
| Is this a setting or URL parameter? | Popup settings persist. URL parameters affect a page at load time. Some changes need a reload or source/window refresh. | `13-reference/settings-and-toggles.md`, `13-reference/settings-change-impact-matrix.md` |
| What is the exact setting key? | Use the generated setting key index. It lists 327 popup setting keys from current shared config. | `13-reference/settings-key-index.md` |
| What is the exact URL parameter? | Use the generated URL parameter index. It lists 255 generated URL parameter entries and notes current duplicate alias findings for `password` and normalized `strokecolor`. | `13-reference/url-parameter-index.md` |
| Why did changing a URL not affect the page? | Many URL parameters are read at page load. Refresh the target page and confirm the parameter belongs to that page. | `13-reference/url-parameters.md` |
| Can I share my settings screenshot? | Hide session IDs, passwords, API keys, webhooks, private endpoints, and user/channel identifiers where possible. | `13-reference/settings-and-toggles.md` |

## Security And Privacy

For detailed redaction rules, webhook/security caveats, settings-export handling, private-source guidance, and secret leak response, use `13-reference/privacy-security-and-secrets.md`.

| User Question | Short Answer | Route To |
| --- | --- | --- |
| Is my session ID secret? | Treat it as private if it controls overlays, API commands, or webhooks. | `13-reference/free-paid-and-support-boundaries.md` |
| Are donation webhook URLs safe to share? | No. Public docs say these webhook paths do not verify platform signatures; anyone with the URL may spoof events. | `13-reference/free-paid-and-support-boundaries.md` |
| Should I share API keys in Discord? | No. Redact keys, tokens, webhooks, private endpoints, passwords, and OAuth data. | `13-reference/support-resources-and-escalation.md` |
| Does SSN bypass platform restrictions? | No. Do not advise users to bypass paywalls, login restrictions, anti-bot systems, or privacy boundaries. | `13-reference/free-paid-and-support-boundaries.md` |

## Escalation Answers

| Situation | What To Collect |
| --- | --- |
| Platform capture broken for many users | Platform, exact URL/mode, extension/app version, browser/app version, whether source file still injects, console errors if available. |
| One user's setup broken | Session consistency, extension on/off, source page URL, source visibility, toggles, OBS/browser test, isolated profile test. |
| Desktop app issue | App version, OS, source type, app logs/console, whether it reproduces in extension, and whether real in-app testing was done. |
| API/automation issue | Session ID redacted, action name, transport, target label, page open/connected status, API toggles, channel number. |
| AI/TTS issue | Provider, local/cloud path, setting keys, browser/app mode, console errors, whether keys/endpoints were redacted. |

## Bad Answers To Avoid

- "It works on all platforms" when feature support is platform/mode-specific.
- "Everything is free" without third-party provider boundaries.
- "Use the app; it fixes all login problems."
- "Send me your session ID/API key/webhook URL."
- "Uninstall and reinstall" without export/backup warnings.
- "Edit the fallback folder" for app source behavior.
- "This was tested" when only static checks or source inspection were done.
