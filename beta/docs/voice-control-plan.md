# Voice control: safeguards and validation before implementation

Status: local commands-only preview implemented, not released. Scope is an opt-in SSApp microphone service for Event Flow commands; browser recognition and external caption-local are alternatives. No requirement for an AI conversation or paid provider.

## Confirmed starting point

- cohost.html captures speech, waits approximately 700 ms of silence, and calls SSApp's native STT bridge. Capture is currently owned by the page.
- ssapp/stt-worker.js caches one CPU q8 Whisper Tiny English model. main.js permits only the main cohost page to use STT, bounds total pending work to three requests, and allows a five-minute request timeout.
- The cohost adapter discards results from old capture generations and limits pending transcription. Its confidence value of 1 is a compatibility placeholder, not measured recognition certainty.
- Current microphone gating uses RMS/peak amplitude and an adaptive noise floor. It is not semantic voice activity detection or speaker identification.
- Existing cohost tests exercise synthetic microphone input, real Whisper, sender restrictions, silence, and simulated TTS pause/resume. They do not establish command recognition accuracy or streaming performance.
- caption-local uses a different faster-whisper backend with rolling audio windows, bounded admission, and request deduplication. Its API is a trusted loopback API without authentication/CORS support; it is not a public browser endpoint.

## Ownership and first-release scope

SSApp owns one microphone capture and one active recognition provider per input. Capture can live in a dedicated hidden renderer managed by the main process. An Event Flow editor or OBS dock controls/subscribes to the service; closing or reloading that UI does not own its lifetime. Closing SSApp ends listening. A second controller must attach to the existing input, not create another listener.

Initially support one host microphone, local recognition, explicit Start/Stop, and fixed phrases. Keep caption output and cohost reuse behind validation; do not promise all three simultaneously before measuring contention. No arbitrary spoken shell commands, AI intent inference, or chat messages masquerading as host commands. Commands match the original language, never an English translation.

## Prevent unintended actions

Normalize case, whitespace and harmless punctuation, then match whole configured phrases. Do not strip words, use fuzzy matching, or automatically correct uncertain output into a command. Encourage distinctive two-to-four-word phrases, optionally beginning with a configured prefix. A prefix is not speaker authentication. Silence/speech gating reduces inference on noise but does not establish intent.

A Listen/Test mode shows recognized text and would-match actions without executing them. Once armed, apply per-command cooldowns and a bounded deduplication cache keyed by input generation, audio segment and command ID. Repeated identical phrases in new segments remain legitimate after cooldown. Decide explicitly whether multiple matching flows run; do not accidentally run the same action twice through two transports.

Default to suppressing command execution while SSN-controlled TTS plays, with a short measured echo tail. Continue capture/caption processing where appropriate; do not stop a shared service merely because the cohost speaks. External speakers/game audio cannot be reliably suppressed this way. Offer hold-to-listen only through a real desktop global hotkey or physical control; browser key handlers cannot promise operation while a game has focus.

Never use the existing confidence=1 placeholder as an acceptance score. Evaluate false activations directly. An optional real speech detector must be packaged and benchmarked before adoption; it is not a guarantee against recognition hallucinations.

## Latency, overload and cancellation

Every audio segment needs service-assigned monotonic start/end timestamps and a capture generation. Check freshness both before inference and immediately before dispatch to Event Flow. Proposed initial command expiry is two seconds after speech ends; tune only from measurements and expose a clear slow-system status if this drops too many legitimate commands.

Model download/warmup happens before showing Ready. Speech during loading does not queue future commands. Do not reuse the five-minute transcription timeout as command eligibility. An old computation may finish, but its command must be discarded.

Bound command waiting work to the newest useful segment. Captions may keep a separate bounded buffer with an explicit gap/lag status; do not replay that buffer through command matching after recovery. A running caption job cannot necessarily be preempted by queue priority. Therefore start with short command segments and benchmark shared decoding; if captions cause unacceptable delay, offer an explicit mode choice before adding another heavyweight model.

## Fallback and duplicate ownership

Fallback is opt-in and never turns a local-only session into cloud processing. If browser recognition fails and a prepared SSApp engine is available: disarm, stop the old provider, increment generation, clear pending command eligibility, activate the new provider, then re-arm with visible status. Old-provider callbacks cannot fire actions. Do not replay audio spanning the switch as commands. If the new engine is not ready, remain stopped and explain the recovery action.

Do not auto-switch on a single uncertain phrase or oscillate providers. Permission denial and microphone removal stop listening; reconnecting a different device requires user selection. Previously authorized startup listening can be a later explicit option, off by default.

## OBS and local connection boundaries

Use an explicitly paired, scoped local connection rather than broadening cohost IPC access or borrowing the powerful legacy renderer-execution token. Bind any new local endpoint to loopback; validate Host/Origin where applicable and require a capability token. Localhost alone is not authorization. Pairing grants separate caption-read and control permissions; do not send microphone audio to ordinary overlays. Keep tokens out of logs/referrers and allow revocation. A read-only caption overlay cannot start the microphone or invoke arbitrary Event Flow actions.

Validate the connection inside actual OBS CEF, including HTTPS-page access to local services and reconnect behavior. Prefer serving the optional control dock from the paired local service if browser restrictions require it. Raw command recognition should stay within SSApp and its trusted Event Flow path rather than a public chat relay. Use private, explicitly configured caption delivery for overlays; never assume an ordinary session ID grants control authority.

## Languages and resources

Keep the model lazy-loaded and the runtime packaged; download/cache only a selected supported model after opt-in. Pin model versions and validate downloaded assets. Tiny.en is English-only. Do not infer another language is supported because the UI accepts its name. Warm the model once, cap concurrency, and measure memory after stop/restart. Release resources after an idle period only if restart latency is clearly shown.

caption-local remains an advanced SSApp-side provider, with its existing trusted-local boundary preserved. Do not require Python, Docker, or manual service installation for the normal Windows path.

## Proposed acceptance gates (targets, not observed results)

1. Rules: zero duplicate, expired, unarmed, old-generation, or unauthorized action executions in deterministic tests, including disconnect/reconnect and provider switching.
2. Recognition: at least 100 command utterances from several speakers, plus confusable phrases, accents, and off-axis speech. Initial target >=95% intended matches and end-of-speech-to-action p95 <=1.5 s on a named baseline PC. Synthetic speech alone is insufficient.
3. False activation: zero actions in a one-hour held-out mixture of normal conversation, silence, music, game audio and TTS containing similar phrases. Report exposure and actual misses/false activations; zero in one test is not a universal reliability claim.
4. Streaming load: compare identical OBS/game workloads with recognition off/on on modest Windows hardware. Proposed ceiling <5% relative frame-time regression and no sustained added OBS encoding/render lag; record model, CPU, RAM, load and thermal conditions. Run for at least one hour to detect queue/memory growth.
5. Surfaces: real SSApp and OBS dock/overlay, then current Chrome/Edge; test device removal, hidden/reloaded UI, loss of service, model cold start, and permission denial. Never use live viewer channels.
6. Echo: test controlled TTS playback and separately external speaker leakage. Document the limits of suppression; do not imply voice identity verification.

Decision after measurements: retain existing Whisper if it meets these gates. If latency or false triggers fail, compare one command-focused engine such as Vosk or sherpa-onnx using the same recordings before shipping a new dependency. Keep browser recognition as an optional supported-runtime provider, not an assumed OBS capability.

Sources reviewed: local cohost.html; ../ssapp/main.js; ../ssapp/stt-worker.js; ../ssapp/tests/electron/cohost-stt-e2e.js; https://github.com/steveseguin/caption-local/blob/main/API.md; https://github.com/steveseguin/caption-local/blob/main/evidence/multistream/report.md; https://docs.streamer.bot/guide/core/voice-control.

## Investigation evidence

An isolated SSApp run using the existing fake-microphone WAV and real cached Whisper recognized "Cobalt Lantern 7". The original SSAPP_STT_TEST_TTS=1 harness failed because it expected both a greeting and response in a provider path producing only a response, then checked resume before the simulated 650 ms playback callback completed. An in-memory diagnostic variant (no SSApp file edits) required the actual response and awaited the next recognition start. It passed the lifecycle suite. Diagnostics reported one model load and one worker, with no queued request at observation. This validates baseline recognition and software pause/resume around simulated TTS, not acoustic echo rejection, arbitrary command accuracy, or gaming-load performance. The original test assumptions still need updating if that suite is used as a release gate.


## Local preview implementation (September 6, 2026)

SSApp now owns a private microphone renderer. Windows x64 voice commands use local whisper.cpp Tiny English Q5_1; other platforms retain the existing ONNX Whisper worker. Cohost keeps its existing worker on every platform. The Event Flow **When I say...** trigger matches a whole phrase, with a per-trigger cooldown. Every start enters Test mode; the host must explicitly enable actions. Closing/reloading the controls leaves the listener running until Stop or SSApp exit. The OBS dock shares this listener through a revocable, loopback-only private link; create a new link after restarting SSApp.

Open Event Flow, add **When I say...**, enter a distinctive phrase such as `ninja celebration`, and connect the desired existing action. Open **Voice Control** from that trigger, choose the microphone, Start listening, and check **Last heard** and **Matched** before enabling actions. First use downloads the verified runtime and English model (about 40 MB on Windows x64). Recognition is local afterward. Transcripts are kept only in memory. Use a headset: software suppression covers participating SSApp TTS pages, not external speakers, OBS TTS, or speaker identity.

Duplicate matching triggers intentionally run their respective flows. Normal incoming chat cannot activate voice triggers. Stopped, old-generation and more-than-two-second-old results cannot run commands. Slow results produce a visible status rather than executing late.

The new desktop files are included in the build list. This requires a new SSApp build containing `ninjafy.voiceControl`; released 0.4.25 is not sufficient merely because its version number matches a development checkout. No changes were made to the existing Local AI control API.

Browser/cloud fallback, caption-local configuration, shared cohost capture, shared live captions, global hold-to-listen, and additional languages remain deferred. Existing cohost capture remains independent; avoid running both microphone consumers until contention testing is complete. The multi-speaker, acoustic echo, modest-PC gaming-load and hour-long validation gates above remain outstanding. This preview must not be described as meeting those gates.


### Preview validation completed

- `node tests/voice-control-ssapp.e2e.cjs --obs`: actual SSApp editor setup and native window opening, real cached Whisper on a synthetic microphone WAV, Test mode, armed Event Flow action, forged chat rejection, paired dock, actual OBS CEF reload and Stop, and revoked/missing pairing credentials. Screenshots reviewed for the editor, native controls, and actual OBS dock.
- `node --test tests/voice-control-service.test.cjs`: supporting deterministic checks for cooldown, expiry, in-flight Stop, Test-to-Armed, disarm/rearm, managed TTS, detached Event Flow, renderer failure, and unauthorized IPC.
- `node tests/electron/cohost-stt-e2e.js` in ssapp: existing real Whisper lifecycle passed with one worker and one model load. The optional simulated TTS variant discussed above was not used as a passing release gate.
- `node tests/tts-elevenlabs-queue-race.test.js`: existing TTS queue regression passed.

Synthetic recognition and an empty OBS scene are functional integration evidence, not multi-speaker accuracy or streaming-load benchmarks. No live channels or real user microphone audio were used. Changes remain local and unreleased.

## Recorded-audio review

See [voice-control-validation.md](voice-control-validation.md) for repeatable recorded-voice measurements, observed misses, and the Stop/long-speech safeguards validated during review. Commands must be short (under four seconds) and followed by a pause. The Windows x64 preview now meets the synthetic recording targets (56/56 commands, 29/29 negative cases, 1.17-second p95), but the additional synthetic voices exposed wording-dependent misses with both the original and faster settings. Broader human/hardware release gates remain.
