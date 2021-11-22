# Social Stream
Consolidate your live social messaging streams

- Supports live automated two-way chat messaging with Facebook, Youtube, and Twitch
- Includes a "feature chat" overlay, selectable via the dockable dashboard
- Supports bot-commands and automated chat responses, with custom logic plugin support.

Social Stream makes use of VDO.Ninja's data-transport API to stream data securely between browser windows with extremely low latency and all for free!

### Video walk-thru

https://youtu.be/w4jbZS5QgJs

### To install

Currently you must download, extract, and load the browser extension manually.  It is not available yet in the browser's web store.

Link to download: https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip

Once extracted into a folder, you can go here to load it: chrome://extensions/

![image](https://user-images.githubusercontent.com/2575698/142858940-62d88048-5254-4f27-be71-4d99ea5947ab.png)

Ensure you have Developer Mode enabled; then you can just load the extension via the load unpacked button and selecting the folder you extracted the fiels to.

![image](https://user-images.githubusercontent.com/2575698/142857907-80428c61-c192-4bff-a1dc-b1a674f9cc4a.png)

You're ready to start using it!

### To use

Open Twitch or Youtube "Pop out" chat; or just go to your Facebook Live chat while connected to Ethernet or WiFi. You must not minimize or close these windows, but they can be left in the background or moved to the side.

Then, press the Social Stream chrome extension button and ENABLE streaming of chat data. (Red implies disabled. Green is enabled)

![image](https://user-images.githubusercontent.com/2575698/142856707-0a6bc4bd-51b4-4cd0-9fa3-ef5a1adfcbf7.png)

Using the provided two links, you can manage the social stream of chat messages and view selected chat messages as overlays.

![image](https://user-images.githubusercontent.com/2575698/142935393-4ca90418-a645-45e3-8e37-f4884e16457a.png)

You can hold ALT on the keyboard to resize elements in OBS, allowing you to crop the chat stream if you want to hide aspects like the time or source icon.

Clicking on a message will have it appear in the overlay link. You can press the clear button to hide it or use the &showtime=20000 URL option added to the overlay page to auto-hide it after 20-seconds (20,000 ms).

![image](https://user-images.githubusercontent.com/2575698/142854951-fe1f34c9-0e24-495f-8bfe-a33ab69fa7cb.png)

There is a &darkmode option, but the default is white, for the dock.

![image](https://user-images.githubusercontent.com/2575698/142855585-45c11625-c01c-4cc0-bfe0-cde4aed5fc44.png)

A good resolution for the overlay is either 1280x222 or 1920x220; you can specify this in the OBS browser source.  You can edit the style of the overlay using the OBS CSS style input text box.

![image](https://user-images.githubusercontent.com/2575698/142855680-74f6055d-7b79-4e9a-ae7d-909c7f677a24.png)

If using the automated chat response options, like auto-hi, you must ensure the Youtube/Twitch/Facebook chat input options are enabled and that you are able to send a chat message. Manually entering a chat message into the pop-out window or into the Facebook live chat area first can help ensure things are working are intended, else automated message may not be sent.

### Customize

- &darkmode (Enables the dark-mode for the chat stream)
- &showtime=20000 (auto-hides selected messages after 20s)
- &scale=2 (doubles size/resolution of all elements)
- &nodate (hides the date in the chat stream)
- &autohi (responds by saying Hi! to anyone who says hi in chat)
- &hidesource (hides the youtube/twitch/fb icons)

### Chat Commands

- !highlight  (will not trigger if loaded into OBS as an overlay)
- !joke  (will not trigger if loaded into OBS as an overlay)
- hi  (requires &autohi to be enabled)

### Support

You can find me on discord over at https://discord.vdo.ninja (steve), offering free support in channel #chat-overlay-support 
