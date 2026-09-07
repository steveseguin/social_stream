# SSN TTS voice previews

Generated through the real `dock.html` TTS path in an isolated OBS 32.2.2 Browser Source on Windows 11, September 7, 2026. No paid provider credentials or viewer messages were used.

Shared input: `Welcome to the stream! Thanks for joining us. Which game should we play next?`

Shared URL settings: `speech=en-US&simpletts&simpletts2`. Name reading is disabled. The ordinary chat cleanup removes exclamation marks before synthesis.

| File | Provider / voice settings |
| --- | --- |
| piper-hfc.mp3 | `ttsprovider=piper&pipervoice=en_US-hfc_female-medium` |
| kokoro-bella.mp3 | `ttsprovider=kokoro&voicekokoro=af_bella&kokorodevice=wasm&kokorodtype=q8` |
| kitten-4f.mp3 | `ttsprovider=kitten&kittenvoice=expr-voice-4-f` |
| espeak-en.mp3 | `ttsprovider=espeak&espeakvoice=en` |

The test fed a synthetic chat message through the dock's iframe bridge listener. Synthesis and playback were not mocked. Each provider completed playback, moved its OBS input meter, and produced non-silent audio in an OBS recording. The playback audio was saved and encoded as 96 kbps MP3; these previews omit initialization/wait time. Local transcription was used to check the words. This is a functional check, not a performance benchmark or verification of every voice.

The guide's provider screenshots were captured from actual `popup.html` controls in SSApp using a fresh isolated profile and the current SSN source. Cloud/custom settings were inspected, but live paid API calls were not tested. Personal OBS scenes, microphones and desktop audio were excluded.

When replacing these assets, repeat the actual Browser Source recording check, use the same sentence, and update the guide's test date and voice labels. Do not substitute recordings from a different engine or voice.

## Spanish and Portuguese samples

Added September 7, 2026. Generated with the packaged browser engines (Kokoro q8/WASM and Piper), using actual synthesis, with local Whisper transcription checks. These four clips were generated directly in Chrome; separate OBS dock recording checks cover Kokoro Spanish/Portuguese, Piper Edresson Low and existing English Kokoro. No microphone, account or viewer data was used.

- `piper-spanish.mp3`: `es_ES-davefx-medium`
- `kokoro-spanish.mp3`: `ef_dora`
- `piper-portuguese.mp3`: `pt_BR-faber-medium`
- `kokoro-portuguese.mp3`: `pf_dora`

Each says a short welcome and asks what to play today in its language. These are voice previews, not latency measurements or a native-speaker accent assessment. Encoded at 96 kbps without changing playback speed.
