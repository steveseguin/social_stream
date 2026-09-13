# OBS Integration

Status: heavy extraction pass started from README, `parameters.md`, `api.md`, Event Flow guide, and OBS tester.

## Source Anchors

- `README.md`
- `parameters.md`
- `api.md`
- `dock.html`
- `featured.html`
- `actions.html`
- `actions/event-flow-guide.html`
- `actions/EventFlowEditor.js`
- `obs-websocket-test.html`
- `thirdparty/obs-websocket.min.js`

## Main OBS Workflows

| Workflow | SSN Surface | Notes |
| --- | --- | --- |
| Show selected chat | `featured.html` Browser Source | Most common stream overlay path. |
| Operate chat | `dock.html` browser/custom dock/window | Use as operator UI, not usually public output. |
| Style an overlay | OBS Browser Source custom CSS or URL params | Fastest safe customization path. |
| Read TTS audio | Browser Source audio or system audio routing | Provider TTS captures better than system TTS. |
| Event Flow media/actions | `actions.html` Browser Source | Must stay open for overlay/audio/OBS actions. |
| OBS scene/source control | Browser Source API or OBS WebSocket v5 | Permissions and WebSocket version matter. |

## Browser Source Setup

Common URLs:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID
https://socialstream.ninja/dock.html?session=SESSION_ID
https://socialstream.ninja/actions.html?session=SESSION_ID
```

Common sizes:

- Featured/basic overlay: `1280x600` or `1920x600` from README guidance.
- Full-canvas themed overlays or Event Flow Actions: `1920x1080` is often appropriate.

Support checks:

- Session ID matches extension/app/source.
- Browser Source URL includes `session`.
- Source is refreshed after URL/CSS changes.
- Browser Source is visible on the active scene.
- CSS is not hiding text or setting same foreground/background colors.

## Dock vs Featured

- `dock.html`: operator dashboard and control UI.
- `featured.html`: public selected-message overlay.
- `actions.html`: Event Flow output/action surface.

Common user confusion: opening `dock.html` and expecting only a clean featured overlay, or opening `featured.html` and thinking it is broken because it is transparent/blank until a message is selected.

## Styling In OBS

Recommended styling paths:

- Use URL parameters from `parameters.md`.
- Use OBS Browser Source custom CSS.
- Use `css` or `cssb64` parameters.
- Use `themes/featured-styles/*` for purpose-built featured overlays.

README warns that local self-hosted dock/featured files can be problematic in OBS on macOS/Linux. Hosted `socialstream.ninja` pages or OBS CSS are safer there.

## TTS Audio

TTS capture rule:

- Browser/provider TTS such as Kokoro, Google Cloud, ElevenLabs, Speechify, OpenAI-compatible provider paths generally play inside the browser page and work better with OBS Browser Source audio control.
- Free system/Web Speech TTS can play through the OS default output and may require virtual cable, application audio capture, or desktop audio capture.

If users say "TTS works but OBS does not hear it", first identify which TTS provider/mode they use.

## OBS Remote Scene Support

README says OBS remote scene/stats support requires adding an SSN page to OBS as a Browser Source with appropriate page permissions. An OBS custom dock is not enough for the required permissions.

Parameters from `parameters.md`:

| Parameter | Meaning |
| --- | --- |
| `remote` | Enables OBS scene state display/control integration. |
| `cycle` | Allows guests to change OBS scenes with `!cycle` when enabled. |
| `startstop` | Allows privileged users to start/stop streaming. |
| `notobs` | Disables OBS Studio detection. |

Permission notes:

- Reading scene state needs user-level permissions.
- Starting/stopping streaming requires higher/full permissions.
- Use this carefully; chat-triggered OBS control can affect live production.

## Event Flow And OBS WebSocket

`actions/event-flow-guide.html` documents two OBS control modes:

| Mode | Requirement | Notes |
| --- | --- | --- |
| Browser Source API | `actions.html` running inside OBS Browser Source with Advanced Access Level | Scene switching works; some recording/streaming/replay actions may fall back to this. |
| OBS WebSocket | OBS 28+ integrated OBS WebSocket v5, usually `ws://127.0.0.1:4455` | Recommended for consistent control. |

Other Event Flow OBS notes:

- Only append `&obspw=...` if OBS WebSocket requires a password.
- Add `&obsdebug=1` to `actions.html` to show a small OBS connection badge while troubleshooting.
- Old obs-websocket 4.x / port `4444` setups are not compatible with current Flow Actions source/filter/mute behavior.
- Keep `actions.html` open; closing it pauses overlay/audio/OBS actions.

Diagnostic page:

```text
https://socialstream.ninja/obs-websocket-test.html
```

The tester is intended for OBS 28+ / WebSocket v5. It can check `GetVersion`, `GetCurrentProgramScene`, `GetSceneList`, scene switching, source visibility, filters, mute, record, stream, and replay buffer actions.

## API/Automation With OBS

StreamDeck/Companion/API actions can indirectly affect OBS output by controlling SSN:

- `clearOverlay`
- `nextInQueue`
- `autoShow`
- `feature`
- `content`
- `toggleTTS`

Event Flow can directly control OBS scenes/sources/filters where permissions or WebSocket are configured.

## Common Support Issues

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| OBS overlay blank | No featured message, wrong URL/session, source hidden | Feature a test message; compare session; refresh source. |
| Page is white in browser | Transparent/empty overlay outside OBS | Use dock to feature a message; check CSS/background. |
| Text cropped | Browser Source too short or CSS too large | Use `1280x600`/`1920x600`; adjust scale/CSS. |
| CSS not applying | CSS specificity or local-file issue | Use OBS CSS field; add `!important`; avoid local files on macOS/Linux. |
| TTS silent in OBS | System TTS not captured | Use provider/browser TTS or route system audio. |
| OBS scene commands fail | Wrong permission/control mode | Use Browser Source Advanced Access or OBS WebSocket v5. |
| OBS WebSocket fails | Wrong port/version/password or mixed content | Use `4455`, OBS 28+, correct password; test with `obs-websocket-test.html`. |
| Event Flow actions stop | `actions.html` closed/not visible/running | Keep the actions overlay open. |
| `!cycle` does nothing | OBS remote/cycle not enabled or no permissions | Check `cycle`, OBS permissions, and source page context. |

## Safety Notes

- Do not expose OBS WebSocket passwords in public URLs/screenshots.
- Be careful with chat-triggered scene/source/start-stop controls.
- Test OBS actions in a safe scene before live production.
- If a public chat can trigger actions, use filters/moderation/role restrictions.

## Follow-Up Extraction Needs

- Exact OBS action list from `EventFlowEditor.js`.
- Screenshot-based OBS overlay troubleshooting guide.
- Browser Source permission matrix by OBS version.
- Mapping from `remote`, `cycle`, and `startstop` to exact code paths.
