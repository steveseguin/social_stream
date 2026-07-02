# URL Parameter Index

Status: generated lookup pass from `shared/config/urlParameters.js` on 2026-06-24.

Use this page to find exact URL parameter names, aliases, and accepted value hints quickly. For behavior, verify against `parameters.md`, `url-parameter-source-trace.md`, and the target page code.

## Counts

- Total generated parameter entries: 255
- Groups: 2
- Sections: 23
- Lookup entries: 302
- Alias strings: 304

## Focused Validation Note

On 2026-06-24, a read-only inline Node metadata checker confirmed these generated counts and found no missing required `key`/`displayName`/`aliases`/`description` fields in `shared/config/urlParameters.js`.

Known metadata findings:

- `password` appears as an alias for two generated `password` entries in the dock parameter group: one under Basic Configuration Parameters and one under Privacy & Security Parameters.
- `strokecolor` and `strokeColor` normalize to the same alias for the same `strokecolor` key under Visual Style Parameters.

Evidence label: `focused-metadata-validation`; not runtime-tested. This does not validate page-specific URL parser behavior, generated links, overlay rendering, OBS refresh behavior, or whether the duplicate aliases cause a user-visible issue.

## URL Parameters for the Streaming Overlay (dock.html)

These are for the main streaming overlay.

### Basic Configuration

Entries: 10.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `session` | `session`, `s`, `id` | string | Sets the session ID for connecting to the chat |
| `password` | `password` | string | Sets a password for the session |
| `scale` | `scale` | float | Adjusts the size scaling of the overlay (default: 1.0) |
| `limit` | `limit` | number | Maximum number of messages to show before older ones are removed |
| `opacity` | `opacity` | 0.0-1.0 | Sets the opacity of the main overlay window |
| `hidemenu` | `hidemenu`, `nomenu` | boolean or "2" | Hides the menu bar. Value of "2" keeps scroll lock functionality |
| `css` | `css` | URL or CSS string | Applies custom CSS styling via URL or direct CSS |
| `cssb64` | `cssb64`, `b64css`, `base64css`, `cssbase64` | base64 string | Applies custom CSS styling via base64 encoded string |
| `js` | `js`, `base64js`, `b64js`, `jsbase64`, `jsb64` | URL or base64 string | Loads external JavaScript (limited to trusted hosting contexts) |
| `label` | `label` | string | Assigns a label to this instance |

### Visual Style

Entries: 42.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `darkmode` | `darkmode` | boolean | Enables dark theme with black background |
| `lightmode` | `lightmode` | boolean | Enables light theme with white background |
| `transparent` | `transparent`, `transparency` | boolean | Makes background transparent and hides scrollbar |
| `chroma` | `chroma` | hex color | Sets a specific background color (without #) |
| `blur` | `blur`, `blurred` | number | Applies blur effect to messages (value in pixels) |
| `noblur` | `noblur` | boolean | Disables blur rendering (including hidden-source blur and timed-out blur) |
| `compact` | `compact`, `overlaymode` | boolean | Enables compact mode with less spacing |
| `padding` | `padding` | number | Sets padding between messages in pixels |
| `largeavatar` | `largeavatar` | boolean | Shows larger user avatars on the left side |
| `emoji` | `emoji`, `emojis` | number | Sets emoji size scaling (percentage, default: 140) |
| `nooutline` | `nooutline` | boolean | Removes text outline effects |
| `font` | `font` | string | Sets custom font family |
| `googlefont` | `googlefont` | string | Loads and uses a Google Font |
| `color` | `color`, `colorednames` | boolean | Uses platform accent colors for usernames |
| `fontcolor` | `fontcolor` | hex color | Overrides the body text color |
| `namecolor` | `namecolor` | hex color | Overrides the username text color |
| `fontweight` | `fontweight` | number or keyword | Sets font weight for message text |
| `nameweight` | `nameweight` | number or keyword | Sets font weight for usernames |
| `outlinewidth` | `outlinewidth` | number | Width (px) of the outer outline highlight |
| `outlinecolor` | `outlinecolor` | hex color | Color applied to the outer outline highlight |
| `strokewidth` | `strokewidth`, `stroke` | number | Width (px) for the text stroke effect |
| `strokecolor` | `strokecolor`, `strokeColor` | hex color (alpha supported) | Color applied to the text stroke effect (accepts 8-digit hex/rgba for transparency) |
| `border` | `border` | hex color | Adds a profile image border using the provided color (without #) |
| `pressedcolor` | `pressedcolor` | hex color or empty | Custom highlight color for pinned/featured states |
| `donationhighlightcolor` | `donationhighlightcolor` | hex/color | Custom donation row highlight color; 6-digit colors are shown with stronger shading automatically |
| `memberhighlightcolor` | `memberhighlightcolor` | hex/color | Custom member row highlight color; 6-digit colors are shown with stronger shading automatically |
| `firsttimehighlightcolor` | `firsttimehighlightcolor` | hex/color | Custom first-time chatter row highlight color; 6-digit colors are shown with stronger shading automatically |
| `questionhighlightcolor` | `questionhighlightcolor` | hex/color | Custom question row highlight color; 6-digit colors are shown with stronger shading automatically |
| `hideshadow` | `hideshadow` | boolean | Removes alternating card drop shadows |
| `largecontent` | `largecontent` | boolean | Enlarges embedded content or image cards |
| `donationright` | `donationright` | number | Sets donation amount margin-right in pixels |
| `bubbleopacity` | `bubbleopacity` | 0.0-1.0 | Sets message bubble background opacity |
| `namebubblecolor` | `namebubblecolor` | hex/color | Background color for the rounded name bubble |
| `namebubbletext` | `namebubbletext` | hex/color | Text color for the rounded name bubble |
| `namebubbleradius` | `namebubbleradius` | number or CSS length | Border radius for the rounded name bubble |
| `namebubblepadding` | `namebubblepadding` | CSS padding string | Padding for the rounded name bubble |
| `bolder` | `bolder` | boolean | Applies a thicker drop shadow around text |
| `thinner` | `thinner` | boolean | Applies a thinner drop shadow around text |
| `unhighlight` | `unhighlight` | boolean | Uses an alternate style when un-featuring messages |
| `nofeaturedhightlight` | `nofeaturedhightlight` | boolean | Disables the flash highlight when a card is featured |
| `nomemberhighlight` | `nomemberhighlight` | boolean | Disables highlight color for member messages |
| `noquestionhightlight` | `noquestionhightlight` | boolean | Disables highlight color for question cards |

### Layout

Entries: 13.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `horizontal` | `horizontal` | boolean | Makes messages scroll horizontally |
| `horizontalreverse` | `horizontalreverse` | boolean | When horizontal is enabled, enters left-to-right mode so newest messages slide in from the left |
| `alignbottom` | `alignbottom` | boolean | Makes messages start from bottom |
| `alignright` | `alignright` | boolean | Aligns messages to the right side |
| `rtl` | `rtl` | boolean | Enables right-to-left text direction |
| `fixed` | `fixed` | boolean | Makes messages overlap each other |
| `twolines` | `twolines` | boolean | Places messages on a separate line below usernames |
| `split` | `split` | boolean | Enables split mode for message alignment |
| `bubble` | `bubble` | boolean | Styles messages as chat bubbles |
| `namebubble` | `namebubble` | boolean | Adds a separate rounded bubble behind usernames (bubble mode) |
| `fadedtop` | `fadedtop` | boolean | Fades out the top of the overlay |
| `reverse` | `reverse` | boolean | Displays the feed in reverse order (newest at the top) |
| `dropdown` | `dropdown` | boolean | Enables reverse order with drop-down style animations |

### Animation

Entries: 9.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `fadein` | `fadein` | boolean | Enables fade-in animation for new messages |
| `fadeout` | `fadeout` | boolean | Enables fade-out animation when removing messages |
| `swipeleft` | `swipeleft` | boolean | Messages slide in from the right |
| `swiperight` | `swiperight` | boolean | Messages slide in from the left |
| `swipeup` | `swipeup` | boolean | Messages slide up from bottom |
| `smooth` | `smooth` | boolean | Enables smooth scrolling |
| `animatein` | `animatein` | string | Sets specific entrance animation (see animate.css) |
| `animateout` | `animateout` | string | Sets specific exit animation (see animate.css) |
| `typewriter` | `typewriter` | boolean or number | Types chat text letter-by-letter with a blinking cursor; optional numeric value sets the per-character delay (ms) while messages wait for the current typing to finish |

### Message Display

Entries: 24.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `showtime` | `showtime` | number | Auto-hides messages after specified milliseconds |
| `delaytime` | `delaytime` | number | Delays showing messages by specified milliseconds |
| `trim` | `trim` | number | Trims messages longer than specified characters |
| `trimname` | `trimname` | number | Trims usernames longer than specified characters |
| `hidenames` | `hidenames` | boolean | Hides usernames completely |
| `firstnamesonly` | `firstnamesonly`, `firstname`, `firstnames` | boolean | Shows only first names of users |
| `youtubechannelname` | `youtubechannelname`, `youtubechanneltitle` | boolean | Featured Chat only: resolves YouTube WebSocket author channel IDs to channel titles before showing featured messages |
| `hidesource` | `hidesource` | boolean | Hides the source platform icons (YouTube, Twitch, etc.) |
| `noavatar` | `noavatar`, `noavatars` | boolean | Hides user avatars |
| `nobadges` | `nobadges`, `hidebadges` | boolean | Hides user badges |
| `limitbadges` | `limitbadges` | number | Limits number of badges shown per message |
| `notime` | `notime`, `notimestamp`, `nodate` | boolean | Hides timestamp |
| `24hr` | `24hr` | boolean | Displays timestamps using 24-hour format |
| `sequence` | `sequence` | boolean | Hides name/icons if sequential messages from same user |
| `attachmentsonly` | `attachmentsonly` | boolean | Displays only messages that include an attached image or clip |
| `hidequestions` | `hidequestions` | boolean | Hides cards flagged as questions |
| `onlyquestions` | `onlyquestions` | boolean | Shows only messages that contain question metadata |
| `hidenumbers` | `hidenumbers` | boolean | Hides messages that contain only digits |
| `showsourcename` | `showsourcename` | boolean | Displays the originating platform label on each card |
| `showviewercount` | `showviewercount` | boolean | Shows the current viewer count indicator |
| `nocolon` | `nocolon` | boolean | Removes the colon between username and message body |
| `namefilter` | `namefilter` | boolean | Applies filters to usernames instead of message text |
| `stripreplyto` | `stripreplyto` | boolean | Removes "replying to" prefaces from imported messages |
| `normalize` | `normalize` | boolean | Normalizes characters (e.g., removes diacritics) for comparisons |

### Filtering

Entries: 16.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `hidecommands` | `hidecommands` | boolean | Hides messages starting with "!" |
| `hideshortmessages` | `hideshortmessages` | number | Hides messages shorter than specified length |
| `noemojisonly` | `noemojisonly` | boolean | Filters out messages containing only emojis |
| `stripemoji` | `stripemoji` | boolean | Removes all emojis from messages |
| `striphtml` | `striphtml`, `strip` | boolean | Removes HTML formatting from messages |
| `striplinks` | `striplinks` | boolean | Removes links from messages |
| `activelinks` | `activelinks` | boolean | Makes URLs clickable |
| `shortlink` | `shortlink` | boolean | Shortens displayed links |
| `onlytwitch` | `onlytwitch` | boolean | Shows only Twitch messages |
| `hidetwitch` | `hidetwitch` | boolean | Hides Twitch messages |
| `hidefrom` | `hidefrom`, `exclude` | comma-separated strings | List of usernames to hide messages from |
| `onlyfrom` | `onlyfrom`, `fromonly` | comma-separated strings | List of usernames to exclusively show |
| `badkarma` | `badkarma` | 0.0-1.0 | Filters messages based on sentiment score |
| `showonlymods` | `showonlymods` | boolean | Shows messages from moderators only |
| `showonlyvips` | `showonlyvips` | boolean | Shows messages from VIPs only |
| `excludefiltered` | `excludefiltered` | boolean | Prevents filtered messages from being auto-featured |

### Message Selection & Queue

Entries: 33.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `autoshow` | `autoshow` | boolean | Automatically features new messages |
| `autoshowtime` | `autoshowtime` | number | Custom timing for auto-show feature (milliseconds) |
| `chartime` | `chartime` | number | Time per character for auto-show duration |
| `autoshowdonos` | `autoshowdonos` | boolean | Auto-features only donation messages |
| `autoshowmembers` | `autoshowmembers` | boolean | Auto-features only member messages |
| `autoshowqueued` | `autoshowqueued` | boolean | Auto-shows queued messages |
| `autoshowcontentimages` | `autoshowcontentimages` | boolean | Auto-features queued messages that include image/content attachments |
| `queueonly` | `queueonly` | boolean | Shows only queued messages |
| `pinnedonly` | `pinnedonly` | boolean | Shows only pinned messages |
| `viewonly` | `viewonly` | boolean | Disables chat, pin, and feature capabilities |
| `featuredmode` | `featuredmode` | boolean | Connects dock.html to the featured-message feed so it only receives selected messages |
| `chatmode` | `chatmode` | boolean | Enables chat-only mode (no pin/feature) |
| `helpermode` | `helpermode` | boolean | Enables view/pin/queue mode (no chat/feature) |
| `chatonly` | `chatonly` | boolean | Moves the chat input into the toolbar for a chat-centric layout |
| `openchat` | `openchat` | boolean | Automatically opens the chat composer on load |
| `showmenu` | `showmenu` | boolean | Forces the main toolbar to remain visible |
| `sync` | `sync`, `synced` | boolean | Syncs message selection across multiple docks |
| `autopindonations` | `autopindonations` | boolean | Auto-pins donation cards as they arrive |
| `autopinquestions` | `autopinquestions`, `autopinquestion` | boolean | Auto-pins cards marked as questions |
| `autoqueuedonations` | `autoqueuedonations`, `autoqueuedonation` | boolean | Auto-queues donation cards |
| `autoqueuequestions` | `autoqueuequestions`, `autoqueuequestion` | boolean | Auto-queues question cards |
| `skipdonations` | `skipdonations` | boolean | Prevents donation cards from being auto-featured |
| `selfqueue` | `selfqueue` | comma-separated strings | Viewer commands that add themselves to the queue (e.g., !queue) |
| `deleteonlylast` | `deleteonlylast` | boolean | Only removes the most recent card when clearing messages |
| `disabletimeout` | `disabletimeout` | boolean | Disables the auto-timeout on featured messages |
| `altselect` | `altselect` | boolean | Keeps the Feature button visible when menus are hidden |
| `autoscroll` | `autoscroll` | boolean | Scrolls to the latest message once and leaves scrolling unlocked |
| `manualscroll` | `manualscroll` | boolean | Disables automatic near-bottom scrolling unless Force scroll is enabled |
| `buffer` | `buffer` | boolean | Enables adaptive buffering for smoother message pacing |
| `bufferdelay` | `bufferdelay` | number | Base delay (ms) used when buffering messages |
| `buffermin` | `buffermin` | number | Minimum delay (ms) used when buffering messages |
| `buffermax` | `buffermax` | number | Maximum delay (ms) used when buffering messages |
| `random` | `random` | boolean | Randomizes which queued message is featured next |

### Text-to-Speech (TTS)

Entries: 10.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `speech` | `speech`, `tts` | language code | Enables TTS with specified language (e.g., "en-US") |
| `volume` | `volume` | 0.0-1.0 | Sets TTS volume |
| `rate` | `rate` | number | Sets TTS speaking rate |
| `pitch` | `pitch` | number | Sets TTS pitch |
| `voice` | `voice` | string | Specifies TTS voice to use |
| `ttscommand` | `ttscommand` | string | Custom command to trigger TTS (default: "!say") |
| `ttscommandmembersonly` | `ttscommandmembersonly` | boolean | Restricts TTS command to members only |
| `simpletts` | `simpletts` | boolean | Simplified TTS output without "says" phrases |
| `readevents` | `readevents` | boolean | Enables TTS for stream events |
| `readouturls` | `readouturls` | boolean | Reads URLs instead of saying "link" |

### Donation & Member

Entries: 12.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `showonlydonos` | `showonlydonos` | boolean | Shows only messages with donations |
| `showonlymembers` | `showonlymembers` | boolean | Shows only messages from members |
| `stripdonations` | `stripdonations` | boolean | Removes donation data from messages |
| `nodonohighlight` | `nodonohighlight` | boolean | Disables background highlighting for donations |
| `autoyoutubememberchat` | `autoyoutubememberchat` | boolean | Auto-features YouTube member milestone chat cards |
| `tiktokfans` | `tiktokfans` | boolean | Treats TikTok fans as channel members for highlighting |
| `t1` | `t1` | number | First donation threshold amount (USD) |
| `t1c` | `t1c` | hex/color | Color for first donation threshold messages |
| `t2` | `t2` | number | Second donation threshold amount (USD) |
| `t2c` | `t2c` | hex/color | Color for second donation threshold messages |
| `t3` | `t3` | number | Third donation threshold amount (USD) |
| `t3c` | `t3c` | hex/color | Color for third donation threshold messages |

### Bot & Host Control

Entries: 12.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `myname` | `myname`, `botlist`, `botnames` | comma-separated strings | List of bot usernames to identify |
| `hidebots` | `hidebots` | boolean | Hides messages from identified bots |
| `hidebotnames` | `hidebotnames` | boolean | Hides names of identified bots |
| `hidehosts` | `hidehosts` | boolean | Hides messages from hosts |
| `hidehostnames` | `hidehostnames` | boolean | Hides names of hosts |
| `nobeepbot` | `nobeepbot` | boolean | Disables notification sound for bot messages |
| `nobeephost` | `nobeephost` | boolean | Disables notification sound for host messages |
| `nobeepevent` | `nobeepevent` | boolean | Disables notification sound for events |
| `nobeepmod` | `nobeepmod` | boolean | Disables notification sound for moderator messages |
| `showvipbadge` | `showvipbadge` | boolean | Shows special badge for VIP users |
| `autofeaturevip` | `autofeaturevip` | boolean | Auto-features messages from VIP users |
| `autofeaturepriv` | `autofeaturepriv` | boolean | Auto-features messages from privileged users |

### Notification & Sound

Entries: 5.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `beep` | `beep` | boolean | Enables sound notification for new messages |
| `beepvolume` | `beepvolume` | 0-100 | Sets volume for notification sound (percentage) |
| `custombeep` | `custombeep` | URL | Custom sound file URL for notifications |
| `beepwords` | `beepwords` | boolean | Replaces asterisks with "beep" in messages |
| `quietcommands` | `quietcommands` | boolean | Disables the TTS beep when command shortcuts trigger |

### OBS Integration

Entries: 7.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `remote` | `remote` | boolean/string | Enables OBS scene state display |
| `cycle` | `cycle` | boolean | Allows guests to change OBS scenes with !cycle |
| `startstop` | `startstop` | boolean | Allows privileged users to start/stop OBS |
| `server` | `server` | URL | Custom WebSocket server URL |
| `server2` | `server2` | URL | Secondary WebSocket server URL |
| `server3` | `server3` | URL | Tertiary WebSocket server URL |
| `lanonly` | `lanonly` | boolean | Restricts P2P connections to LAN only |

### External Automation & Integrations

Entries: 11.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `postserver` | `postserver` | URL | Endpoint that receives featured message data via POST |
| `putserver` | `putserver` | URL | Endpoint that receives featured message data via PUT |
| `h2rurl` | `h2rurl` | URL | Base URL for H2R Graphics API posts |
| `h2r` | `h2r` | string | Path or endpoint suffix appended to h2rurl |
| `spxserver` | `spxserver` | URL | Base URL for SPX-GC |
| `spxfunction` | `spxfunction` | string | SPX function invoked when a message is featured |
| `spxlayer` | `spxlayer` | string | SPX template/layer identifier to update |
| `singular` | `singular` | string | Singular.live data node ID for webhook updates |
| `passtts` | `passtts` | boolean | Allows the !pass shortcut to forward TTS to remote automation |
| `passttsmod` | `passttsmod` | boolean | Restricts the !pass TTS shortcut to moderators |
| `v` | `v` | string | Overrides the dock version used for remote compatibility checks |

### Export & Saving

Entries: 6.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `save` | `save` | boolean | Auto-saves messages to downloads folder |
| `savesingle` | `savesingle` | boolean | Saves last message to a file |
| `savefeatured` | `savefeatured` | boolean | Saves featured message to file |
| `saveimg` | `saveimg` | boolean | Includes user avatar URLs when saving |
| `reload` | `reload` | boolean | Reloads last ~50 messages on refresh |
| `loadlast` | `loadlast` | number | Loads specified number of messages from database |

### Professional API Integration

Entries: 5.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `ttskey` | `ttskey`, `googlettskey` | string | Google Cloud TTS API key |
| `elevenlabskey` | `elevenlabskey` | string | ElevenLabs TTS API key |
| `speechifykey` | `speechifykey` | string | Speechify TTS API key |
| `geminikey` | `geminikey` | string | Gemini TTS API key |
| `openaikey` | `openaikey`, `customttskey`, `localttskey` | string | OpenAI or custom local TTS endpoint API key. Optional for local endpoints. |

### OpenAI-Compatible and Custom TTS

Entries: 8.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `ttsprovider` | `ttsprovider` | openai, customtts, localtts | Uses the OpenAI-compatible audio speech request format. customtts and localtts are aliases for local/self-hosted endpoints. |
| `openaiendpoint` | `openaiendpoint`, `customttsendpoint`, `localttsendpoint` | URL | OpenAI-compatible TTS endpoint, such as http://127.0.0.1:8124/v1/audio/speech |
| `voiceopenai` | `voiceopenai`, `customttsvoice`, `localttsvoice` | string | Voice name, speaker ID, or cloned voice name accepted by the endpoint |
| `openaicustomvoice` | `openaicustomvoice` | string | Custom voice value used when the popup voice selector is set to Custom |
| `openaimodel` | `openaimodel`, `customttsmodel`, `localttsmodel` | string | TTS model name sent in the request body |
| `openaicustommodelx` | `openaicustommodelx` | string | Custom model value used when the popup model selector is set to Custom |
| `openaispeed` | `openaispeed`, `customttsspeed`, `localttsspeed` | float | Speaking speed sent to compatible endpoints |
| `openaiformat` | `openaiformat`, `customttsformat`, `localttsformat` | mp3, wav, opus, aac, flac | Preferred audio response format |

### Google Cloud TTS

Entries: 4.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `googlerate` | `googlerate` | float | Google TTS speaking rate |
| `googlepitch` | `googlepitch` | float | Google TTS pitch adjustment |
| `googleaudioprofile` | `googleaudioprofile` | string | Audio profile (e.g., "handset-class-device") |
| `voicegoogle` | `voicegoogle` | string | Google TTS voice name (e.g., "en-GB-Standard-A") |

### Gemini TTS

Entries: 4.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `geminimodel` | `geminimodel` | string | Gemini TTS model (e.g., "gemini-2.5-flash-preview-tts") |
| `voicegemini` | `voicegemini` | string | Gemini prebuilt voice name (e.g., "Kore") |
| `geminilang` | `geminilang` | BCP-47 code | Optional Gemini speech language code (e.g., "th-TH") |
| `geministyle` | `geministyle`, `geminiprompt` | string | Gemini-only style instructions prepended to the TTS prompt |

### ElevenLabs TTS

Entries: 8.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `elevenlatency` | `elevenlatency` | 0-4 | Latency optimization level |
| `elevenstability` | `elevenstability` | 0.0-1.0 | Voice stability setting |
| `elevensimilarity` | `elevensimilarity` | 0.0-1.0 | Voice similarity boost |
| `elevenstyle` | `elevenstyle` | 0.0-1.0 | Style intensity |
| `elevenrate` | `elevenrate` | float | Speaking rate |
| `elevenspeakerboost` | `elevenspeakerboost` | boolean | Enables speaker boost |
| `voice11` | `voice11`, `elevenlabsvoice` | string | Voice ID |
| `elevenlabsmodel` | `elevenlabsmodel` | string | Model selection |

### Speechify

Entries: 3.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `speechifyspeed` | `speechifyspeed` | float | Speaking speed |
| `speechifymodel` | `speechifymodel` | string | Model selection (e.g., 'simba-english') |
| `voicespeechify` | `voicespeechify` | string | Voice selection |

### Event Handling

Entries: 5.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `filterevents` | `filterevents` | comma-separated strings | Exact event names or text keywords to filter when data.event is present |
| `trivialevents` | `trivialevents` | boolean | Allows background shading for minor events |
| `showonlyevents` | `showonlyevents` | boolean | Shows only stream events |
| `hideallevents` | `hideallevents` | boolean | Hides all stream events |
| `dissolve` | `dissolve` | boolean | Stream events fade away after 3s |

### Privacy & Security

Entries: 4.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `privateonly` | `privateonly` | boolean | Shows only private messages |
| `includeprivate` | `includeprivate` | boolean | Includes private messages |
| `password` | `password` | string | Sets password for connection |
| `localserver` | `localserver` | boolean | Uses local WebSocket server |

### Debug & Development

Entries: 4.

| Parameter | Aliases | Values | Short Description |
| --- | --- | --- | --- |
| `debug` | `debug` | boolean | Enables debug mode |
| `notobs` | `notobs` | boolean | Disables OBS studio detection |
| `filtertid` | `filtertid` | comma-separated numbers | Filter by thread IDs |
| `branded` | `branded` | boolean | Shows channel icon |

## Other options for other overlays.

WIP.

No generated sections.
