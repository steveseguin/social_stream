# URL Option Examples

Status: examples pass started on 2026-06-24 from `parameters.md`, generated URL parameter indexes, and current page docs.

## Purpose

Use this page when an AI agent needs a safe, practical example for SSN page URLs and URL parameters.

This is an example cookbook, not a complete parameter catalog. For exact parameter names and aliases, use `url-parameter-index.md`. For source-checked page-specific parser behavior, use `url-parameter-source-trace.md`. For parameter families and caveats, use `url-parameters.md`. For choosing the correct page before adding options, use `surface-url-cheatsheet.md`.

## Safety Rules

- Use `SESSION_ID` as a placeholder. Do not post real session IDs publicly.
- Redact `password`, API keys, provider keys, webhook URLs, OAuth tokens, private endpoints, and private platform URLs.
- Most URL parameters are read on page load. Refresh the page after changing them.
- A parameter can be valid but still not apply to the page the user opened.
- `server`, `server2`, `server3`, `label`, `style`, and `theme` are page-specific; check `url-parameter-source-trace.md` before using them in support replies.
- Theme pages vary. Do not assume every theme supports every dock/featured parameter.
- API actions, viewer chat commands, Event Flow actions, popup settings, and URL parameters are different systems.

## Basic Syntax

Boolean flag:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&darkmode
```

Key/value option:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&scale=1.25&limit=50
```

Multiple flags and values:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID&transparent&scale=1.2&showtime=8000
```

If the first parameter is already present, add more with `&`. If no parameter exists yet, start with `?`.

## Common OBS Chat Overlay Examples

Transparent normal chat:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&transparent&hidemenu&compact
```

Dark compact chat with source icons hidden:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&darkmode&compact&hidesource&limit=75
```

Bottom-aligned chat:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&transparent&alignbottom&limit=30
```

Horizontal ticker-style chat:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&transparent&horizontal&limit=20
```

Right-to-left layout:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&rtl&alignright
```

First checks when blank:

- Is a source side open and sending messages?
- Does the dock receive messages without extra styling options?
- Is the same session used everywhere?
- Did OBS refresh after the URL changed?

## Featured Message Examples

Basic featured overlay:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID
```

Transparent featured overlay:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID&transparent
```

Auto-hide featured message after 8 seconds:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID&showtime=8000
```

Targeted featured overlay with label:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID&label=main
```

Remember:

- `featured.html` waits for a selected/featured message.
- Click a message in dock, enable auto-show, or send a feature/queue API action before judging it blank.
- If several featured overlays are open, use labels and target the matching label from API commands.

## Filtered Display Examples

Hide bot commands:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&hidecommands
```

Only show questions:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&onlyquestions
```

Hide questions:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&hidequestions
```

Only show Twitch messages:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&onlytwitch
```

Hide listed users:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&hidefrom=user1,user2
```

Only show listed users:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&onlyfrom=user1,user2
```

Support warning:

- Filters can make capture look broken. Remove filters and test one plain message before diagnosing platform capture.
- Username/source matching can be page/source-specific; source-check before promising exact matching behavior.

## Operator, Queue, And Helper Examples

View-only dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&viewonly
```

Queue-only dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&queueonly
```

Pinned-only dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&pinnedonly
```

Helper mode:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&helpermode
```

Viewer self-queue command:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&selfqueue=!queue
```

Auto-show incoming messages:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&autoshow
```

Auto-show donations only:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&autoshowdonos
```

Checks:

- Queue/pin/feature behavior needs the dock open.
- Viewer self-queue requires matching chat input from the source side.
- Auto-show can make selected-message behavior look automatic; confirm whether the user intended manual feature selection.

## Theme Page Examples

Normal chat theme:

```text
https://socialstream.ninja/themes/compact-clean.html?session=SESSION_ID
```

Normal chat theme with timed messages:

```text
https://socialstream.ninja/themes/compact-clean.html?session=SESSION_ID&showtime=10000
```

T3nkey theme package:

```text
https://socialstream.ninja/themes/t3nk3y/?session=SESSION_ID
```

Featured-style theme:

```text
https://socialstream.ninja/themes/featured-styles/featured-modern.html?session=SESSION_ID&style=glass
```

Wrapper theme:

```text
https://socialstream.ninja/themes/pretty.html?session=SESSION_ID
```

Checks:

- Normal themes need ordinary chat payloads.
- Featured-style themes need selected/featured payloads.
- Wrapper themes embed or route through dock behavior.
- Some local theme files need `server` or `localserver` modes in OBS/local-file workflows, but only when the theme supports it.

## Event And Utility Page Examples

Word cloud counting all words:

```text
https://socialstream.ninja/wordcloud.html?session=SESSION_ID&allwords
```

Leaderboard with persistence:

```text
https://socialstream.ninja/leaderboard.html?session=SESSION_ID&persistdata
```

Floating emotes:

```text
https://socialstream.ninja/emotes.html?session=SESSION_ID
```

Ticker page:

```text
https://socialstream.ninja/ticker.html?session=SESSION_ID
```

Map page:

```text
https://socialstream.ninja/map.html?session=SESSION_ID
```

Checks:

- These pages are payload-specific. Ordinary chat may not visibly affect every page.
- `wordcloud.html` needs chat text; `allwords` changes tokenizing.
- `ticker.html` needs explicit `ticker` payloads.
- `emotes.html` needs emoji/image/SVG emote content.
- `map.html` needs recognizable location text.

## Tip Jar And Credits Examples

Simple tip jar goal:

```text
https://socialstream.ninja/tipjar.html?session=SESSION_ID&goal=100
```

Persistent tip jar:

```text
https://socialstream.ninja/tipjar.html?session=SESSION_ID&goal=100&persistent
```

Credits/supporter roll:

```text
https://socialstream.ninja/credits.html?session=SESSION_ID
```

Persistent credits:

```text
https://socialstream.ninja/credits.html?session=SESSION_ID&persistcredits
```

Checks:

- Tip jar and credits depend on donation/supporter-style payloads or page-local persistence.
- Donation webhook URLs are separate from display page URLs and must be kept private.
- Clear/reset behavior is page-specific; use `07-overlays-and-pages/tipjar-credits.md`.

## TTS URL Examples

Basic system/browser TTS from dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&speech=en-US
```

Slower, quieter TTS:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&speech=en-US&rate=0.9&volume=0.7
```

Command-triggered TTS:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&speech=en-US&ttscommand=!say
```

Do not share provider-key URLs:

```text
featured.html?session=REDACTED&elevenlabskey=REDACTED
```

Checks:

- The page that should speak must be open and unmuted.
- Browser/system TTS and provider-backed TTS have different OBS audio behavior.
- Cloud provider keys are private and can cost money.

## API/Server And Label Examples

Dock publishing through server route where intended:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&server
```

Timer page with server route:

```text
https://socialstream.ninja/timer.html?session=SESSION_ID&server
```

Labeled dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&label=control
```

Labeled featured page:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID&label=main
```

Checks:

- `server`, `server2`, `server3`, and `localserver` are page/context-specific.
- Do not add server flags everywhere by default.
- API labels only work when the target page uses the matching label.
- Use `api-command-examples.md` for the API command side.

## CSS And Customization Examples

Use OBS custom CSS first when possible for visual-only changes.

Simple CSS parameter shape:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&css=CSS_OR_URL
```

Base64 CSS shape:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&b64css=BASE64_CSS
```

Custom JS shape where trusted/supported:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID&js=TRUSTED_JS_URL_OR_BASE64
```

Warnings:

- Avoid untrusted scripts.
- Hosted pages cannot load a local disk `custom.js`.
- Extension code should not depend on remote executable scripts.
- Prefer custom overlays for complex layout changes.

## Common Failure Matrix

| Symptom | Likely Cause | First Check |
| --- | --- | --- |
| Page is blank | Missing source side, wrong session, wrong page type, or OBS issue | Test dock with no extra params in a normal browser. |
| Parameter does nothing | Wrong page or page needs refresh | Confirm parameter belongs to that page and reload. |
| Featured-style theme is blank | No featured/selected payload | Feature a message from dock. |
| Word cloud is blank | Messages do not match token mode | Send a simple word, or add `allwords` for sentences. |
| Ticker is blank | No explicit `ticker` payload | Send/test ticker payload, not ordinary chat. |
| Game ignores messages | Wrong game input or source session | Check game page command/input rules. |
| Chat missing after filters | Filter hides messages | Remove filters and retest plain chat. |
| OBS differs from browser | OBS source cache/CSS/local-file behavior | Refresh OBS source and test hosted URL. |
| API label target fails | No open page with matching `label` | Check page URL and API target. |
| URL exposes secrets | Real session/password/key/webhook in query | Redact and route to `privacy-security-and-secrets.md`. |

## Safe Answer Pattern

When giving a URL option answer:

1. Pick the correct page first.
2. Add only the required options.
3. Use `SESSION_ID` as a placeholder.
4. Tell the user to refresh the page after editing URL parameters.
5. Mention the first likely failure condition.
6. Warn about secrets when URLs include sessions, passwords, API keys, provider keys, webhook URLs, or private endpoints.
