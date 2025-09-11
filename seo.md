## Social Stream Ninja: Live Chat Overlay and Management Extension Documentation

**Social Stream Ninja** is a free, powerful Chrome extension that empowers you to seamlessly manage and overlay live chat from various platforms directly within your streaming setup. This documentation provides a comprehensive guide to the extension's features, usage, and customization options.

### Overview

Social Stream Ninja allows you to:

- **Capture live chat:** From popular platforms like Twitch, YouTube, Facebook, Zoom, and many more.
- **Display chat as an overlay:** Customize the appearance and positioning of your live chat in your stream.
- **Control chat interactions:** Feature messages, queue messages for later highlighting, and manage a waitlist or draw system.
- **Use text-to-speech:** Read chat messages aloud in various languages.
- **Integrate with third-party services:** Push chat messages to other platforms or receive donations via webhooks.
- **Customize extensively:** With a wide range of settings and CSS styling options.

### Installation

**Note:** Social Stream Ninja is now also available in the Chrome Web Store

1. **Download:** Get the latest version of the extension from the official GitHub repository: [https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip](https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip)
2. **Extract:** Unzip the downloaded archive to a folder on your computer.
3. **Load unpacked:**  In Chrome, navigate to `chrome://extensions/`. Enable "Developer mode" if it's not already enabled. Click the "Load unpacked" button and select the extracted folder.

### Usage

1. **Enable extension:** Click the Social Stream Ninja icon in your browser's toolbar. Ensure the icon is green, indicating the extension is enabled.
2. **Start capturing:** Open the live chat pop-out window of your chosen platform.
3. **Manage chat:** Use the two links provided by the extension:
    - **Dock:** Manage and select messages (CTRL + click for queuing).
    - **Overlay:**  View selected messages (auto-hide messages after a set time using `&showtime=20000`).

### Customization

#### URL Parameters

You can adjust the appearance and behavior of the dock and overlay pages by modifying the URL parameters:

**Dock (dock.html):**

- `&lightmode`: Enable light mode (white background) for the dock.
- `&scale=2`: Double the size/resolution of all elements.
- `&notime`: Hide the timestamp from the dock.
- `&hidesource`: Hide the source platform icons (Twitch, YouTube, etc.).
- `&compact`: Remove spacing between the name and the message.
- `&autoshow`: Automatically feature chat messages as they come in at a rate of about 2 per 3 seconds.
- `&attachmentsonly`: Show only image attachments in the dock.
- `&exclude=youtube,twitch,facebook`: Exclude specific chat sources from the dock.
- `&filterevents=joined`: Filter out messages tagged as specific "events" in the dock.
- `&filterevents=!joined`:  Filter *in* messages tagged as specific "events" in the dock.
- `&server`:  Enable the server API.
- `&sync`: Enable synced docks (multiple docks connected will stay in sync with the selected messages).
- `&label=NAMEHERE`: Assign a unique target name to the dock for targeted API commands.
- `&css=https://youdomain.com/style.css`: Load a custom CSS file for the dock.
- `&b64css=YOUR_CSS_CODE_HERE`:  Load a custom CSS file for the dock in base64 encoded format.
- `&js=https%3A%2F%2Fvdo.ninja%2Fexamples%2Ftestjs.js`: Load a custom JavaScript file for the dock (be cautious as this can be a security risk).

**Overlay (featured.html):**

- `&showtime=20000`: Auto-hide the selected message after 20 seconds (20,000 milliseconds).
- `&showsource`: Display the source platform icons next to the name.
- `&fade`: Make the selected messages fade in.
- `&swipe`: Make the selected messages swipe in from the left side.
- `&center`:  Center the selected messages.
- `&speech=en-US`: Set the default language for text-to-speech (see list of available languages [https://socialstream.ninja/tts](https://socialstream.ninja/tts)).
- `&ttskey=YOURGOOGLECLOUDAPIKEYHERE`:  Use Google Cloud Text-to-Speech API (requires your own API key).
- `&elevenlabskey=YOURELEVENLABSAPIKEYHERE`: Use ElevenLabs Text-to-Speech API (requires your own API key).
- `&latency=4`: Set the latency for ElevenLabs API (0 for high quality, 4 for fastest).
- `&voice=VR6AewLTigWG4xSOukaG`: Select a specific voice for ElevenLabs API.

#### CSS Styling

You can fine-tune the appearance of the overlay and dock by adding custom CSS to the browser source's style sheet in OBS Studio or by directly editing the `featured.html` file.

Here's an example of CSS code you can use to customize some basic styles:

```css
body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }

:root {
  --comment-color: #090;
  --comment-bg-color: #DDD;
  --comment-border-radius: 10px;
  --comment-font-size: 30px;
  --author-border-radius: 10px;
  --author-bg-color: #FF0000;
  --author-avatar-border-color: #FF0000;
  --author-font-size: 32px;
  --author-color: blue;
  --font-family:  "opendyslexic", opendyslexic, serif;
}

@font-face {
  font-family: 'opendyslexic';
    src: url('https://vdo.ninja/examples/OpenDyslexic-Regular.otf');
    font-style: normal;
    font-weight: normal;
} 

.hl-name{
	padding: 2px 10px !important;
}
```

#### Extension Menu

The Social Stream Ninja extension's menu offers a wide range of settings and toggles:

- **General mechanics:**
    - **Disable host chat:**  Prevent the extension from capturing host messages in the dock.
    - **Share stream ID:** Allow third-party services to access your session ID.
    - **Enable server:** Use the server API for remote control and message publishing.
    - **LAN only:**  Restrict P2P connections to the same network.
    - **Capture stream events:**  Capture likes, subs, and other events.
    - **Capture "joined" events (TikTok):** Don't block "joined" messages on TikTok.
    - **Block premium Shorts donos:** Prevent capturing donations/memberships from YouTube Shorts.
    - **Delay Youtube capture:** Delay Youtube capture to allow mods/bots to delete messages.
    - **Add sentiment scores to messages:**  Enable sentiment analysis (requires Ollama to be installed locally).
    - **Disable the message database:** Stop saving messages to the local database.
    - **Filter events:** Block specific event messages.
    - **Enable text-to-speech:**  Enable text-to-speech functionality.
    - **Add BTTV emotes:**  Enable BetterTTV emotes for supported channels and globally.
    - **Add 7TV emotes:** Enable 7TV emotes for supported channels and globally.
    - **Enable Pronoun support:** Display users' pronouns (Twitch only).
    - **Any message from a YouTube member is treated as membership chat:** Include all member messages in the dock, not just monthly featured messages.
    - **Use 24-hour time for timestamp:**  Display the time in 24-hour format.

- **Chat commands:**
    - **Auto-reply to "hi" messages:**  Enable an automatic response to "hi" messages.
    - **Announce donations across all chats:**  Relay donation messages to all connected chat sources.
    - **Relay all messages (!NOT RECOMMENDED!)**: Relay all messages to all connected chat sources (not recommended due to potential spamming).
    - **Tell joke on "joke" command:** Enable a random joke response to the "!joke" command.
    - **Enable MIDI hotkeys:**  Enable MIDI hotkeys for sending pre-defined messages.
    - **Load config:**  Choose a MIDI config file to define custom MIDI hotkeys.
    - **Enable Giphy/Tenor support:** Integrate with Giphy and Tenor to automatically include GIFs based on chat commands.
    - **Hide Giphy/Tenor trigger word:**  Suppress the trigger command from the chat output.
    - **Select random Giphy GIF:**  Choose a random GIF from the top 10 results.
    - **Send fixed messages at intervals:**  Configure scheduled messages.
    - **Auto-responder:**  Create custom chat commands that trigger automatic responses.
    - **Dynamic timing:**  Skip scheduled messages if the chat is too quiet.
    - **Max length of dock/relayed chat**:  Set the maximum length of messages sent to other chat sources.

- **Chat visibility:**
    - **Hide source icon:**  Suppress the source platform icons.
    - **Hide Twitch messages:**  Disable Twitch messages.
    - **Show Twitch only:**  Filter for Twitch messages exclusively.
    - **Hide Kick messages:** Disable Kick messages.
    - **Blur messages from hidden sources:**  Apply a blur effect to messages from blocked sources.
    - **Show channel icon:** Display the channel icon.
    - **Hide avatars:**  Suppress avatar images.
    - **Hide timestamp:**  Remove timestamps from chat messages.
    - **Hide badges:**  Disable badges.
    - **Show just the first 2 badges:** Limit the number of displayed badges.
    - **Show only stream events:**  Filter for events only.
    - **Hide all stream events:** Disable event messages.
    - **Use first names only:**  Display only the first names of users.
    - **Delete names entirely:** Remove usernames from the chat output.
    - **Color names if color info available:**  Colorize usernames based on available color information.
    - **Limit total messages to:** Set a limit on the number of chat messages displayed.
    - **Filter out messages with bad karma:**  Block messages with low sentiment scores (requires Ollama).
    - **Hide messages that start with '!':**  Suppress command messages.
    - **Show only messages with donations:**  Filter for donation messages only.
    - **Show only messages from members:**  Filter for membership messages only.
    - **Alt-keyword filter will match on name-only:**  Only search for keywords in the user's name, not the message content.
    - **Only show messages marked as questions:**  Filter for messages marked as questions.
    - **Hide messages marked as questions:**  Block messages marked as questions.
    - **Hide messages that are numbers only:**  Suppress messages containing only numbers.
    - **Hide basic messages shorter than:**  Set a minimum character length for displayed messages.
    - **Strip HTML from messages and donations:** Remove HTML tags from chat messages and donations.
    - **Strip text-based emojis from messages:**  Remove text-based emojis (not graphical ones).
    - **Replace links in messages with just '[Link]':**  Replace URLs with a placeholder.
    - **Make URLs in chat clickable links:** Make URLs clickable.
    - **Shorten long links ...:**  Shorten long links.
    - **Increase the minimum time messages auto-show for:** Adjust the time a message is automatically featured for.

- **Identify hosts, mods, bots, VIPs:**
    - **Identify by name who are hosts or bots:**  Specify names to identify bots and hosts.
    - **Delete names for specified host or bots:**  Remove bot/host usernames from the chat output.
    - **Filter out messages from above hosts or bots:**  Block messages from specified hosts and bots.
    - **Auto-feature messages from privileged users:**  Automatically highlight messages from admins.
    - **Allow privileged users to "start" or "stop" OBS:**  Enable admin control over the OBS stream (requires OBS Browser Source with full permissions).

- **Streaming chat (dockable):**
    - **Hide menu bar:**  Remove the menu bar from the dock.
    - **Make chat input the full menu bar:**  Display the chat input field as the entire menu bar.
    - **Magnify the view (larger font/images):**  Increase the size of all elements.
    - **Make the font, icons, and menu smaller:**  Decrease the size of all elements.
    - **Force transparent background:**  Set a transparent background.
    - **Make entire page partially transparent:**  Apply a translucent effect to the entire page (Chrome support limited).
    - **Translucent page background:**  Set a translucent background for the page.
    - **Green page background:**  Use a green background for the page.
    - **White page background:**  Use a white background for the page.
    - **Light mode — White page background:**  Enable light mode with a white background (Chrome support limited).
    - **Dark mode — Black page background:**  Enable dark mode with a black background.
    - **Show current OBS scene in corner:**  Display the current OBS scene in the corner (requires OBS Browser Source with read permissions).
    - **Auto-select new messages (skipping as needed):** Automatically feature new messages (skipping as needed).
    - **Custom auto-select show time:**  Set the duration for which a message is automatically featured.
    - **Exclude filtered messages from auto-selecting:** Prevent filtered messages from being automatically featured.
    - **When auto-select is on, select donations:** Only automatically feature donation messages.
    - **When auto-select is on, select those from members:** Only automatically feature membership messages.
    - **Auto-feature YouTube monthly member chat:** Automatically feature YouTube member chat messages.
    - **Multiple docks will stay in sync as to selected messages:**  Enable synced docks.
    - **Only see pinned messages (for use with &sync):**  Filter for pinned messages only.
    - **View-only mode. (Can't chat, pin, or feature):**  Disable chat, pinning, and featuring.
    - **View & Chat-only mode. (Can't pin or feature):**  Disable pinning and featuring.
    - **View, Pin, and Queue. (Can't chat or feature):** Disable chat and featuring.
    - **Use 24-hour time for timestamp:**  Display timestamps in 24-hour format.
    - **Allow LAN only P2P connections:**  Restrict P2P connections to the same network.
    - **Chat command to auto-queue the message:**  Set a chat command for automatically queueing messages.

- **Featured chat overlay:**
    - **Make overlay smaller:**  Reduce the size of the overlay.
    - **Green page background:**  Use a green background for the overlay.
    - **Split mode (align overlay to center):**  Center the overlay.
    - **Raise overlay higher:** Adjust the vertical positioning of the overlay.
    - **Auto-hide message after:**  Set the duration for which the selected message is displayed.
    - **Queue + Show messages for at least:** Set the minimum duration for which a queued message is displayed.
    - **Beep when there is a new message:**  Enable a beep sound when a new message is selected.
    - **Reduce the beep's volume to 30%:**  Lower the beep volume.
    - **URL for custom beep audio file:** Specify a URL for a custom beep sound.
    - **Messages align to the right-side:**  Right-align messages.
    - **Force right-to-left text reading:**  Enable right-to-left text direction.
    - **Auto-show messages without needing the dock:**  Automatically feature messages without needing to select them in the dock.
    - **Old messages stay and stack:**  Enable stacking of previous messages (use the dock for stacking multiple messages).
    - **Allow LAN only P2P connections:**  Restrict P2P connections to the same network.
    - **Save avatar image to disk:**  Save the avatar image to the user's downloads folder.
    - **Align comment to top:**  Align the comment text to the top.
    - **Round edges:**  Apply rounded corners to the overlay.
    - **Reduce font-size if message gets too long:**  Adjust the font size dynamically based on message length.
    - **Color names if original name color available:** Colorize usernames if name color is available.
    - **Comment font color:**  Set the font color for chat messages.
    - **Comment background color:** Set the background color for chat messages.
    - **Default name font color:**  Set the default font color for usernames.
    - **Name background color:** Set the background color for usernames.
    - **Font Family:** Choose a font family.
    - **a specify a Google Font name:** Load a Google Font for the overlay.
    - **Fade in/out instead:**  Enable fade-in/out animation for message transitions.

- **Emotes wall:**
    - **Filter out duplicate emotes per message:**  Suppress duplicate emotes within a single message.
    - **Limit to 10 emotes at a time:**  Set a maximum number of emotes to display.
    - **Show messages for 20s, rather than 5s:**  Extend the display time for messages.
    - **Double the emotes' movement speed:**  Increase the animation speed.
    - **Make all emojis half the size:**  Reduce the size of emotes.
    - **Make all emojis twice the size:**  Increase the size of emotes.
    - **Only show emojis from members:**  Filter for member emotes only.
    - **Exclude message @replies emojies:**  Prevent emotes in replies from being displayed.
    - **Emotes float up, rather than bounce around:**  Change the animation to a floating effect.
    - **Emotes to filter out:**  Specify a list of emotes to block.

- **Hype meter:**
    - **Enable the hype meter's processing:**  Start tracking unique user counts per chat source.
    - **Align overlay to the right-side:**  Right-align the hype meter.
    - **Disable text outlining:**  Remove text outlines.
    - **Magnify the view (larger font/images):**  Increase the size of the hype meter.
    - **Make the font, icons, and menu smaller:**  Decrease the size of the hype meter.
    - **Force transparent background:**  Set a transparent background.
    - **Make entire page partially transparent:**  Apply a translucent effect to the hype meter page (Chrome support limited).
    - **Do not show the sub-title:**  Hide the hype meter sub-title.
    - **Light mode — Black text, white outline:**  Enable light mode for the hype meter.
    - **Font Family:**  Choose a font family.
    - **a specify a Google Font name:**  Load a Google Font.

- **Wait List/Winner Draw:**
    - **Enable the waitlist/draw page and customize the !trigger:** Start tracking users who enter the waitlist using the !trigger command.
    - **Configure as winner-draw mode instead of queue:** Switch to the draw mode (random winner selection) instead of the queue mode.
    - **Align overlay to the right-side:**  Right-align the waitlist.
    - **Align overlay to the center/middle:** Center the waitlist.
    - **Disable text outlining:** Remove text outlines.
    - **Drop confetti when a name is selected:**  Enable confetti animation on winner selection.
    - **Play a sound when there a name selected:**  Enable a sound when a winner is selected.
    - **URL for custom sound audio file:** Specify a URL for a custom sound effect.
    - **Magnify the view (larger font/images):**  Increase the size of the waitlist.
    - **Make the font, icons, and menu smaller:**  Decrease the size of the waitlist.
    - **Force transparent background:**  Set a transparent background.
    - **Make entire page partially transparent:**  Apply a translucent effect to the waitlist page (Chrome support limited).
    - **Do not show the !queue instructions:** Hide the instructions.
    - **Light mode — Black text, white outline:**  Enable light mode for the waitlist.
    - **List re-randomizes on every update:**  Enable random shuffling of the waitlist on updates.
    - **Use a custom message/title:**  Set a custom message or title for the waitlist.
    - **Font Family:**  Choose a font family.
    - **a specify a Google Font name:** Load a Google Font.

- **Graphical Poll:**
    - **Enable Poll:** Start a new poll.
    - **Poll Type:** Choose the type of poll.
    - **Poll Question:**  Set the question for the poll.
    - **Options (comma separated):**  Enter the options for a multiple-choice poll.
    - **Timer (seconds):**  Set the poll duration (in seconds).
    - **Start Poll:**  Begin the poll.
    - **End Poll:**  Terminate the poll.

- **Battle Royal:**
	- **Host Starts:**  Enable the Battle Royal mode.
	- **Start the game:**  Start a new game.
	- **Disable computer players:**  Prevent computer players from participating.
	- **Increase lobby wait time to 30s:**  Extend the lobby waiting time to 30 seconds.

- **Ticker:**
	- **Enable:** Activate the ticker banner.
	- **Select the ticker source file:**  Choose a text file to provide content for the ticker.
	- **Font Family:** Choose a font family.
	- **a specify a Google Font name:** Load a Google Font.

- **Customizable ticker banner bar:**
    - **Enable the ticker:** Activate the ticker banner.
    - **Choose location:**  Select the file that contains the ticker text.
    - **Font Family:** Choose a font family.
    - **a specify a Google Font name:** Load a Google Font.

- **Local chat bot (LLM):**
    - **Enable the censor bot. * (non-blocking by default)**: Enable the censor bot to moderate chat messages (non-blocking by default).
    - **Block messages until approved by the censor bot:**  Enable blocking mode for the censor bot.
    - **Enable the Ollama AI chat bot:**  Enable the Ollama AI chatbot functionality.
    - **Customize bot name:** Set a custom name for the bot.
    - **Rate limit for responses per tab / source:**  Set the response rate limit.
    - **Additional Bot Instructions (Optional):**  Provide context and instructions for the bot.
    - **Use a custom knowledge-base (RAG):** Enable RAG mode for the bot to access a local knowledge base.
    - **Add a resource file:**  Upload a file to populate the knowledge base.
    - **Clear all:**  Remove the knowledge base and delete uploaded files.
    - **Use enhanced processing:** Use enhanced processing for the knowledge base (may work better with multiple documents).
    - **Enable private chat bot option:**  Enable a private chatbot interface for communication with the bot. 

- **Session Options:**
    - **Your unique session ID is below.**  Displays your session ID.
    - **Set or change your session password:**  Set a password for your session.

### Using the Server API

Social Stream Ninja's server API enables remote control and message publishing. To use the API:

1. **Enable server API:** Toggle the "Enable server" option in the extension menu.
2. **Connect:** Connect to the WebSocket server at `wss://io.socialstream.ninja`.
3. **Send commands:** Send JSON commands to the API server using:
    - **WebSocket API:** `wss://io.socialstream.ninja/join/SESSION_ID/IN_CHANNEL/OUT_CHANNEL` (replace with your session ID and channel numbers).
    - **HTTP API:**
        - **GET:** `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE`
        - **POST/PUT:** `https://io.socialstream.ninja/SESSION_ID` or `https://io.socialstream.ninja/SESSION_ID/ACTION` (with JSON body)

### Supported Sites

Social Stream Ninja supports capturing live chat from a wide range of platforms:

- **Twitch**
- **YouTube (Live & Static Comments)**
- **Facebook (Live & Static Comments)**
- **Workplace.com**
- **Zoom.us**
- **LFG.tv**
- **Owncast**
- **Crowdcast.io**
- **Livestream.com**
- **Mixcloud.com**
- **Microsoft Teams**
- **Vimeo.com**
- **Instagram Live & Static Comments**
- **Instafeed.me**
- **TikTok Live**
- **Webex Live Chat**
- **LinkedIn Events & Live Comments**
- **VDO.Ninja**
- **Whatsapp.com**
- **Discord.com**
- **Telegram**
- **Slack**
- **Google Meet**
- **Restream.io**
- **Amazon.com/live**
- **Wix.com**
- **Clouthub**
- **Rumble.com**
- **Trovo.live**
- **Dlive.tv**
- **Picarto.tv**
- **Mobcrush**
- **Odysee.com**
- **Minnit.chat**
- **Livepush.io**
- **Piczel.tv**
- **Bilibili.tv & Bilibili.com**
- **Amazon Chime**
- **Locals.com**
- **Nimo.TV**
- **Kick.com**
- **Quickchannel.com**
- **Rokfin.com**
- **Sli.do**
- **Cbox.ws**
- **Castr.io**
- **Tellonym.me**
- **Peertube**
- **IRC**
- **Tradingview.com**
- **Rooter.gg**
- **Loco.gg**
- **Buzzit.ca**
- **Afreecatv.com**
- **Nonolive.com**
- **StageTEN.tv**
- **Live.vkplay.ru**
- **Arena.tv**
- **Bandlab.com**
- **Threads.net**
- **Floatplane.com**
- **OpenAI chatGPT**
- **Estream**
- **Livestorm.io**
- **Boltplus.tv**
- **Cozy.tv**
- **Steamcommunity.com**
- **Whatnot.com**
- **Sessions.us**
- **Jaco.live**
- **X (Twitter) Live & Static Feed Posts**
- **YouNow.com**
- **Shareplay.tv**
- **Truffle.vip**
- **MegaphoneTV.com**
- **Pilled**
- **Riverside.fm**
- **Chzzk.naver.com**
- **Demo.openstreamingplatform.com**
- **Wave.video**
- **Beamstream.gg**
- **Zap.stream**
- **Twitcasting.tv**
- **Bigo.tv**
- **Circle.so**
- **Sooplive.com**
- **On24.com (Q&A only)**

###  Support

For assistance, feedback, and feature requests, join the Social Stream Ninja Discord server: [https://discord.socialstream.ninja](https://discord.socialstream.ninja).

### Standalone Desktop App

There's an upcoming standalone version of Social Stream Ninja that installs as an app, providing more control and avoiding some browser-related issues. 

###  License

Social Stream Ninja is licensed under the GPLv3.0 License. You can find the full license details in the [LICENSE](LICENSE) file. 

### Terms of Service

Please review the [Terms of Service](README.md#terms-of-service) for important information regarding usage, liability, and data handling. 
