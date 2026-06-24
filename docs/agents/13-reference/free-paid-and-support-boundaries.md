# Free, Paid, And Support Boundaries

Status: heavy reference pass started from README, download/support docs, AI/TTS docs, and support-mining notes.

## Source Anchors

- `README.md`
- `docs/download.html`
- `docs/support.html`
- `docs/commands.html`
- `docs/supported-sites.html`
- `docs/services.html`
- `docs/agents/01-product-map.md`
- `docs/agents/09-api-and-integrations/ai-features.md`
- `docs/agents/09-api-and-integrations/tts.md`
- `docs/agents/11-support-kb/common-questions.md`

## Short Answer

Social Stream Ninja itself is free and open-source. Costs can appear when the user chooses third-party providers, cloud APIs, platform services, graphics tools, or paid platform features outside SSN.

## Free / Included With SSN

| Item | Boundary |
| --- | --- |
| Core SSN project | Free/open-source under GPLv3. |
| Browser extension | Free. Chrome Web Store/manual install/Firefox XPI are distribution choices. |
| Standalone app | Free download from Social Stream release assets. |
| Hosted dock/featured/tool pages | Free to use. |
| Most DOM capture modes | Usually no extra SSN account/API key needed; platform login may still be required. |
| HTTP/WebSocket/SSE API | Free hosted relay use, subject to availability/limits and user privacy choices. |
| Basic system/browser TTS | Free Web Speech API/system voices, with capture limitations. |
| Ollama/local AI paths | Free software/self-hosted path, but user hardware and setup are required. |
| Custom overlays/API integrations | Free if the user builds/runs them. |

## Can Cost Money Or Require Accounts

| Item | Why |
| --- | --- |
| Google Cloud TTS | Provider account/API key/billing. |
| ElevenLabs TTS | Provider account/key; free tier may exist but provider controls limits. |
| Speechify TTS | Provider account/key/pricing. |
| OpenAI/Gemini/DeepSeek/xAI/Groq/OpenRouter/Bedrock AI | Provider account/API key/quota/billing. |
| OpenAI-compatible custom endpoints | Could be free self-hosted or paid third-party depending on user endpoint. |
| Streamlabs/Stripe/Ko-Fi/Buy Me A Coffee/Fourthwall | External platform accounts and their fees/rules. |
| H2R/SPX/Singular/production graphics systems | External tools may be paid or self-hosted. |
| Platform paywalled content | SSN does not bypass paywalls or access restrictions. |
| User hardware | Local AI/TTS can require CPU/GPU/RAM. |

Do not describe third-party providers as included with SSN. Say "SSN supports this provider; the provider controls pricing and access."

## TTS Cost Boundaries

| Provider Type | Cost/Runtime Boundary | Support Notes |
| --- | --- | --- |
| System/browser TTS | Free, uses OS/browser voices | Can be hard to capture in OBS because audio may route through system output. |
| Kokoro/local browser TTS | Free/local runtime path | Needs browser/runtime support and capable hardware; may be slow. |
| Kitten/local browser TTS | Free/local lightweight model path where supported | Downloads model assets; runtime support matters. |
| Google Cloud TTS | Paid/provider API key | Easier OBS capture than system TTS. |
| ElevenLabs | Provider account/key; may have test/free tiers | Provider controls voice/model limits. |
| Speechify | Provider account/key | Provider controls pricing and limits. |
| Gemini/OpenAI-compatible TTS | Provider or self-hosted endpoint | Keys/endpoints must be treated as private. |

## AI Cost Boundaries

| Provider Family | Boundary |
| --- | --- |
| Ollama | Local/self-hosted; no cloud bill from SSN, but setup/hardware required. |
| Local browser models | Local/browser runtime; model assets and hardware matter. |
| OpenAI, Gemini, DeepSeek, xAI, Groq, OpenRouter, Bedrock | Cloud provider account/key/billing/quota. |
| Custom API | User controls endpoint; may be local, self-hosted, private, or paid. |

AI outputs can be wrong or unsafe. Do not promise correctness, moderation reliability, or platform compliance.

## Support Boundaries

Free support paths:

- Discord: `https://discord.socialstream.ninja`
- GitHub issues: `https://github.com/steveseguin/social_stream/issues`
- Public docs under `https://socialstream.ninja/docs/`

Boundaries to state clearly:

- Support is best-effort, not guaranteed.
- Platform changes can break sources without warning.
- Not all requested sites or features will be added.
- Steve does not accept payment for adding integrations or support.
- Donations are gifts, not service contracts.
- Users should not share private session IDs, tokens, API keys, webhook URLs, or credentials.

## New Site / Feature Requests

README guidance:

- Requests can be made through GitHub issues or Discord.
- Not all requested sites can or will be supported.
- Publicly accessible social chat sites with meaningful communities are more likely to be considered.
- Code contributions are welcome but may be declined for legal, quality, maintenance, or policy reasons.
- Some users may need to maintain a fork for unsupported or sensitive integrations.

Support answer rule: do not say a new source is easy or guaranteed. Say it depends on platform access, maintainability, and current priorities.

## Terms, Privacy, And Platform Rules

Public docs include:

- SSN Terms of Service: `https://socialstream.ninja/TOS`
- Privacy Policy: `https://socialstream.ninja/privacy`
- YouTube Terms link in README.

README warning: using SSN may potentially violate some social-media platform Terms of Service. Do not advise users to bypass platform restrictions, paywalls, login controls, anti-bot checks, or privacy boundaries.

## Donation Webhook Security

Inbound donation webhook URLs use the session ID:

```text
https://io.socialstream.ninja/SESSION_ID/stripe
https://io.socialstream.ninja/SESSION_ID/kofi
https://io.socialstream.ninja/SESSION_ID/bmac
https://io.socialstream.ninja/SESSION_ID/fourthwall
```

The public API docs say these paths do not verify platform signatures. Anyone with the session/webhook URL can spoof donation events. Treat webhook URLs as private secrets.

## Common Bad Answers To Avoid

- "Everything is free" without mentioning provider/platform costs.
- "Premium TTS is included" when it needs an external account/key.
- "Donating will get the integration added."
- "This site is supported forever."
- "Use the app; it fixes all login issues."
- "Share your session ID so I can test it" in a public channel.
- "SSN bypasses platform restrictions."

## Answer Pattern

For cost/support questions:

1. State what SSN provides for free.
2. Name any third-party service that can charge money.
3. Say who controls the account/key/pricing.
4. Mention privacy/secrets if URLs or keys are involved.
5. Point to Discord/GitHub/docs for support, with best-effort boundary.
