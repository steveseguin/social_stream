# Reference Index

Status: heavy reference pass started.

## Purpose

This section gives AI agents fast answers for common SSN questions that cut across many pages: commands, URL options, mode selection, costs, support boundaries, and plugin/customization paths.

Use these pages when the user asks "how do I do X?" and the answer may involve more than one product surface.

## Pages

- `commands-and-actions.md`: viewer chat commands, API actions, MIDI/hotkey commands, Event Flow actions, and common command mistakes.
- `url-parameters.md`: high-value URL parameter families for dock, featured, TTS, filters, automation, tip jar, credits, and security.
- `modes-and-capability-matrix.md`: extension/app/hosted/local/Lite/Firefox/API mode comparison and platform capture mode rules.
- `free-paid-and-support-boundaries.md`: what is free, what can cost money, support expectations, donations, Terms/Privacy, and third-party limits.
- `custom-plugins-and-extensions.md`: exact meaning of plugin-like support in SSN and how to build custom behavior safely.
- `support-resources-and-escalation.md`: where to send users, what to collect, and when to escalate a support issue.
- `settings-and-toggles.md`: popup settings, URL parameters, storage layers, generated setting categories, and common setting support patterns.
- `features-and-capabilities.md`: broad feature family map, mode/cost boundaries, and routing for capability questions.

## Source Priority

Prefer current code and source docs in this order:

1. Current `social_stream` code and docs.
2. Current `ssapp` code/docs for standalone app behavior.
3. Curated `stevesbot` support material.
4. Historical raw support records, only after summarizing and source-checking.

## Fast Routing

| User Question | Start With |
| --- | --- |
| "What command do I use to clear/feature/send chat?" | `commands-and-actions.md` |
| "What URL option changes this overlay?" | `url-parameters.md` |
| "Should I use app, extension, WebSocket, or Lite?" | `modes-and-capability-matrix.md` |
| "Is this free? Does support cost money?" | `free-paid-and-support-boundaries.md` |
| "Can I make my own plugin/source/overlay?" | `custom-plugins-and-extensions.md` |
| "Where do I get help or report a bug?" | `support-resources-and-escalation.md` |
| "Where is this toggle or setting?" | `settings-and-toggles.md` |
| "Can SSN do this feature?" | `features-and-capabilities.md` |

## Follow-Up Extraction Needs

- Intense source validation of every API action in `background.js`, `dock.html`, and special pages.
- Full generated URL parameter index with page-specific support status.
- Full feature matrix by browser/app/OS/platform.
- Current source list matrix generated from `manifest.json`, `docs/js/sites.js`, and `sources/`.
- Line-level mapping of popup controls to setting definitions, storage keys, live reload behavior, and desktop app parity.
