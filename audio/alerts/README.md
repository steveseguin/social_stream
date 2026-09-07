# Alert sound assets

These short clips are packaged locally and shared by Multi-Alerts and Event Flow through `shared/alerts/sound-library.js`.

- Applause, drumroll, whoosh, cash register, boing, record scratch, pop and camera shutter are original procedural effects. No third-party audio samples were used.
- The four `voice-*` WAVs are deliberately synthetic English phrases generated with the repository's existing eSpeak-NG formant synthesizer: “Thank you!”, “Welcome to the stream!”, “Let's go!”, and “All aboard the hype train!”. They are not recordings of a person or cloned voices. The picker labels them as synthetic.
- The generator is `node scripts/build-alert-sounds.cjs` (requires local Playwright). It uses the packaged eSpeak worker and blocks external requests. The engine is not loaded at runtime to play these clips; the WAVs work offline.
- Effect files are mono 22.05 kHz PCM with short fades and restrained peaks. The default alert volume is 35%; use Listen before changing a stream's levels.

The generated sound assets in this directory may be freely used, modified and redistributed with attribution optional (CC0-1.0). The eSpeak engine retains its existing GPL license; it is not included in the WAVs. The five legacy sounds in the parent directory are unchanged.
