# AI Event Overlay

Open **Chat Bots and AI services → AI Event Overlay** in the SSN popup. Enable SSN, configure an LLM provider, and enable the **private chat bot option**.

1. Give your configuration a name and ID, such as `fantasy-intro`.
2. Choose **Featured messages**, **All messages**, or **Event Flow**.
3. Write a prompt, choose an appearance and display time, then select **Save and test**.
4. Copy the Browser Source URL into OBS. Use a transparent source, for example 1920 × 1080.
5. Keep SSN running. Reload the OBS source after changing its configuration.

The setup page is `aievent.html?session=YOUR_SESSION`. The display page is `aievent-overlay.html?session=YOUR_SESSION&profile=fantasy-intro`. Open the popup link to include the correct session, password and transport settings. Configurations are stored in the extension/desktop app, so OBS does not need to share browser storage with the setup page.

## Prompts and basic LLMs

Example: “Introduce this viewer as a fantasy adventurer. Use their message as inspiration. Write two short sentences.”

SSN passes the viewer name, message, platform, donation, membership, event and metadata to the configured LLM. The LLM only returns display text. It does not need to generate HTML, JavaScript or JSON, or support tools. A model override is optional; the provider and key come from SSN's existing LLM settings.

With **Let the AI choose an appearance** enabled, the LLM may append `[style: neon]`, `[style: glass]`, `[style: storybook]` or `[style: minimal]`. If it does not supply a recognized tag, the selected appearance is used.

Each display page processes events one at a time, including generation and display time. Busy all-message feeds can build a backlog and make many API calls. The queue is in memory; reloading clears it. LLM failures skip that presentation and are logged in the browser console. Optional media failures still allow the generated text to display; the setup preview reports those failures.

## Event Flow and loyalty points

Set the saved configuration's trigger to **Event Flow**. In the editor, add **Media & Effects → Show AI Event Overlay**, and enter its configuration ID. Keep the corresponding OBS Browser Source loaded.

For donations or platform rewards, connect the desired trigger to this action. For a loyalty reward, connect a command trigger, such as `!intro`, to **Spend Points**, then to **Show AI Event Overlay**. Existing Spend Points behavior stops dependent actions when the debit fails. Points are spent before generation; a disconnected overlay or failed generation does not automatically refund them.

Different configurations can have different prompts, styles and media endpoints. Each uses its own overlay URL.

## Optional image endpoint

Enable image generation and enter the full endpoint URL. SSN sends a JSON POST:

```json
{"prompt":"Your image direction, generated text and viewer name","n":1,"model":"optional-model"}
```

The endpoint must return image bytes with an `image/*` content type, `{"url":"https://..."}`, `{"data":[{"url":"https://..."}]}`, or `{"data":[{"b64_json":"..."}]}` (PNG base64). Async job/polling APIs need an adapter that returns the completed image. A supplied API key is sent as `Authorization: Bearer KEY`.

## Optional TTS endpoint

Enable speech and enter the full TTS endpoint URL, with optional model, voice and API key. SSN sends:

```json
{"input":"Generated overlay text","model":"optional-model","voice":"optional-voice"}
```

The endpoint must return audio bytes with an `audio/*` content type or a JSON `url` (also accepted inside `data[0]`). A supplied key uses Bearer authorization. Omitted model and voice fields are left to the endpoint. Providers with other request formats need an adapter. Audio starts with the presentation and stops when its display time expires. Browser tabs may require interaction before allowing sound; OBS audio must be enabled for the source.

Media requests run in SSN. Endpoint keys stay in the saved configuration and are not placed in the OBS URL or public display configuration. Generated media URLs must be accessible by the display browser.

## Connections

Featured mode listens to the Dock's selected-message feed, including direct messages and API content wrappers; all-message mode receives the captured feed. Event Flow sends to the configuration's dedicated label. The `server`, `server2`, and `server3` URL options select the appropriate feed socket when present; private configuration and generation requests still require the VDO.Ninja bridge to SSN. The display supports `onlytype`, `hidetype`, `scale`, `css`, and `b64css`.
