# All URL Parameters for Social Stream Ninja

This completes the comprehensive list of URL parameters available for your live streaming chat overlay system. Each parameter can be added to the URL using standard query string format:

```
?parameter1=value&parameter2=value
```

For boolean parameters, simply including the parameter name enables it:
```
?darkmode&compact
```

For parameters requiring values:
```
?scale=1.5&limit=200&ttskey=YOUR_API_KEY
```

## URL Parameters for the Streaming Overlay (dock.html)

These are for the main streaming overlay
```
https://socialstream.ninja/dock.html?session=xxxxxxxxx&urlparameter=value
```
### Basic Configuration Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `session` | string | Sets the session ID for connecting to the chat. Also accepts `s` or `id` as alternatives |
| `password` | string | Sets a password for the session |
| `scale` | float | Adjusts the size scaling of the overlay (default: 1.0) |
| `limit` | number | Maximum number of messages to show before older ones are removed |
| `opacity` | 0.0-1.0 | Sets the opacity of the main overlay window |
| `hidemenu` | boolean or "2" | Hides the menu bar. Value of "2" keeps scroll lock functionality |
| `css` | URL or CSS string | Applies custom CSS styling via URL or direct CSS |
| `cssb64` | base64 string | Applies custom CSS styling via base64 encoded string |
| `label` | string | Assigns a label to this instance |

### Visual Style Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `darkmode` | boolean | Enables dark theme with black background |
| `lightmode` | boolean | Enables light theme with white background |
| `transparent` | boolean | Makes background transparent and hides scrollbar |
| `chroma` | hex color | Sets a specific background color (without #) |
| `blur` | number | Applies blur effect to messages (value in pixels) |
| `compact` | boolean | Enables compact mode with less spacing |
| `padding` | number | Sets padding between messages in pixels |
| `largeavatar` | boolean | Shows larger user avatars on the left side |
| `emoji` | number | Sets emoji size scaling (percentage, default: 140) |
| `nooutline` | boolean | Removes text outline effects |
| `font` | string | Sets custom font family |
| `googlefont` | string | Loads and uses a Google Font |

### Layout Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `horizontal` | boolean | Makes messages scroll horizontally |
| `horizontalreverse` | boolean | When horizontal is enabled, enters left-to-right mode so newest messages slide in from the left |
| `alignbottom` | boolean | Makes messages start from bottom |
| `alignright` | boolean | Aligns messages to the right side |
| `rtl` | boolean | Enables right-to-left text direction |
| `fixed` | boolean | Makes messages overlap each other |
| `twolines` | boolean | Places messages on a separate line below usernames |
| `split` | boolean | Enables split mode for message alignment |
| `bubble` | boolean | Styles messages as chat bubbles |
| `fadedtop` | boolean | Fades out the top of the overlay |

### Animation Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `fadein` | boolean | Enables fade-in animation for new messages |
| `fadeout` | boolean | Enables fade-out animation when removing messages |
| `swipeleft` | boolean | Messages slide in from the right |
| `swiperight` | boolean | Messages slide in from the left |
| `swipeup` | boolean | Messages slide up from bottom |
| `smooth` | boolean | Enables smooth scrolling |
| `animatein` | string | Sets specific entrance animation (see animate.css) |
| `animateout` | string | Sets specific exit animation (see animate.css) |

### Message Display Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `showtime` | number | Auto-hides messages after specified milliseconds |
| `delaytime` | number | Delays showing messages by specified milliseconds |
| `trim` | number | Trims messages longer than specified characters |
| `trimname` | number | Trims usernames longer than specified characters |
| `hidenames` | boolean | Hides usernames completely |
| `firstnames` | boolean | Shows only first names of users |
| `hidesource` | boolean | Hides the source platform icons (YouTube, Twitch, etc.) |
| `noavatar` | boolean | Hides user avatars |
| `nobadges` | boolean | Hides user badges |
| `limitbadges` | number | Limits number of badges shown per message |
| `notime` | boolean | Hides timestamp |
| `sequence` | boolean | Hides name/icons if sequential messages from same user |

### Filtering Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `hidecommands` | boolean | Hides messages starting with "!" |
| `hideshortmessages` | number | Hides messages shorter than specified length |
| `noemojisonly` | boolean | Filters out messages containing only emojis |
| `stripemoji` | boolean | Removes all emojis from messages |
| `striphtml` | boolean | Removes HTML formatting from messages |
| `striplinks` | boolean | Removes links from messages |
| `activelinks` | boolean | Makes URLs clickable |
| `shortlink` | boolean | Shortens displayed links |
| `onlytwitch` | boolean | Shows only Twitch messages |
| `hidetwitch` | boolean | Hides Twitch messages |
| `hidefrom` | comma-separated strings | List of usernames to hide messages from |
| `onlyfrom` | comma-separated strings | List of usernames to exclusively show |
| `badkarma` | 0.0-1.0 | Filters messages based on sentiment score |

### Message Selection & Queue Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `autoshow` | boolean | Automatically features new messages |
| `autoshowtime` | number | Custom timing for auto-show feature (milliseconds) |
| `chartime` | number | Time per character for auto-show duration |
| `autoshowdonos` | boolean | Auto-features only donation messages |
| `autoshowmembers` | boolean | Auto-features only member messages |
| `autoshowqueued` | boolean | Auto-shows queued messages |
| `queueonly` | boolean | Shows only queued messages |
| `pinnedonly` | boolean | Shows only pinned messages |
| `viewonly` | boolean | Disables chat, pin, and feature capabilities |
| `chatmode` | boolean | Enables chat-only mode (no pin/feature) |
| `helpermode` | boolean | Enables view/pin/queue mode (no chat/feature) |
| `sync` | boolean | Syncs message selection across multiple docks |

### Text-to-Speech (TTS) Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `speech` or `tts` | language code | Enables TTS with specified language (e.g., "en-US") |
| `volume` | 0.0-1.0 | Sets TTS volume |
| `rate` | number | Sets TTS speaking rate |
| `pitch` | number | Sets TTS pitch |
| `voice` | string | Specifies TTS voice to use |
| `ttscommand` | string | Custom command to trigger TTS (default: "!say") |
| `ttscommandmembersonly` | boolean | Restricts TTS command to members only |
| `simpletts` | boolean | Simplified TTS output without "says" phrases |
| `readevents` | boolean | Enables TTS for stream events |
| `readouturls` | boolean | Reads URLs instead of saying "link" |

### Donation & Member Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `showonlydonos` | boolean | Shows only messages with donations |
| `showonlymembers` | boolean | Shows only messages from members |
| `stripdonations` | boolean | Removes donation data from messages |
| `nodonohighlight` | boolean | Disables background highlighting for donations |
| `t1` | number | First donation threshold amount (USD) |
| `t1c` | hex/color | Color for first donation threshold messages |
| `t2` | number | Second donation threshold amount (USD) |
| `t2c` | hex/color | Color for second donation threshold messages |
| `t3` | number | Third donation threshold amount (USD) |
| `t3c` | hex/color | Color for third donation threshold messages |

### Bot & Host Control Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `myname` or `botlist` | comma-separated strings | List of bot usernames to identify |
| `hidebots` | boolean | Hides messages from identified bots |
| `hidebotnames` | boolean | Hides names of identified bots |
| `hidehosts` | boolean | Hides messages from hosts |
| `hidehostnames` | boolean | Hides names of hosts |
| `nobeepbot` | boolean | Disables notification sound for bot messages |
| `nobeephost` | boolean | Disables notification sound for host messages |
| `nobeepevent` | boolean | Disables notification sound for events |
| `nobeepmod` | boolean | Disables notification sound for moderator messages |
| `showvipbadge` | boolean | Shows special badge for VIP users |
| `autofeaturevip` | boolean | Auto-features messages from VIP users |
| `autofeaturepriv` | boolean | Auto-features messages from privileged users |

### Notification & Sound Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `beep` | boolean | Enables sound notification for new messages |
| `beepvolume` | 0-100 | Sets volume for notification sound (percentage) |
| `custombeep` | URL | Custom sound file URL for notifications |
| `beepwords` | boolean | Replaces asterisks with "beep" in messages |

### OBS Integration Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `remote` | boolean/string | Enables OBS scene state display |
| `cycle` | boolean | Allows guests to change OBS scenes with !cycle |
| `startstop` | boolean | Allows privileged users to start/stop OBS |
| `server` | URL | Custom WebSocket server URL |
| `server2` | URL | Secondary WebSocket server URL |
| `server3` | URL | Tertiary WebSocket server URL |
| `lanonly` | boolean | Restricts P2P connections to LAN only |

### Export & Saving Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `save` | boolean | Auto-saves messages to downloads folder |
| `savesingle` | boolean | Saves last message to a file |
| `savefeatured` | boolean | Saves featured message to file |
| `saveimg` | boolean | Includes user avatar URLs when saving |
| `reload` | boolean | Reloads last ~50 messages on refresh |
| `loadlast` | number | Loads specified number of messages from database |

### Professional API Integration Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `ttskey` or `googlettskey` | string | Google Cloud TTS API key |
| `elevenlabskey` | string | ElevenLabs TTS API key |
| `speechifykey` | string | Speechify TTS API key |

### Google Cloud TTS Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `googlerate` | float | Google TTS speaking rate |
| `googlepitch` | float | Google TTS pitch adjustment |
| `googleaudioprofile` | string | Audio profile (e.g., "handset-class-device") |
| `voicegoogle` | string | Google TTS voice name (e.g., "en-GB-Standard-A") |

### ElevenLabs TTS Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `elevenlatency` | 0-4 | Latency optimization level |
| `elevenstability` | 0.0-1.0 | Voice stability setting |
| `elevensimilarity` | 0.0-1.0 | Voice similarity boost |
| `elevenstyle` | 0.0-1.0 | Style intensity |
| `elevenrate` | float | Speaking rate |
| `elevenspeakerboost` | boolean | Enables speaker boost |
| `voice11` or `elevenlabsvoice` | string | Voice ID |
| `elevenlabsmodel` | string | Model selection |

### Speechify Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `speechifyspeed` | float | Speaking speed |
| `speechifymodel` | string | Model selection (e.g., 'simba-english') |
| `voicespeechify` | string | Voice selection |

### Event Handling Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `filterevents` | comma-separated strings | List of event types to filter |
| `trivialevents` | boolean | Allows background shading for minor events |
| `showonlyevents` | boolean | Shows only stream events |
| `hideallevents` | boolean | Hides all stream events |
| `dissolve` | boolean | Stream events fade away after 3s |

### Privacy & Security Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `privateonly` | boolean | Shows only private messages |
| `includeprivate` | boolean | Includes private messages |
| `password` | string | Sets password for connection |
| `localserver` | boolean | Uses local WebSocket server |

### Debug & Development Parameters

| Parameter | Values | Description |
|-----------|---------|-------------|
| `debug` | boolean | Enables debug mode |
| `notobs` | boolean | Disables OBS studio detection |
| `filtertid` | comma-separated numbers | Filter by thread IDs |
| `branded` | boolean | Shows channel icon |

## Other options for other overlays.

WIP.

