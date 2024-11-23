# Social Stream Ninja
Consolidates your live social messaging streams and more. Free.

 [Jump to Download and Install instructions](#to-install)

- Supports live automated two-way chat messaging with Facebook, Youtube, Twitch, Zoom, and dozens more
- Includes a "featured chat" overlay, with messages selectable via the dockable dashboard; auto or manual selection.
- Supports bot-commands and automated chat responses, with custom logic supported via scriptable plugin file.
- Support for LLMs, including native Ollama API support; powering AI-based moderation, chat, RAG, and custom instructions.
- Text-to-speech support, including free, premium and ultra-premium TTS services supported.
- Multi-channel source-icon support, so you can differentiate between different streams and creators
- Message relaying support; send messages from one platform to other platforms automatically
- No user login, API key, or permission needed to capture the chat messages from most sites and services.
- Queuing of messages for later highlighting
- Free community support at https://discord.socialstream.ninja

Social Stream Ninja (SSN) makes use of VDO.Ninja's data-transport API to stream data securely between browser windows with extremely low latency and all for free!

![image](https://user-images.githubusercontent.com/2575698/148505639-972eec38-7d8b-4bf3-9f15-2bd02182591e.png) ![image](https://user-images.githubusercontent.com/2575698/148505691-8a08e7b0-29e6-4eb5-9632-9dbcac50c204.png)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

  - [Supported sites:](#supported-sites)
    - [Chat graveyard 🪦🪦🪦](#chat-graveyard-)
  - [Video walk-thru](#video-walk-thru)
  - [Manually install extension](#manually-install-extension)
    - [Seeing an error message about Manifest Version 2?](#seeing-an-error-message-about-manifest-version-2)
  - [Chrome Web Store version](#chrome-web-store-version)
    - [Updating](#updating)
    - [Firefox support](#firefox-support)
  - [Standalone version of the app](#standalone-version-of-the-app)
  - [To use the extension](#to-use-the-extension)
  - [Customize](#customize)
    - [More advanced styling customizations](#more-advanced-styling-customizations)
    - [Removing text-outlines](#removing-text-outlines)
    - [Changing the background alternative line colors in the dock](#changing-the-background-alternative-line-colors-in-the-dock)
  - [Changing CSS without OBS](#changing-css-without-obs)
  - [Pre-styled templates / themes](#pre-styled-templates--themes)
    - [Custom Overlays from scratch](#custom-overlays-from-scratch)
    - [Custom Javascript](#custom-javascript)
    - [Auto responding / custom actions](#auto-responding--custom-actions)
  - [Queuing messages](#queuing-messages)
  - [Pinning messages](#pinning-messages)
  - [Togglable Menu Commands](#togglable-menu-commands)
  - [View chat while gaming; always-on-top](#view-chat-while-gaming-always-on-top)
  - [Hotkey (MIDI / Streamlabs) support](#hotkey-midi--streamlabs-support)
  - [Server API support](#server-api-support)
    - [Social Stream Ninja's server API (ingest and clear messages via remote request)](#social-stream-ninjas-server-api-ingest-and-clear-messages-via-remote-request)
    - [Message structure](#message-structure)
    - [Remote server API support (publish messages to third parties)](#remote-server-api-support-publish-messages-to-third-parties)
    - [Inbound third-party donation support](#inbound-third-party-donation-support)
  - [Text to speech](#text-to-speech)
    - [Installing different language-speech packs](#installing-different-language-speech-packs)
    - [Premium TTS voice options](#premium-tts-voice-options)
  - [Branded channel support](#branded-channel-support)
  - [Random other commands not documented elsewhere](#random-other-commands-not-documented-elsewhere)
  - [Known issues or solutions](#known-issues-or-solutions)
    - [Chat stops when put in the background or minimized](#chat-stops-when-put-in-the-background-or-minimized)
    - [Blue bar appears or chat responder not working](#blue-bar-appears-or-chat-responder-not-working)
    - [Can't export settings or save files](#cant-export-settings-or-save-files)
    - [Other issues](#other-issues)
  - [Requesting a site](#requesting-a-site)
  - [Adding sites yourself](#adding-sites-yourself)
  - [OBS remote scene support](#obs-remote-scene-support)
  - [Support](#support)
- [License](#license)
- [Terms of Service](#terms-of-service)
- [Privacy Policy](#privacy-policy)
- [Donations](#donations)
- [Icons and Media](#icons-and-media)
- [Credit](#credit)
- [Contributors to this project](#contributors-to-this-project)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Supported sites:

- twitch.tv - pop out chat to trigger
- youtube live - pop out the chat to trigger (studio or guest view); or add &socialstream to the YT link
- youtube static comments - click SS in the top right corner of Youtube, then select the message you wish to publish inside the YT comment section via the new buttons there.
- facebook live - guest view, publisher view, or the producer's pop-up chat on the web is supported.
- workplace.com - (same setup as Facebook)
- zoom.us (web version)
- owncast demo page (`watch.owncast.online`, or for a pop-out chat version, open `https://watch.owncast.online/embed/chat/readwrite/`  )
- crowdcast.io
- livestream.com
- mixcloud.com (pop out chat)
- ms teams (teams.live.com and teams.microsoft.com)
- vimeo.com (either the vimeo.com/events/xxx pages or https://vimeo.com/live-chat/xxxxxxxxx/interaction/)
- instagram live (instagram.com/*/live/),  css note:  `[data.type = "instagramlive"]`
- Instagram post non-live comments (REQUIRES the TOGGLE in menu to enable it), css note: `[data.type = "instagram"]`
- instafeed.me (no pop out; alternative instagram live support)
- tiktok live (tiktok.com/*/live -- the chat must be left open/visible if using the extension version)
- webex live chat (not the pop out)
- linkedin events and live comments. (works with linkedin.com/videos/live/* or linkedin.com/videos/events/* or linkedin.com/events/*)
- vdo.ninja (pop-out chat)
- Whatsapp.com (REQUIRES the TOGGLE in menu to enable it; use @ https://web.whatsapp.com ; fyi, no avatar support)
- discord.com (web version; requires toggle enabled via the settings as well) 
- telegram (web.telegram.org in stream mode; requires toggle enabled)
- slack (https://app.slack.com/ ; required toggle enabled to use)
- Google Meet ; required toggle enabled to use. (You can specify your own name, rather than "You", via the host/bot section in the extension menu)
- ![Requires toggling to enable certain integrations](https://user-images.githubusercontent.com/2575698/178857380-24b3a0fc-bf86-4645-91ec-24893df19279.png) telegram, slack, whatsapp, discord require an extra step to enable.  See this video for more help: https://www.youtube.com/watch?v=L3l0_8V1t0Q
- restream.io chat supported (https://chat.restream.io/chat)
- amazon.com/live
- wix.com (https://manage.wix.com/dashboard/*/live-video/*)
- clouthub (no pop out; just the video page)
- rumble.com (pop out chat)
- trovo.live (open the chat pop-up page; ie: https://trovo.live/chat/CHANNEL_NAME_HERE)
- Dlive.tv  (just the regular viewer page; no pop out needed)
- Picarto.tv (pop-out chat; ie: https://picarto.tv/chatpopout/CHANNELNAMEHERE/public)
- Mobcrush (this page: https://studio.mobcrush.com/chatpopup.html)
- odysee.com (via the pop out chat I think)
- minnit.chat support (https://minnit.chat/xxxxxxxxxxx?mobile&popout)
- livepush.io (chat overlay link provided; no input field support?)
- piczel.tv (pop out chat @ https://piczel.tv/chat/xxxxxxxxx)
- bilibili.tv (just regular view page /w chat; no pop out)
- bilibili.com (just regular view page /w chat; no pop out.)
- Amazon Chime (https://app.chime.aws/meetings/xxxxxxxxx)
- Locals.com (no pop out needed)
- Nimo.TV (pop out chat, ie: https://www.nimo.tv/popout/chat/xxxx)
- kick.com (pop out chat)
- quickchannel.com (https://play.quickchannel.com/*)
- rokfin.com (https://www.rokfin.com/popout/chat/xxxxxx?stream=yyyyyy)
- sli.do (https://app.sli.do/event/XXXXXXXXXXXXXX/live/questions)
- cbox.ws (no pop out needed)
- castr.io (https://chat.castr.io/room/XXXXXXXX)
- tellonym.me
- peertube (triggers on: https://*/plugins/livechat/*router/webchat/room/*)
- IRC (via https://webchat.quakenet.org/)
- Tradingview.com (just the normal viewer page; no pop out)
- rooter.gg (no pop out; just pause the video I guess)
- loco.gg (no pop out; just pause the video I guess)
- buzzit.ca (community member submitted integration)
- afreecatv.com (pop out the chat; you can't close the main window it seems tho?)
- nonolive.com (no pop out; partial support added so far only)
- stageTEN.tv
- live.vkplay.ru (was vkplay.live) - pop out the chat
- arena.tv (no pop out chat support, so just pause the video I guess)
- bandlab.com (no pop out, so just pause the video I guess while chat open)
- threads.net (a little funky star icon, right of the share icon, will select thread to push to dock)
- floatplane.com (pop out chat; gotta keep the main window still open though? annoying..)
- OpenAI chatGPT chat - (via https://chat.openai.com/chat). You must opt-in via the toggle for this though
- estrim - live video chat supported
- livestorm.io (open the 'external sidebar', which might be a plugin, and it should capture that)
- boltplus.tv (pop out chat)
- cozy.tv (no pop out; just open the view page)
- steamcommunity.com (https://steamcommunity.com/broadcast/chatonly/XXXXXXXX)
- whatnot.com (no pop out, so just open the view page)
- sessions.us - the meeting video chat; not popped out.(You can specify your own name, rather than "You", via the host/bot section in the extension menu)
- jaco.live (https://jaco.live/golive)
- X Live video chat (aka, was Twitter) (open the chat pop out; ie: https://x.com/XXXXXXXXXX/chat and make sure chat permissions are enabled 
- X static feed posts -- you will need to click "Enable Overlay" in the lower right of X  to have X posts be supported. Manually click then to select which post.
- younow.com - ( just open the video as normal with chat on the side; there's no pop out chat, so the link is just https://www.younow.com/USERNAME )
- shareplay.tv (pop out chat, ie: https://www.shareplay.tv/chat/usernamehere/9fd3a9ee-a915-4f8b-b23d-xxxxxxxxxxx)
- truffle.vip (https://chat.truffle.vip/chat/*)
- megaphonetv.com (In [Studio](https://studio.megaphonetv.com/), select UGC, then open Recent messages)
- pilled (pop out the chat)
- riverside.fm (just open the chat bar. Note: you can opt-out of capture via the extension menu)
- chzzk.naver.com (pop out the chat)
- demo.openstreamingplatform.com (pop out chat)
- wave.video
- beamstream.gg (open https://beamstream.gg/USERNAME/chat to user. *note the /chat added at the end)
- zap.stream (no pop out)
- twitcasting.tv (no pop out)
- bigo.tv (no pop out)
- circle.so
- sooplive.com (pop out the chat to use)
- on24.com ( Q&A - questions supported)
- meetme
- music.gala.com (no pop out)
- WebinarGeek (no pop out ; chat only)
- live.fc2.com (no pop out)
- noice.com (main video chat)
- parti.com (pop out chat)
  
There are additional sites supported, but not listed; refer to the sources folder for a more complete listing.
  
[More on request](#requesting-a-site)

#### Chat graveyard 🪦🪦🪦

Past supported sites that have ceased to exist.

- 🪦 omlet.gg (RIP June 2023)
- 🪦 glimesh (RIP July 2023)
- 🪦 theta.tv (RIP Sept 2023)
- 🪦 xeenon.xyz (RIP Sept 2023)
- 🪦 live.space (RIP April 2024)
- 🪦 vstream.com (RIP April 2024)
- 🪦 twitter.com (RIP May 2024. fight me.)
- 🪦 vimm.tv (RIP June 2024)
- 🪦 caffeine.tv (RIP June 2024)

  (it's the effort that counts, guys; may your code live on in our ai llm bots forever)

### Video walk-thru

Install guide for the extension: https://www.youtube.com/watch?v=Zql6Q5H2Eqw

A bit about Social Stream Ninja (old now): https://www.youtube.com/watch?v=X_11Np2JHNU

How to setup for discord, slack, whatsapp, meet, and telegram, see: https://www.youtube.com/watch?v=L3l0_8V1t0Q

### Manually install extension

This extension should work with Chromium-based browser on systems that support webRTC. This includes Chrome, Edge, and Brave. [Firefox users see here](https://github.com/steveseguin/social_stream#firefox-support).

The link to download newest main version is here: https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip

Once extracted into a folder, you can go here to load it: chrome://extensions/

![image](https://user-images.githubusercontent.com/2575698/142858940-62d88048-5254-4f27-be71-4d99ea5947ab.png)

Ensure you have Developer Mode enabled; then you can just load the extension via the load unpacked button and selecting the folder you extracted the fiels to.

![image](https://user-images.githubusercontent.com/2575698/142857907-80428c61-c192-4bff-a1dc-b1a674f9cc4a.png)

You're ready to start using it! 

Please note also that you will need to manually update the extension to access newer versions; it currently does not auto-update aspects of the extension; just the dock and single overlay page auto-update as they are hosted online.

#### Seeing an error message about Manifest Version 2?

If you see the browser say there is an "Error", specifically a manifest v2 warning, you can safely ignore it. It is not actually an error and will not impact the function of the extension at present. If it worries you, please note that both a manifest version 3 version of the extension is available for download or via the Chrome webstore; there is also a standalone desktop app version. Manifest version 2 just happens to remain the most tried and test version at the moment.

While Google will eventually kill manifest version 2 extensions, it's possible to keep them alive until at least June 2025, as noted in <a href="https://www.reddit.com/r/chrome/comments/1dln9ev/tutorial_extend_manifest_v2/">this guide here</a>. I will depreciate version 2 when the times come, and while manifest version 3 is more restrictive, it should still work. If you download the v3 version from the Webstore, please note that I will only update it every couple weeks, due to review restrictions by Google. You can download version 3 all directly from Github, under the v3 branch.

### Chrome Web Store version

You can install Social Stream Ninja via the Chrome Web Store, however it only gets updated every few weeks, due to the lengthly review process involved in updating it.

https://chromewebstore.google.com/detail/social-stream-ninja/cppibjhfemifednoimlblfcmjgfhfjeg

It's based on Chrome Manifest v3, and will require you to leave a small browser tab open to use it.

#### Updating

To update, just download the extension, replace the old files with the new files, and then reload the extension or completely restart the browser.  If just reloading the extension, you may then need to also reload any open chat sites that you wish to use Social Stream Ninja with.

You can download the newest version here: https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip

Please note: DO NOT Uninstall the extension if you want to update it. This will delete all your settings.  Replace the files, and reload the extension or browser instead.  If you MUST uninstall, you can export your settings to disk and reload them after you have reinstalled.  

New app integrations do not auto-update; just the overlay and dock page will auto-update. It's suggeseted you update every now and then manually, or whenever you encounter a bug.  I'll try to resolve this issue down the road, perhaps with a standalone desktop app eventually.

And for a video that covers two ways to update the extension: https://youtu.be/Zql6Q5H2Eqw?t=612

(If using the Standalone app version of SocialStream, and not the extension, it will auto update when you reload/reopen)

#### Firefox support

I no longer offer official Firefox support, but you can still try to get it going with the steps below:

 - Download+extract or clone the SocialStream code somewhere.

 - Go to `about:debugging#/runtime/this-firefox` in Firefox and select Load Temporary Add-on. 

 - Select any file inside the SocialStream folder.

 - You're done.  This is a temporary install and none of the settings made will be persist, including your session ID.

You will still need to manually redo these steps to update when needed, but you can use the newest version of the code.

### Standalone version of the app

There is an upcoming standalone version of Social Stream Ninja, which installs as an app, rather than as a browser extension.

To try out the preview test version of the app, you can download it below, but keep in mind that the bugs are still being worked out:

[https://github.com/steveseguin/social_stream/releases/](https://github.com/steveseguin/social_stream/releases)
MacOS and Windows 10/11 (x64) are supported currently, with limited Linux support now available via an AppImage.

Please note:  If using the same session ID in both the browser extension and the standalone version, you will only be able to use one at a time. 

### To use the extension

Open Twitch or Youtube "Pop out" chat; or just go to your Facebook Live chat while connected to Ethernet or WiFi. You must not minimize or close these windows, but they can be left in the background or moved to the side.

Then, press the Social Stream Ninja chrome extension button and ENABLE streaming of chat data. (Red implies disabled. Green is enabled)

![image](https://user-images.githubusercontent.com/2575698/142856707-0a6bc4bd-51b4-4cd0-9fa3-ef5a1adfcbf7.png)

##### Please note:  If the Extension's icon is RED, then it means it is still off and wil not work.  You have to click "Enable extension", and the icon must change to the color green.

Next, using the provided two links, you can manage the Social Stream Ninja of chat messages and view selected chat messages as overlays.

![image](https://user-images.githubusercontent.com/2575698/142935393-4ca90418-a645-45e3-8e37-f4884e16457a.png)

You can hold ALT on the keyboard to resize elements in OBS, allowing you to crop the chat stream if you want to hide aspects like the time or source icon.

Clicking on a message will have it appear in the overlay link. You can press the clear button to hide it or use the &showtime=20000 URL option added to the overlay page to auto-hide it after 20-seconds (20,000 ms).

![image](https://user-images.githubusercontent.com/2575698/142854951-fe1f34c9-0e24-495f-8bfe-a33ab69fa7cb.png)

There is a &darkmode option, but the default is white, for the dock.

![image](https://user-images.githubusercontent.com/2575698/142855585-45c11625-c01c-4cc0-bfe0-cde4aed5fc44.png)

A good resolution for the overlay is either 1280x600 or 1920x600; you can specify this in the OBS browser source.  You can edit the style of the overlay using the OBS CSS style input text box.  The chat overlay will appear 50-px from the bottom currently, but the height of the chat window can be quite tall; to avoid the name of the overlay being cropped, just make sure you give it enough room.

![image](https://user-images.githubusercontent.com/2575698/142855680-74f6055d-7b79-4e9a-ae7d-909c7f677a24.png)

If using the automated chat response options, like auto-hi, you must ensure the Youtube/Twitch/Facebook chat input options are enabled and that you are able to send a chat message. Manually entering a chat message into the pop-out window or into the Facebook live chat area first can help ensure things are working are intended, else automated message may not be sent.

 ##### Note: If things do not work,
 
- Toggle the extension on and off, and reload the pop-out chat window.  Ideally the pop-out chat should be visible on screen, as even just a few pixels shown will allow the pop-out chat to work at full-power.  Chrome otherwise may throttle performance.
- Open a new dock / overlay link if things still do not work, as the session ID may have changed.
- Ensure that VDO.Ninja works with your browser, as if not, webRTC may be disabled and so this Social Stream Ninja extension will not work also.
- If using Facebook live chat, please sure you are viewing the page as a "viewer", not as a publisher, and that you are connected to WiFi or Ethernet, and not mobile LTE/4G/5G.
- The auto-responder requires you to be signed in to the social endpoint and that you have access to chat; ensure you accept any disclaimer and try issuing a test message first.
- Try using the extension in Incognito mode or try disabling all other browser extensions, then reloading the browser, and trying again.  Many extension types will conflict with Socialstream, causing certain functions to fail.

### Customize

There are quite a few toggles available to customize functions and styles, but these toggles often just apply URL parameters. You can as a result, just manually apply the parameters yourself, opening up more fine-grain control.  A list of some of the options are available below.

To customize the dock, you can use the following options:

- &lightmode (Enables the dark-mode for the chat stream)
- &scale=2 (doubles size/resolution of all elements)
- &notime (hides the date in the chat stream)
- &hidesource (hides the youtube/twitch/fb icons from the stream)
- &compact (Removes the spacing between name and message)
- &autoshow (will auto-feature chat messages as they come into the dock at a rate of about 2 per 3 seconds)
- &attachmentsonly (will only show image attachments in the dock; the messages will be wiped)

To customize the featured chat overlay, the following URL parameters are available

- &showtime=20000 (auto-hides selected messages after 20s)
- &showsource (shows the youtube/twitch/fb icons next to the name)
- &fade (will have featured messages fade in, rather than pop up)
- &swipe (will have featured messages swipe in from the left side)
- &center (center featured messages)

To customize the color, font-size and styling, you can edit the CSS, in either the OBS browser source style-sheet section, or by editing the and using the featured.html file. See below:

#### More advanced styling customizations

To further customize the appearance of the overlay or dock, you can make CSS style changes via OBS browser source, without any coding.  

![image](https://user-images.githubusercontent.com/2575698/153123085-4cf2923e-fce3-40bd-bd66-3ba14a6ab321.png)

```
body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }

:root {
     
     --comment-color: #090;
     --comment-bg-color: #DDD;
     --comment-color: #FF0;
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
Sample CSS of which you can use to customize some of the basic styles. There's not much that you can't do via CSS in this way, but you can edit things further at a code-level if needed. Mac/Linux users may face issues with OBS not liking self-hosted versions of the featured/dock file, but it's not an issue for the PC version.

It's important in some cases to add `!important` at the end of some CSS values, to force them into use.

#### Removing text-outlines
Try:
```
body {
	text-shadow: 0 0 black;
}
```

#### Changing the background alternative line colors in the dock
In OBS browser source, for the CSS style, add the following to customize the alternative colors
```
:root {
    --highlight-base: #333!important;
    --highlight-base2: #888!important;
    --highlight-compact: #333!important;
    --highlight-compact2: #888!important;
}
```
Note that `--highlight-compact` and `--highlight-compact2` are needed if using &compact mode, while the other two are the default background alternative colors.  Using `!important` is needed to force override the style.

### Changing CSS without OBS

You can also pass custom CSS to the dock and featured page via URL parameters using either &css or &b64css.

`&css=https://youdomain.com/style.css` or `&b64css=YOUR_CSS_CODE_HERE`

You can use this tool to encode the URL you want to link to:  https://www.urlencoder.org/

For the base64 css option, you can create the base64 encoding using `btoa(encodeURIComponent(csshere))` via the browser's developer console. For example:

```window.btoa(encodeURIComponent("#mainmenu{background-color: pink; ❤" ));```

The above will return the base64 encoded string required. Special non-latin characters are supported with this approach; not just latin characters.

Example of what it might look like:
https://socialstream.ninja/?64css=JTIzbWFpbm1lbnUlN0JiYWNrZ3JvdW5kLWNvbG9yJTNBJTIwcGluayUzQiUyMCVFMiU5RCVBNA

### Pre-styled templates / themes

You can try out some stylized chat overlays in the themes folder:

An example of one is available here: https://socialstream.ninja/themes/pretty.html?session=SESSIONIDHERE

![image](https://user-images.githubusercontent.com/2575698/193437450-545f7f4c-d5fc-465b-9cfe-d42f82671c51.png)

For anyone who wants to create a custom theme/style/template for their chat stream, you can share them via adding them to this repository as a Pull Request.

#### Custom Overlays from scratch

For those so inclined to make their own overlays for Social Stream Ninja from scratch, I've created a basic and bare HTML template for reference.

Check it out here: https://socialstream.ninja/sampleoverlay?session=XXXXX

- There are no functions like TTS or style customization via URL parameters; it's just a simple fixed overlay with minimal code
- It can be used as a featured overlay or as a dock-alternative, with all messages. In the code, toggle `featuredMode` on or off, depending on whether you want it work with featured messages only, or all incoming messages.
- You can edit and load it via your browser locally, without needing to host it. Keep it perhaps in a different folder than Social Stream Ninja though to avoid having it deleted after an update.
  
![image](https://github.com/steveseguin/social_stream/assets/2575698/26f26421-ac44-47f7-bcfc-04627deb85f9)

#### Custom Javascript

You can inject a bit of javascript into the dock or featured pages using `&js={URL ENCODED JAVASCRIPT}`

For example, 
[https://socialstream.ninja/featured.html?session=test123&js=https%3A%2F%2Fvdo.ninja%2Fexamples%2Ftestjs.js](https://socialstream.ninja/featured.html?session=test123&js=https%3A%2F%2Fvdo.ninja%2Fexamples%2Ftestjs.js)

#### Auto responding / custom actions

You can create your own custom auto-responding triggers or other actions by including a `custom.js` file. You don't need to host the featured or dock file for this.

Included in the code is the `custom_sample.js` file, which you can rename to custom.js to get started. Included in it is the `&auto1` trigger, which  auto responds "1" to any message that is also "1".  You need to add `&auto1` to the dock's URL to activate it.

It's fairly easy to modify the `auto1` trigger to do whatever you want. You can also customize or remove the URL-parameter trigger needed to activate it.

Please note that currently the custom.js file needs the dock.html to be opened locally, if you wish to have it load there.

### Queuing messages

If you hold CTRL (or cmd on mac), you can select messages in the dock that get added to a queue.  A button should appear in the top dock menu bar that will let you cycle through the queue, one at a time.  When pressing the Next in Queue button, messages from the queue will appear as featured chat messages in the overlay page.

### Pinning messages

Like queuing a message, you can also instead hold down the ALT key while clicking a message to pin it; it will stay at the top of the page, until unpinned in the same fashion.

### Togglable Menu Commands 

These are some generic auto-reply commands that can be toggled on/off via the extension's menu. They do not need a custom.js file to work

- !joke  (tells a random geeky dad joke)
- hi  (Welcomes anyone who says "hi" into chat)

### View chat while gaming; always-on-top

The Standalone desktop version of Social Stream Ninja can pin windows on top of other applications, and can have the background be transparent. The Standalone app is still early in its development, so instead you might want to consider the Electron Capture app instead.  It offers the ability to keep any browser window on top of your apps, such as while gaming, and there is a hotkey function to toggle user input when needing to interact with it.

check it out here: https://github.com/steveseguin/electroncapture

![image](https://github.com/steveseguin/social_stream/assets/2575698/9c9c9da7-5656-45f8-ab86-5be56099d970)


### Hotkey (MIDI / Streamlabs) support

There's a toggle to enable MIDI hotkey support. This allows a user to issue commands to the extension when active, such as issue predefined chat messages to all social destinations.

The hotkeys can be issued via MIDI, which can be applied to a Streamdeck also via a virtual MIDI device. The MIDI actions available currently include:

Using Control Change MIDI Commands, on channel 1:

- command 102, with value 1: Say "1" into all chats
- command 102, with value 2: Say "LUL" into all chats
- command 102, with value 3: Tell a random joke into all chats
- command 102, with value 4: Clear all featured chat overlays
	
![image](https://user-images.githubusercontent.com/2575698/144830051-20b11caa-ba63-4223-80e1-9315c479ebd6.png)


The StreamDeck MIDI plugin can be found in the Streamdeck store pretty easily. 

Please note that you will also need a MIDI Loopback device installed if using the StreamDeck MIDI plugin. For Windows, you can find a virtual MIDI loopback device here: https://www.tobias-erichsen.de/software/loopmidi.html  There are some for macOS as well.

![image](https://user-images.githubusercontent.com/2575698/186810050-c6b026f2-3642-4bed-a3b2-f954b1d5b507.png)

Lastly, please note that you will need to enable the MIDI option in the menu options for it to work, as it is not loaded by default.

![image](https://user-images.githubusercontent.com/2575698/186801053-6319d63e-fe92-42bc-b951-cad4d35753cc.png)


### Server API support

You can send messages to Social Stream Ninja via the hosted server ingest API, and you can also send messages from Social Stream Ninja to remote third-parties. Many options are supported; perhaps more than what is listed below.

A simple use case is to ingest a donation from a third party via webhook. You can push those dono notifications to Social Stream Ninja and show as an overlay. You can also use a third-party service to overlay messages captured by Social Stream Ninja. More below.

#### Social Stream Ninja's server API (ingest and clear messages via remote request)

If using the MIDI API isn't something you can use, you can also check out the hosted API service to send messages to SocialStream, which will be redirected to your social live chat sites.  This API works with a Stream Deck or custom applications.

This API end point supports WSS, HTTPS GET, and HTTP POST (JSON).  Support for this API must be toggled on in the menu settings; there's several different toggles you may want to enable, depending on which HTTP/WSS API you want to use

##### API Sandbox with many examples as buttons

There's a link to this page in the Social Stream Ninja options menu itself, but it contains a large number of common API commands, available at a press of a button.

https://socialstream.ninja/sampleapi.html?session=xxxxxxxxxx (replacing xxxxxxxx with your Social Stream Ninja session ID to have it work)

Referring to the source code of the sampleapi.html page is useful if you wish to develop your own API integration, or get a better understanding of the basics.

Most, but not all, API commands are listed there. Referring to the source code or asking Steve on Discord (socialstream.discord.vdo) can help with options not listed.

##### A couple common examples
 
An overly simple example of how to use the GET API would be: https://io.socialstream.ninja/XXXXXXXXXX/sendChat/null/Hello, which sends HELLO.  Replace XXXXX with your Social Stream Ninja session ID.  Other options, like `https://io.socialstream.ninja/XXXXXXXXXX/clearOverlay` should work, too.

You can use this API to clear the featured-chat, poke the next-in-queue item, and more. It works with WSS or HTTP requests.

##### Target specific docks

You can also target specific docks with your API requests by assigning a target name to each dock.html page using `&label`.

For example, to set a dock with the target name of "NAMEHERE", we'd do: `https://socialstream.ninja/dock.html?session=XXXXXXXXXXXXX&server&sync&label=NAMEHERE`.  From there, we can target it with the API format like this: `https://io.socialstream.ninja/XXXXXXXXXXXXX/nextInQueue/NAMEHERE/null`.  This all may be needed because if you have multiple docks connected to the API interface, you may not want to trigger the same command multiple times in all cases.

##### General technical concept of the API logic iteslf

The public API for Social Stream Ninja is based on the same API server logic that VDO.Ninja uses, which is mentioned here: https://github.com/steveseguin/Companion-Ninja.

More information on the routing logic below..

######  GET/POST API structure

The generic structure of the API is:
`https://io.socialstream.ninja/{sessionID}/{action}/{target}/{value}`

or

`https://io.socialstream.ninja/{sessionID}/{action}/{value}`

or

`https://io.socialstream.ninja/{sessionID}/{action}`

Any field can be replaced with "null", if no value is being passed to it. Double slashes will cause issues though, so avoid those.

There's a niche advanced command for the GET API, where if you publish with the action `content`, it will accept a JSON object via the URL, and send it to websocket's channel 1.  Using action `content2` sends it instead to channel 2, and `content3` will send to channel 3, etc. You could in theory publish predefined messages to the dock, extension, overlay page, etc, via a Streamdeck hotkey, this way.

###### Websocket API
If using the Websocket API, this accepts JSON-based commands

connect to: wss://io.socialstream.ninja:443, which will by default have you'll join channel 1, I believe. For something more advanecd, try wss://io.socialstream.ninja/join/SESSIONIDHERE/CHANNELINBOUND/CHANNELOUTBOUND

On connection, send: {"join": $sessionID }, where $sessionID is your session ID.

be sure to stringify objects as JSON before sending over the websocket connection. ie: JSON.stringify(object)
Once joined, you can then issue commands at will.

Be sure to implement reconnection logic with the websocket connection, as it will timeout every minute or so by default otherwise. You will need to rejoin after a timeout.

###### Server Side Events
If you want to simply listen to events, using SSE connections, you can do so using the https://io.socialstream.ninja/sse/APIKEYHERE endpoint.

Sample Javascript code is below:
```
const sessionID = "YOURSTREAMIDHERE";
const eventSource = new EventSource(`https://io.socialstream.ninja/sse/${sessionID}`);
eventSource.onmessage = function(event) {
 console.log(JSON.parse(event.data));
};
eventSource.onerror = function(error) {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

#### Message structure

Messages sent over `io.socialstream.ninja` contain normally a display name, avatar image of the user, source type, and normally a few other optional fields, like donations.

Typically, some form of message content is needed to be accepted as a valid message. If just a name for example, that will typically be rejected as an empty message.

While the data structure of the message is not formalized yet, as it's evolving still, you can find the current basic outline of it below.

key name | value type | description
--- | --- | ---
chatname | string | Display name
chatmessage | string | Chat message
chatimg | string | URL or DataBlob (under ~55KB) of the user's avatar image
type | lower-case string | the pre-qualified name of the source, eg: `twitch`, also used as the source png image
sourceImg | string | an alternative URL to the source image; relative or absolute
textonly | boolean | Whether the chat message is only plain text; or does it contain HTML, etc.
hasDonation | string | The donation amount with its units.  eg: "3 roses" or "$50 USD".
chatbadges | array | An array of URLs/Objects. If an object, it may define itself as an img/svg and other attributes
contentimg | string | URL to a single image or mp4/webm video
membership | string | Membership event description / membership action / type or whatever
title | string | An alternative name given for a donation event; CHEERS / DONATION are typical defaults
subtitle | string | For added detail of a membership event, like number of months they have been a member.
moderator | boolean | Whether they are a moderator in chat or not
event | string or boolean | Whether this message should be treated as an event, and possible, what type of event it is
admin | boolean | Whether they are a "priviledged" user or not
bot | boolean | Whether the user is a bot / host or not
question | boolean | Whether the message is a certified question or not
userid | string | Some form of unique user ID / username for the source type. Useful if the display name isn't unique or if needing the user ID external API needs, like user blocking
karma | float | 1.0 is a happy message; 0.0 is negative message, so 0.1 is likely bad. AI generated
id | integer | This is maintained mostly internally, but it's an internal message ID value
private | boolean | whether this is a private/direct message; typically won't be made public by default
nameColor | string | Manually specify the color of a display name by passing a color value
textColor | string | Manually specify the background color of a featured message
backgroundColor | string | Manually specify the color of a featured message's main text color

#### Remote server API support (publish messages to third parties)

Remote API support is available via dock page or extensions.  You can currently auto-publish messages via the dock with the &autoshow parameter, but there's also an option to publish to the featured chat via the dock directly. To capture these messages, you can use the websocket API server, which requires enabling a toggle in the General mechanics section. You can also publish messages via POST/PUT to an HTTP webserver, rather than connecting with websockets; there's a few options for singular / h2r specifically.

For some images provided in the outgoing data-structure, the assumed host location for certain files/images, if none provided, should be `https://socialstream.ninja/`.

If wanting to connect to the websocket server, to publish or listen to messages, you can refer to the code for actual examples.  However, a simple way to listen for messages broadcasted by the extension is with `wss://io.socialstream.ninja/join/SESSIONIDHERE/4`, which implies joining the room with our session ID as the name, and then subscribing to channel 4 for messages.  `wss://io.socialstream.ninja/join/SESSIONIDHERE/1/2` on the other hand would listen on channel 1, and publish to channel 2.

##### Singular Live

`&singular=XXXXXXX` will send selected messages (via the dock page) to singular live for featured message overlay.  The target address will be: `https://app.singular.live/apiv1/datanodes/XXXXXXX/data`

This parameter is added to the dock page to use.

##### H2R

`&h2r=XXXXXXX` will send selected messages (via the dock page) to a local H2R server using its POST data structure. The target address will be: `"http://127.0.0.1:4001/data/XXXXXXX`

You can manually set a custom H2R URL though with `&h2rurl` though, which will override the default one.

These parameters are added to the dock page to use.

##### Generic POST / PUT

These options will send selected featured messages (via the Dock page) to a remote web server; the default URL is  "http://127.0.0.1"

A generic JSON-POST can be made using `&postserver`, with the address provided
`&postserver=https://domain.com/input-source`

A generic JSON-PUT can be made using `&putserver`, with the address provided. There isn't much difference between POST and PUT, but some sites are picky.
`&putserver=https://domain.com/input-source`

In these cases, the JSON being delivered is in the Social Stream Ninja data-structure. Example usage is as follows:

`https://socialstream.ninja/dock?session=XXXXXX&postserver=https://127.0.0.1/messageingest/?socialstream`

#### Inbound third-party donation support

##### Stripe webhook donation support

If you create a Stripe payment link (eg: https://donate.stripe.com/YYYYYYYYYYYY), you can have successful payments show up in Social Stream Ninja. This is a great way to collect donations from viewers of your stream without needing to use middleware for payment processing.

To get started, after creating a Stripe payment link, create a Stripe webhook that listens for the event `checkout.session.completed`. Have the webhook point to: `https://io.socialstream.ninja/XXXXXX/stripe`, where XXXXXX is your Social Stream Ninja session ID. You don't need to worry about the verification signatures or API tokens in Stripe since we won't be verifying the payments. Of course, keep your session ID private as a result, else someone will be able to spoof fake donations to your end point.

If you wish to ask the payer for a name, include a custom field called "Display Name" or "Username" when creating your Stripe payment link. You can also include a field called "Message", which will allow the payer an opportunity to leave a custom message. The donation amount and current type should be dervived from the payment automatically, but some rare exotic currencies may not always show up with the right decimal place -- just keep that in mind.

Lastly, to allow these events to show up in the Social Stream Ninja dock, add &server to the dock URL; this will have the dock start listening for incoming messages from the webhook/api server. You can always test that the workflow is working using Stripe's "Test mode"; just spam 424242.. etc for the credit card number, expiration, cvc, etc, when using the test mode, rather than a valid credit card.

![image](https://github.com/steveseguin/social_stream/assets/2575698/29bab9b6-8fb7-482d-87d1-2b7f2bd74f9f)

![image](https://github.com/steveseguin/social_stream/assets/2575698/3f31974c-6bbb-4ed0-bc7c-4d27f7c3103b)

##### Ko-Fi webhook donation support

This is very simliar to the Stripe support method, as seen above.

To setup, sign into your Ko-Fi account, go to https://ko-fi.com/manage/webhooks

Add `https://io.socialstream.ninja/XXXXXXXX/kofi` to the Webhook URL text field, where you replace XXXXXXXX with your Social Stream Ninja session ID.

![image](https://github.com/steveseguin/social_stream/assets/2575698/9119d86a-d452-4658-b1c5-383f5b16fc9d)

On your `dock.html` page, append &server to the URL (at the end is fine).  This has the dock connecting to the Social Stream Ninja API service, which is where our Ko-Fi notifications will come from.

![image](https://github.com/steveseguin/social_stream/assets/2575698/d4669e90-1019-4b6d-a809-ed1483f0b770)

You can then press the Send Single Donation Test button.

![image](https://github.com/steveseguin/social_stream/assets/2575698/73ba4b80-c599-45f6-85df-6ff629a3e6a5)

Please note, do not share your Social Stream Ninja session ID with others as they will be able to create fake donations to Social Stream Ninjas via posting to the API.

##### BuyMeACoffee webhook support

See above for usage details, as Buy-me-a-coffee support is similar in concept to Ko-Fi. Added specifics below:

The webhook URL for it however is: `https://io.socialstream.ninja/XXXXXXXX/bmac`

Event types supported include: `membership.started` and `donation.created`.

The default display name if none provided by the user will be `Anonymous`.

`support_note` and `membership_level_name` will be used as fields for the new membership event.

`support_note` and amount donated, with currency type, will be used as fields for the donation event.

### Text to speech

Text messages can be converted to speech for free, assuming your system supports TTS.  On my Windows machine running Chrome/Edge/OBS, it works just fine.  I have it set to English-US by default, but you can change the language to something else by editing the URL and adjusting the language code.

ie: `featured.html?session=XXXXXX&speech=en-US` or `socialstream.ninja/?session=xxx&&speech=en-US`

Please visit https://socialstream.ninja/tts for a list of available speech options for your specific browser + system. Google Chrome and MS Edge will offer both local and cloud-hosted language options, while "free" open-source browsers, like Chromium or Firefox may only have access to local system languages or none at all. Local options should work within the OBS browser source, such as the ones shown in the image below, but non-local free options will need to be used via Chrome or Edge.

![image](https://github.com/steveseguin/social_stream/assets/2575698/228ff1ca-ad7b-4d73-b3a6-2ff2e01c6cca)

You can sometimes install additional local languages if on Windows. See: https://support.microsoft.com/en-us/windows/download-language-pack-for-speech-24d06ef3-ca09-ddcc-70a0-63606fd16394

![image](https://user-images.githubusercontent.com/2575698/165753730-374498e7-7885-49ef-83ba-7fe2acde26ee.png)

Please note that when using this free TTS approach, the audio will play out the default system audio output device. This might be a problem if using OBS for capture, as you'll need to use a virtual audio cable to capture the audio output of the system output and route it back into OBS for capture.  Another user mentioned they were able to capture the TTS audio in OBS by selecting `explorer.exe` in the system application recorder.

If it's too complicated to use the built-in free TTS, using the premium Google Cloud / ElevenLabs TTS option (mentioned below) would be a great non-free solution to this issue. The paid options play out as browser tab audio, not system audio. See the related issue here: https://github.com/w3c/mediacapture-output/issues/102

If loading the app in the Chrome/Edge/Firefox browser, you will need to "click" the web page first before audio will play. This isn't the case with OBS, but most browsers require the user interact with the website on some level before it will play audio.  Please keep this in mind when testing things.

There is a toggle in the dock to turn off and on the text-to-speech; turning it off whill automatically stop any audio playout. Still, be careful when using text-to-speech with the dock, as viewers can exploit it to have your system read out unwanted things on air.

#### Installing different language-speech packs

By default, the list of support languages on your computer could be slim. To add more speech options for different langauges, you'll need to install them.

see: https://support.microsoft.com/en-us/windows/download-language-pack-for-speech-24d06ef3-ca09-ddcc-70a0-63606fd16394 for details

There's a simplified test app for text-to-speech here also, that might also help try different languages on the fly: 
https://mdn.github.io/dom-examples/web-speech-api/speak-easy-synthesis/

You can manaul set the pitch, volume, rate, and even voice-name with the below URL parameters.  The voice just matches on a partial word, so "siri", "google", "bob", or whatever is being used will work.  This still assumes the language selected also matches. `&speech=en` (first english to match),  `&speech=en-US` (default), or `&speech=fr-CA` can specify the language, for example.
```
&pitch=1
&volume=1
&voice=google
&rate=1
```

#### Premium TTS voice options

##### GOOGLE CLOUD TTS 

I've added support for Google Cloud Text to Speech API, but you must use your own API key to use this feature, as it is expensive to use.  

Go to https://cloud.google.com/text-to-speech -> Enable the service, and then get an API key.

![image](https://user-images.githubusercontent.com/2575698/180443408-5cc0f7a9-c015-420d-9541-fd94a520ef25.png)

This premium text-to-speech is supported on the featured.html (the featured chat overlay) and dock.html page. If  you stop the TTS with the button in the dock's menu, it will stop playback immediately in the dock. It will also delete any queued messages to be spoken.

You need at least &speech and &ttskey to enable the premium TTS, but there are customizations:
```
&volume=1
&voice=en-GB-Standard-A
&gender=FEMALE
&speech=en-us
&ttskey=XXXXXXX
```
See the Google Cloud doc for more help

##### Eleven Labs TTS 

If you want a different set of voices, or wish to train your own, ElevenLabs.io has a TTS service that you can try. There's a "free" version you can get started testing with, which just needs you to create an account there and get an API key from your profile settings there. You may need to provide attribution as required, for the free tier?

Anyways, documentation on getting start with finding a voice you want to use and testing your API key:
API Social Stream Ninja is using: https://api.elevenlabs.io/docs#/text-to-speech/Text_to_speech_v1_text_to_speech__voice_id__stream_post
Available voices: https://api.elevenlabs.io/docs#/voices/Get_voices_v1_voices_get

To use this with Social Stream Ninja, you'll need to be using the featured-chat featured.html or dock.html page, and you'll need to provide your api key there.

Example URL with options `https://socialstream.ninja/featured.html?session=SESSIONIDHERE&tts&elevenlabskey=YOURELEVENLABSAPIKEYHERE&latency=4&voice=VR6AewLTigWG4xSOukaG`

- &tts is also required to enable TTS in general
- &voice={VOICEIDHERE} , is the voice ID you want to use.
- &latency={N}, where N can be 0,1,2,3, or 4.  0 is high latency, but better quality. Default is 4 (fastest)
- &elevenlabskey={APIKEYHERE} , don't share this API key, but this is needed to use the service and to specify that you want to use elevenlabs for TTS

If  you stop the TTS with the button in the dock's menu, it will stop playback immediately in the dock. It will also delete any queued messages to be spoken. 

Please NOTE: Make sure to CLICK on the browser page after it loads, else audio may not work in the browser. Browsers require user-gesture detection before audio can auto-play.  OBS Studio's browser source and the Electron Capture app are exceptions to this rule.

### Branded channel support

There is a toggle that lets you show the source of the chat messages.

- &branded will show the channel-icon; Youtube and Twitch channels supported.  Use with the dock or featured file.
- &showsource can be added to the featured.file, to show the main site the source is from; ie: Youtube, Facebook.

![image](https://user-images.githubusercontent.com/2575698/166864138-00cd1e1c-2149-473f-be8d-d07a8d400c07.png)

### Random other commands not documented elsewhere

- You can exclude certain sources from appearing in the dock with the &exclude option
  - ie: dock.html?session=xxx&exclude=youtube,twitch,facebook

- You can combine multiple docks into one, if for example you have multiple extensions capturing chat, and want to view it all one a single computer
  - ie: dock.html?session=aaaaa,bbbbb

- You can filter out certain messages marked as "events" in the dock using &filterevents
  - ie: dock.html?session=xxx&filterevents=joined

- the Filter option in the dock supports `!` to denote opposite, such as `source:!youtube`, so only filter for sources that are not youtube.

### Known issues or solutions

#### Chat stops when put in the background or minimized

- Browser may pause non-visible windows, such as the chat streams Social Stream Ninja grabs from, and so you may need to disable this behaviour in your browser. To do so, "Disable" the option located at `chrome://flags/#enable-throttle-display-none-and-visibility-hidden-cross-origin-iframes`.  Also "Disable" the flag `chrome://flags/#calculate-native-win-occlusion`. Restart the browser after saving the changes.

- Avoid minimizing any windows. Things work best if windows are kept visible and open, but if you need to put them in the background, don't minimize them at least. 

- Browsers may also sometimes stop tabs/windows after an hour of inactivity. Disable any option in your browser under `chrome://settings/performance` related to performance throttling or background tabs, such as "Throttle Javascript timers in background".

- Try to keep the chat window and dock page active and if possible, even partially visible on screen. If the windows are hidden or minimized, they may stop working. This is also true if the scroll bar for the chat window is not at the bottom; sometimes messages won't load unless you are seeing the newest messages. 

- Another option, if chat messages stop once put in them in background, if using Windows, is to do Win + Tab, and have two virtual Desktops on your PC.  Put the chat windows into one virtual desktop, and use OBS in the other. Win+Tab can let you switch between desktops/windows.

- You can also try the Social Stream Ninja Standalone desktop app, as that has more controls and will avoid common throttling / visibility issues found while using Chrome

- You can also download an application that can "pin" the chat windows, so they remain on top and visible. The windows can be made very small in those cases, and just push to the side.

#### Blue bar appears or chat responder not working

If the auto responder doesn't work -- you see a blue bar, but nothing happens, there's a couple things to do.
- make sure if using Youtube/Twitch that the pop out window is open
- Avoid Firefox, as it will only work with Chromium-based apps (or the standalone app)
- go to `chrome://apps` and remove the Youtube(s) apps that might appear.  You can remove them all really if none are required.
- Make sure you have permission to post into the chat first -- sometimes you need to be a subscriber for example to send chat messages.

![image](https://user-images.githubusercontent.com/2575698/146602513-e3b7e69c-19fa-4e58-b907-6f08b3f873e0.png)

- If the blue bar warning about Debugging mode is a problem, start Chrome with this command line flag: `--silent-debugger-extension-api`

![image](https://user-images.githubusercontent.com/2575698/196629133-6c06fedb-9f22-40aa-8031-d7f4c681ad95.png)

#### Can't export settings or save files

- If you can't save to disk, like export the settings to disk, ensure your browser allows the `File System Access API`

In Brave, this can be enabled via `brave://flags/#file-system-access-api` ; open that link and enable the setting (then restart)

#### Other issues

- If using OBS Studio on macOS or Linux, for some reason this extension will not work if hosted locally on your drive, so custom CSS needs to happen via the browser source style section. It works great on PC locally, and when hosted on socialstream.ninja, but locally on mac, it does not seem supported. This is an issue you'll need to take up with the OBS developers.

- For discord, slack, and telegram not working, for security reasons, you need to enable the TOGGLE switch in the settings to enable.

- Make sure your session ID matches the dock.html page and the value inside the extension; if they don't match, things work work

- To set the Session ID to your own value, go to Extensions settings to set it. On Chrome: Settings -> Extensions -> Social Stream Ninja -> Details -> Extension options.  

- Try refreshing the chat page if things stop working; sometimes refreshing the page will retrigger the code and bypass any errors. This is particularly try if you install or refresh the extension after the chat page has already been loaded.


### Requesting a site

You can make a request here on Github as an issue ticket, or join the Discord server at https://discord.socialstream.ninja and request there.

Not all requested sites can or will be supported. Steve generally will add support for publicly accessible social chat sites that have a significantly-large community; it's ultimately up to the decretion of Steve though on what he wants to add or has time to add. Code contributions from others that add new site integration or features are normally welcomed, but sites/features that may violate Canadian laws, fail to meet quality standards, or for any other reason, may possibly not be merged or accepted. In these cases you may need to self-host or fork the repo, maintaining your own copy with said changes instead.

There is no guarentee that a site that gets added will continue to be supported over time. Steve also doesn't accept payment for adding an integration or for support.

### Adding sites yourself

I have a video walk-thru on how I added a simple social site to Social Stream Ninja:   [https://www.youtube.com/watch?v=5LquQ1xhmms](https://www.youtube.com/watch?v=5LquQ1xhmms)

You can also refer to some of my code commits, where you can see which changes I made to add support for any specific site.

ie: `https://github.com/steveseguin/social_stream/commit/942fce2697d5f9d51af6da61fc878824dee514b4`

For a simple site, a developer should need just 30 minutes to an hour to get a site supported. A more complicated and tricky site may take a few hours or longer, depending on the developer's skill.

### OBS remote scene support

Remote OBS control/stats are available with Social Stream Ninja, however they will require adding a Social Stream Ninja page to OBS as a browser source, along with setting that browser source's page permission to an appropriate level.

To access scene state information, user access permissions are at least needed, while the ability to start/stop the stream will require full permissions.  A use for this is to access and display the current OBS scene state if doing an IRL stream with the dock open on mobile.

![image](https://github.com/steveseguin/social_stream/assets/2575698/a52758a3-6eb9-4224-9bec-13f31a78c617)

Adding a Social Stream Ninja page as an OBS custom dock will not work in providing the required permissions; it needs to be a browser source currently.  This could be changed in the future

There are some options built into Social Stream Ninja to control OBS scenes/streaming state, and those will be expanded over time. Guests can change scenes with the `!cycle` option, when enabled, for example. 

Given that Social Stream Ninja uses VDO.Ninja as its transport engine, you also can use VDO.Ninja [remote control software[(https://vdo.ninja/examples/obsremote) to have dedicated remote control pages that can work in conjuction with Social Stream Ninja. `&remote=XXXX` can be used on either VDO.Ninja or Social Stream Ninja's dock.html page to enable VDO.Ninja-based remote control when loaded in OBS with the right permissions; refer to the VDO.Ninja documentation on this. This is all pretty complicated though, requiring just the right URL parameters, but it's possible.

### Support

You can find me on discord over at https://discord.socialstream.ninja or [https://discord.gg/7U4ERn9y](https://discord.gg/vFU8AuwNf3), offering free support in channel #chat.overlay-support 

Feedback and feature requests are welcomed.  Please also make a Github issue if you're not a fan of Discord, but still need to report a bug or feature request.

## License
This project is licensed under the GPLv3.0 License - see the [LICENSE](LICENSE) file for details.

## Terms of Service

For the Terms of Service, please see: [Terms of Service](https://socialstream.ninja/TOS)

For YouTube's Terms of Service, please see:  [YouTube's Terms of Service](https://www.youtube.com/t/terms) 

## Privacy Policy

For the privacy policy, please see: [Privacy Policy](https://socialstream.ninja/privacy)

##  Donations

I condemn Russia's brutal invasion of Ukraine. 💙💛 Please consider supporting or donating to Ukraine instead: https://war.ukraine.ua/support-ukraine/

If you still wish to send a donation to Steve, it is considered a gift, with no exchange of value or service offered or expected in return.

## Icons and Media

I do not claim rights of all the icons or images distributed. While I (or contributors) made some of the icons and images, trademarks and logos of third party companies/services are the rights of those respectivitive entities. Use them according to the terms that those entities may offer them under.

Some icons used are licensed as attribution-required:

<a href="https://www.flaticon.com/free-icons/communication" title="communication icons">Communication icons created by Freepik - Flaticon</a>

<a href="https://www.flaticon.com/free-icons/announcement" title="announcement icons">Announcement icons created by Design Circle - Flaticon</a>

If there is missing attribution or concerns over any media, please contact us.

## Credit

This project contains inspiration by my past project, chat.overlay.ninja, which was a derivation of another Youtube-specific chat widget, which was inspired by the stylings of other featured-chat code sample, of which that was also inspired by existing chat overlay designs. May the many new innovations of this project inspire the future foundation of other awesome projects as well.

## Contributors to this project

<a href="https://github.com/steveseguin/social_stream/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=steveseguin/social_stream" />
</a>

