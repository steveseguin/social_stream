# Prerecorded TTS phrases

Piper and eSpeak voices for other languages read English by their own rules. A Portuguese or Spanish voice drops the silent "h", so "hi" comes out as a short "i". When a chat message is only one of these short English phrases ("hi", "hello everyone", "good night", ...), Social Stream plays the matching clip here instead, after the sender's name in the selected voice. English voices and longer messages are unchanged.

The phrase list lives in `TTS.phraseClips` in [tts.js](../../tts.js). Clips play at normal pace whatever the speech speed; slowed versions blurred the "h" again.

The clips were generated with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) using the `am_eric` voice, which is close in pitch to the male Portuguese and Spanish Piper voices. Regenerate them with `scripts/build-tts-phrases.cjs` after changing the list. No recordings or voice cloning were used.

These generated assets may be freely used, modified, and redistributed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is optional; the model retains its separate Apache-2.0 license.
