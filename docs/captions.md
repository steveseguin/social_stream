# Captions in the dock and chat

Show what you say as messages in the SSN dock and overlays. You can also post it to your chats, so it stays readable after the on-screen caption is gone.

There are three ways to get your speech into SSN. All are in the SSN popup under **Settings → Mechanics - Connections & Integrations**.

| Input | What it does | Can post to chat |
|---|---|---|
| Caption.Ninja room | SSN reads the finished captions from your room and shows them. | No |
| Caption.Ninja linked to SSN | Your Caption.Ninja page sends its finished captions to SSN privately. | Yes |
| Browser microphone | An SSN page listens with your browser's own speech recognition. | Yes |

## Caption.Ninja room

1. Open [caption.ninja](https://caption.ninja) in Chrome, Edge or Firefox and allow the microphone. Your room is in the address bar, after `room=`.
2. In SSN, turn on **Show Caption.Ninja captions as messages**.
3. Paste the room, or the whole Caption.Ninja link, into **Caption.Ninja room**. The status beside the field changes to **Connected**.
4. Speak. Each finished caption appears in the dock with the captions icon.

To show your name instead of "Captions", add `&label=YourName` to the address of the Caption.Ninja page.

Captions read from a room are never posted to chat. Anyone who has the room name, for example from an overlay link you shared, can add captions to that room, so SSN treats them as ordinary text and not as you speaking.

## Caption.Ninja linked to SSN

Use this to keep Caption.Ninja as your microphone, with its languages, push-to-talk and overlays, and still post what you say to chat.

1. In SSN, select **Open Caption.Ninja linked to SSN**. Caption.Ninja opens with your SSN session added to its address as `&ssn=`.
2. Allow the microphone. A line on the page reads **Social Stream Ninja: linked** once it is connected.
3. Speak. Each finished caption appears in the SSN dock, marked as yours.

- Your overlays keep working as before. The overlay link shown on the Caption.Ninja page does not contain your SSN session and is safe to share.
- Do not share the address of the linked Caption.Ninja page itself. It contains your SSN session, like your dock link.
- If SSN is also reading that room, each of your captions is still shown once. Captions from other speakers in the room are shown as before.
- If you already use a Caption.Ninja address with your own options, add `&ssn=YOUR_SESSION_ID` to it instead. **Copy ID** at the top of the Chat tab copies the session.

## Browser microphone

1. In SSN, select **Use my browser's microphone instead**. Open the page in Chrome or Edge.
2. Choose your language, type the name to show, and select **Start listening**. Allow the microphone when asked.
3. Speak. Each finished phrase appears in the dock. Keep the tab open while you stream.

- The page needs a browser with speech recognition. Inside the SSN desktop app it offers **Copy this page's link** instead, so you can open it in Chrome.
- It uses your computer's default microphone. The browser's speech service does the recognition, usually online.
- Only finished phrases are used. Words the browser was still guessing when it stopped listening are not sent.
- Add `&autostart` to the page address to start listening as soon as it opens, and `&lang=fr-FR` or `&label=YourName` to preset the language and name.
- The page address contains your SSN session, like your dock link. Do not share it.

Use either this page or Caption.Ninja, not both at once. A browser may run only one speech recognition session at a time, and with both running everything you say would appear twice.

## Post captions to chat

Captions from the microphone page or from a linked Caption.Ninja page can also be sent to your chats, from your own account.

1. Turn on **Post my captions to chat**.
2. Under **Post to these chats**, pick each chat that should receive them. Nothing is posted until you pick at least one.

- Each chat gets the caption split to its own length limit, for example 500 characters on Twitch, 200 on YouTube and 150 on TikTok. No words are cut off.
- **Seconds between posts**: above 0, SSN waits at least that long between posts to each chat and joins what you said in between. The dock is never delayed.
- Switching posting off, or un-picking a chat, stops it at once. Anything still waiting for that chat is dropped.
- Chats connected through a WebSocket source, such as Twitch, confirm each post. SSN waits for that before sending the next one, and asks again if the chat was busy with another message.
- If you have set SSN to limit the length of outgoing messages, captions are split to that length as well.
- If you talk for a long time with a long wait set, SSN can fall behind. Once more than 3000 characters are waiting for a chat, the oldest are skipped.

### Your posts coming back

Each chat sends your post back like any other message. The caption is already on screen, so SSN hides that copy when it knows the post was yours:

- **Twitch (WebSocket source):** automatic. SSN knows which account that source is signed in with.
- **Other chats:** list your account names under **Identify the hosts' name** in the popup.

When SSN cannot tell who sent a message with the same words, it shows it, but does not relay it, let a bot answer it, or read it aloud while your post is still expected back. A viewer who is known to be a different account is treated normally, even if they type the same words.

## Good to know

- Text-to-speech does not read captions automatically.
- Captions are shown in the dock and overlays and saved to your message history, and nothing else. Bots, chat commands, points, Event Flow, relay, giveaways, polls, the map, the word cloud, GIF commands, sticker rewards, the audience room, credits, and the Discord, webhook, H2R and Streamer.bot outputs all ignore them.
- Captions are messages of type `captions`. Add `&hidetype=captions` to an overlay link to keep them off that overlay.
- For live word-by-word captions on screen, use the Caption.Ninja overlay in OBS.
- Translations are made inside the Caption.Ninja overlay, so SSN receives the language you spoke.
- Private Caption.Ninja relay rooms are not supported.
- Posting uses the same sending as the dock's chat box. It is off while **Disable the host chat and block functions** is on.
