# Public Claims Boundary Matrix

Status: heavy source-check pass on 2026-06-24. This is a public-claim reconciliation layer, not runtime validation.

## Purpose

Use this page when an agent is tempted to repeat broad public wording such as "120+ sites", "two-way chat", "no API keys", "free", "AI support", "premium TTS", "scriptable plugins", or "the standalone app fixes throttling".

Public docs are useful for product positioning, but support answers need narrower wording. This page maps broad public claims to safer agent phrasing, the first verification doc, and the remaining validation risk. For evidence labels, minimum proof packs, and do-not-promise boundaries before stronger feature, cost, provider, service, support, app-vs-extension, or public claims, use `feature-cost-claims-proof-ledger.md`.

## Source Anchors

- `README.md`
- `docs/features.html`
- `docs/supported-sites.html`
- `docs/js/sites.js`
- `docs/support.html`
- `docs/services.html`
- `docs/download.html`
- `docs/ssapp.html`
- `docs/tts.html`
- `docs/local-tts.html`
- `api.md`
- `parameters.md`
- `docs/agents/13-reference/features-and-capabilities.md`
- `docs/agents/13-reference/feature-support-decision-matrix.md`
- `docs/agents/13-reference/free-paid-and-support-boundaries.md`
- `docs/agents/13-reference/feature-cost-claims-proof-ledger.md`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`
- `docs/agents/08-platform-sources/public-site-support-status.md`
- `docs/agents/08-platform-sources/public-site-implementation-map.md`
- `docs/agents/08-platform-sources/platform-capability-matrix.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/agents/13-reference/customization-path-decision-matrix.md`
- `docs/agents/11-support-kb/public-docs-coverage.md`

## Core Rule

Repeat public claims only at the same level of precision that the evidence supports.

Safe pattern:

```text
SSN publicly supports this general capability. The exact setup still depends on the platform, mode, page, provider, and target surface. Start with [specific doc], then verify [specific source or runtime path] before promising exact behavior.
```

Do not convert a broad public claim into an exact support promise.

## Broad Claim Matrix

| Public Claim Or Phrase | Current Evidence | Safe Agent Wording | Check Before Saying More |
| --- | --- | --- | --- |
| "120+ sites and growing" | README product summary plus 139 public cards in `docs/js/sites.js` at the last extraction. Focused metadata validation found duplicate `On24`/`ON24` cards, so treat this as a public-card count, not a unique-live-platform count. | SSN has a large public supported-site list; use the public site lookup for the exact setup path. | `supported-sites-lookup.md`, then `public-site-implementation-map.md` and source/manifest for exact runtime support. |
| "100+ platforms and services" | `docs/features.html`, `docs/supported-sites.html`, and support pages use this broader marketing count. | It works with 100+ public entries, but exact platform, URL mode, and feature support still matter. | Same public-site routing docs; do not promise rich events or send-back from the count alone. |
| "Cross-platform chat" | README, features page, source inventory, supported-site data. | SSN consolidates chat from many supported source modes. | Exact source mode, source page visibility, extension/app surface, session, and dock receipt. |
| "Automated two-way messaging" or "two-way chat on most platforms" | README/features/SS app pages use broad two-way language; platform docs show it is mode-specific. | Some platforms/modes support sending chat back, but it must be checked by platform and source mode. | `platform-capability-matrix.md`, exact platform doc, WebSocket source docs, source code, auth/login state. |
| "No login or API keys needed for most platforms" | README/features describe most rendered-page capture as no SSN API-key path. | Many DOM/popout sources do not need SSN-specific API keys, but platform login, toggles, OAuth, or API tokens can still be required. | Supported-site setup type, private/toggle source docs, WebSocket/API source-page requirements, provider docs. |
| "Completely free" | README/download/support docs describe SSN as free/open source. | SSN itself is free/open source; external providers, platforms, payment tools, and hardware can cost money. | `free-paid-and-support-boundaries.md`; provider-specific docs before pricing or quota claims. |
| "Free support" | README/support docs point to Discord/GitHub/community support. | Support is best-effort and community/project-maintainer based, not guaranteed service. | `support-resources-and-escalation.md`; avoid implying support contracts. |
| "Donations" | README says donations are gifts and not exchanged for service. | Donations do not buy guaranteed support, fixes, or integrations. | `free-paid-and-support-boundaries.md`; do not promise priority work. |
| "AI integration" | Features page, README, AI docs, generated settings, cohost pages. | SSN has AI integration paths for chatbots, moderation, cohost pages, and generated overlays, but provider/local setup and privacy matter. | `09-api-and-integrations/ai-features.md`, `07-overlays-and-pages/ai-cohost-pages.md`, provider settings and current code. |
| "AI moderation" | Public docs mention AI moderation; AI docs warn provider/prompt limits. | AI moderation is optional and best-effort; do not promise perfect moderation. | AI docs, current settings, prompt/provider behavior, privacy requirements. |
| "Free, premium, and ultra-premium TTS" | README, `docs/tts.html`, `docs/local-tts.html`, generated settings, and focused local asset tests for selected providers. | SSN supports free system/local TTS and provider-backed TTS; external provider pricing and OBS capture behavior vary. Focused asset tests are not runtime audio proof. | `09-api-and-integrations/tts.md`, local TTS docs, provider settings, OBS/runtime validation. |
| "Kokoro/free local TTS" | README and local TTS docs describe local/browser model paths; focused Kokoro asset wiring test passed on 2026-06-24. | Local TTS can be free after setup, but runtime support, hardware, CORS, and model assets matter. Asset wiring evidence does not prove runtime audio. | `docs/local-tts.html`, `tts.md`, local bridge docs, app/browser/OBS runtime. |
| "Premium TTS fully supported in app and OBS" | README uses strong wording; runtime can still depend on provider, browser, page, and audio setup. | Provider TTS is designed for browser/app/OBS playback, but exact provider setup and audio capture should be validated. | TTS docs, provider key/path, OBS browser-source audio, standalone app workflow. |
| "Powerful/open API" | `api.md`, commands docs, action matrices. | SSN has HTTP/WebSocket/SSE/API routes, but pages and toggles must be connected for actions to have visible effects. | `api-command-validation-matrix.md`, `api-command-examples.md`, target page open/session/label/channel. |
| "Inbound donation webhooks" | README and `api.md` document Stripe/Ko-Fi/BMAC/Fourthwall webhook paths. | Webhook donation ingest exists, but webhook/session URLs are secrets and spoofable if shared. | `privacy-security-and-secrets.md`, `free-paid-and-support-boundaries.md`, API webhook section. |
| "Customizable / scriptable plugin support" | README/features mention CSS, themes, custom JS, and plugin-like paths. | SSN has several customization paths, not one normal plugin marketplace. Choose the smallest path. | `customization-path-decision-matrix.md`, custom overlay/custom JS/source docs. |
| "The standalone app avoids browser throttling" | README/download docs describe better source-window management; app docs note site blocking and embedded-browser differences. | The app can help with source-window organization and throttling, but login/OAuth/CAPTCHA/platform behavior can differ from Chrome. | `04-standalone-app-source-windows.md`, desktop app troubleshooting, real app validation. |
| "Firefox support" | README/download docs document Firefox and limitations. | Firefox exists, but it has a smaller feature surface than Chromium paths. | `02-installation-and-surfaces.md`, download docs, exact feature question. |
| "OBS remote scene support" | README and OBS docs describe browser-source permission requirements. | OBS control is possible, but it depends on OBS browser-source permissions and exact action path. | `09-api-and-integrations/obs.md`, Event Flow/command docs, OBS runtime validation. |
| "New sites can be requested" | README/support docs invite requests but say not all can or will be supported. | Users can request or contribute integrations, but acceptance is not guaranteed. | `free-paid-and-support-boundaries.md`, `12-development/adding-a-source.md`, support/escalation docs. |
| "Community freelance services" | `docs/services.html` says listings are user-submitted and not guaranteed/endorsed. | Service listings are community-provided; users handle terms and risk directly. | `docs/services.html`; do not present listings as official support. |

## Count Handling

Do not argue about whether the public count is "100+", "120+", or "139" in a normal support answer.

Use this phrasing:

```text
SSN has a large public supported-site list. For this platform, the useful question is the exact setup type and URL mode, not the headline count.
```

Use exact counts only inside agent docs or when a user explicitly asks for inventory. The latest source-backed count in these agent docs is 139 public cards from `docs/js/sites.js`, checked on 2026-06-24. Focused metadata validation also found duplicate `On24`/`ON24` cards, so do not treat the card count as a unique-live-platform count without reconciliation.

## Strong Claims That Need Narrowing

Do not say:

- "It supports that platform" when the platform has several URL modes.
- "It supports send-back" because capture works.
- "It needs no login/API key" for a source-page, OAuth, private page, or provider flow.
- "It is free" without separating SSN from providers/platforms/hardware.
- "AI moderation works" without best-effort/provider/privacy caveats.
- "The standalone app works better" without app login/source-window caveats.
- "Premium TTS is included" when a provider account/key may be required.
- "This custom plugin can be installed" without choosing a real SSN customization path.
- "A public service listing is endorsed" when `docs/services.html` says community listings are not guaranteed.

## Claim-To-Doc Routing

| User Wording | First Doc | Follow-Up |
| --- | --- | --- |
| "Does SSN support X?" | `08-platform-sources/supported-sites-lookup.md` | `public-site-support-status.md`, `public-site-implementation-map.md` |
| "Does it support X feature on Y platform?" | `08-platform-sources/platform-capability-matrix.md` | Exact platform doc and source code |
| "Can it send/reply to chat?" | `08-platform-sources/platform-capability-matrix.md` | Source mode, auth/login, permissions, send path |
| "Is it free?" | `free-paid-and-support-boundaries.md` | Provider/platform-specific docs |
| "Is AI/TTS free?" | `free-paid-and-support-boundaries.md` | `ai-features.md`, `tts.md`, provider docs |
| "Can I use the app instead?" | `modes-and-capability-matrix.md` | `04-standalone-app-source-windows.md`, app troubleshooting |
| "Can I make a plugin?" | `customization-path-decision-matrix.md` | `customization-plugin-recipes.md`, source/custom docs |
| "Can I request a site?" | `support-resources-and-escalation.md` | `12-development/adding-a-source.md`, cost/support boundary docs |
| "Can I hire someone?" | `docs/services.html` public source | Say community listing, not official guarantee |

## Support Answer Patterns

### Broad Platform Answer

```text
It is publicly listed, but the setup type matters. Start with the listed URL/mode, then check whether you need a normal page, popout chat, toggle-required source, manual helper, or WebSocket source page. A listing does not by itself prove send-back, gifts, rewards, moderation, or app parity.
```

### Broad Feature Answer

```text
SSN supports that feature family, but exact support depends on the target page/platform/mode. Use the feature matrix for orientation, then source-check the specific platform or page before promising exact behavior.
```

### Cost Answer

```text
SSN itself is free/open source. The provider, platform, payment processor, graphics tool, or local hardware may still have costs or account requirements.
```

### App Answer

```text
The standalone app can help with source windows and browser throttling, but it is not identical to Chrome. App login, OAuth, CAPTCHA, hidden-window behavior, and source bridges need separate validation.
```

## Evidence Needed To Promote A Claim

To promote a broad public claim into a final-grade support claim, record:

- The exact public source text or public data row.
- The current agent doc that narrows the claim.
- The current source file, manifest row, setting key, URL parameter, or API handler that supports the exact claim.
- The product surface: Chrome extension, standalone app, hosted page, local page, Firefox, Lite, OBS/browser source, or external API client.
- Whether runtime validation exists. If not, mark it source-backed only.

## Follow-Up Validation Needs

- Runtime-check representative public-site setup flows from each setup type: standard, popout, toggle, manual, and WebSocket source page.
- Line-validate platform send-back claims before repeating broad two-way wording.
- Runtime-validate provider TTS/AI setup examples before saying a specific provider works in app/OBS.
- Reconcile public service/support wording whenever `docs/services.html`, `docs/support.html`, or README donation/support sections change.
