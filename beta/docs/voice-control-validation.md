# Voice control validation - September 6-7, 2026

The Windows x64 preview passed the original recorded-command targets in actual SSApp with OBS running (56/56 commands, 29/29 negative cases). A broader synthetic-voice corpus exposed wording-dependent misses with both the original and faster thread settings; results are preserved below. Human voices, physical microphones, and slower streaming PCs still need validation before general release.

## What was exercised

Actual SSApp with an isolated profile, packaged microphone capture, real cached CPU Whisper Tiny English, saved Event Flows, and actual OBS rendering the offline Maze Raid browser source in a 1920 x 1080 scene. Commands incremented a private test counter through the real Event Flow action path. No viewer channels, personal microphone audio, or payments were involved.

The recordings use Windows' David and Zira synthetic voices, three speaking rates, clean/quiet/noisy speech, similar phrases, negations, silence, noise, and generated musical tones. A later run adds continuous recorded speech followed by a command and a fresh command after the pause. These are synthetic recording tests, not human-speaker accuracy or acoustic echo tests.

Machine: AMD Ryzen 9 3950X, 32 logical processors, 96 GB RAM. This is not a modest-PC benchmark. OBS was rendering; it was not encoding or broadcasting. Browser animation-frame timing is not the same as OBS output/render-lag statistics.

## Recorded results

| Run | Intended commands | Negative/noise cases without activation | Successful-command p95 | OBS browser-frame p95, idle / listening |
| --- | --- | --- | --- | --- |
| Initial 6.1 minutes | 49/54 (90.7%) | 27/27 | 1.84 s | 16.7 / 16.8 ms |
| Reviewed 6.5 minutes, including long-speech cases | 36/56 (64.3%) | 29/29 | 1.87 s | 16.8 / 16.8 ms |
| Managed-playback suppression and recovery, 1.4 minutes | 7/8 | 8/8 | 1.55 s | 16.8 / 16.8 ms |

All two-second-expired results were skipped. The initial misses included `Ninja's celebration` instead of `ninja celebration` and correctly recognized phrases that arrived too late. The repeat showed substantially more deadline misses. Do not interpret the similar successful-command p95 as stable recognition: expired/missed commands are excluded from that percentile.

Neither earlier ONNX run met the proposed accuracy or latency gates. No unwanted activations were observed in these samples, but two synthetic voices and short noise/music samples do not establish real-world false-activation safety. The new long-speech cases were ignored and the following short commands worked.

The initial total SSApp working set was approximately 2.17 GB near the start and 2.11 GB at the end (peak 2.39 GB). This includes the entire app, not just Whisper, and is too short a run to rule out a leak. The OBS browser-source timing remained similar; this does not certify encoding performance or latency on lower-end hardware.

The suppression run used real recorded command audio with controlled managed-playback signals through the trusted native bridge. All six commands during the playback signal and both long-utterance cases were suppressed; seven of eight following short commands ran. The remaining recording became `Ninja's celebration`, so exact matching correctly declined it. This tests software suppression and recovery, not physical speaker echo or the sound output of every TTS provider.

The real SSApp/OBS control workflow also passed after the fixes: editor setup, Test/Armed behavior, forged chat rejection, dock pairing/reload/Stop, queued Start cancellation, invalid requests, missing-device handling, renderer crash, and restarting disarmed. Twelve supporting capture/service regressions and the existing ElevenLabs queue regression passed. UI and OBS workload screenshots were reviewed.

## Validated fixes

- Stop now invalidates pending Start/Arm requests, including a Start waiting behind microphone selection. A regression first reproduced the listener restarting after Stop.
- Speech exceeding the four-second capture limit is ignored until a pause. Previously it was submitted as multiple fragments, which conflicts with whole-phrase command matching. A regression reproduced two submissions from one continuous utterance.
- Added actual-app checks for queued Start cancellation, a crashed microphone renderer, and restarting in Test mode.

## Reproduce locally on Windows

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/build-voice-corpus.ps1 -OutputDir "$env:TEMP/ssn-voice-corpus"
python tests/build-voice-corpus.py "$env:TEMP/ssn-voice-corpus"
node tests/voice-recordings-ssapp.e2e.cjs
node tests/voice-control-ssapp.e2e.cjs --obs
node --test tests/voice-control-service.test.cjs tests/voice-capture.test.cjs
```

Requires the sibling SSApp checkout, local Playwright, installed OBS, and the two Windows voices. Windows x64 first use downloads approximately 40 MB of verified native runtime/model files; subsequent starts use the local cache. Other platforms retain the existing cached ONNX model path. The recording benchmark writes measurements and screenshots under a new `ssn-voice-recordings-*` temporary directory. It reports misses instead of disguising them as a passing accuracy gate. Generated WAV files stay outside Git. For a separate managed-TTS suppression/recovery run, generate a corpus in another directory with `--safety-only`, set `SSAPP_VOICE_CORPUS` to that directory, and run the same benchmark.

## Remaining gates

The Windows x64 synthetic corpus met the targets of at least 95% matches and p95 under 1.5 seconds. Several real speakers/accents, a one-hour conversation/game-audio false-activation test, physical microphone removal, speaker leakage, and a modest-PC streaming/encoding workload still need validation. The actual-app native run also exercised a cold runtime/model download. Do not broaden phrase matching or extend stale-command eligibility just to increase the score.

## Runtime investigation

Reducing the existing ONNX worker's thread pool to one, two, or four threads did not improve the worker comparison. Windows System.Speech was faster (113 ms median per recorded file), but its command grammar accepted five incorrect phrases without a confidence cutoff; a cutoff high enough to exclude these accepted only 12/56 intended commands. It was not selected.

The native whisper.cpp b4938 CPU runtime with Tiny English Q5_1 recognized all 56 intended command recordings and rejected all 27 negative/noise recordings in the isolated binary comparison (long utterances remain the capture service's responsibility). p95 including launching/loading the process was 644 ms. This is preliminary worker evidence; the actual SSApp/OBS run is recorded separately below.

Windows x64 voice commands now use that native runtime. First Start downloads pinned, SHA-256-verified runtime/model data from official upstream sources. Only whitelisted executable/DLL archive entries are installed, with individual pinned hashes. Microphone audio is passed as WAV over stdin; results use stdout. No recording files, shell commands, or new listening ports are involved. Other platforms and cohost retain the existing ONNX worker. The runtime exits after each request. The further speed review below adjusts its thread cap only on high-core-count Windows x64 machines. Stop aborts downloads and kills an active recognition process; existing freshness and arming checks still apply.

Upstream references: [whisper.cpp b4938](https://github.com/ggml-org/whisper.cpp/releases/tag/b4938), [model repository](https://huggingface.co/ggerganov/whisper.cpp), and [ONNX Runtime threading](https://onnxruntime.ai/docs/performance/tune-performance/threading.html). The whisper.cpp MIT license is included in SSApp's assets. No binaries or models are committed to either repository.

## Native runtime in actual SSApp and OBS

The 391-second Windows x64 run recognized 56/56 intended commands and rejected all 29 negative/noise/long-speech cases. End-of-recorded-speech to Event Flow action p95 was 1,171 ms. OBS browser-frame p95 was 16.7 ms both before and during listening. It exercised first-use runtime/model download through the real Start control. The control workflow then passed again with native recognition: editor setup, Test/Armed, real actions, forged chat rejection, actual OBS pairing/reload/Stop, queued Start cancellation, missing-device handling, renderer crash, and restarting disarmed. Screenshots were reviewed.

The app process-memory sampler does not include the new native child processes. Its numbers must not be used to claim lower total memory or CPU usage. The 1,171 ms result is end-to-end; the separate 644 ms binary benchmark excludes capture/pause and Event Flow overhead.

The 86-second native suppression/recovery run also passed: 8/8 following commands worked, and all six playback-overlap commands plus two long utterances were suppressed. End-to-end p95 was 1,103 ms; OBS browser-frame p95 remained 16.7 ms. The first attempt could not report measurements because the test installed its OBS sampler before navigation finished. The harness now waits for document completion and asserts a populated baseline; the complete rerun produced these results.

A separate actual native-process test verified cancellation and a fresh recognition after Stop. Fifteen supporting service/capture/download checks passed, covering corrupt/oversized downloads and cancellation, plus the existing ElevenLabs queue regression. The binary imports Microsoft Visual C++ runtime DLLs; a clean Windows-machine dependency check remains outstanding. Missing-DLL process exits now give a specific Visual C++ x64 installation message (supporting injected-exit regression), rather than a generic retry message.

The unchanged cohost speech workflow passed again in actual SSApp after native integration: Cobalt Lantern 7 / The microphone is working, one ONNX worker, one model load, and an empty request queue at completion.

## Further speed comparison

Interleaved runs of the same 83 standalone clips retained all 56 commands and 27 negative cases with the full audio context. Reducing the context to 256/512/768/1024 retained only 24/48/51/55 commands respectively; none produced a false command in these negative samples, but the lost commands disqualify the change. Two threads and disabling flash attention kept accuracy but were slower. These options were not applied to the app. Capture pause detection and exact matching are unchanged.

Additional generated fixtures use six phrases and the installed Windows Linda, Richard, and Mark voices, including Canadian English voices. They remain synthetic speech, not real human recordings. The actual-app harness now derives its Event Flows from each corpus and reports any event outside the scored utterance windows. Generated WAV files and complete benchmark outputs remain under the local temporary directory.

The 1280 context also lost one command and was rejected. In the matched full-context comparison, four/six/eight threads all retained 56/56 commands and 27/27 negatives. Binary p95 was 712/533/533 ms respectively. Six threads were selected for further actual-app validation: PCs with at least 24 logical processors use six; smaller PCs retain the previous maximum of four (or their available CPU count). The model, decoding settings, capture pause, and matching rules are unchanged. This does not add a model download or a UI setting.

The additional-voice binary comparison retained 52/57 commands and rejected 39/39 negative/noise clips with both four and six threads. All five misses had identical transcripts in both configurations. Four involved the phrase "ninja start the countdown" (especially the Richard voice); the fifth was a noisy "cat" becoming "cap". Six-thread binary p95 was 612 ms versus 772 ms for four threads. These misses remain visible; exact matching was not loosened to inflate accuracy. This broader corpus did not meet a 95% aggregate recognition target, even with the original thread setting.

To repeat the additional voices locally, run tests/build-voice-onecore.ps1 with an OutputDir, then tests/build-voice-corpus.py on that directory. Set SSAPP_VOICE_CORPUS to it before running the recorded-app test. For the interleaved binary comparison, point SSAPP_NATIVE_WHISPER_CACHE_DIR at the verified cache created by Voice Control and run tests/voice-native-settings-benchmark.cjs with SSAPP_VOICE_BENCH_ROUND=4 (four versus six threads). Rounds 1-3 contain the rejected comparisons. No listening microphone is used to generate these fixtures.

Actual SSApp/OBS with the six-thread cap retained 56/56 commands and 29/29 negatives in the original 391-second corpus, with no events outside the scored windows. End-to-end p95 was 1,077 ms versus the earlier four-thread run of 1,171 ms. OBS browser-frame p95 stayed 16.7 ms. The end-to-end improvement is smaller than the isolated recognition improvement because capture still waits for the same pause.

The additional voices then completed 468 seconds through actual SSApp capture and OBS: 52/57 commands, 42/42 negatives, and no events outside the scored windows. The five misses were the same phrase/voice/condition cases identified in the paired four/six-thread binary comparison. Successful-command end-to-end p95 was 1,302 ms; OBS browser-frame p95 was 16.7 ms before and 16.8 ms during listening. Combined with the original corpus, these actual-app runs exercised five synthetic voices, 113 command attempts (108 recognized), and 71 negative cases (none activated). Phrase-dependent misses remain; this is not a human-speaker accuracy claim.

The native process cancellation/restart test passed after the thread change. Supporting checks verified that 1/4/8/16/24/32 reported logical CPUs select 1/4/4/4/6/6 threads, respectively; these are argument checks, not benchmarks of other machines. All 15 service/capture/download checks passed, including with an existing native-cache environment override. Download tests now force their own temporary cache instead of accidentally reusing that override.

The final six-thread suppression/recovery run passed: 8/8 following commands and 8/8 suppressed cases, with no unexpected events. Successful-command p95 was 937 ms. The actual SSApp/OBS control suite also passed again (Test/Armed, real Event Flow actions, forged chat rejection, pairing/reload/Stop, queued Start cancellation, invalid requests, capture crash, and restarting disarmed). The Test-mode screenshot was reviewed. Changes remain local and unreleased.

## Phrase hints and concurrent microphones

The additional-voice corpus was expanded with near-command negatives such as "Nina celebration", "ninja calibration", "then just start the countdown", and "show the dancing cap". In the interleaved native comparison, the baseline retained 52/57 commands and 54/54 negatives. A single proper-name hint, "Ninja.", retained 53/57 and 54/54, with essentially unchanged binary p95 (531 versus 534 ms). It also retained the original corpus's 56/56 commands and 27/27 negatives. This hint does not change exact phrase matching. A complete command-list hint recognized 57/57 commands but falsely activated four near-command recordings; that approach was rejected. Beam search did not improve the original five misses.

Actual SSApp with OBS exercised three independent control windows sharing one Voice Control microphone, plus two independently capturing cohost pages. The cohost pages shared one ONNX worker, their pending queue stayed bounded, and closing one preserved the other's recognition. Neither cohost stream produced duplicate host-command actions. These concurrency checks passed. The subsequent forced-crash check exposed the separate recovery issue described below.

A supporting regression reproduced Stop throwing when Electron had disposed the microphone frame before destroying its window. Stop now clears the listening/armed state before attempting the best-effort stop message and destroys an unusable capture window. All 16 supporting service/capture/download checks passed after this fix.

The longer control sequence reproduced Electron marking the microphone renderer crashed (isCrashed true, process ID zero) without delivering render-process-gone within 15 seconds. A fresh-listener crash did deliver the event and recover. The service now checks renderer health during existing control/status and Event Flow sync calls, and before accepting a transcription. It stops and disarms a crashed renderer even if the event has not arrived; no new timer was added. A supporting regression covers a crashed renderer with a pending recognition result. The complete actual SSApp/OBS three-stream suite then passed, including the formerly failing crash and restarting in Test mode.

## Local Windows preview package

Built 0.4.25-voice-preview.2 locally with the official fallback updater using the local SSN beta source, then electron-builder with publishing disabled. No repository version bump, commit, tag, push, or public release was made. The preview launcher selects the bundled pages and an isolated preview-profile directory. First-use Whisper downloads remain outside the package.

The packaged executable completed the expanded 528-second corpus in actual SSApp with OBS: 54/57 commands, 57/57 negatives, no unexpected events, and 1,400 ms successful-command p95. OBS browser-frame p95 was 16.8 ms before and 16.7 ms during listening. The three missed recordings were Mark's quiet "show the dancing cat" (heard "kit"), Linda's noisy countdown phrase (an extra "and"), and Richard's noisy cat phrase (heard "cap"). None expired; exact matching correctly declined these different transcripts. The broader set remains just below the proposed 95% recognition gate, so this is a preview for human testing, not general-release accuracy certification.

The same bundled web assets passed actual packaged offline initial-load/reload tests and cache/bad-cache/raw/disk source-mirror tests. The final native helper also passed actual process cancellation and fresh recognition after Stop, plus all 17 supporting capture/service/download checks. Native and OBS dock screenshots were reviewed.

The packaged suppression/recovery corpus passed 8/8 following commands and 8/8 suppressed cases, with no unexpected events. Successful-command p95 was 966 ms; OBS browser-frame p95 remained 16.7 ms. These are controlled SSApp playback signals and long-speech cases, not physical speaker-echo testing.

The self-extracting portable executable also passed the real Event Flow editor's Open Voice Control workflow at its default usable window size, recorded microphone recognition, Test mode, an armed Event Flow action, Stop, and restarting disarmed. Its screenshot was reviewed. The portable harness connects through Chromium after extraction; Playwright's Electron launcher cannot attach reliably through the portable wrapper. Final-package rich-chat and text-only source-to-dock tests passed normal loading, blocked-library handling, and reloads (six captured messages per case).

Local artifact: `ssapp/.codex-tmp/voice-preview-20260906-r2/socialstream-voice-preview.exe`, with `Start Voice Preview.cmd` alongside it. SHA-256: `1D403C48779221380235148AF06C889945260EEDF67A5BE8252E482988EA9E78`. This ignored local directory also contains the launcher instructions and checksum. Human microphone/echo, accents, modest-PC encoding load, and clean-machine Visual C++ dependency checks remain outstanding.
