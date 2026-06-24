# OBS Overlay Display Issues

Status: heavy extraction pass started from README, `dock.html`, `featured.html`, `parameters.md`, Event Flow docs, and OBS integration notes.

## Source Anchors

- `README.md`
- `dock.html`
- `featured.html`
- `parameters.md`
- `docs/customoverlays.md`
- `themes/featured-styles/README.md`
- `actions/event-flow-guide.html`
- `obs-websocket-test.html`
- `docs/agents/09-api-and-integrations/obs.md`

## First Distinction

Determine which page the user loaded:

| Page | Expected Role |
| --- | --- |
| `dock.html` | Operator dashboard/control page. May look like a chat dashboard, not a clean overlay. |
| `featured.html` | Selected-message overlay. Can be blank/transparent until a message is featured. |
| `actions.html` | Event Flow output/actions overlay. Must stay open for media/audio/OBS actions. |
| `sampleoverlay` / custom overlay | Minimal/custom renderer; may not support all dock/featured parameters. |
| `themes/featured-styles/*` | Styled featured-message overlay variants. |

Many "blank overlay" reports are actually correct empty/transparent featured overlays with no selected message yet.

## Quick Checks

1. Does the Browser Source URL include `session=SESSION_ID`?
2. Does that session match the extension/app/dock?
3. Is there an active source sending messages?
4. Can the dock see messages?
5. If using featured overlay, did the user click a dock message or send API `content`?
6. Is the OBS Browser Source visible on the active scene?
7. Has the source been refreshed after URL/CSS/settings changes?
8. Is custom CSS hiding text or making text/background the same color?

## Blank Or Transparent Featured Overlay

Normal cases:

- No message is currently featured.
- `showtime` expired and cleared the message.
- The overlay is transparent for OBS compositing.

Test:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID
```

Then click a message in:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID
```

If the browser appears white before a message is featured, do not treat that alone as failure.

## Wrong Page Or Wrong Session

Symptoms:

- Dock shows messages but overlay does not.
- User has multiple old URLs.
- Store/manual/app session changed.
- API commands affect a different page.

Fix:

- Copy a fresh dock/featured link from the extension/app.
- Compare session IDs exactly.
- Use labels for multiple pages:

```text
featured.html?session=SESSION_ID&label=main
dock.html?session=SESSION_ID&label=control
```

## OBS Browser Source Size

README recommends `1280x600` or `1920x600` for many overlay layouts. Featured-style full-canvas themes and `actions.html` often fit `1920x1080`.

If text is cropped:

- Increase Browser Source height.
- Reduce `scale`.
- Check CSS font sizes.
- Crop intentionally in OBS only after the overlay has enough room.

README also notes holding ALT in OBS can resize/crop elements.

## CSS Problems

Common CSS issues:

- Text color equals background color.
- CSS copied into wrong OBS source.
- Missing `!important` where SSN page styles override custom CSS.
- Local CSS file path blocked or unavailable.
- URL-encoded/base64 CSS malformed.
- `transparent` or `chroma` makes the page look empty in a normal browser.

Safer paths:

- Use OBS Browser Source custom CSS field.
- Use hosted `socialstream.ninja` page.
- Use `css`/`cssb64` parameters only after testing the generated URL.

README warns that local self-hosted featured/dock files can be problematic in OBS on macOS/Linux; hosted pages or OBS CSS are safer.

## Stale Browser Source

If the overlay used to work:

- Refresh the Browser Source.
- Toggle source visibility.
- Clear OBS browser cache if needed.
- Recreate the Browser Source when cached state is clearly stale.
- Ensure "Shutdown source when not visible" is not stopping pages that must remain connected.
- For Event Flow, keep `actions.html` open/running.

## TTS Audio In OBS

If visual overlay works but TTS is silent:

- Identify provider/mode.
- System/Web Speech TTS may require virtual cable, desktop audio, or app audio capture.
- Browser/provider TTS works better with Browser Source audio control.
- Normal browser pages may need a click before audio starts.
- OBS Browser Sources can avoid some browser autoplay prompts.

See `../09-api-and-integrations/tts.md`.

## OBS Remote Control Issues

Scene/source/filter controls need one of:

- Browser Source API: SSN page running inside OBS Browser Source with Advanced Access Level.
- OBS WebSocket v5: OBS 28+ server, usually `ws://127.0.0.1:4455`.

`obs-websocket-test.html` is the diagnostic path for WebSocket requests. Old obs-websocket 4.x / port `4444` setups are not compatible with current Flow Actions request behavior.

## Common Fix Matrix

| Symptom | Likely Fix |
| --- | --- |
| Blank featured page | Feature a message; check `showtime`; verify session. |
| White page in browser | Test in OBS or add temporary background; this can be transparent empty state. |
| Dock works, OBS does not | Refresh/recreate OBS Browser Source; check active scene/source visibility. |
| Overlay text cropped | Increase Browser Source height or reduce scale/CSS font size. |
| Styling ignored | Use OBS CSS field and `!important`; verify CSS target selectors. |
| Local file works in browser but not OBS | Use hosted page or OBS CSS, especially macOS/Linux. |
| Audio missing | Use provider/browser TTS or route system TTS audio. |
| Event Flow media missing | Open `actions.html?session=...` and keep it running. |
| OBS scene control missing | Use Advanced Access Browser Source or OBS WebSocket v5. |

## Escalation Data To Collect

- OBS version.
- Browser Source URL with session/key values redacted.
- Which page is loaded: dock, featured, actions, custom, theme.
- Browser Source dimensions.
- Custom CSS used.
- Screenshot of dock and OBS output.
- Whether dock sees messages.
- Whether a simple `clearOverlay` or `content` API command works.
- OBS WebSocket URL/version/password-required status for control issues.

## Follow-Up Extraction Needs

- Add screenshot examples for empty featured overlay vs broken overlay.
- Extract common CSS selectors for dock/featured styling.
- Mine OBS-specific support history from `stevesbot`.
- Document OBS Browser Source permission UI by OBS version.
