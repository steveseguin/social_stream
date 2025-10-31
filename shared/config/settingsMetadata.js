// Auto-generated settings metadata based on popup.html analysis
// Do not edit by hand; update via metadata generation script.
const SETTINGS_CATEGORIES = Object.freeze({
  'streaming_chat_dock_overlay': { label: "Streaming chat (dock & overlay)", order: 0 },
  'more_tts_options': { label: "More TTS options", order: 5 },
  'text_to_speech_service_provider': { label: "Text-to-Speech Service Provider", order: 6 },
  'built_in_system_tts_options': { label: "Built-in System TTS Options", order: 7 },
  'kokoro_tts_options': { label: "Kokoro TTS Options", order: 8 },
  'kitten_tts_options': { label: "Kitten TTS Options", order: 9 },
  'elevenlabs_tts_options': { label: "ElevenLabs TTS Options", order: 10 },
  'google_cloud_tts_options': { label: "Google Cloud TTS Options", order: 11 },
  'speechify_tts_options': { label: "Speechify TTS Options", order: 12 },
  'openai_tts_options': { label: "OpenAI TTS Options", order: 13 },
  'customize_donation_colors_by_threshold': { label: "Customize Donation Colors by Threshold 🌈💰", order: 16 },
  'featured_chat_overlay': { label: "Featured chat overlay", order: 18 },
  'colors': { label: "Colors", order: 23 },
  'configure_llm_api': { label: "Configure LLM API 🦙", order: 29 },
  'chat_bot': { label: "Chat bot 🤖💬", order: 30 },
  'give_the_above_chat_bot_access_to_additional_custom_knowledge_that_you_can_provide': { label: "Give the above chat bot access to additional custom knowledge that you can provide", order: 31 },
  'enable_text_to_speech': { label: "Enable Text to Speech", order: 34 },
  'censor_bot_options': { label: "Censor bot options 🤖🚫🤬", order: 37 },
  'standalone_one_on_one_chat_bot': { label: "Standalone one-on-one chat bot", order: 38 },
  'sources_to_monitor': { label: "Sources to Monitor", order: 42 },
  'display_options': { label: "Display Options", order: 43 },
  'must_enable_the_trigger_to_use': { label: "Must enable the trigger to use", order: 47 },
  'other_customization_options': { label: "Other customization options", order: 48 },
  'configure_select_a_winner_draw_mode': { label: "Configure select-a-winner draw mode", order: 57 },
  'poll_settings': { label: "Poll Settings", order: 64 },
  'top_bar_settings': { label: "Top Bar Settings", order: 71 },
  'custom_gif_commands_settings': { label: "Custom GIF Commands Settings", order: 116 },
  'global_settings_and_tools': { label: "Global settings and tools", order: 117 },
  'opt_in_options': { label: "Opt-in options", order: 118 },
  'opt_out_options': { label: "Opt-out options", order: 119 },
  'miscellaneous_options_for_sites': { label: "Miscellaneous options for sites", order: 120 },
  'custom_injection': { label: "Custom Injection", order: 121 },
  'printer_control': { label: "Printer Control", order: 122 },
  'spotify_configuration': { label: "Spotify Configuration", order: 123 },
  'now_playing_features': { label: "Now Playing Features", order: 124 },
  'general_settings': { label: "General Settings", order: 126 },
  'commands': { label: "Commands", order: 127 },
  'management': { label: "Management", order: 128 },
  'custom_javascript': { label: "Custom JavaScript", order: 129 },
  'giphy_tenor_support': { label: "Giphy/Tenor support", order: 130 },
  'trigger_webhook_url_by_a_command': { label: "Trigger webhook URL by a !command", order: 131 },
  'send_fixed_messages_at_intervals': { label: "Send fixed messages at intervals", order: 132 },
  'auto_responder': { label: "Auto-responder", order: 133 },
  'trigger_midi_note_on_command': { label: "Trigger MIDI note on command", order: 134 },
  'message_doubling_echos_duplicates_relayed': { label: "Message doubling / echos / duplicates / relayed", order: 135 },
  'other_filters': { label: "Other filters", order: 136 },
  'blocked_allowed_users': { label: "Blocked / Allowed Users:", order: 137 },
  'assign_roles_classes_to_certain_users': { label: "Assign roles/classes to certain users", order: 138 },
  'youtube_api': { label: "YouTube API", order: 139 },
  'opened_in_new_tab': { label: "Opened in new tab", order: 140 },
  'opened_in_new_window': { label: "Opened in new window", order: 141 },
  'custom': { label: "Custom", order: 142 },
  'hide_your_links': { label: "Hide your links", order: 151 },
  'miscellaneous': { label: "Miscellaneous", order: 9999 },
});

const SETTINGS_METADATA = Object.freeze({
  "addkarma": {
    type: "boolean",
    category: "custom_injection",
    description: "When enabled, add sentiment scores to messages."
  },
  "adminnames": {
    type: "text",
    category: "assign_roles_classes_to_certain_users",
    description: "Note: Specify privileged/admin name(s) to help identify them in chat. The list of names should be comma separated."
  },
  "aiProvider": {
    type: "select",
    category: "configure_llm_api"
  },
  "allmemberchat": {
    type: "boolean",
    category: "custom_injection",
    description: "Mark a message as a memberchat only when its a highlighted membership message"
  },
  "allowChatBot": {
    type: "boolean",
    category: "standalone_one_on_one_chat_bot",
    description: "Allow for private communication with the chat bot. Currently doesn't have access to RAG."
  },
  "allowLLMSummary": {
    type: "boolean",
    category: "chat_bot",
    description: "Include chat summaries with past context"
  },
  "alwaysRespondLLM": {
    type: "boolean",
    category: "chat_bot",
    description: "By default the bot is told not if it doesn't see value in doing so. You can disable that instruction here though"
  },
  "autoLiveYoutube": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Instead of Top Chat, which is default, auto-select Live Chat; Youtube Live chat pop out."
  },
  "autohi": {
    type: "boolean",
    category: "management",
    description: "When enabled, auto-reply to \" hi messages."
  },
  "autoshowtime": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "Set custom auto-select show time ms."
  },
  "bedrockAccessKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "bedrockRegion": {
    type: "text",
    category: "configure_llm_api"
  },
  "bedrockSecretKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "bedrockmodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "beepvolume": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "Lower the beep's volume"
  },
  "blacklist": {
    type: "boolean",
    category: "other_filters",
    description: "Censor common bad words with asterixis. Create badwords.txt to make your own blocklist."
  },
  "blacklistname": {
    type: "boolean",
    category: "other_filters",
    description: "Censor common bad words with asterixis in usernames"
  },
  "blacklistusers": {
    type: "text",
    category: "blocked_allowed_users",
    description: "Provide comma separated values; only values that match a username will be allowed."
  },
  "blacklistuserstoggle": {
    type: "boolean",
    category: "blocked_allowed_users",
    description: "When enabled, blocked users."
  },
  "blockpremiumshorts": {
    type: "boolean",
    category: "custom_injection",
    description: "Block donations/memberships from Youtube Shorts. Requires &shorts added to the Youtube chat pop out also."
  },
  "botReplyMessageFull": {
    type: "boolean",
    category: "auto_responder",
    description: "When enabled, trigger only if full message matches exactly."
  },
  "botnamesext": {
    type: "text",
    category: "assign_roles_classes_to_certain_users",
    description: "Note: Bot name(s) to help identify them. The list of names should be comma separated.."
  },
  "bottriggerwords": {
    type: "text",
    category: "chat_bot",
    description: "Leave empty to trigger always. The bot may however still choose to not respond on its own though."
  },
  "bttv": {
    type: "boolean",
    category: "custom_injection",
    description: "Enable BTTV emotes - YT/TW channels + globals"
  },
  "captureevents": {
    type: "boolean",
    category: "custom_injection",
    description: "Capture likes, subs, and other available event data."
  },
  "capturejoinedevent": {
    type: "boolean",
    category: "custom_injection",
    description: "Don't block 'joined' stream events in TikTok"
  },
  "chatbotHistoryTotal": {
    type: "number",
    category: "chat_bot",
    description: "There's 10 included by default; this is user, not entire, chat history."
  },
  "chatbotRespondToReflections": {
    type: "boolean",
    category: "chat_bot",
    description: "When enabled, the chat bot can answer reflections created by dock/API messages from the host."
  },
  "chatbotTimestamps": {
    type: "boolean",
    category: "chat_bot",
    description: "Include timestamp in chat history (toLocaleString)."
  },
  "chatgptApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "chatgptmodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "chatwebhookpost": {
    type: "boolean",
    category: "trigger_webhook_url_by_a_command",
    description: "When enabled, use POST instead of GET for webhook calls."
  },
  "chatwebhookstrict": {
    type: "boolean",
    category: "trigger_webhook_url_by_a_command",
    description: "When enabled, trigger only if full message matches exactly."
  },
  "chime": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Chime chat."
  },
  "chromaalpha": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "This won't work in Chrome"
  },
  "collecttwitchpoints": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "If you enable this, it will work even if the extension itself is set to inactive"
  },
  "colorofsource": {
    type: "boolean",
    category: "other_filters",
    description: "Sets the color for a name to the color of the source's branding. This does not cause a name to be displayed as colorful though- you need to enable that option."
  },
  "colorofsourcebg": {
    type: "boolean",
    category: "other_filters",
    description: "Sets the color for a background to the color of the source's branding. Featured messages only."
  },
  "colorseed": {
    type: "number",
    category: "other_filters",
    description: "Set seed value used for color assignment."
  },
  "comment_background": {
    type: "text",
    category: "colors"
  },
  "comment_color": {
    type: "text",
    category: "colors"
  },
  "custom1_url": {
    type: "text",
    category: "custom"
  },
  "custom1_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 1 on new window."
  },
  "custom2_url": {
    type: "text",
    category: "custom"
  },
  "custom2_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 2 on new window."
  },
  "custom3_url": {
    type: "text",
    category: "custom"
  },
  "custom3_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 3 on new window."
  },
  "custom4_url": {
    type: "text",
    category: "custom"
  },
  "custom4_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 4 on new window."
  },
  "custom5_url": {
    type: "text",
    category: "custom"
  },
  "custom5_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 5 on new window."
  },
  "custom6_url": {
    type: "text",
    category: "custom"
  },
  "custom6_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 6 on new window."
  },
  "custom7_url": {
    type: "text",
    category: "custom"
  },
  "custom7_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 7 on new window."
  },
  "custom8_url": {
    type: "text",
    category: "custom"
  },
  "custom8_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 8 on new window."
  },
  "custom9_url": {
    type: "text",
    category: "custom"
  },
  "custom9_url_newwindow": {
    type: "boolean",
    category: "custom",
    description: "When enabled, open custom URL 9 on new window."
  },
  "customAIApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "customAIEndpoint": {
    type: "text",
    category: "configure_llm_api"
  },
  "customAIModel": {
    type: "text",
    category: "configure_llm_api"
  },
  "customJsEnabled": {
    type: "boolean",
    category: "custom_javascript",
    description: "Upload custom JavaScript to extend functionality"
  },
  "customdiscordchannel": {
    type: "text",
    category: "opt_in_options"
  },
  "customkickaccount": {
    type: "text",
    category: "opt_out_options"
  },
  "customkickstate": {
    type: "boolean",
    category: "opt_out_options"
  },
  "customriversideaccount": {
    type: "text",
    category: "opt_out_options"
  },
  "customriversidestate": {
    type: "boolean",
    category: "opt_out_options"
  },
  "customtiktokaccount": {
    type: "text",
    category: "opt_out_options"
  },
  "customtiktokstate": {
    type: "boolean",
    category: "opt_out_options"
  },
  "customtwitchaccount": {
    type: "text",
    category: "opt_out_options"
  },
  "customtwitchstate": {
    type: "boolean",
    category: "opt_out_options"
  },
  "customwaitlistcommand": {
    type: "text",
    category: "must_enable_the_trigger_to_use"
  },
  "customwaitlistmessage": {
    type: "text",
    category: "other_customization_options"
  },
  "customwaitlistmessagetoggle": {
    type: "boolean",
    category: "other_customization_options"
  },
  "customyoutubeaccount": {
    type: "text",
    category: "opt_out_options"
  },
  "customyoutubestate": {
    type: "boolean",
    category: "opt_out_options"
  },
  "deepseekApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "deepseekmodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "defaultavatar": {
    type: "text",
    category: "other_filters"
  },
  "delaykick": {
    type: "boolean",
    category: "custom_injection",
    description: "Delay capturing messages from Kick to give time for messages to be deleted if needed; 3 extra seconds of delay"
  },
  "delaytime": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "This option gives you time to delete a message with another dock that doesn't have the delay; censorship-friendly then"
  },
  "delaytwitch": {
    type: "boolean",
    category: "custom_injection",
    description: "Delay capturing messages from Twitch to give time for messages to be deleted if needed; 3 extra seconds of delay"
  },
  "delayyoutube": {
    type: "boolean",
    category: "custom_injection",
    description: "Delay capturing messages from Youtube to give time for messages to be deleted if needed; 3 extra seconds of delay"
  },
  "detweet": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "If you enable this, it will work even if the extension itself is set to inactive"
  },
  "dice": {
    type: "boolean",
    category: "management",
    description: "The user can use !dice 10 to have it out of ten; by default it is out 1 to 6"
  },
  "disableDB": {
    type: "boolean",
    category: "custom_injection",
    description: "By default all inbound messages are saved to a local database for later look-up reference"
  },
  "disablehost": {
    type: "boolean",
    category: "printer_control",
    description: "Disable the host chat option in the dock and the api. Featured chat remains enabled."
  },
  "discord": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Discord chat."
  },
  "discord_channelid": {
    type: "text",
    category: "opened_in_new_tab"
  },
  "discord_serverid": {
    type: "text",
    category: "opened_in_new_tab"
  },
  "discordmemberships": {
    type: "boolean",
    category: "custom_injection",
    description: "Treat Discord roles as Memberships"
  },
  "dlive_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "drawmode": {
    type: "boolean",
    category: "configure_select_a_winner_draw_mode",
    description: "When enabled, configure as winner-draw mode instead of queue."
  },
  "duration": {
    type: "number",
    category: "other_customization_options",
    description: "Duration takes priority over speed in most cases; Star Wars has a fixed speed."
  },
  "dynamictiming": {
    type: "boolean",
    category: "send_fixed_messages_at_intervals",
    description: "If less than 10 messages total have come in, skip the automated message interval"
  },
  "elevenlatency": {
    type: "number",
    category: "elevenlabs_tts_options",
    description: "Set elevenLabs Latency Optimization."
  },
  "elevenrate": {
    type: "number",
    category: "elevenlabs_tts_options",
    description: "Set speaking Rate."
  },
  "elevensimilarity": {
    type: "number",
    category: "elevenlabs_tts_options",
    description: "Set similarity Boost."
  },
  "elevenstability": {
    type: "number",
    category: "elevenlabs_tts_options",
    description: "Set stability."
  },
  "elevenstyle": {
    type: "number",
    category: "elevenlabs_tts_options"
  },
  "enableCustomGifCommands": {
    type: "boolean",
    category: "custom_gif_commands_settings",
    description: "Enable to custom GIF Commands"
  },
  "enableLeaderboardCommand": {
    type: "boolean",
    category: "commands",
    description: "Enable to !leaderboard command"
  },
  "enablePointsCommand": {
    type: "boolean",
    category: "commands",
    description: "Enable to !points command"
  },
  "enablePointsSystem": {
    type: "boolean",
    category: "general_settings",
    description: "Enable to loyalty points system"
  },
  "enableRewardsCommand": {
    type: "boolean",
    category: "commands",
    description: "Enable to !rewards command"
  },
  "engagementWindow": {
    type: "number",
    category: "general_settings",
    description: "Set engagement window (minutes):."
  },
  "eventsSources": {
    type: "text",
    category: "sources_to_monitor",
    description: "Enter youtube,twitch,tiktok,etc"
  },
  "excludeReplyingTo": {
    type: "boolean",
    category: "other_filters",
    description: "Exclude 'Replying to @user' text when available from supported sources"
  },
  "facebook_username": {
    type: "text",
    category: "opened_in_new_tab"
  },
  "featuredOverlayStyle": {
    type: "select",
    category: "featured_chat_overlay",
    description: "This link will only show selected messages, one at a time. Requires the dock to select messages."
  },
  "ffz": {
    type: "boolean",
    category: "custom_injection",
    description: "Enable FFZ emotes - YT/TW channels + globals"
  },
  "filtercommands": {
    type: "boolean",
    category: "other_filters",
    description: "Filter out messages that might be chat commands."
  },
  "filtercommandscustomtoggle": {
    type: "boolean",
    category: "other_filters"
  },
  "filtercommandscustomwords": {
    type: "text",
    category: "other_filters",
    description: "Provide comma separated values; messages that start with the word will be blocked. eg: playlist,hello,subscribe"
  },
  "filterevents": {
    type: "text",
    category: "custom_injection",
    description: "Provide comma separated values; values that match a word in the event will be rejected. eg: joined,banned,gifted"
  },
  "filtereventstoggle": {
    type: "boolean",
    category: "custom_injection"
  },
  "firstsourceonly": {
    type: "boolean",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Filter out duplicate messages as a result of you replying to multiple chat sites. Only the first reply is captured"
  },
  "firsttimers": {
    type: "boolean",
    category: "custom_injection",
    description: "Mark first time chatters/donators (requires the local database)"
  },
  "flipYoutube": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Flip Youtube watch page layout"
  },
  "forwardcommands2twitch": {
    type: "boolean",
    category: "management",
    description: "When enabled, forward chat !commands to Twitch."
  },
  "geminiApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "geminimodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "giphy": {
    type: "boolean",
    category: "giphy_tenor_support",
    description: "When enabled, include a GIF when !giphy is used."
  },
  "giphy2": {
    type: "boolean",
    category: "giphy_tenor_support",
    description: "When enabled, include a GIF when #{somekeyword} is used."
  },
  "giphyKey": {
    type: "text",
    category: "giphy_tenor_support"
  },
  "goodwordslist": {
    type: "boolean",
    category: "other_filters",
    description: "Allow only words in the goodwords.txt file, otherwise they will be turned into asterixis."
  },
  "googlepitch": {
    type: "number",
    category: "google_cloud_tts_options"
  },
  "googlerate": {
    type: "number",
    category: "google_cloud_tts_options",
    description: "Set speaking rate."
  },
  "groqApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "groqmodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "h2r": {
    type: "boolean",
    category: "printer_control"
  },
  "h2rserver": {
    type: "text",
    category: "printer_control"
  },
  "hidePaidPromotion": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Hide"
  },
  "hideallreplies": {
    type: "boolean",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Do not capture your responses that you make to chat. They will be filtered out, so will not appear in the dock"
  },
  "hidebotnamesext": {
    type: "boolean",
    category: "assign_roles_classes_to_certain_users",
    description: "When enabled, delete names for specified bots."
  },
  "hidebotsext": {
    type: "boolean",
    category: "assign_roles_classes_to_certain_users",
    description: "When enabled, filter out messages for listed bots."
  },
  "hidegiphytrigger": {
    type: "boolean",
    category: "giphy_tenor_support",
    description: "Hide the Giphy/Tenor trigger word or sentence."
  },
  "hidehostsext": {
    type: "boolean",
    category: "assign_roles_classes_to_certain_users",
    description: "When enabled, filter out messages for listed hosts."
  },
  "hidemodsext": {
    type: "boolean",
    category: "assign_roles_classes_to_certain_users",
    description: "When enabled, filter out messages for listed mods."
  },
  "hideshortmessages": {
    type: "number",
    category: "openai_tts_options",
    description: "Set hide basic messages shorter than chars."
  },
  "hideyourlinks": {
    type: "boolean",
    category: "hide_your_links",
    description: "Hide the links for each page so it can't be seen on stream."
  },
  "highlightHostMentions": {
    type: "boolean",
    category: "management",
    description: "Highlight messages that mention a host name"
  },
  "highlightword": {
    type: "text",
    category: "other_filters",
    description: "Trivial events can be highlighted in the dock using &trivialevents"
  },
  "hostFirstSimilarOnly": {
    type: "boolean",
    category: "management",
    description: "Hide duplicate messages from 'hosts'."
  },
  "hostnamesext": {
    type: "text",
    category: "assign_roles_classes_to_certain_users",
    description: "Note: Host name(s) to help identify them. The list of names should be comma separated. This is like the previous list of names, except with its own flag/options"
  },
  "hypemode": {
    type: "boolean",
    category: "must_enable_the_trigger_to_use",
    description: "Enable to the hype meter's processing"
  },
  "identifyQuestions": {
    type: "boolean",
    category: "management",
    description: "Automatically identifies questions in chat messages based on keywords like ?, how, what, etc."
  },
  "ignorealternatives": {
    type: "boolean",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Filter out third party relayed messages from capture; restream.io, beam, etc"
  },
  "includeBotResponses": {
    type: "boolean",
    category: "chat_bot",
    description: "Include the bot's own replies to user in chat history. This can confuse an LLM, so avoid it."
  },
  "instagram": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Instagram non-live comment."
  },
  "instagramlive_username": {
    type: "text",
    category: "opened_in_new_tab"
  },
  "joke": {
    type: "boolean",
    category: "management",
    description: "When enabled, tell joke on !joke message."
  },
  "kick_username": {
    type: "text",
    category: "opened_in_new_tab"
  },
  "kittenspeed": {
    type: "number",
    category: "kitten_tts_options",
    description: "Set speaking rate."
  },
  "kokorospeed": {
    type: "number",
    category: "kokoro_tts_options",
    description: "Set speaking rate."
  },
  "lanonly": {
    type: "boolean",
    category: "printer_control",
    description: "Only others on the same network/computer as yours can connect to this via p2p"
  },
  "latency": {
    type: "number",
    category: "elevenlabs_tts_options",
    description: "Set elevenLabs Latency Optimization."
  },
  "lightencolorname": {
    type: "boolean",
    category: "other_filters",
    description: "Makes it easier to see names on darker backgrounds."
  },
  "limit": {
    type: "number",
    category: "openai_tts_options",
    description: "Set limit emotes shown:."
  },
  "limitcharacters": {
    type: "number",
    category: "management",
    description: "Set max length of dock/relayed chat."
  },
  "limitcharactersstate": {
    type: "boolean",
    category: "management"
  },
  "limitedyoutubememberchat": {
    type: "boolean",
    category: "custom_injection",
    description: "Mark a message as a memberchat only when its a highlighted membership message"
  },
  "llmsummary": {
    type: "boolean",
    category: "chat_bot",
    description: "Include chat summaries with past context"
  },
  "maxentries": {
    type: "number",
    category: "display_options",
    description: "Set maximum entries to show."
  },
  "maxevents": {
    type: "number",
    category: "display_options",
    description: "Set maximum events to display:."
  },
  "maxusers": {
    type: "number",
    category: "display_options",
    description: "Set maximum users to display."
  },
  "meet": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Google Meet chat."
  },
  "memberchatonly": {
    type: "boolean",
    category: "other_filters",
    description: "Totally filter out messages from non-members"
  },
  "midi": {
    type: "boolean",
    category: "auto_responder",
    description: "Enable to mIDI hotkeys"
  },
  "midiOutputDevice": {
    type: "select",
    category: "trigger_midi_note_on_command"
  },
  "modLLMonly": {
    type: "boolean",
    category: "chat_bot",
    description: "The bot will only ever respond to mods"
  },
  "modnamesext": {
    type: "text",
    category: "assign_roles_classes_to_certain_users",
    description: "Note: Mod name(s) to help identify them. The list of names should be comma separated. This is like the previous list of names, except with its own flag/options"
  },
  "multipleChoiceOptions": {
    type: "text",
    category: "poll_settings"
  },
  "name_background": {
    type: "text",
    category: "colors"
  },
  "name_color": {
    type: "text",
    category: "colors"
  },
  "noduplicates": {
    type: "boolean",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Filter out duplicate messages that might occur with a specific source only."
  },
  "nohostreflections": {
    type: "boolean",
    category: "management",
    description: "Hide relayed reflections of 'hosts'."
  },
  "nollmcontext": {
    type: "boolean",
    category: "chat_bot",
    description: "Include message history as context for the bot. Will slow things down.."
  },
  "noollamabotname": {
    type: "boolean",
    category: "chat_bot",
    description: "When enabled, do not include the bot's name when responding."
  },
  "nosaid": {
    type: "boolean",
    category: "management",
    description: "When enabled, do not include 'User Said:' with relays\"."
  },
  "nosubcolor": {
    type: "boolean",
    category: "other_filters",
    description: "Members on Youtube won't have green names, for example."
  },
  "notiktokdonations": {
    type: "boolean",
    category: "custom_injection",
    description: "Do not treat coin-bought items as gifts on Tiktok, such as roses"
  },
  "notiktoklinks": {
    type: "boolean",
    category: "custom_injection",
    description: "Remove links when sending messages to Tiktok from SocialStreamNinja"
  },
  "ollama": {
    type: "boolean",
    category: "chat_bot",
    description: "Enable the LLM AI Bot responder."
  },
  "ollamaCensorBot": {
    type: "boolean",
    category: "censor_bot_options",
    description: "Use the bot to moderate messages, deleting messages that it thinks aren't fit. It will skip messages if it can't keep up."
  },
  "ollamaCensorBotBlockMode": {
    type: "boolean",
    category: "censor_bot_options",
    description: "Only approved messages get thru, but this may slow things down and messages will get skipped."
  },
  "ollamaKeepAlive": {
    type: "number",
    category: "configure_llm_api",
    description: "Time to keep the model in memory; -1 unlimited. In minutes"
  },
  "ollamaRagEnabled": {
    type: "boolean",
    category: "give_the_above_chat_bot_access_to_additional_custom_knowledge_that_you_can_provide",
    description: "Enable the RAG mode, which has the LLM bot access a local database containing additional knowledge that if may reference in its responses."
  },
  "ollamaRateLimitPerTab": {
    type: "number",
    category: "chat_bot",
    description: "There's a minimum of 5-seconds by default"
  },
  "ollamabotname": {
    type: "text",
    category: "chat_bot"
  },
  "ollamaendpoint": {
    type: "text",
    category: "configure_llm_api"
  },
  "ollamamodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "ollamaoverlayonly": {
    type: "boolean",
    category: "chat_bot",
    description: "Do not relay bot messages"
  },
  "ollamaprompt": {
    type: "text",
    category: "chat_bot"
  },
  "ollamatts": {
    type: "boolean",
    category: "enable_text_to_speech",
    description: "Text to speech bot messages"
  },
  "opacity": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "This won't work in Chrome"
  },
  "openai": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture OpenAI chat."
  },
  "openaispeed": {
    type: "number",
    category: "openai_tts_options",
    description: "Set speaking rate."
  },
  "openrouterApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "openroutermodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "overlayPreset": {
    type: "select",
    category: "streaming_chat_dock_overlay",
    description: "This link will display chat messages as a streaming list. Use as an overlay or as a control dock."
  },
  "padding": {
    type: "number",
    category: "openai_tts_options",
    description: "Set padding between messages px."
  },
  "picarto_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "pitch": {
    type: "number",
    category: "built_in_system_tts_options"
  },
  "pointsPerEngagement": {
    type: "number",
    category: "general_settings",
    description: "Set points per engagement:."
  },
  "pollEnabled": {
    type: "boolean",
    category: "poll_settings",
    description: "Enable to poll"
  },
  "pollQuestion": {
    type: "text",
    category: "poll_settings"
  },
  "pollSpam": {
    type: "boolean",
    category: "poll_settings",
    description: "Allow multiple votes per user."
  },
  "pollStyle": {
    type: "select",
    category: "poll_settings"
  },
  "pollTally": {
    type: "boolean",
    category: "poll_settings",
    description: "Show number of votes instead of perecent."
  },
  "pollTimer": {
    type: "number",
    category: "poll_settings",
    description: "Set timer (seconds):."
  },
  "pollTimerState": {
    type: "boolean",
    category: "poll_settings",
    description: "When enabled, timer (seconds):."
  },
  "pollType": {
    type: "select",
    category: "poll_settings"
  },
  "post": {
    type: "boolean",
    category: "printer_control"
  },
  "postalldiscord": {
    type: "boolean",
    category: "printer_control"
  },
  "postallserverdiscord": {
    type: "text",
    category: "printer_control"
  },
  "postdiscord": {
    type: "boolean",
    category: "printer_control"
  },
  "postserver": {
    type: "text",
    category: "printer_control"
  },
  "postserverdiscord": {
    type: "text",
    category: "printer_control"
  },
  "printerName": {
    type: "text",
    category: "printer_control"
  },
  "pronouns": {
    type: "boolean",
    category: "custom_injection",
    description: "Enable Pronoun support - https://pr.alejo.io/"
  },
  "pumpTheNumbers": {
    type: "boolean",
    category: "custom_injection",
    description: "When enabled, multiply viewer count by 1.75x."
  },
  "questionKeywords": {
    type: "boolean",
    category: "management",
    description: "Comma-separated keywords to identify questions (default: ?,Q:,question:,how,what,when,where,why,who,which,could,would,should,can,will)"
  },
  "queuetime": {
    type: "number",
    category: "featured_chat_overlay",
    description: "Set queue + Show messages for at least ms."
  },
  "randomcolor": {
    type: "boolean",
    category: "other_filters",
    description: "If a name lacks color data, randomly add one. This does not cause a name to be displayed as colorful though- you need to enable that option."
  },
  "randomcolorall": {
    type: "boolean",
    category: "other_filters",
    description: "Randomly sets the color for a name. This does not cause a name to be displayed as colorful though- you need to enable that option."
  },
  "randomgif": {
    type: "boolean",
    category: "giphy_tenor_support",
    description: "When enabled, select random gif from top 10 results."
  },
  "rate": {
    type: "number",
    category: "built_in_system_tts_options",
    description: "Set speaking rate."
  },
  "relayall": {
    type: "boolean",
    category: "management",
    description: "When enabled, relay all messages (!NOT RECOMMENDED!)."
  },
  "relaydonos": {
    type: "boolean",
    category: "management",
    description: "When enabled, announce donations across all chats."
  },
  "relayhostonly": {
    type: "boolean",
    category: "management",
    description: "When enabled, only relay if message is from a 'host'\"."
  },
  "relaytargets": {
    type: "text",
    category: "management",
    description: "Note: List of sources that you want to allow the relay to work with. Nothing implies all."
  },
  "removeContentImage": {
    type: "boolean",
    category: "other_filters",
    description: "Remove original content images from messages (stickers, twitter post images)"
  },
  "rotateinterval": {
    type: "number",
    category: "top_bar_settings",
    description: "Set rotation interval seconds."
  },
  "s10": {
    type: "boolean",
    category: "printer_control"
  },
  "s10apikey": {
    type: "text",
    category: "printer_control"
  },
  "s10relay": {
    type: "boolean",
    category: "printer_control",
    description: "Relay messages from other sites to Stage TEN"
  },
  "scale": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "Set emoji scale 1.00x."
  },
  "sdk": {
    type: "boolean",
    category: "global_settings_and_tools",
    description: "When enabled, use SDK transport (beta)."
  },
  "seventv": {
    type: "boolean",
    category: "custom_injection",
    description: "Enable 7TV emotes - YT/TW channels + globals"
  },
  "sharestreamid": {
    type: "boolean",
    category: "printer_control",
    description: "Some sites may wish to access your stream ID for custom third party integrations"
  },
  "showtime": {
    type: "number",
    category: "streaming_chat_dock_overlay",
    description: "Set auto-hide message after ms."
  },
  "slack": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Slack chat."
  },
  "socketserver": {
    type: "boolean",
    category: "printer_control",
    description: "See documentation on socialstream.ninja for details."
  },
  "soundvolume": {
    type: "number",
    category: "other_customization_options",
    description: "Lower the 🎵 volume"
  },
  "speechifyspeed": {
    type: "number",
    category: "speechify_tts_options"
  },
  "speed": {
    type: "number",
    category: "other_customization_options",
    description: "Set scroll speed x."
  },
  "spotifyAnnounceFormat": {
    type: "text",
    category: "now_playing_features"
  },
  "spotifyAnnounceNewTrack": {
    type: "boolean",
    category: "now_playing_features",
    description: "When enabled, announce new tracks in chat."
  },
  "spotifyBotName": {
    type: "text",
    category: "now_playing_features"
  },
  "spotifyClientId": {
    type: "text",
    category: "spotify_configuration"
  },
  "spotifyClientSecret": {
    type: "text",
    category: "spotify_configuration"
  },
  "spotifyEnabled": {
    type: "boolean",
    category: "spotify_configuration",
    description: "Enable to spotify integration"
  },
  "spotifyNowPlaying": {
    type: "boolean",
    category: "now_playing_features",
    description: "Enable to now playing tracking"
  },
  "spotifyPollingInterval": {
    type: "number",
    category: "now_playing_features",
    description: "Set polling interval (seconds): (3-60 seconds)."
  },
  "streamerbot": {
    type: "boolean",
    category: "printer_control",
    description: "Enable to streamer.bot websocket support"
  },
  "streamerbotactionid": {
    type: "text",
    category: "printer_control"
  },
  "streamerbotendpoint": {
    type: "text",
    category: "printer_control"
  },
  "streamerbotpassword": {
    type: "text",
    category: "printer_control"
  },
  "t1": {
    type: "number",
    category: "customize_donation_colors_by_threshold",
    description: "Set threshold: $ USD, Color:."
  },
  "t2": {
    type: "number",
    category: "customize_donation_colors_by_threshold",
    description: "Set threshold: $ USD, Color:."
  },
  "t3": {
    type: "number",
    category: "customize_donation_colors_by_threshold",
    description: "Set threshold: $ USD, Color:."
  },
  "teams": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Teams chat."
  },
  "telegram": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture Telegram chat."
  },
  "tenor": {
    type: "boolean",
    category: "giphy_tenor_support",
    description: "When enabled, include a GIF when !tenor is used."
  },
  "tenorKey": {
    type: "text",
    category: "giphy_tenor_support"
  },
  "textonlymode": {
    type: "boolean",
    category: "other_filters",
    description: "Just text is captured. No HTML, so no BTTV emotes, etc."
  },
  "thissourceonly": {
    type: "boolean",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Only show replies from you if they are from the selected source"
  },
  "thissourceonlytype": {
    type: "select",
    category: "message_doubling_echos_duplicates_relayed",
    description: "Only show replies from you if they are from the selected source"
  },
  "ticker": {
    type: "boolean",
    category: "must_enable_the_trigger_to_use",
    description: "Enable to 📄 Select the ticker source file"
  },
  "tiktok_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "totalcolors": {
    type: "number",
    category: "other_filters",
    description: "Set max number of random colors to use."
  },
  "translationlanguage": {
    type: "select",
    category: "miscellaneous",
    description: "Choose a different translation. Note: Re-open menu to apply any langugage changes to it."
  },
  "trimname": {
    type: "number",
    category: "customize_donation_colors_by_threshold",
    description: "Set trim names longer than chars."
  },
  "trovo_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "ttsProvider": {
    type: "select",
    category: "text_to_speech_service_provider",
    description: "Choose text-to-Speech Service Provider."
  },
  "twichadannounce": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Trigger an inbound message starting when there is an ad starting/stopping"
  },
  "twichadmute": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "If you enable this, it will work even if the extension itself is set to inactive"
  },
  "twitch_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "unlimitedDB": {
    type: "boolean",
    category: "custom_injection",
    description: "Override's the database 30-day storage limits"
  },
  "updateinterval": {
    type: "number",
    category: "display_options",
    description: "Set update interval seconds (0 = disabled)."
  },
  "vdoninjadiscord": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Make Discord Videos available as VDO.Ninja view links"
  },
  "viplistusers": {
    type: "text",
    category: "assign_roles_classes_to_certain_users",
    description: "Note: VIP name(s) to help identify them. The list of names should be comma separated. This is like the previous list of names, except with its own flag/options"
  },
  "volume": {
    type: "number",
    category: "more_tts_options",
    description: "The volume has a max of 1.0 (100%)"
  },
  "waitlistmembersonly": {
    type: "boolean",
    category: "other_customization_options",
    description: "When enabled, only members can enter."
  },
  "waitlistmode": {
    type: "boolean",
    category: "must_enable_the_trigger_to_use"
  },
  "webhookrelay": {
    type: "boolean",
    category: "printer_control",
    description: "Relay Ko-fi, Stripe, Buy Me a Coffee, and Fourthwall webhook payloads to your custom endpoint"
  },
  "whatsapp": {
    type: "boolean",
    category: "opt_in_options",
    description: "When enabled, capture WhatsApp chat."
  },
  "whitelistusers": {
    type: "text",
    category: "blocked_allowed_users",
    description: "Provide comma separated values; only values that match a username will be allowed."
  },
  "whitelistuserstoggle": {
    type: "boolean",
    category: "blocked_allowed_users",
    description: "Show only the specified users (approved list)."
  },
  "wordcloud": {
    type: "boolean",
    category: "must_enable_the_trigger_to_use"
  },
  "xaiApiKey": {
    type: "text",
    category: "configure_llm_api"
  },
  "xaimodel": {
    type: "text",
    category: "configure_llm_api"
  },
  "xcapture": {
    type: "boolean",
    category: "opt_in_options",
    description: "Enable to x.com embedded page features"
  },
  "youtubeLargerFont": {
    type: "boolean",
    category: "miscellaneous_options_for_sites",
    description: "Increase the font size of chat messages in the Youtube Live chat popout"
  },
  "youtube_username": {
    type: "text",
    category: "opened_in_new_window"
  },
  "youtubeapikey": {
    type: "text",
    category: "youtube_api"
  },
});

export function getSettingMetadata(settingKey) {
  return SETTINGS_METADATA[settingKey] || null;
}

export function listSettingsMetadata() {
  return Object.entries(SETTINGS_METADATA).map(([key, value]) => ({ key, ...value }));
}

export const SETTINGS_CATEGORY_INFO = SETTINGS_CATEGORIES;
export default SETTINGS_METADATA;
