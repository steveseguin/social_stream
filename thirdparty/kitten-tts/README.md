# Kitten TTS Integration

This folder contains the Kitten TTS (Text-to-Speech) implementation for Social Stream.

## License

Copyright 2024 KittenML  
Licensed under the Apache License, Version 2.0 (see LICENSE file)

## Attribution

Kitten TTS is developed by KittenML.  
- **Original Repository**: https://github.com/KittenML/KittenTTS
- **Web Demo Repository**: https://github.com/KittenML/KittenTTS-Web-Demo
- **License**: https://github.com/KittenML/KittenTTS?tab=Apache-2.0-1-ov-file#readme

## Files

- `kitten-tts-lib.js` - Main library file (ES module, ~59MB bundled with dependencies)
- `kitten_tts_nano_v0_1.onnx` - ONNX model file (~23MB)
- `voices.json` - Voice embeddings for 8 different voices
- `LICENSE` - Apache 2.0 License
- `NOTICE` - Attribution and third-party notices

## Voices Available

The system includes 8 voices:
- `expr-voice-2-m` - Voice 2 (Male)
- `expr-voice-2-f` - Voice 2 (Female)
- `expr-voice-3-m` - Voice 3 (Male)
- `expr-voice-3-f` - Voice 3 (Female)
- `expr-voice-4-m` - Voice 4 (Male)
- `expr-voice-4-f` - Voice 4 (Female)
- `expr-voice-5-m` - Voice 5 (Male)
- `expr-voice-5-f` - Voice 5 (Female)

## Usage

The library is loaded dynamically when Kitten TTS is selected as the provider:
- In popup.js for the Chrome extension
- In tts.js for the main application

## Features

- Browser-based TTS (no server required)
- 8 voice options
- Adjustable speed (0.5 to 2.0)
- ONNX Runtime for neural network inference
- IPA phoneme-based synthesis

## Dependencies

The library includes bundled:
- ONNX Runtime Web (MIT License)
- espeak-ng phonemizer (GPL-3.0)
- All required WASM files are in the parent directory

## Modifications

This integration has been modified from the original:
- Bundled as ES module with all dependencies
- Configured for Chrome extension context compatibility
- Path adjustments for local resource loading
- Added voice validation and fallback logic

## Building from Source

Source files are located in `../kitten-tts-web-demo/`
To rebuild: `cd ../kitten-tts-web-demo && npx vite build --config vite.config.lib.js`