# Common Support Questions

Status: heavy extraction pass started. This page is source-backed from current repo docs and should be expanded with mined Discord/KB history in later passes.

## Source Anchors

- `README.md`
- `api.md`
- `parameters.md`
- `docs/commands.html`
- `docs/download.html`
- `docs/js/sites.js`
- `custom_sample.js`
- `custom_actions.js`
- `sample_wss_source.html`
- `docs/agents/08-platform-sources/*.md`
- Future support-mining pass: `C:\Users\steve\Code\stevesbot\data\sqlite\*.sqlite`

## Fast Reference Pages

Use these cross-topic pages before repeating long answers:

- `docs/agents/13-reference/commands-and-actions.md`
- `docs/agents/13-reference/url-parameters.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/agents/13-reference/free-paid-and-support-boundaries.md`
- `docs/agents/13-reference/custom-plugins-and-extensions.md`
- `docs/agents/13-reference/support-resources-and-escalation.md`
- `docs/agents/13-reference/settings-and-toggles.md`
- `docs/agents/13-reference/features-and-capabilities.md`

## Product And Cost

### Is Social Stream Ninja free?

Yes. The core project is described as completely free and open-source. Most platform capture modes also avoid platform API keys, special permissions, or separate logins beyond the normal logged-in browser/app page.

Important boundaries:

- Third-party premium services can still cost money. This includes cloud TTS, some AI services, and platform services outside SSN.
- System TTS is free but can be harder to capture in OBS because browser pages may use the operating-system voice output.
- Donations to Steve are gifts. They are not payment for support, feature work, or guaranteed integrations.

### Is it a Chrome extension or a standalone app?

Both are supported product surfaces.

- Browser extension: best when the user already has normal browser sessions, cookies, and site access working. It captures chat from supported web pages and popout chats through content scripts.
- Standalone desktop app: Electron app that loads Social Stream source files and manages source windows without requiring the extension. It can avoid some browser visibility/throttling problems and organize sources better, but some platform sign-in flows may block embedded browsers.
- Hosted/overlay pages: `dock.html`, `featured.html`, alert pages, games, API examples, and tool pages can be used with either surface as long as the session ID and transport settings match.

If the extension and standalone app use the same session ID at the same time, do not assume both can publish/control the same workflow cleanly. For support, isolate one surface first.

### Which version should users install?

Common guidance:

- Use the Chrome Web Store build for easiest install, but expect it to lag behind GitHub because store review takes time.
- Use manual GitHub install when the user needs the newest fixes or wants full source control.
- Use Firefox only when the missing features are acceptable. Firefox lacks some Chromium-only capabilities such as debugger/tab-capture behavior and some TTS/model support.
- Use the standalone app when users want managed source windows, always-on-top style workflows, or fewer problems from hidden/minimized browser windows.
- Use Lite only for quick/lightweight sessions. Current download docs describe Lite as having a very limited feature set and only a handful of core services.

## Capture And Overlay Basics

### Chat is not appearing. What should be checked first?

Use the same first-pass checks before platform-specific debugging:

1. Confirm SSN is enabled. In the extension, red means off and green means enabled.
2. Confirm the chat source page was reloaded after installing/reloading the extension.
3. Confirm the source page is a supported URL/mode. Many sites require popout chat, while some require the normal watch page.
4. Confirm the dock/overlay session ID matches the extension/app session ID.
5. Keep the source chat visible and not minimized. Browsers can throttle hidden or minimized pages.
6. Disable conflicting extensions or test in an isolated browser/incognito profile.
7. Confirm WebRTC/VDO.Ninja connectivity works in the browser/network.
8. For Discord, Slack, Telegram, WhatsApp, Google Meet, ChatGPT/static comments, and similar sensitive pages, confirm the required capture toggle is enabled.

For platform-specific checks, start with:

- `docs/agents/08-platform-sources/youtube.md`
- `docs/agents/08-platform-sources/tiktok.md`
- `docs/agents/08-platform-sources/twitch.md`
- `docs/agents/08-platform-sources/kick.md`
- `docs/agents/08-platform-sources/discord.md`

### Overlay or dock is open but not updating. What usually causes it?

Most common causes:

- Session ID mismatch between source and page URL.
- The extension/app source is off, disconnected, or on a different session.
- Browser source in OBS is stale and needs a refresh.
- The wrong target label is being used. Pages can be labeled with `&label=NAME`, and API commands can target that label.
- The user opened a local page but expected hosted-page behavior, or opened the hosted page but expected a local `custom.js` file to load.
- API server toggles are not enabled for WebSocket/HTTP workflows.

### Why does chat stop after a while or when hidden?

Browser tabs/windows may throttle or stop JavaScript when minimized, hidden, discarded, or considered backgrounded. The README recommends keeping chat windows visible and active where possible. Even a small visible strip is often better than a minimized window.

Support steps:

- Do not minimize source chat windows.
- Keep chat scrolled to the newest messages.
- Check browser performance/background tab settings.
- Check `chrome://discards/` and turn off auto-discard for source pages.
- For Chromium, the README mentions disabling flags related to hidden cross-origin iframe throttling and native window occlusion when needed.
- Consider the standalone app for workflows that frequently hit browser throttling.

## Installing And Updating

### How do users manually install the extension?

High-level flow:

1. Download the current GitHub source archive.
2. Extract it to a folder.
3. Open the browser extensions page, such as `chrome://extensions/`.
4. Enable Developer Mode.
5. Load the extracted folder as an unpacked extension.
6. Reload chat pages after extension reload/install.

Do not tell users to uninstall as an update method unless they have exported settings first.

### How should users update without losing settings?

Replace the extension files and reload the extension/browser. Do not uninstall, because uninstalling deletes extension settings. If uninstall is unavoidable, export settings first and import them after reinstalling.

### Why does Manifest V2 show a warning?

The README says the Manifest V2 warning can be ignored for current function. Manifest V3 builds exist through the Chrome Web Store and GitHub branches, but MV3 has restrictions and may require a small browser tab to stay open.

## Platform Setup Answers

### Which sites are supported?

The README states 120+ sites, and `docs/js/sites.js` currently contains 139 named site entries. The repo source files and manifest are the more complete implementation inventory.

The site metadata breaks down roughly as:

- 100 standard/open-page entries
- 23 popout entries
- 9 toggle-required entries
- 4 WebSocket-source entries
- 3 manual-pick entries

Always verify a specific site against the source file and manifest entry before promising exact support.

### Can Social Stream Ninja do a specific feature?

Usually the answer depends on mode, source, and setup. Start with `docs/agents/13-reference/features-and-capabilities.md`, then route to the exact feature page.

High-level rules:

- Core chat capture, dock, featured overlay, URL/CSS customization, API control, Event Flow, polls/waitlist/giveaway/games, and custom overlays are part of SSN.
- AI, cloud TTS, payment/donation services, and some platform API modes can require third-party accounts, keys, quotas, or costs.
- Two-way chat, moderation, richer events, and reward/gift coverage are platform/mode-specific. Check the platform doc before promising support.

### Where is a setting or toggle?

Start with `docs/settings.html` or `docs/agents/13-reference/settings-and-toggles.md`.

Use this support pattern:

1. Search the public settings reference for the setting name or behavior.
2. Confirm whether it is a persistent popup setting or a URL parameter.
3. If the user says it does not work, check whether the source page or overlay needs a reload.
4. Check whether another filter, opt-out, duplicate/relay, source toggle, or URL parameter is overriding the expected behavior.
5. Hide keys, webhooks, passwords, and session IDs in screenshots.

### YouTube is not working. What should I ask?

Ask which YouTube mode:

- Live chat DOM mode: use the YouTube popout chat, studio chat, guest view, or a supported `live_chat` URL.
- YouTube watch page shortcut: the README mentions adding `&socialstream` to the YouTube link.
- Static comments: click the SS control on YouTube and manually select comments.
- WebSocket/API mode: requires source-page setup and is the better route for richer events. Some YouTube events require WebSocket mode and Google API permissions.

Also check that the user reloaded the YouTube chat after extension reload and that permissions/auth are valid for sending chat or moderation actions.

### TikTok is not working. What should I ask?

Ask whether they are using extension capture or standalone/TikTok connector mode.

- Extension capture requires the TikTok live chat page to remain visible/open.
- App/connector workflows may use additional signing, connection manager, or fallback behavior from the standalone app.
- Donation/gift/member fields vary by capture mode and by what TikTok exposes.

Start with visibility, live status, account/session access, and whether the source page is being throttled.

### Twitch is not working. What should I ask?

Ask whether the user opened the Twitch popout chat. The README says Twitch requires popout chat to trigger extension capture.

Also determine whether they are using:

- DOM/popout mode
- WebSocket/source page mode
- Twitch IRC/WebSocket source
- Channel points/static helper scripts

For richer event coverage, WebSocket mode may be required.

### Kick is not working. What should I ask?

Ask which Kick URL and mode:

- Popout/chatroom page capture
- Source scout/static helper
- WebSocket source page
- Standalone app OAuth or WebSocket helper behavior

Kick event coverage can depend on WebSocket mode. Check the Kick-specific agent doc before answering details.

### Discord, Slack, Telegram, WhatsApp, Google Meet, or ChatGPT capture is not working. What is the common fix?

Many sensitive/private-message surfaces require an explicit settings toggle before SSN injects or captures from them. Tell the user to enable the relevant source toggle, then reload the site.

## Customization

### How do users customize the overlay quickly?

Common simple URL parameters:

- `&lightmode` or `&darkmode`
- `&scale=1.5`
- `&compact`
- `&font=FONTNAME`
- `&speech=en-US`
- `&hidesource`
- `&showtime=10000`
- `&transparent`
- `&limit=100`

For the full parameter inventory, see `parameters.md`.

### How should users add custom CSS?

Options:

- Add CSS through the OBS browser-source custom CSS field.
- Use URL parameters such as `&css=...` or base64 CSS parameters.
- Use hosted/forked pages for durable custom templates.
- Use local pages on Windows when local-file behavior works for the workflow.

The README notes OBS local-file CSS limitations on macOS/Linux. For those systems, prefer the OBS browser-source CSS field or hosted pages.

### Can users build a custom overlay from scratch?

Yes. The README points to `sampleoverlay` as a minimal HTML overlay. It can be used as a featured-message overlay or all-message dock alternative depending on the template mode.

Use custom overlays when the user wants full layout/rendering control. Use URL parameters/CSS first when they only need styling changes.

## Commands, API, And Automation

### What built-in chat commands exist?

Current public command docs list at least:

- `!joke`: sends a random geeky dad joke when enabled.
- `hi`: welcomes users who say hi when enabled.
- `!cycle`: can cycle OBS scenes when OBS remote support and permissions are configured.

Do not assume every command is enabled by default. Many command features require toggles in the extension/app settings or URL parameters.

### How can StreamDeck or Companion control SSN?

Enable remote API control, then use either:

- HTTP GET commands such as `https://io.socialstream.ninja/SESSIONID/clearOverlay`
- WebSocket commands to `wss://io.socialstream.ninja/join/SESSIONID`
- Bitfocus Companion's Social Stream Ninja module

Common actions include `clearOverlay`, `nextInQueue`, `autoShow`, `sendChat`, `sendEncodedChat`, poll controls, waitlist controls, and TTS controls.

See `docs/agents/09-api-and-integrations/websocket-http-api.md` and `streamdeck-companion.md`.

### How can an external app receive chat?

Enable both:

- `Enable remote API control of extension`
- `Send chat messages to API server`

Then connect to channel 4:

```text
wss://io.socialstream.ninja/join/SESSION_ID/4
```

Chat messages normally include `chatname`, `chatmessage`, and `type`.

### Are donation webhooks secure?

Treat webhook URLs and session IDs as secrets. The API docs state webhook URLs do not use signature verification, so anyone with the session ID/webhook URL can send fake donation events.

Supported webhook paths documented in `api.md` include Stripe, Ko-Fi, Buy Me A Coffee, and Fourthwall.

## TTS And AI

### Which TTS options are free?

- System/browser TTS is free but harder to capture in OBS because it may play through system audio.
- Kokoro is described in README as browser-based free/premium-quality TTS but can require a powerful computer.
- Cloud providers such as Google Cloud, ElevenLabs, Speechify, Gemini, and OpenAI-compatible endpoints may require accounts, keys, paid usage, or local hosting depending on provider.

### Does SSN support AI?

Yes. Public docs mention Ollama/local AI and premium AI services for chatbot/moderation/cohost workflows. AI features are optional and depend on settings, local model availability, or API keys.

When answering exact provider/setup questions, check `docs/commands.html`, `docs/agents/09-api-and-integrations/ai-features.md`, and the current settings definitions/code.

## Custom Plugins, Scripts, And New Integrations

### Can users make their own plugin?

The public wording says SSN has scriptable plugin/custom logic support, but for support answers be precise:

- There is no single packaged "plugin marketplace" flow documented for normal users.
- Users can customize behavior with URL parameters, CSS, custom overlays, API integrations, `custom.js`, uploaded custom user functions, and custom sources.
- Developers can add a real source by adding a content script/source file and manifest entries.

### What is `custom.js`?

`custom_sample.js` can be renamed to `custom.js`. It is for local dock/featured-page behavior such as `applyCustomActions(data)` and `applyCustomFeatureActions(data)`.

Important limitation: the sample says the local file path must be used for the dock to load local `custom.js`. Hosted `https://socialstream.ninja/dock.html` will not load a local `custom.js`.

### What is `custom_actions.js`?

`custom_actions.js` is an uploaded custom user-function template. It defines:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

When custom JS is enabled, the background processing path calls `customUserFunction(data)`. Returning modified data continues processing; returning `false` can block a message in the template examples.

### Can users request a new site?

Yes, through GitHub issues or Discord. The README says requests are not guaranteed. Steve generally prioritizes publicly accessible social chat sites with meaningful communities, but support can be declined or left to forks when legal, quality, or maintenance concerns exist. Steve does not accept payment for adding integrations or support.

## Support Etiquette And Escalation

### Where should users get support?

The public support path is Discord:

```text
https://discord.socialstream.ninja
```

The README names `#chat.overlay-support` for free support. GitHub issues are also appropriate for bugs and feature requests.

### What should an agent collect before escalating?

Collect:

- Surface: extension, standalone app, hosted page, local page, Lite.
- Browser/app version and install path.
- Session ID match confirmation, but do not ask for a private session ID unless necessary.
- Platform/source URL pattern and whether it is popout, standard, toggle-required, manual, or WebSocket mode.
- Relevant toggles enabled.
- OBS/browser-source URL when the problem is overlay display.
- Console errors or screenshots, if available.
- Whether the source works in a clean browser profile.

Do not promise fixes for platform breakages without checking current code/issues, because supported sites can change or break when third-party platforms change.
