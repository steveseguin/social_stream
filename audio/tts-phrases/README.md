# Prerecorded TTS phrases

Piper and eSpeak voices for other languages read English by their own rules. A Portuguese or Spanish voice drops the silent "h", so "hi" comes out as a short "i". When a chat message is only one of these short English phrases ("hi", "hello everyone", "good night", ...), Social Stream plays the matching clip here instead, after the sender's name in the selected voice. English voices and longer messages are unchanged.

The phrase list lives in `TTS.phraseClips` in [tts.js](../../tts.js). Clips play at normal pace whatever the speech speed; slowed versions blurred the "h" again.

The Portuguese Piper voices Tugão and Faber also use clips for standalone "oi" and "Olá", including "ola" without the accent. Names and longer Portuguese messages use the selected voice. These two greetings may sound slightly different from that voice.

The English clips were generated with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) using the `am_eric` voice, which is close in pitch to the male Portuguese and Spanish Piper voices. Regenerate the English clips with `scripts/build-tts-phrases.cjs` after changing the list. The Portuguese `pt-oi` clip uses Kokoro's `am_michael` voice; `pt-ola` uses [Piper Faber](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD), trained on a CC0 dataset. No recordings or voice cloning were used.

These generated assets may be freely used, modified, and redistributed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is optional; the models retain their separate licenses.
