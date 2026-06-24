# URL Parameters

Status: heavy reference pass started from `parameters.md`, README, and overlay docs. This is a practical map, not a full replacement for `parameters.md`.

## Source Anchors

- `parameters.md`
- `README.md`
- `api.md`
- `dock.html`
- `featured.html`
- `multi-alerts.html`
- `waitlist.html`
- `poll.html`
- `timer.html`
- `tipjar.html`
- `credits.html`
- `docs/agents/07-overlays-and-pages/*.md`
- `docs/agents/09-api-and-integrations/tts.md`

## Syntax

Boolean flags only need to appear:

```text
dock.html?session=SESSION_ID&darkmode&compact
```

Values use normal query syntax:

```text
dock.html?session=SESSION_ID&scale=1.5&limit=200
```

For API keys, passwords, custom JS, or private session IDs, avoid sharing full URLs publicly.

## Core Connection Parameters

| Parameter | Use |
| --- | --- |
| `session`, `s`, `id` | Session ID for dock/featured/tool/API routing. |
| `password` | Session password. Treat as private. |
| `label` | Names this page instance for targeted API commands. |
| `server` | Enables or sets WebSocket server routing, depending on page context. |
| `server2` / `server3` | Alternate WebSocket routing modes used by some pages. |
| `localserver` | Uses local WebSocket server where supported. |
| `lanonly` | Restricts peer behavior to LAN where supported. |

Support rule: most overlay "not updating" issues start with `session`, `server`, and `label`.

## Common Dock/Overlay Style Parameters

| Parameter | Use |
| --- | --- |
| `darkmode` / `lightmode` | Switches theme. |
| `transparent` | Transparent page background for overlays. |
| `scale` | Scales the page/card size. |
| `limit` | Maximum number of displayed messages. |
| `compact` / `overlaymode` | More compact message layout. |
| `horizontal` / `horizontalreverse` | Horizontal scrolling layout. |
| `alignbottom` / `alignright` | Changes message alignment. |
| `rtl` | Right-to-left text direction. |
| `bubble` / `namebubble` | Bubble-style message cards. |
| `font` / `googlefont` | Font family. |
| `fontcolor` / `namecolor` | Text/name color overrides. |
| `nooutline` | Removes outline styling. |
| `chroma` | Solid background color, without `#`. |
| `blur` / `noblur` | Blur behavior. |
| `largeavatar` / `largecontent` | Larger avatars or content attachments. |

For deeper styling, prefer OBS custom CSS or `&css=` / `&b64css=` before editing core files.

## Message Display And Filtering

| Parameter | Use |
| --- | --- |
| `showtime` | Auto-hide messages after milliseconds. |
| `delaytime` | Delay message display. |
| `trim` / `trimname` | Truncate long messages/usernames. |
| `hidenames` | Hide usernames. |
| `firstnamesonly` | Show first names only. |
| `hidesource` / `showsourcename` | Hide/show platform source info. |
| `noavatar` / `nobadges` | Hide avatars/badges. |
| `notime` / `24hr` | Timestamp behavior. |
| `attachmentsonly` | Only show messages with attached content. |
| `hidequestions` / `onlyquestions` | Question filtering. |
| `hidecommands` | Hide messages starting with `!`. |
| `hideshortmessages` | Hide short messages. |
| `stripemoji` / `noemojisonly` | Emoji filtering. |
| `striphtml` / `striplinks` | Remove HTML or links. |
| `activelinks` / `shortlink` | Link display behavior. |
| `hidefrom` / `exclude` | Hide listed usernames or sources, depending on page context. |
| `onlyfrom` / `fromonly` | Show only listed users/sources. |
| `showonlymods` / `showonlyvips` | Privileged-user filtering. |
| `filterevents` | Hide specific event names/text when `data.event` exists. |
| `showonlyevents` / `hideallevents` | Event-only or no-event views. |

If a user says "messages are missing", check filters before assuming capture is broken.

## Queue, Pin, And Feature Parameters

| Parameter | Use |
| --- | --- |
| `autoshow` | Automatically feature incoming messages. |
| `autoshowtime` | Timing for auto-show behavior. |
| `chartime` | Auto-show time per character. |
| `autoshowdonos` / `autoshowmembers` | Auto-feature only donations or members. |
| `autoshowqueued` | Auto-show queued messages. |
| `autoshowcontentimages` | Auto-feature queued messages with content images. |
| `queueonly` | Show only queued messages. |
| `pinnedonly` | Show only pinned messages. |
| `viewonly` | Disable chat/pin/feature capabilities. |
| `featuredmode` | Connect dock to featured-message feed. |
| `chatmode` / `chatonly` | Chat-centric/no-feature mode. |
| `helpermode` | View/pin/queue helper mode. |
| `sync` / `synced` | Sync selection across multiple docks. |
| `selfqueue` | Viewer commands that self-add to queue, such as `!queue`. |
| `random` | Randomize queued message selection. |

Use queue docs when the user asks about CTRL/cmd-click queueing or "next in queue".

## TTS Parameters

| Parameter | Use |
| --- | --- |
| `speech` / `tts` | Enables TTS with language, such as `en-US`. |
| `volume` | TTS volume. |
| `rate` | Speaking rate. |
| `pitch` | Speaking pitch. |
| `voice` | Partial voice name match. |
| `ttscommand` | Custom chat command for TTS; default is usually `!say`. |
| `ttscommandmembersonly` | Restricts TTS command to members. |
| `simpletts` | Simpler spoken phrasing. |
| `readevents` | Read stream events. |
| `readouturls` | Read URLs aloud instead of saying "link". |

Provider/API-key families:

- Google Cloud: `ttskey`, `googlettskey`, `googlerate`, `googlepitch`, `googleaudioprofile`, `voicegoogle`.
- ElevenLabs: `elevenlabskey`, `voice11`, `elevenlabsvoice`, `elevenlabsmodel`, `elevenlatency`, `elevenstability`, `elevensimilarity`, `elevenstyle`, `elevenrate`, `elevenspeakerboost`.
- Speechify: `speechifykey`, `voicespeechify`, `speechifymodel`, `speechifyspeed`.
- Gemini: `geminikey`, `geminimodel`, `voicegemini`, `geminilang`, `geministyle`, `geminiprompt`.
- OpenAI-compatible/local: `ttsprovider`, `openaikey`, `customttskey`, `localttskey`, `openaiendpoint`, `customttsendpoint`, `localttsendpoint`, `voiceopenai`, `customttsvoice`, `localttsvoice`, `openaimodel`, `customttsmodel`, `localttsmodel`.

Do not put provider keys in shared screenshots.

## Donation, Member, And Event Parameters

| Parameter | Use |
| --- | --- |
| `showonlydonos` / `showonlymembers` | Show only donation/member messages. |
| `stripdonations` | Remove donation data from messages. |
| `nodonohighlight` | Disable donation highlight. |
| `autoyoutubememberchat` | Auto-feature YouTube member milestone cards. |
| `tiktokfans` | Treat TikTok fans as channel members for highlighting. |
| `t1`, `t2`, `t3` | Donation thresholds. |
| `t1c`, `t2c`, `t3c` | Threshold colors. |
| `filterevents` | Filter named events such as subscription/follow/gift categories. |
| `trivialevents` | Allow minor event shading. |
| `dissolve` | Fade event cards quickly. |

For tip goal display, use `tipjar.html` parameters such as `goal`, `style`, `tipjartype`, `tipjarsource`, `persistent`, `controls`, `sound`, `hype`, `levelsize`, and color/fill options.

## Automation And External Integration Parameters

| Parameter | Use |
| --- | --- |
| `remote` | Enables OBS scene state/control related behavior where supported. |
| `cycle` | Allows `!cycle` OBS scene changes. |
| `startstop` | Allows privileged users to start/stop OBS where permitted. |
| `postserver` | POST selected/featured data to an endpoint. |
| `putserver` | PUT selected/featured data to an endpoint. |
| `h2rurl` / `h2r` | H2R Graphics integration. |
| `spxserver` / `spxfunction` / `spxlayer` | SPX-GC integration. |
| `singular` | Singular.live data node updates. |
| `passtts` / `passttsmod` | TTS pass-through to remote automation. |

Use the API docs for command-style control; use these URL parameters for page behavior at load time.

## Custom CSS And JS Parameters

| Parameter | Use |
| --- | --- |
| `css` | CSS URL or direct CSS where supported. |
| `cssb64`, `b64css`, `base64css`, `cssbase64` | Base64-encoded CSS. |
| `js`, `base64js`, `b64js`, `jsbase64`, `jsb64` | Loads custom JS in trusted contexts. |

Safety:

- Avoid untrusted scripts.
- Hosted pages cannot load a local `custom.js` from a user's disk.
- Extension code must not introduce remote executable script dependencies.
- Prefer CSS for visual changes and custom overlays for full visual control.

## Export And Persistence Parameters

| Parameter | Use |
| --- | --- |
| `save` | Auto-save messages to downloads. |
| `savesingle` | Save last message to a file. |
| `savefeatured` | Save featured message to file. |
| `saveimg` | Include avatar URLs when saving. |
| `reload` | Reload recent messages on refresh. |
| `loadlast` | Load a number of historical messages from database where supported. |
| `persistcredits` | Credits page persists supporter list. |
| `persistent` | Tip jar persists current amount between sessions. |

## Common URL Mistakes

- Missing `session`.
- Reusing an old session ID.
- Putting a parameter on the wrong page.
- Expecting a URL parameter to change an already-open page without refresh.
- Confusing API actions with URL parameters.
- Forgetting to URL-encode CSS, JS, messages, or endpoint URLs.
- Sharing API keys, passwords, or session IDs in screenshots.
- Using local files in OBS on macOS/Linux when hosted pages or OBS custom CSS would be more reliable.

## Answer Pattern

When asked for a URL option:

1. Identify the page: dock, featured, multi-alerts, waitlist, poll, timer, tipjar, credits, bot, or custom overlay.
2. Confirm the page has `session=...`.
3. Choose the smallest parameter set.
4. Warn about secrets if keys/passwords/session IDs are in the URL.
5. Link the deeper page or `parameters.md` for the full list.
