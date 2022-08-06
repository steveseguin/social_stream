# Social Stream
Consolidate your live social messaging streams

 [Jump to Download and Install instructions](https://github.com/steveseguin/social_stream/blob/main/README.md#to-install)

- Supports live automated two-way chat messaging with Facebook, Youtube, Twitch, Zoom, and dozens more
- Includes a "featured chat" overlay, with messages selectable via the dockable dashboard; auto or manual selection.
- Supports bot-commands and automated chat responses, with custom logic supported via scriptable plugin file.
- Text-to-speech support, along with many other niche features supported.
- Multi-channel source-icon support, so you can differentiate between different streams and creators
- No user login, API key, or permission needed to capture the chat messages from most sites and services.
- Queuing of messages for later highlighting
- Free community support at https://discord.socialstream.ninja

Social Stream makes use of VDO.Ninja's data-transport API to stream data securely between browser windows with extremely low latency and all for free!

![image](https://user-images.githubusercontent.com/2575698/148505639-972eec38-7d8b-4bf3-9f15-2bd02182591e.png) ![image](https://user-images.githubusercontent.com/2575698/148505691-8a08e7b0-29e6-4eb5-9632-9dbcac50c204.png)

### Supported sites:

- twitch.tv - pop out chat to trigger
- youtube live - pop out the chat to trigger (studio or guest view); or add &socialstream to the YT link
- facebook live (guest view on web; you can pause the video tho)
- zoom.us (web version)
- owncast demo page (watch.owncast.online)
- crowdcast.io
- livestream.com
- mixcloud.com (pop out chat)
- ms teams (experimental support)
- vimeo.com (pop out chat page; https://vimeo.com/live-chat/xxxxxxxxx/interaction/)
- instagram live (instagram.com/*/live/)
- tiktok live (tiktok.com/*/live)
- webex live chat (not the pop out)
- linkedin events comments
- vdo.ninja (pop-out chat)
- Whatsapp.com (REQUIRES the TOGGLE in menu to enable it; use @ https://web.whatsapp.com ; fyi, no avatar support)
- discord.com (web version; requires toggle enabled via the settings as well) 
- telegram (web.telegram.org in stream mode; requires toggle enabled)
- slack (https://app.slack.com/ ; required toggle enabled to use)
- ![Requires toggling to enable certain integrations](https://user-images.githubusercontent.com/2575698/178857380-24b3a0fc-bf86-4645-91ec-24893df19279.png) telegram, slack, whatsapp, discord require an extra step to enable
- restream.io chat supported (https://chat.restream.io/chat)
- amazon.com/live
- rumble.com (no pop out; viewer page)
- trovo.live (open the chat pop-up page; ie: https://trovo.live/chat/xxxxxx)

- Dlive.tv  (pop-out chat)
- Picarto.tv (pop-out chat; ie: https://picarto.tv/chatpopout/CHANNELNAMEHERE/public)
- Mobcrush (this page: https://studio.mobcrush.com/chatpopup.html)
- vimm.tv (https://www.vimm.tv/chat/xxxxxxxxx/)
- odysee.com (via the pop out chat I think)

More on request

### Video walk-thru

https://www.youtube.com/watch?v=X_11Np2JHNU

### To install

This extension should work with Chromium-based browser on systems that support webRTC. This includes Chrome, Edge, and Brave. [Firefox users see here](https://github.com/steveseguin/social_stream#firefox-support).

Currently you must download, extract, and load the browser extension manually.  It is not available yet in the browser's web store.

The link to download newest version is here: https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip

Once extracted into a folder, you can go here to load it: chrome://extensions/

![image](https://user-images.githubusercontent.com/2575698/142858940-62d88048-5254-4f27-be71-4d99ea5947ab.png)

Ensure you have Developer Mode enabled; then you can just load the extension via the load unpacked button and selecting the folder you extracted the fiels to.

![image](https://user-images.githubusercontent.com/2575698/142857907-80428c61-c192-4bff-a1dc-b1a674f9cc4a.png)

You're ready to start using it! 

Please note that you will need to manually update the extension to access newer versions; it currently does not auto-update aspects of the extension; just the dock and single overlay page auto-update as they are hosted online.

#### Updating

To update, just download the extension, replace the old files with the new files, and then reload the extension or completely restart the browser.  If just reloading the extension, you may then need to also reload any open chat sites that you wish to use Social Stream with.

New app integrations do not auto-update; just the overlay and dock page will auto-update. It's suggeseted you update every now and then manually, or whenever you encounter a bug.  

#### Firefox support

You have two ways to install the add-on for Firefox. 

Please note, neither Firefox option supports two-way message responding, but the dock and featured chat overlay should work.  If you want to use the bot commands with auto-responding, please consider using a Chromium-based browser instead.

##### First way:

Download+extract or clone the SocialStream code somewhere.

Go to `about:debugging#/runtime/this-firefox` in Firefox and select Load Temporary Add-on. 

Select any file inside the SocialStream folder.

You're done.  This is a temporary install and none of the settings made will be persist, including your session ID.

You will still need to manually redo these steps to update when needed, but you can use the newest version of the code.

##### Second way:

Go to the release section of this repo and find a release that includes a Firefox XPI file. 

https://github.com/steveseguin/social_stream/releases

Download the XPI file and drag it into an Open Firefox window.

Accept any install pop ups. Storage functions should work with this approach.

You are good to go, but you will need to manually update when needed by recompleting these steps.

Please note: XPI files are currently provided on request or with major updates; XPI file creation hasn't yet been automated. (TODO)

### To use

Open Twitch or Youtube "Pop out" chat; or just go to your Facebook Live chat while connected to Ethernet or WiFi. You must not minimize or close these windows, but they can be left in the background or moved to the side.

Then, press the Social Stream chrome extension button and ENABLE streaming of chat data. (Red implies disabled. Green is enabled)

![image](https://user-images.githubusercontent.com/2575698/142856707-0a6bc4bd-51b4-4cd0-9fa3-ef5a1adfcbf7.png)

##### Please note:  If the Extension's icon is RED, then it means it is still off and wil not work.  You have to click "Enable extension", and the icon must change to the color green.

Next, using the provided two links, you can manage the social stream of chat messages and view selected chat messages as overlays.

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
- Ensure that VDO.Ninja works with your browser, as if not, webRTC may be disabled and so this social stream extension will not work also.
- If using Facebook live chat, please sure you are viewing the page as a "viewer", not as a publisher, and that you are connected to WiFi or Ethernet, and not mobile LTE/4G/5G.
- The auto-responder requires you to be signed in to the social endpoint and that you have access to chat; ensure you accept any disclaimer and try issuing a test message first.

### Customize

There are quite a few toggles available to customize functions and styles, but these toggles often just apply URL parameters. You can as a result, just manually apply the parameters yourself, opening up more fine-grain control.  A list of some of the options are available below.

To customize the dock, you can use the following options:

- &lightmode (Enables the dark-mode for the chat stream)
- &scale=2 (doubles size/resolution of all elements)
- &notime (hides the date in the chat stream)
- &hidesource (hides the youtube/twitch/fb icons from the stream)
- &compact (Removes the spacing between name and message)
- &autoshow (will auto-feature chat messages as they come into the dock at a rate of about 2 per 3 seconds)

To customize the featured chat overlay, the following URL parameters are available

- &showtime=20000 (auto-hides selected messages after 20s)
- &showsource (shows the youtube/twitch/fb icons next to the name)
- &fade (will have featured messages fade in, rather than pop up)
- &swipe (will have featured messages swipe in from the left side)
- &center (center featured messages)

To customize the color, font-size and styling, you can edit the CSS, in either the OBS browser source style-sheet section, or by editing the and using the index.html file. See below:

#### More advanced styling customizations

To further customize the appearance of the overlay or dock, you can make CSS style changes via OBS browser source, without any coding.  

![image](https://user-images.githubusercontent.com/2575698/153123085-4cf2923e-fce3-40bd-bd66-3ba14a6ab321.png)

```
body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }

:root {
     --author-bg-color: #FF0000;
     --author-avatar-border-color: #FF0000;
     --comment-color: #090;
     --comment-bg-color: #DDD;
     --comment-color: #FF0;
     --comment-border-radius: 10px;
     --author-border-radius: 10px;
     --comment-font-size: 30px;
     --author-color: blue;
}
```
Sample CSS of which you can use to customize some of the basic styles. There's not much that you can't do via CSS in this way, but you can edit things further at a code-level if needed. Mac/Linux users may face issues with OBS not liking self-hosted versions of the index/dock file, but it's not an issue for the PC version.

#### Auto responding / custom actions

You can create your own custom auto-responding triggers or other actions by including a `custom.js` file. You don't need to host the index or dock file for this.

Included in the code is the `custom_sample.js` file, which you can rename to custom.js to get started. Included in it is the `&auto1` trigger, which  auto responds "1" to any message that is also "1".  You need to add `&auto1` to the dock's URL to activate it.

It's fairly easy to modify the `auto1` trigger to do whatever you want. You can also customize or removee the URL-parameter trigger needed to activate it.

### Queuing messages

If you hold CTRL (or cmd on mac), you can select messages in the dock that get added to a queue.  A button should appear in the top dock menu bar that will let you cycle through the queue, one at a time.  When pressing the Next in Queue button, messages from the queue will appear as featured chat messages in the overlay page.

### Togglable Menu Commands 

These are some generic auto-reply commands that can be toggled on/off via the extension's menu. They do not need a custom.js file to work

- !joke  (tells a random geeky dad joke)
- hi  (Welcomes anyone who says "hi" into chat)

### Hotkey (MIDI / Streamlabs) support

There's a toggle to enable MIDI hotkey support. This allows a user to issue commands to the extension when active, such as issue predefined chat messages to all social destinations.

The hotkeys can be issued via MIDI, which can be applied to a Streamdeck also via a virtual MIDI device. The MIDI actions available currently include:

Using Control Change MIDI Commands, on channel 1:

- command 102, with value 1: Say "1" into all chats
- command 102, with value 2: Say "LUL" into all chats
- command 102, with value 3: Tell a random joke into all chats
- command 102, with value 4: Clear all featured chat overlays
	
![image](https://user-images.githubusercontent.com/2575698/144830051-20b11caa-ba63-4223-80e1-9315c479ebd6.png)

The MIDI plugin can be found in the Streamdeck store pretty easily. If using Windows, you can find a virtual MIDI loopback device here: https://www.tobias-erichsen.de/software/loopmidi.html  There are some for macOS as well.

Feedback welcomed

### Text to speech

Text messages can be converted to speech, assuming your system supports TTS.  On my Windows machine running Chrome/OBS, it works.  I have it set to English-US by default, but you can change the language to something else by editing the URL. ()

ie: `index.html?session=XXXXXX&speech=en-US` or `socialstream.ninja/?session=xxx&&speech=en-US`

You can get a list of support languages on your system by running `speechSynthesis.getVoices()` from the Chrome browser console on your system.  You can install additional ones fairly easily, if on Windows. See: https://support.microsoft.com/en-us/windows/download-language-pack-for-speech-24d06ef3-ca09-ddcc-70a0-63606fd16394

![image](https://user-images.githubusercontent.com/2575698/165753730-374498e7-7885-49ef-83ba-7fe2acde26ee.png)

The audio will play out the default system audio output device. This might be a problem if using OBS for capture, as you'll need to use a virtual audio cable to capture the audio output of the system output and route it back into OBS for capture.  See the related issue here: https://github.com/w3c/mediacapture-output/issues/102

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

I've added support for Google Cloud Text to Speech API, but you must use your own API key to use this feature, as it is expensive to use.  

Go to https://cloud.google.com/text-to-speech -> Enable the service, and then get an API key.

![image](https://user-images.githubusercontent.com/2575698/180443408-5cc0f7a9-c015-420d-9541-fd94a520ef25.png)

This premium text-to-speech is supported on the index.html page (the featured chat overlay), and currently not yet added to the dock page.(I'll add it there eventually)

You need at least &speech and &ttskey to enable the premium TTS, but there are customizations:
```
&volume=1
&voice=en-GB-Standard-A
&gender=FEMALE
&speech=en-us
&ttskey=XXXXXXX
```
See the Google Cloud doc for more help

### Branded channel support

There is a toggle that lets you show the source of the chat messages.

- &branded will show the channel-icon; Youtube and Twitch channels supported.  Use with the dock or index file.
- &showsource can be added to the index.file, to show the main site the source is from; ie: Youtube, Facebook.

![image](https://user-images.githubusercontent.com/2575698/166864138-00cd1e1c-2149-473f-be8d-d07a8d400c07.png)


### Known issues or solutions

If the auto responder doesn't work -- you see a blue bar, but nothing happens, there's a couple things to do.
- make sure if using Youtube/Twitch that the pop out window is open
- go to `chrome://apps` and remove the Youtube(s) apps that might appear.  You can remove them all really if none are required.
- Make sure you have permission to post into the chat first -- sometimes you need to be a subscriber for example to send chat messages.

![image](https://user-images.githubusercontent.com/2575698/146602513-e3b7e69c-19fa-4e58-b907-6f08b3f873e0.png)

- Try refreshing the chat page; sometimes refreshing the page will retrigger the code and bypass any errors. This is particularly try if you install or refresh the extension after the chat page has already been loaded.

- Try to keep the chat window and dock page active and if possible, even partially visible on screen. If the windows are hidden or minimized, they may stop working. This is also true if the scroll bar for the chat window is not at the bottom; sometimes messages won't load unless you are seeing the newest messages.

- If using OBS Studio on macOS or Linux, for some reason this extension will not work if hosted locally on your drive, so custom CSS needs to happen via the browser source style section. It works great on PC locally, and when hosted on socialstream.ninja, but locally on mac, it does not seem supported. This is an issue you'll need to take up with the OBS developers.

- For discord, slack, and telegram, for security reasons, you need to enable the TOGGLE switch in the settings to enable.

### Support

You can find me on discord over at https://discord.socialstream.ninja or [https://discord.gg/7U4ERn9y](https://discord.gg/vFU8AuwNf3), offering free support in channel #chat.overlay-support 

Feedback and feature requests are welcomed.  Please also make a Github issue if you're not a fan of Discord, but still need to report a bug or feature request.

### Icons

I do not claim rights of all the icons distributed. While I made some of the icons, trademarks and logos of third party companies/services are the rights of those respectivitive entities. Use them according to the terms that those entities may offer them under.

### Credit

This project contains inspiration by my other project, chat.overlay.ninja, which was a derivation of another Youtube-specific chat widget, which was inspired by the stylings of other featured-chat code sample, of which that was also inspired by existing chat overlay designs. May the many new innovations of this project inspire the future foundation of other awesome projects as well.
