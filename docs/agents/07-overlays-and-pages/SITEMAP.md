# Overlays And Pages Sitemap

Status: generated folder sitemap on 2026-06-24 for docs/agents/07-overlays-and-pages.

Use this file to navigate this folder without scanning the filesystem.

- [Agent docs sitemap](../SITEMAP.md)
- [Master agent index](../99-agent-index.md)

## Files

- [AI And Cohost Pages](../07-overlays-and-pages/ai-cohost-pages.md) - Use this page when a user asks which AI page to open, why the cohost overlay is blank, why generated AI overlays are not loading, how aiprompt.html and aioverlay.html relate, or why AI requests time out.
- [Custom Overlays](../07-overlays-and-pages/custom-overlays.md) - Document how to build custom SSN overlay pages that receive normalized SSN messages without modifying the extension background/runtime code.
- [Diagnostic And Helper Pages](../07-overlays-and-pages/diagnostic-helper-pages.md) - Use this page when a user asks about SSN helper pages that test, recover, import, replay, or diagnose behavior. These pages are not all the same type:
- [Dock Page](../07-overlays-and-pages/dock.md) - - dock.html
- [Event And Effect Overlays](../07-overlays-and-pages/event-effect-overlays.md) - Use this page when a user asks about the event dashboard, hype/viewer counter, confetti effect, word cloud, or leaderboard pages. These pages are not platform sources. They are receiving/output pages that need matching SSN session traffic from source pages, the dock, the standalone app, or an API/server route.
- [Featured Overlay](../07-overlays-and-pages/featured.md) - - featured.html
- [Game Pages](../07-overlays-and-pages/game-pages.md) - Use this page when a user asks how SSN chat games work, which game URL to open, what viewers should type, why a game ignores chat, or how to reset game state.
- [Overlays And Pages Index](../07-overlays-and-pages/index.md) - This section covers SSN pages users open in browsers, OBS, the extension, or the standalone app.
- [Live Display Utilities](../07-overlays-and-pages/live-display-utilities.md) - Use this page when a user asks about floating emotes, reaction bursts, points scoreboards, ticker text, or viewer-location maps. These are receiving/display pages. They do not capture platform chat by themselves.
- [Multi Alerts](../07-overlays-and-pages/multi-alerts.md) - multi-alerts.html is an alert overlay for event-style SSN payloads. It is separate from normal chat overlays and focuses on follows, subscriptions, donations, cheers/bits, raids, auction wins, and hype-train events.
- [Page Capability Matrix](../07-overlays-and-pages/page-capability-matrix.md) - Use this page when a user asks "which SSN page supports this?", "what has to stay open?", "does this go in OBS?", "does it need the dock?", or "why does this page do nothing?" This is a routing and dependency matrix. For exact parameters or commands, use the page-specific docs and the reference indexes.
- [Page Processing Matrix](../07-overlays-and-pages/page-processing-matrix.md) - Use this page to answer: "Has this page file been processed already?", "Which pages are only inventoried?", and "What should the next extraction pass inspect?" Use page-capability-matrix.md for user-facing capability routing.
- [Specialized And Legacy Pages](../07-overlays-and-pages/specialized-legacy-pages.md) - Use this page when a user asks about a root HTML page that looks like a standalone feature but is actually a wrapper, skin, legacy custom renderer, or experimental integration surface.
- [Theme Pages](../07-overlays-and-pages/theme-pages.md) - Use this page when a user asks which theme URL to open, how prebuilt themes work, why a theme is blank in OBS, whether a theme supports server, how featured-message style themes differ from normal chat themes, or how to start from a theme when building a custom overlay.
- [Tip Jar And Credits](../07-overlays-and-pages/tipjar-credits.md) - Use this page when a user asks about donation goals, hype goals, tip jars, supporter credits, credits roll persistence, or why donation/supporter display pages are blank.
- [Waitlist Polls And Games](../07-overlays-and-pages/waitlist-polls-games.md) - This page documents SSN's interactive browser/OBS tools: waitlists, polls, timers, giveaways, and chat-driven games. These tools consume SSN session traffic but often maintain their own state and command surfaces.
