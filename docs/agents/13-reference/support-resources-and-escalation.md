# Support Resources And Escalation

Status: heavy reference pass started from public support/download/guides docs and support-mining pages.

## Source Anchors

- `README.md`
- `docs/support.html`
- `docs/download.html`
- `docs/guides.html`
- `docs/supported-sites.html`
- `docs/commands.html`
- `docs/services.html`
- `docs/agents/10-troubleshooting/*.md`
- `docs/agents/11-support-kb/*.md`
- `C:\Users\steve\Code\stevesbot\resources\instructions\social-stream-support.md`

## Public Support Resources

| Resource | Use |
| --- | --- |
| `https://discord.socialstream.ninja` | Main community/support path. README names free support in `#chat.overlay-support`. |
| `https://github.com/steveseguin/social_stream/issues` | Bug reports, feature requests, platform requests, reproducible technical issues. |
| `https://github.com/steveseguin/social_stream` | Source code, releases, README, docs, issue history. |
| `https://socialstream.ninja/docs/` | Public docs entry point. |
| `https://socialstream.ninja/docs/download.html` | Download/install choices. |
| `https://socialstream.ninja/docs/guides.html` | Setup guides. |
| `https://socialstream.ninja/docs/commands.html` | Commands/API/user-facing automation docs. |
| `https://socialstream.ninja/docs/supported-sites.html` | Public supported-sites page. |
| `https://socialstream.ninja/TOS` | Terms of Service. |
| `https://socialstream.ninja/privacy` | Privacy Policy. |

## Internal Agent Docs To Use First

| Problem | Internal Starting Page |
| --- | --- |
| First-pass troubleshooting | `10-troubleshooting/quick-triage.md` |
| Extension capture failure | `10-troubleshooting/extension-not-capturing.md` |
| OBS overlay/display issue | `10-troubleshooting/obs-overlay-display.md` |
| Standalone app issue | `10-troubleshooting/desktop-app-issues.md` |
| Login/auth issue | `10-troubleshooting/auth-and-sign-in.md` |
| Settings loss/backup | `10-troubleshooting/settings-loss-and-backups.md` |
| Platform-specific issue | `08-platform-sources/*.md` and `10-troubleshooting/platform-known-issues.md` |
| API/control issue | `09-api-and-integrations/websocket-http-api.md` |
| Custom/plugin issue | `13-reference/custom-plugins-and-extensions.md` |
| Cost/support boundary | `13-reference/free-paid-and-support-boundaries.md` |

## What To Collect Before Escalating

Ask for the smallest useful set:

- Product surface: extension, standalone app, Lite, hosted page, local page, API client.
- Install source/version: Web Store, manual GitHub, Firefox XPI, standalone app release, local dev.
- OS and browser/app.
- Platform/source and exact URL type: popout, watch page, Studio, source page, WebSocket/API, custom.
- Capture mode: DOM, WebSocket/API, EventSub, app connector, external API.
- Whether dock receives messages.
- Whether overlay works in a normal browser outside OBS.
- Session ID match confirmation, without posting the actual private ID publicly.
- Relevant toggles enabled.
- Recent change: update, new stream, platform UI change, browser update, OBS update.
- Redacted console errors/screenshots/logs.

Do not ask for credentials, tokens, API keys, unredacted webhook URLs, or public session IDs unless absolutely necessary and in a private context.

## Escalation Criteria

Escalate or mark for deeper investigation when:

- Multiple users report the same platform breakage after normal setup checks.
- A source worked before and fails after a visible platform UI/API change.
- The dock receives malformed or incomplete payloads.
- Extension and app behave differently for the same source in a way not explained by auth/login.
- API actions fail with correct toggles/session/channel.
- A user repeatedly loses settings after current backup/restore logic should protect them.
- OAuth/login failures involve provider policy or embedded-browser restrictions.
- A security/privacy issue involves session IDs, tokens, webhook spoofing, or private messages.

## Support Answer Style

Good support answers:

- Identify the surface and mode first.
- Give one concrete next check.
- Explain mode-specific limits.
- Avoid promising platform fixes.
- Avoid blaming the user for platform/browser restrictions.
- Keep secret-handling advice explicit.

Avoid:

- "Just update" as the whole answer.
- "The app is better" as a blanket rule.
- "The extension is better" as a blanket rule.
- "This site is supported" without mode/version caveats.
- "Share your session ID" in public.
- "Donate and it will be fixed."

## Common Routing Examples

| User Says | Route |
| --- | --- |
| "No chat appears anywhere." | Extension/app source capture branch. Check enabled, URL, reload, visibility, toggle-required source. |
| "Dock works, OBS overlay blank." | Routing/display branch. Check session, overlay URL, OBS refresh, hidden filters, CSS, browser preview. |
| "StreamDeck button does nothing." | API branch. Check remote API toggle, endpoint, session, action, target label. |
| "Python is not receiving chat." | API listener branch. Check remote API toggle plus "Send chat messages to API server"; listen on channel 4. |
| "TTS text appears but no sound." | TTS branch. Check page open, browser audio gate, provider, OBS audio capture, queue state. |
| "Can I add my own site?" | Custom/source branch. Decide custom API source vs first-class source. |
| "Is this paid?" | Cost boundary branch. SSN free; provider/platform may cost. |

## Bug Report Template For Agents

Use this shape when turning a support report into a GitHub issue:

```text
Surface:
Install/version:
OS/browser/app:
Platform/source:
Mode:
Expected:
Actual:
Steps to reproduce:
Dock receives messages:
Overlay/API receives messages:
Console/log errors:
Recent changes:
Screenshots:
Redactions confirmed:
```

## Support Data Mining Notes

Use `11-support-kb/mining-method.md` before mining `stevesbot` support data. Raw support data is historical evidence, not a direct source of truth. Summarize and anonymize; source-check against current code/docs before turning support history into final guidance.
