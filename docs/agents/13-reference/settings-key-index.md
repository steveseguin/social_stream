# Settings Key Index

Status: generated lookup pass from `shared/config/settingsDefinitions.js` on 2026-06-24.

Use this page to find exact popup setting keys quickly. For UI behavior, storage behavior, or live-update behavior, verify against `popup.html`, `popup.js`, and the relevant runtime code.

## Counts

- Total setting keys: 327
- Categories: 54
- Types: boolean=170, text=98, select=10, number=49

## Focused Validation Note

On 2026-06-24, a read-only inline Node metadata checker confirmed these generated counts and found no duplicate object-key tokens, missing generated category references, or missing required `type`/`category`/`description` fields in `shared/config/settingsDefinitions.js`.

Evidence label: `focused-metadata-validation`; not runtime-tested. This does not validate popup UI behavior, storage, generated links, app parity, migration, or live setting changes.

## Streaming chat (dock & overlay)

Category key: `streaming_chat_dock_overlay`. Settings: 9.

| Key | Type | Short Description |
| --- | --- | --- |
| `autoshowtime` | number | Set custom auto-select show time ms. |
| `beepvolume` | number | Lower the beep's volume |
| `chromaalpha` | number | This won't work in Chrome |
| `delaytime` | number | This option gives you time to delete a message with another dock that doesn't have the delay; censorship-friendly then |
| `opacity` | number | This won't work in Chrome |
| `overlayPreset` | select | This link will display chat messages as a streaming list. Use as an overlay or as a control dock. |
| `scale` | number | Set emoji scale 1.00x. |
| `showtime` | number | Set auto-hide message after ms. |
| `stripatext` | boolean | Remove @ from the start of display names. |

## More TTS options

Category key: `more_tts_options`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `volume` | number | The volume has a max of 1.0 (100%) |

## Text-to-Speech Service Provider

Category key: `text_to_speech_service_provider`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `ttsProvider` | select | Choose text-to-Speech Service Provider. |

## Built-in System TTS Options

Category key: `built_in_system_tts_options`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `pitch` | number | Pitch multiplier (0.1-2.0) for the system TTS voice. |
| `rate` | number | Set speaking rate. |

## Kokoro TTS Options

Category key: `kokoro_tts_options`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `kokorospeed` | number | Set speaking rate. |

## Kitten TTS Options

Category key: `kitten_tts_options`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `kittenspeed` | number | Set speaking rate. |

## ElevenLabs TTS Options

Category key: `elevenlabs_tts_options`. Settings: 6.

| Key | Type | Short Description |
| --- | --- | --- |
| `elevenlatency` | number | Set elevenLabs Latency Optimization. |
| `elevenrate` | number | Set speaking Rate. |
| `elevensimilarity` | number | Set similarity Boost. |
| `elevenstability` | number | Set stability. |
| `elevenstyle` | number | ElevenLabs style intensity parameter (0.0-1.0). |
| `latency` | number | Set elevenLabs Latency Optimization. |

## Google Cloud TTS Options

Category key: `google_cloud_tts_options`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `googlepitch` | number | Pitch adjustment (-20 to +20) for Google Cloud TTS voices. |
| `googlerate` | number | Set speaking rate. |

## Speechify TTS Options

Category key: `speechify_tts_options`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `speechifyspeed` | number | Playback speed multiplier for Speechify TTS voices. |

## OpenAI TTS Options

Category key: `openai_tts_options`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `hideshortmessages` | number | Set hide basic messages shorter than chars. |
| `limit` | number | Set limit emotes shown:. |
| `openaispeed` | number | Set speaking rate. |
| `padding` | number | Set padding between messages px. |

## Customize Donation Colors by Threshold

Category key: `customize_donation_colors_by_threshold`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `t1` | number | Set threshold: $ USD, Color:. |
| `t2` | number | Set threshold: $ USD, Color:. |
| `t3` | number | Set threshold: $ USD, Color:. |
| `trimname` | number | Set trim names longer than chars. |

## Featured chat overlay

Category key: `featured_chat_overlay`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `featuredOverlayStyle` | select | This link will only show selected messages, one at a time. Requires the dock to select messages. |
| `queuetime` | number | Set queue + Show messages for at least ms. |

## Colors

Category key: `colors`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `comment_background` | text | Hex or CSS color used for comment card backgrounds on overlays. |
| `comment_color` | text | Color applied to the comment text on overlays. |
| `name_background` | text | Custom background color behind usernames in overlays. |
| `name_color` | text | Custom text color for usernames in overlays. |

## Configure LLM API

Category key: `configure_llm_api`. Settings: 36.

| Key | Type | Short Description |
| --- | --- | --- |
| `aiAutoTranslate` | boolean | Translate incoming chat messages to the target language using the selected AI provider. |
| `aiAutoTranslateBlockMode` | boolean | Wait for translation before showing messages; drop messages if the translator is busy, times out, or fails. |
| `aiAutoTranslateContext` | boolean | Include the last 10 chat messages as context for AI translation. |
| `aiAutoTranslateOutgoing` | boolean | Translate outgoing host messages before sending them to chat sources. |
| `aiAutoTranslateOutgoingTargetLanguage` | text | Target language for AI-translated outgoing host messages. Defaults to the incoming translation target. |
| `aiAutoTranslateTargetLanguage` | text | Target language for AI-translated incoming chat messages. Defaults to en-US. |
| `aiAutoTranslateTimeout` | number | Maximum time in milliseconds to wait for each AI translation request. Defaults to 10000. |
| `aiProvider` | select | Choose which LLM provider powers the chat bot and automation features. |
| `bedrockAccessKey` | text | AWS access key used when authenticating to Bedrock. |
| `bedrockmodel` | text | Bedrock model identifier to request (for example anthropic.claude-v2). |
| `bedrockRegion` | text | AWS region where your Bedrock deployment runs, such as us-east-1. |
| `bedrockSecretKey` | text | AWS secret key paired with the Bedrock access key. |
| `chatgptApiKey` | text | OpenAI API key used when the ChatGPT provider is selected. |
| `chatgptmodel` | text | Model slug to request from OpenAI (for example gpt-4o-mini). |
| `customAIApiKey` | text | API key for your custom OpenAI-compatible endpoint (optional). |
| `customAIEndpoint` | text | Base URL for the custom OpenAI-compatible API to call. |
| `customAIModel` | text | Model identifier exposed by the custom OpenAI-compatible service. |
| `deepseekApiKey` | text | DeepSeek API key used when that provider is active. |
| `deepseekmodel` | text | DeepSeek model name to request (e.g., deepseek-chat). |
| `geminiApiKey` | text | Google AI Studio API key required for Gemini access. |
| `geminimodel` | text | Gemini model identifier to call (for example gemini-2.5-flash). |
| `groqApiKey` | text | Groq API key used when leveraging Groq-hosted models. |
| `groqmodel` | text | Model slug provided by Groq (for example llama-3.1-8b-instant). |
| `hostedLLMEndpoint` | text | Optional endpoint override for the SSN Hosted Trial LLM. |
| `hostedLLMModel` | text | Optional model override for the SSN Hosted Trial LLM. |
| `hostedLLMToken` | text | Optional token override for the SSN Hosted Trial LLM. |
| `localgemmahost` | text | Self-hosted origin used to fetch Local browser model assets. |
| `localgemmamodel` | text | Model identifier or folder name override for the Local Gemma browser model. |
| `localqwenmodel` | text | Model identifier or folder name override for the Local Qwen browser model. |
| `ollamaendpoint` | text | HTTP endpoint where your local Ollama server is reachable. |
| `ollamaKeepAlive` | number | Time to keep the model in memory; -1 unlimited. In minutes |
| `ollamamodel` | text | Ollama model tag to load (for example gemma3:1b). |
| `openrouterApiKey` | text | OpenRouter API key for routing hosted model calls. |
| `openroutermodel` | text | Model identifier from the OpenRouter catalog (e.g., openai/gpt-4o). |
| `xaiApiKey` | text | xAI (Grok) API key for authenticated requests. |
| `xaimodel` | text | Model slug to call via the xAI API. |

## Chat bot

Category key: `chat_bot`. Settings: 16.

| Key | Type | Short Description |
| --- | --- | --- |
| `allowLLMSummary` | boolean | Include chat summaries with past context |
| `alwaysRespondLLM` | boolean | By default the bot is told not if it doesn't see value in doing so. You can disable that instruction here though |
| `bottriggerwords` | text | Leave empty to trigger always. The bot may however still choose to not respond on its own though. |
| `chatbotHistoryTotal` | number | There's 10 included by default; this is user, not entire, chat history. |
| `chatbotRespondToReflections` | boolean | When enabled, the chat bot can answer reflections created by dock/API messages from the host. |
| `chatbotTimestamps` | boolean | Include timestamp in chat history (toLocaleString). |
| `includeBotResponses` | boolean | Include the bot's own replies to user in chat history. This can confuse an LLM, so avoid it. |
| `llmsummary` | boolean | Include chat summaries with past context |
| `modLLMonly` | boolean | The bot will only ever respond to mods |
| `nollmcontext` | boolean | Include message history as context for the bot. Will slow things down.. |
| `noollamabotname` | boolean | When enabled, do not include the bot's name when responding. |
| `ollama` | boolean | Enable the LLM AI Bot responder. |
| `ollamabotname` | text | Display name the Ollama bot uses when replying. |
| `ollamaoverlayonly` | boolean | Do not relay bot messages |
| `ollamaprompt` | text | System prompt prepended to every Ollama bot response. Supports prompt variables. |
| `ollamaRateLimitPerTab` | number | There's a minimum of 5-seconds by default |

## Give the above chat bot access to additional custom knowledge that you can provide

Category key: `give_the_above_chat_bot_access_to_additional_custom_knowledge_that_you_can_provide`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `ollamaRagEnabled` | boolean | Enable the RAG mode, which has the LLM bot access a local database containing additional knowledge. |

## Enable Text to Speech

Category key: `enable_text_to_speech`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `ollamatts` | boolean | Text to speech bot messages |

## Censor bot options

Category key: `censor_bot_options`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `ollamaCensorBot` | boolean | Use the bot to moderate messages, deleting messages that it thinks aren't fit. |
| `ollamaCensorBotBlockMode` | boolean | Only approved messages get thru, but this may slow things down and messages will get skipped. |

## Standalone one-on-one chat bot

Category key: `standalone_one_on_one_chat_bot`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `allowChatBot` | boolean | Allow for private communication with the chat bot. Currently doesn't have access to RAG. |

## Sources to Monitor

Category key: `sources_to_monitor`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `eventsSources` | text | Enter youtube,twitch,tiktok,etc |

## Display Options

Category key: `display_options`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `maxentries` | number | Set maximum entries to show. |
| `maxevents` | number | Set maximum events to display:. |
| `maxusers` | number | Set maximum users to display. |
| `updateinterval` | number | Set update interval seconds (0 = disabled). |

## Must enable the trigger to use

Category key: `must_enable_the_trigger_to_use`. Settings: 5.

| Key | Type | Short Description |
| --- | --- | --- |
| `customwaitlistcommand` | text | Custom chat command viewers type (for example !queue) to join the waitlist overlay. |
| `hypemode` | boolean | Enable to the hype meter's processing |
| `ticker` | boolean | Enable to Select the ticker source file |
| `waitlistmode` | boolean | Enable the waitlist/queue overlay and listen for the join command. |
| `wordcloud` | boolean | Enable the word cloud overlay trigger. |

## Other customization options

Category key: `other_customization_options`. Settings: 7.

| Key | Type | Short Description |
| --- | --- | --- |
| `customwaitlistmessage` | text | Headline text displayed on the waitlist overlay; supports the {trigger} placeholder. |
| `customwaitlistmessagetoggle` | boolean | Display the custom waitlist message instead of the default prompt. |
| `duration` | number | Duration takes priority over speed in most cases; Star Wars has a fixed speed. |
| `soundvolume` | number | Lower the volume |
| `speed` | number | Set scroll speed x. |
| `waitlistallowrejoin` | boolean | Allow removed users to join the waitlist again. |
| `waitlistmembersonly` | boolean | When enabled, only members can enter. |

## Configure select-a-winner draw mode

Category key: `configure_select_a_winner_draw_mode`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `drawmode` | boolean | When enabled, configure as winner-draw mode instead of queue. |

## Poll Settings

Category key: `poll_settings`. Settings: 10.

| Key | Type | Short Description |
| --- | --- | --- |
| `multipleChoiceOptions` | text | Comma separated answer list for multiple choice polls. |
| `pollEnabled` | boolean | Enable to poll |
| `pollMatchMode` | select | Controls whether poll votes must match the whole message or can use hashtags anywhere in the message. |
| `pollQuestion` | text | Prompt shown to viewers when the poll overlay is active. |
| `pollSpam` | boolean | Allow multiple votes per user. |
| `pollStyle` | select | Visual theme applied to the poll overlay. |
| `pollTally` | boolean | Show number of votes instead of perecent. |
| `pollTimer` | number | Set timer (seconds):. |
| `pollTimerState` | boolean | When enabled, timer (seconds):. |
| `pollType` | select | Poll mode (free-form, yes/no, or multiple choice). |

## Top Bar Settings

Category key: `top_bar_settings`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `rotateinterval` | number | Set rotation interval seconds. |

## Custom GIF Commands Settings

Category key: `custom_gif_commands_settings`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `enableCustomGifCommands` | boolean | Enable to custom GIF Commands |

## Global settings and tools

Category key: `global_settings_and_tools`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `disableRelayThrottle` | boolean | Send relayed chat messages without per-site throttling or queues. |
| `sdk` | boolean | When enabled, use SDK transport (beta). |

## Opt-in options

Category key: `opt_in_options`. Settings: 11.

| Key | Type | Short Description |
| --- | --- | --- |
| `chime` | boolean | When enabled, capture Chime chat. |
| `customdiscordchannel` | text | Comma separated Discord channel identifiers to capture; leave blank to allow every channel. |
| `discord` | boolean | When enabled, capture Discord chat. |
| `instagram` | boolean | When enabled, capture Instagram non-live comment. |
| `meet` | boolean | When enabled, capture Google Meet chat. |
| `openai` | boolean | When enabled, capture OpenAI chat. |
| `slack` | boolean | When enabled, capture Slack chat. |
| `teams` | boolean | When enabled, capture Teams chat. |
| `telegram` | boolean | When enabled, capture Telegram chat. |
| `whatsapp` | boolean | When enabled, capture WhatsApp chat. |
| `xcapture` | boolean | Enable to x.com embedded page features |

## Opt-out options

Category key: `opt_out_options`. Settings: 10.

| Key | Type | Short Description |
| --- | --- | --- |
| `customkickaccount` | text | Kick channel name to keep capturing when the Kick opt-out toggle is enabled. |
| `customkickstate` | boolean | Disable capturing Kick chat except for channels listed in the allow field. |
| `customriversideaccount` | text | Riverside room identifier to keep capturing when the opt-out toggle is enabled. |
| `customriversidestate` | boolean | Disable capturing Riverside chat except for the allow list. |
| `customtiktokaccount` | text | TikTok channel handle to keep capturing when the opt-out toggle is enabled. |
| `customtiktokstate` | boolean | Disable capturing TikTok chat except for the allow list. |
| `customtwitchaccount` | text | Twitch channel name to keep capturing when the opt-out toggle is enabled. |
| `customtwitchstate` | boolean | Disable capturing Twitch chat except for the allow list. |
| `customyoutubeaccount` | text | YouTube channel ID to keep capturing when the opt-out toggle is enabled. |
| `customyoutubestate` | boolean | Disable capturing YouTube chat except for the allow list. |

## Miscellaneous options for sites

Category key: `miscellaneous_options_for_sites`. Settings: 11.

| Key | Type | Short Description |
| --- | --- | --- |
| `autoLiveYoutube` | boolean | Instead of Top Chat, auto-select Live Chat; Youtube Live chat pop out. |
| `collecttwitchpoints` | boolean | If enabled, it will work even if the extension itself is set to inactive |
| `detweet` | boolean | If enabled, it will work even if the extension itself is set to inactive |
| `disableYoutubeAutoScroll` | boolean | Turn off the YouTube Popout chat auto-scroll keeper. |
| `flipYoutube` | boolean | Flip Youtube watch page layout |
| `hidePaidPromotion` | boolean | Hide |
| `kickchatroomscout` | boolean | Experimental: on kick.com pages, check bridge lookup first and seed chatroom cache when missing. |
| `twichadannounce` | boolean | Trigger an inbound message starting when there is an ad starting/stopping |
| `twichadmute` | boolean | If enabled, it will work even if the extension itself is set to inactive |
| `vdoninjadiscord` | boolean | Make Discord Videos available as VDO.Ninja view links |
| `youtubeLargerFont` | boolean | Increase the font size of chat messages in the Youtube Live chat popout |

## Custom Injection

Category key: `custom_injection`. Settings: 25.

| Key | Type | Short Description |
| --- | --- | --- |
| `addkarma` | boolean | When enabled, add sentiment scores to messages. |
| `allmemberchat` | boolean | Mark a message as a memberchat only when its a highlighted membership message |
| `blockpremiumshorts` | boolean | Block donations/memberships from Youtube Shorts. Requires &shorts added to the Youtube chat pop out also. |
| `bttv` | boolean | Enable BTTV emotes - YT/TW channels + globals |
| `capturejoinedevent` | boolean | Capture 'joined' stream events from supported sources |
| `capturelikeevent` | boolean | Allow 'liked' stream events in TikTok (high volume) |
| `delaykick` | boolean | Delay capturing messages from Kick to give time for messages to be deleted if needed; 3 extra seconds of delay |
| `delaytwitch` | boolean | Delay capturing messages from Twitch to give time for messages to be deleted if needed; 3 extra seconds of delay |
| `delayyoutube` | boolean | Delay capturing messages from Youtube to give time for messages to be deleted if needed; 3 extra seconds of delay |
| `disableDB` | boolean | By default all inbound messages are saved to a local database for later look-up reference |
| `discordmemberships` | boolean | Treat Discord roles as Memberships |
| `ffz` | boolean | Enable FFZ emotes - YT/TW channels + globals |
| `filterevents` | text | Provide comma separated values; values that match a word in the event will be rejected. |
| `filtereventstoggle` | boolean | Enable the event filter to hide events containing the provided keywords. |
| `firsttimerbadge` | boolean | Prepend a custom leaf badge to messages flagged as first-time chatters. |
| `firsttimers` | boolean | Enable first-time chatter detection and include last activity timestamps. |
| `hideevents` | boolean | Block stream events (follows, likes, subs) from appearing anywhere. |
| `limitedyoutubememberchat` | boolean | Mark a message as a memberchat only when its a highlighted membership message |
| `notiktokdonations` | boolean | Do not treat coin-bought items as gifts on Tiktok, such as roses |
| `notiktoklinks` | boolean | Remove links when sending messages to Tiktok from SocialStreamNinja |
| `pronouns` | boolean | Enable Pronoun support - https://pr.alejo.io/ |
| `pronounscombined` | boolean | When enabled, show combined Twitch pronouns when available. |
| `pumpTheNumbers` | boolean | When enabled, multiply viewer count by 1.75x. |
| `seventv` | boolean | Enable 7TV emotes - YT/TW channels + globals |
| `unlimitedDB` | boolean | Override's the database 30-day storage limits |

## Printer Control

Category key: `printer_control`. Settings: 21.

| Key | Type | Short Description |
| --- | --- | --- |
| `disablehost` | boolean | Disable the host chat option in the dock and the api. Featured chat remains enabled. |
| `h2r` | boolean | Send all captured events to the configured H2R Graphics endpoint. |
| `h2rserver` | text | H2R Graphics server identifier or full URL to receive forwarded events. |
| `lanonly` | boolean | Only others on the same network/computer as yours can connect to this via p2p |
| `post` | boolean | Forward all captured events to the custom POST endpoint below. |
| `postalldiscord` | boolean | Forward all captured messages to the Discord webhook URL. |
| `postallserverdiscord` | text | Discord webhook URL that receives every captured message. |
| `postdiscord` | boolean | Forward only donation events to the Discord webhook URL. |
| `postserver` | text | Custom HTTP endpoint or identifier to receive forwarded events. |
| `postserverdiscord` | text | Discord webhook URL that receives donation events. |
| `printerName` | text | Local printer name to use when printing chat from the dock. |
| `s10` | boolean | Enable the Stage TEN Chat API relay. |
| `s10apikey` | text | Stage TEN API key used when the relay is enabled. |
| `s10relay` | boolean | Relay messages from other sites to Stage TEN |
| `sharestreamid` | boolean | Some sites may wish to access your stream ID for custom third party integrations |
| `socketserver` | boolean | See documentation on socialstream.ninja for details. |
| `streamerbot` | boolean | Enable to streamer.bot websocket support |
| `streamerbotactionid` | text | Streamer.bot action GUID triggered for relayed events. |
| `streamerbotendpoint` | text | Streamer.bot WebSocket endpoint URL. |
| `streamerbotpassword` | text | Password used when connecting to the Streamer.bot WebSocket. |
| `webhookrelay` | boolean | Relay Ko-fi, Stripe, Buy Me a Coffee, and Fourthwall webhook payloads to your custom endpoint |

## Spotify Configuration

Category key: `spotify_configuration`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `spotifyClientId` | text | Client ID from your Spotify developer app. |
| `spotifyClientSecret` | text | Client secret from your Spotify developer app. |
| `spotifyEnabled` | boolean | Enable to spotify integration |
| `spotifyManagedQueue` | boolean | Use managed queue for Spotify chat requests (enables !revoke; queues one request at a time). |

## Now Playing Features

Category key: `now_playing_features`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `spotifyAnnounceFormat` | text | Template used when announcing tracks in chat (supports {song} and {artist}). |
| `spotifyAnnounceNewTrack` | boolean | When enabled, Social Stream announces new tracks in its overlays/relays (not posted to platform chat). |
| `spotifyBotName` | text | Display name used when Spotify announcements are sent to chat. |
| `spotifyPollingInterval` | number | Set polling interval (seconds): (3-60 seconds). |

## General Settings

Category key: `general_settings`. Settings: 3.

| Key | Type | Short Description |
| --- | --- | --- |
| `enablePointsSystem` | boolean | Enable to loyalty points system |
| `engagementWindow` | number | Set engagement window (minutes):. |
| `pointsPerEngagement` | number | Set points per engagement:. |

## Commands

Category key: `commands`. Settings: 3.

| Key | Type | Short Description |
| --- | --- | --- |
| `enableLeaderboardCommand` | boolean | Enable to !leaderboard command |
| `enablePointsCommand` | boolean | Enable to !points command |
| `enableRewardsCommand` | boolean | Enable to !rewards command |

## Management

Category key: `management`. Settings: 22.

| Key | Type | Short Description |
| --- | --- | --- |
| `autohi` | boolean | When enabled, auto-reply to " hi messages. |
| `blockChannelPointRelays` | boolean | When enabled, channel point redemptions are not relayed. |
| `blockrelayaccountroles` | text | Comma-separated SSApp account roles that must not send relayed messages. |
| `botreplyaccountroles` | text | Comma-separated SSApp account roles used for bot and auto-reply output. |
| `dice` | boolean | The user can use !dice 10 to have it out of ten; by default it is out 1 to 6 |
| `forwardcommands2kick` | boolean | When enabled, forward chat !commands to Kick. |
| `forwardcommands2twitch` | boolean | When enabled, forward chat !commands to Twitch. |
| `forwardcommands2youtube` | boolean | When enabled, forward chat !commands to YouTube. |
| `highlightHostMentions` | boolean | Highlight messages that mention a host name |
| `hostFirstSimilarOnly` | boolean | Hide duplicate messages from 'hosts'. |
| `identifyQuestions` | boolean | Automatically identifies questions in chat messages based on keywords like ?, how, what, etc. |
| `joke` | boolean | When enabled, tell joke on !joke message. |
| `limitcharacters` | number | Set max length of dock/relayed chat. |
| `limitcharactersstate` | boolean | Enable truncating relayed chat to the maximum length specified below. |
| `nohostreflections` | boolean | Hide relayed reflections of 'hosts'. |
| `nosaid` | boolean | When enabled, do not include 'User Said:' with relays". |
| `questionKeywords` | boolean | Comma-separated keywords to identify questions. |
| `relayaccountroles` | text | Comma-separated SSApp account roles that may send relayed messages. |
| `relayall` | boolean | When enabled, relay all messages (!NOT RECOMMENDED!). |
| `relaydonos` | boolean | When enabled, announce donations across all chats. |
| `relayhostonly` | boolean | When enabled, only relay if message is from a 'host'". |
| `relaytargets` | text | List of sources that you want to allow the relay to work with. Nothing implies all. |

## Custom JavaScript

Category key: `custom_javascript`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `customJsEnabled` | boolean | Upload custom JavaScript to extend functionality |

## Giphy/Tenor support

Category key: `giphy_tenor_support`. Settings: 7.

| Key | Type | Short Description |
| --- | --- | --- |
| `giphy` | boolean | When enabled, include a GIF when !giphy is used. |
| `giphy2` | boolean | When enabled, include a GIF when #{somekeyword} is used. |
| `giphyKey` | text | Giphy API key used to enable GIF search support. |
| `hidegiphytrigger` | boolean | Hide the Giphy/Tenor trigger word or sentence. |
| `randomgif` | boolean | When enabled, select random gif from top 10 results. |
| `tenor` | boolean | When enabled, include a GIF when !tenor is used. |
| `tenorKey` | text | Tenor API key used to enable GIF search support. |

## Trigger webhook URL by a !command

Category key: `trigger_webhook_url_by_a_command`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `chatwebhookpost` | boolean | When enabled, use POST instead of GET for webhook calls. |
| `chatwebhookstrict` | boolean | When enabled, trigger only if full message matches exactly. |

## Send fixed messages at intervals

Category key: `send_fixed_messages_at_intervals`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `dynamictiming` | boolean | If less than 10 messages total have come in, skip the automated message interval |

## Auto-responder

Category key: `auto_responder`. Settings: 2.

| Key | Type | Short Description |
| --- | --- | --- |
| `botReplyMessageFull` | boolean | When enabled, trigger only if full message matches exactly. |
| `midi` | boolean | Enable to mIDI hotkeys |

## Trigger MIDI note on command

Category key: `trigger_midi_note_on_command`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `midiOutputDevice` | select | Default MIDI output device used for trigger commands. |

## Message doubling / echos / duplicates / relayed

Category key: `message_doubling_echos_duplicates_relayed`. Settings: 6.

| Key | Type | Short Description |
| --- | --- | --- |
| `firstsourceonly` | boolean | Filter out duplicate messages as a result of you replying to multiple chat sites. Only the first reply is captured |
| `hideallreplies` | boolean | Do not capture your responses that you make to chat. They will be filtered out, so will not appear in the dock |
| `ignorealternatives` | boolean | Filter out third party relayed messages from capture; restream.io, beam, etc |
| `noduplicates` | boolean | Filter out duplicate messages that might occur with a specific source only. |
| `thissourceonly` | boolean | Only show replies from you if they are from the selected source |
| `thissourceonlytype` | select | Only show replies from you if they are from the selected source |

## Other filters

Category key: `other_filters`. Settings: 21.

| Key | Type | Short Description |
| --- | --- | --- |
| `blacklist` | boolean | Censor common bad words with asterixis. Create badwords.txt to make your own blocklist. |
| `blacklistblockmessages` | boolean | Block entire chat messages if they contain words from the bad word list. |
| `blacklistname` | boolean | Censor common bad words with asterixis in usernames |
| `colorofsource` | boolean | Sets the color for a name to the color of the source's branding. |
| `colorofsourcebg` | boolean | Sets the color for a background to the color of the source's branding. Featured messages only. |
| `colorseed` | number | Set seed value used for color assignment. |
| `defaultavatar` | text | Fallback avatar image URL to use when a message has no profile picture. |
| `excludeReplyingTo` | boolean | Exclude 'Replying to @user' text when available from supported sources |
| `filtercommands` | boolean | Filter out messages that might be chat commands. |
| `filtercommandscustomtoggle` | boolean | Enable the custom command filter so messages starting with listed words are blocked. |
| `filtercommandscustomwords` | text | Provide comma separated values; messages that start with the word will be blocked. |
| `goodwordslist` | boolean | Allow only words in the goodwords.txt file, otherwise they will be turned into asterixis. |
| `highlightword` | text | Trivial events can be highlighted in the dock using &trivialevents |
| `lightencolorname` | boolean | Makes it easier to see names on darker backgrounds. |
| `memberchatonly` | boolean | Totally filter out messages from non-members |
| `nosubcolor` | boolean | Members on Youtube won't have green names, for example. |
| `randomcolor` | boolean | If a name lacks color data, randomly add one. |
| `randomcolorall` | boolean | Randomly sets the color for a name. |
| `removeContentImage` | boolean | Remove original content images from messages (stickers, twitter post images) |
| `textonlymode` | boolean | Just text is captured. No HTML, so no BTTV emotes, etc. |
| `totalcolors` | number | Set max number of random colors to use. |

## Blocked / Allowed Users:

Category key: `blocked_allowed_users`. Settings: 4.

| Key | Type | Short Description |
| --- | --- | --- |
| `blacklistusers` | text | Provide comma separated values; only values that match a username will be allowed. |
| `blacklistuserstoggle` | boolean | When enabled, blocked users. |
| `whitelistusers` | text | Provide comma separated values; only values that match a username will be allowed. |
| `whitelistuserstoggle` | boolean | Show only the specified users (approved list). |

## Assign roles/classes to certain users

Category key: `assign_roles_classes_to_certain_users`. Settings: 9.

| Key | Type | Short Description |
| --- | --- | --- |
| `adminnames` | text | Specify privileged/admin names to help identify them in chat. |
| `botnamesext` | text | Bot names to help identify them. |
| `hidebotnamesext` | boolean | When enabled, delete names for specified bots. |
| `hidebotsext` | boolean | When enabled, filter out messages for listed bots. |
| `hidehostsext` | boolean | When enabled, filter out messages for listed hosts. |
| `hidemodsext` | boolean | When enabled, filter out messages for listed mods. |
| `hostnamesext` | text | Host names to help identify them. |
| `modnamesext` | text | Mod names to help identify them. |
| `viplistusers` | text | VIP names to help identify them. |

## YouTube API

Category key: `youtube_api`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `youtubeapikey` | text | YouTube Data API key used for overlays that query YouTube. |

## Opened in new tab

Category key: `opened_in_new_tab`. Settings: 5.

| Key | Type | Short Description |
| --- | --- | --- |
| `discord_channelid` | text | Discord channel ID appended when opening the Discord chat shortcut. |
| `discord_serverid` | text | Discord server (guild) ID used for the Discord chat shortcut. |
| `facebook_username` | text | Facebook page or profile slug opened by the chat shortcut. |
| `instagramlive_username` | text | Instagram account handle used for the open chat shortcut. |
| `kick_username` | text | Kick channel slug opened by the chat shortcut. |

## Opened in new window

Category key: `opened_in_new_window`. Settings: 6.

| Key | Type | Short Description |
| --- | --- | --- |
| `dlive_username` | text | DLive channel name used by the open chat button. |
| `picarto_username` | text | Picarto channel name used by the open chat button. |
| `tiktok_username` | text | TikTok channel handle opened by the chat shortcut. |
| `trovo_username` | text | Trovo channel name opened in a new window. |
| `twitch_username` | text | Twitch channel name opened in a new window. |
| `youtube_username` | text | YouTube channel ID used when opening the pop-out chat window. |

## Custom

Category key: `custom`. Settings: 18.

| Key | Type | Short Description |
| --- | --- | --- |
| `custom1_url` | text | URL opened when the Custom 1 quick-launch button is clicked. |
| `custom1_url_newwindow` | boolean | When enabled, open custom URL 1 on new window. |
| `custom2_url` | text | URL opened when the Custom 2 quick-launch button is clicked. |
| `custom2_url_newwindow` | boolean | When enabled, open custom URL 2 on new window. |
| `custom3_url` | text | URL opened when the Custom 3 quick-launch button is clicked. |
| `custom3_url_newwindow` | boolean | When enabled, open custom URL 3 on new window. |
| `custom4_url` | text | URL opened when the Custom 4 quick-launch button is clicked. |
| `custom4_url_newwindow` | boolean | When enabled, open custom URL 4 on new window. |
| `custom5_url` | text | URL opened when the Custom 5 quick-launch button is clicked. |
| `custom5_url_newwindow` | boolean | When enabled, open custom URL 5 on new window. |
| `custom6_url` | text | URL opened when the Custom 6 quick-launch button is clicked. |
| `custom6_url_newwindow` | boolean | When enabled, open custom URL 6 on new window. |
| `custom7_url` | text | URL opened when the Custom 7 quick-launch button is clicked. |
| `custom7_url_newwindow` | boolean | When enabled, open custom URL 7 on new window. |
| `custom8_url` | text | URL opened when the Custom 8 quick-launch button is clicked. |
| `custom8_url_newwindow` | boolean | When enabled, open custom URL 8 on new window. |
| `custom9_url` | text | URL opened when the Custom 9 quick-launch button is clicked. |
| `custom9_url_newwindow` | boolean | When enabled, open custom URL 9 on new window. |

## Hide your links

Category key: `hide_your_links`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `hideyourlinks` | boolean | Hide the links for each page so it can't be seen on stream. |

## Miscellaneous

Category key: `miscellaneous`. Settings: 1.

| Key | Type | Short Description |
| --- | --- | --- |
| `translationlanguage` | select | Choose a different translation. Re-open menu to apply language changes. |

## Extraction Gaps

- Map each key to exact UI label and popup section.
- Mark whether changing the key takes effect live, after source reload, after overlay reload, or after app restart.
- Mark extension-only, app-only, shared, and URL-generated keys.
