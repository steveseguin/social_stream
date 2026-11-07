<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [🥷 Social Stream Ninja](#-social-stream-ninja)
  - [👀 What is Social Stream Ninja?](#-what-is-social-stream-ninja)
  - [✨ What you can do](#-what-you-can-do)
  - [🌐 Supported platforms](#-supported-platforms)
  - [🚀 Download and get started](#-download-and-get-started)
    - [Your first chat overlay](#your-first-chat-overlay)
    - [Updating](#updating)
  - [🎨 Overlays, templates, and sound](#-overlays-templates-and-sound)
  - [🔊 Text-to-speech and automation](#-text-to-speech-and-automation)
  - [🧰 Troubleshooting](#-troubleshooting)
  - [🛠️ Source code and development](#-source-code-and-development)
  - [💬 Support and contributions](#-support-and-contributions)
  - [📜 License and privacy](#-license-and-privacy)
  - [💙 Donations](#-donations)
  - [Icons and Media](#icons-and-media)
  - [Credit and contributors](#credit-and-contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<div align="center">
  <h1>🥷 Social Stream Ninja</h1>
  <p><strong>Free, open-source multistream chat, livestream overlays, and audience interaction tools.</strong></p>
  <img src="https://socialstream.ninja/media/logo.png" width="160" alt="Social Stream Ninja logo">
</div>

[![GitHub stars](https://img.shields.io/github/stars/steveseguin/social_stream?style=social)](https://github.com/steveseguin/social_stream/stargazers)
[![Discord](https://img.shields.io/discord/698324796546482177?color=7289DA&label=community&logo=discord&logoColor=white)](https://discord.socialstream.ninja)
[![GitHub release](https://img.shields.io/github/v/release/steveseguin/social_stream?include_prereleases)](https://github.com/steveseguin/social_stream/releases)
[![GitHub License](https://img.shields.io/github/license/steveseguin/social_stream)](LICENSE)

**[Website](https://socialstream.ninja/) · [Download](https://socialstream.ninja/docs/download.html) · [Guides](https://socialstream.ninja/docs/guides.html) · [Templates](https://socialstream.ninja/docs/templates.html) · [Discord](https://discord.socialstream.ninja)**

## 👀 What is Social Stream Ninja?

Social Stream Ninja (SSN) brings chat from YouTube, Twitch, TikTok, Kick, Facebook Live, and many other platforms into one place. Read and manage your combined chat, feature individual viewer messages, and show customized chat overlays and event alerts in OBS Studio or Streamlabs.

Use SSN as a **browser extension** or a **standalone desktop app** for multistreaming, interviews, live events, gaming, and community broadcasts. SSN uses VDO.Ninja’s data transport and also offers WebSocket connections and APIs for custom integrations.

SSN is free to use. Some optional integrations, AI services, and voice providers require their own accounts or paid API access. Capture, replies, and available events vary by platform and connection method.

<div align="center">
  <img src="https://user-images.githubusercontent.com/2575698/148505639-972eec38-7d8b-4bf3-9f15-2bd02182591e.png" width="400" alt="Social Stream Ninja combined chat interface">
  <img src="https://user-images.githubusercontent.com/2575698/148505691-8a08e7b0-29e6-4eb5-9632-9dbcac50c204.png" width="400" alt="Viewer messages displayed as livestream overlays">
</div>

## ✨ What you can do

- **💬 Combine and manage chat:** Read multiple platforms in one dock, filter messages, queue or pin them, and reply or relay messages where supported.
- **⭐ Feature viewers:** Select a message for your on-stream overlay, or configure automatic featuring.
- **🎨 Match your stream:** Choose chat templates and matching theme packs, customize CSS, or convert a StreamElements chat widget.
- **🎉 Celebrate events:** Show follow, membership, donation, bits, and other supported alerts with animations and sound effects.
- **🔊 Give chat a voice:** Use system text-to-speech, local AI voices, or supported external voice providers.
- **⚡ Automate interactions:** Build Event Flow actions, bot commands, timers, and integrations with Stream Deck, MIDI, webhooks, and OBS.
- **🤖 Connect AI and custom tools:** Use supported AI services, Ollama, APIs, and your own scripts for chat responses and workflows.

<a id="supported-sites"></a>
## 🌐 Supported platforms

SSN includes integrations for livestreaming services, social networks, meetings, and community chat. Examples include YouTube, Twitch, TikTok, Kick, Facebook, Instagram, Rumble, Discord, Zoom, Microsoft Teams, Google Meet, Slack, Telegram, and WhatsApp.

**[Browse supported sites and setup instructions](https://socialstream.ninja/docs/supported-sites.html)** for each platform’s capture method and limitations. Some sources need a pop-out chat; others require an explicit opt-in toggle or authentication. The [sources directory](sources/) contains the capture implementations, including newer and experimental integrations.

<a id="manually-install-extension"></a>
<a id="browser-extension-stores"></a>
<a id="standalone-version-of-the-app"></a>
## 🚀 Download and get started

| Option | Where to start |
| --- | --- |
| **Standalone desktop app** | [Download for Windows, macOS, or Linux](https://socialstream.ninja/docs/download.html#standalone). Manage your chat sources inside the app. |
| **Chrome / Chromium extension** | [Chrome Web Store](https://chromewebstore.google.com/detail/social-stream-ninja/cppibjhfemifednoimlblfcmjgfhfjeg), or follow the [manual installation guide](https://socialstream.ninja/docs/download.html#manual-install). |
| **Firefox extension** | [Firefox download and setup](https://socialstream.ninja/docs/download.html#firefox-install). Some Chromium-specific features are unavailable. |
| **Lite web app** | [Open SSN Lite](https://socialstream.ninja/lite/) for a smaller web-only experience with fewer features. |

<a id="to-use-the-extension"></a>
### Your first chat overlay

1. **Install and enable SSN.** In the desktop app, add your sources. With the extension, open supported chat pages and enable capture from the extension menu.
2. **Check the chat dock.** Send a message in your own chat and confirm that it appears in SSN. Keep SSN and the required source pages running.
3. **Choose what to display.** Use a consolidated chat overlay for the feed, a featured overlay for selected messages, or an event alert overlay.
4. **Copy the overlay link from SSN.** Add it as an OBS or Streamlabs **Browser Source**, and choose dimensions appropriate for your layout. Generated links include your session settings.
5. **Test before going live.** Select a message in the dock to test a featured overlay; use the alert preview to test event effects and audio.

Treat your session ID and password as private. Your sources and overlay links must use matching session settings.

For screenshots and detailed setup, see the [getting started guide](https://socialstream.ninja/docs/getting-started.html). Prefer video? Watch the [extension installation walkthrough](https://www.youtube.com/watch?v=Zql6Q5H2Eqw).

<a id="updating"></a>
### Updating

Use the update instructions for your installed version on the [download page](https://socialstream.ninja/docs/download.html). Store, manually installed, and desktop builds have different update paths.

**Do not uninstall an unpacked extension just to update it:** uninstalling deletes its settings. Export a backup, replace the files in the same folder, reload the extension, and refresh your source pages. Updating a hosted overlay does not update your installed capture code.

<a id="customize"></a>
<a id="pre-styled-templates--themes"></a>
## 🎨 Overlays, templates, and sound

Start with the menu’s built-in controls for colors, layout, filtering, and visibility. For a complete visual style, use the [templates page](https://socialstream.ninja/docs/templates.html) or [screenshot gallery](https://socialstream.ninja/docs/overlay-gallery.html). Matching packs cover consolidated chat, featured messages, and event alerts.

- **Make your own:** The [template guide and copyable AI prompts](https://socialstream.ninja/docs/templates.html#make-your-own) cover CSS changes and custom overlays. Developers can use the [custom overlay guide](docs/customoverlays.md).
- **Bring an existing widget:** The [StreamElements converter](https://socialstream.ninja/streamelements-importer.html) imports compatible widget files, previews them, and exports HTML for OBS.
- **Add event audio and animations:** Follow the [alert effects guide](https://socialstream.ninja/docs/alert-effects.html) for sound choices and event or donation-value rules.
- **Fine-tune an overlay URL:** Use the [parameter reference](parameters.md) for additional layout and behavior options.

<a id="text-to-speech"></a>
## 🔊 Text-to-speech and automation

Choose a voice and test it in the SSN settings before adding it to your broadcast. System speech and browser-generated audio can need different OBS capture methods; the guides cover both.

| Task | Guide |
| --- | --- |
| Set up voices and capture TTS audio | [TTS setup](https://socialstream.ninja/docs/tts-setup-guide.html) |
| Use a local voice engine or custom endpoint | [Local AI TTS](https://socialstream.ninja/docs/local-tts.html) |
| Build triggers and actions visually | [Event Flow editor guide](https://socialstream.ninja/actions/event-flow-guide.html) |
| Use bot commands, MIDI, Stream Deck, or webhooks | [Commands and integrations](https://socialstream.ninja/docs/commands.html) |
| Connect AI tools to the desktop app | [AI control guide](https://socialstream.ninja/docs/llm-control-guide.html) |

<a id="known-issues-or-solutions"></a>
## 🧰 Troubleshooting

If chat is missing, check that SSN is enabled, the source is connected, and your dock and overlays have matching session settings. Refresh the source page after installing or reloading the extension. Browser-based capture may pause when a source page is closed, minimized, or suspended.

- [Extension troubleshooting](https://socialstream.ninja/docs/guides.html#extension-troubleshooting)
- [Desktop app troubleshooting](https://socialstream.ninja/docs/guides.html#standalone-troubleshooting)
- [OBS display and audio troubleshooting](https://socialstream.ninja/docs/obs-troubleshooting.html)
- [Zoom setup](docs/zoom.md)

Platform changes can temporarily break integrations. When reporting an issue, include your SSN version, operating system, browser or desktop app, source platform, and steps to reproduce it. Remove private session links and credentials from screenshots and logs.

<a id="server-api-support"></a>
<a id="adding-sites-yourself"></a>
## 🛠️ Source code and development

**Looking for the standalone desktop app source? Visit [steveseguin/ssn_app](https://github.com/steveseguin/ssn_app).** That repository contains the Electron desktop runtime and its build instructions. Installer downloads are available from [Social Stream Ninja releases](https://github.com/steveseguin/social_stream/releases).

This **social_stream** repository contains the shared web interface, browser extension, overlays, and platform capture scripts used by SSN.

| Area | Source or documentation |
| --- | --- |
| Platform capture | [sources/](sources/) and [sources/websocket/](sources/websocket/) |
| Shared utilities | [shared/](shared/) |
| Standalone web experience | [lite/](lite/) |
| Custom overlays | [sampleoverlay.html](sampleoverlay.html), [themes/](themes/), and [developer guide](docs/customoverlays.md) |
| Event payloads | [Canonical event reference](https://socialstream.ninja/docs/event-reference.html) |
| Remote commands and APIs | [API documentation](https://socialstream.ninja/docs/commands.html#server-api) |

Read [AGENTS.md](AGENTS.md) before making changes. Shared capture scripts must work in both the extension and desktop app; keep browser-facing code compatible with the project’s supported runtime and package executable dependencies locally.

Validate settings changes with `bash scripts/validate-configs.sh`. To enable the repository’s local pre-push checks, run `git config core.hooksPath .githooks`. Run checks relevant to the area you change; documentation edits do not require launching the desktop app.

<a id="requesting-a-site"></a>
## 💬 Support and contributions

Ask questions in [Discord](https://discord.socialstream.ninja), or [open a GitHub issue](https://github.com/steveseguin/social_stream/issues) for bugs, feature requests, and new platform suggestions. Contributions are welcome; support for a requested site depends on access, feasibility, and maintenance effort. Adding an integration does not guarantee ongoing support.

Please follow each platform’s terms when capturing or relaying messages. Automated posting and bots may be restricted by the source platform.

## 📜 License and privacy

SSN is licensed under [GPL-3.0](LICENSE). See the [Terms of Service](https://socialstream.ninja/TOS.html) and [Privacy Policy](https://socialstream.ninja/privacy.html). YouTube use is also subject to [YouTube’s Terms of Service](https://www.youtube.com/t/terms).

## 💙 Donations

I condemn Russia’s brutal invasion of Ukraine. 💙💛 Please consider [supporting Ukraine](https://war.ukraine.ua/support-ukraine/).

If you wish to [support Steve](https://github.com/sponsors/steveseguin), donations are gifts, with no exchange of value or service offered or expected in return.


## Icons and Media

I do not claim rights of all the icons or images distributed. While I (or contributors) made some of the icons and images, trademarks and logos of third party companies/services are the rights of those respective entities. Use them according to the terms that those entities may offer them under.

Some icons used are licensed as attribution-required:

<a href="https://www.flaticon.com/free-icons/communication" title="communication icons" target="_blank">Communication icons created by Freepik - Flaticon</a>

<a href="https://www.flaticon.com/free-icons/announcement" title="announcement icons" target="_blank">Announcement icons created by Design Circle - Flaticon</a>

<a href="https://www.freepik.com/icon/chatbot_10817282#fromView=resource_detail&position=91" target="_blank">Icon by juicy_fish</a>

<a href="https://www.flaticon.com/free-icons/vip" target="_blank" title="vip icons">Vip icons created by Freepik - Flaticon</a>

Some vectors and icons by <a href="https://www.svgrepo.com" target="_blank">SVG Repo</a>

Icons and any additional attribution for credits can be found <a href="https://socialstream.ninja/icons/" target="_blank">here</a>

If there is missing attribution or concerns over any media, please contact us.

## Credit and contributors

SSN grew from chat.overlay.ninja and earlier community chat-overlay projects. Thank you to everyone contributing code, designs, translations, testing, and support.

<a href="https://github.com/steveseguin/social_stream/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=steveseguin/social_stream" alt="Contributors to Social Stream Ninja">
</a>
