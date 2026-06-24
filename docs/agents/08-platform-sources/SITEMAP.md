# Platform Sources Sitemap

Status: generated folder sitemap on 2026-06-24 for docs/agents/08-platform-sources.

Use this file to navigate this folder without scanning the filesystem.

- [Agent docs sitemap](../SITEMAP.md)
- [Master agent index](../99-agent-index.md)

## Files

- [Communication And Sensitive Sources](../08-platform-sources/communication-and-sensitive-sources.md) - Use this page when a user asks about ChatGPT/OpenAI page capture, Slack, Telegram, WhatsApp, Google Meet, Microsoft Teams, Zoom, Webex, or Amazon Chime.
- [Community Membership Web-App Sources](../08-platform-sources/community-membership-webapp-sources.md) - Use this page for community, membership, collaboration, and web-app chat sources that are not dedicated platform docs.
- [Creator Live-Cam Sources](../08-platform-sources/creator-live-cam-sources.md) - Use this page for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat support questions. These are rendered page chat captures, not platform APIs.
- [Discord Source](../08-platform-sources/discord.md) - Document Discord as an SSN platform source. This is separate from Discord support-history mining in stevesbot; that support archive is a data source for documentation, not the same thing as SSN's Discord capture script.
- [Embedded Chat Widget Sources](../08-platform-sources/embedded-chat-widget-sources.md) - Use this page when a user asks about CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, or Online Church.
- [Event And Community Sources](../08-platform-sources/event-and-community-sources.md) - Use this page for event, community, and niche live-page sources that are not covered by the high-volume platform docs, webinar/event doc, or popout/chat-only doc.
- [Facebook Source](../08-platform-sources/facebook.md) - Document SSN's Facebook capture paths: DOM capture on Facebook/Workplace pages and the managed Page Graph API bridge.
- [Generic And Custom Sources](../08-platform-sources/generic-and-custom-sources.md) - - sources/generic.js
- [Independent Live Platform Sources](../08-platform-sources/independent-live-platform-sources.md) - Use this page for smaller independent live/chat platforms that are not yet large enough for a dedicated platform doc but have source-backed behavior beyond a simple inventory row.
- [Platform Sources Index](../08-platform-sources/index.md) - This section tracks platform-specific source capture behavior.
- [Instagram Source](../08-platform-sources/instagram.md) - Document SSN's Instagram and Instagram Live content scripts. Instagram has multiple source files because feed/comment capture and live-chat capture have different DOM behavior.
- [Kick Source](../08-platform-sources/kick.md) - Document Kick capture modes, auth, WebSocket bridge behavior, channel rewards, chat sending, and support issues.
- [Live Commerce Sources](../08-platform-sources/live-commerce-sources.md) - Use this page when a user asks about Amazon Live, eBay Live, or Whatnot.
- [Manifest Content Script Matrix](../08-platform-sources/manifest-content-scripts.md) - Use this page when a user asks which file handles a platform URL, why a source script loads in an iframe, why a source must run at document_start, or whether a public site card has an actual extension content-script match.
- [Manifest Row Matrix](../08-platform-sources/manifest-row-matrix.md) - This page lists every current manifest.json content-script entry. Use it when answering whether a URL shape has an extension content-script match and which file loads first. The manifest remains the source of truth; public site/type hints are agent-routing hints, not final support proof.
- [Manual, Static, And Helper Sources](../08-platform-sources/manual-static-and-helper-sources.md) - Use this page when a file in sources/static/, sources/inject/, or a helper-like sources/*.js row appears in the source matrix and the question is "is this a normal chat source?"
- [Platform Capability Matrix](../08-platform-sources/platform-capability-matrix.md) - Use this page when an agent needs to answer "does SSN support this platform feature?" quickly. This is a routing matrix, not the final line-level source of truth. Before making a public or support-critical promise, check the linked platform doc and the current source.
- [Popout And Chat-Only Sources](../08-platform-sources/popout-chat-only-sources.md) - Use this page for smaller supported platforms where the required setup is a popout, chat-only, or platform-specific chat URL. These are rendered DOM chat captures unless noted otherwise.
- [Public Site Implementation Map](../08-platform-sources/public-site-implementation-map.md) - Use this page when a user asks whether a listed site is supported and the answer needs the current source route, manifest row, or grouped platform doc.
- [Public Site Support Status](../08-platform-sources/public-site-support-status.md) - Use this page to decide how strong an answer can be when a user asks whether a site is supported. This page does not replace the full site list in supported-sites-lookup.md; it explains what a public listing means and what still needs source verification.
- [Regional And Emerging Platform Sources](../08-platform-sources/regional-and-emerging-platform-sources.md) - Use this page for smaller regional, emerging, app-specific, or newly added rendered-page source parsers that do not yet have a dedicated platform doc and do not fit cleanly into the earlier grouped pages.
- [Rumble Source](../08-platform-sources/rumble.md) - Document SSN's Rumble capture paths: normal DOM capture on Rumble pages and the newer Rumble Live Stream API bridge.
- [Source File Processing Matrix](../08-platform-sources/source-file-processing-matrix.md) - This page tracks every current source-file resource at the file level. Exact file names and manifest references are source-backed. Public site-card matches are heuristic and should be verified before making a user-facing claim.
- [Source Inventory](../08-platform-sources/source-inventory.md) - - docs/js/sites.js
- [Special-Case Platform And Helper Sources](../08-platform-sources/special-case-platform-and-helper-sources.md) - Use this page for source files that were easy to misroute in the file matrix because they are not a clean fit for the larger grouped platform pages.
- [Supported Sites Lookup](../08-platform-sources/supported-sites-lookup.md) - Use this page when a user asks whether a platform is supported, which page or popout URL to open, or whether a platform is a standard, popout, toggle-required, manual, or WebSocket source.
- [TikTok Source](../08-platform-sources/tiktok.md) - Document TikTok standard mode, WebSocket/app mode, signing, app-specific connection management, event handling, and common support problems.
- [TikTok Standalone App Connector](../08-platform-sources/tiktok-standalone-app.md) - Use this page when the question is specifically about TikTok inside the standalone desktop app: app source modes, WebSocket versus legacy behavior, local signing, reply/send-back, fallback states, app regression tests, and support triage.
- [Twitch Source](../08-platform-sources/twitch.md) - Document Twitch capture, WebSocket/EventSub behavior, OAuth, chat sending, badges/emotes, and known support issues.
- [Video Broadcast Platform Sources](../08-platform-sources/video-broadcast-platform-sources.md) - Use this page for smaller video, audio, broadcast, and platform chat sources that are mostly rendered-page or chat-only DOM parsers.
- [Webinar And Event Sources](../08-platform-sources/webinar-and-event-sources.md) - Use this page when a user asks about Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, Wave Video, or WebinarGeek.
- [WebSocket And API Source Pages](../08-platform-sources/websocket-source-pages.md) - Use this page when a user asks about sources/websocket/*.html, richer source modes, socket/API source setup, source-page auth, or whether a WebSocket page is the same thing as a normal chat overlay.
- [YouTube Source](../08-platform-sources/youtube.md) - Document YouTube capture modes, setup, OAuth/API behavior, WebSocket/Data API behavior, message payloads, and common support issues.
