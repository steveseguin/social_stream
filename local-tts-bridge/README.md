# Social Stream Ninja Local TTS Bridge

This small Node server lets Social Stream Ninja call local/self-hosted TTS servers through one browser-safe endpoint:

```text
http://127.0.0.1:8124/v1/audio/speech
```

It has no npm dependencies.

## How SSN Calls It

SSN sends the same OpenAI-compatible JSON body it would send to OpenAI:

```json
{
  "model": "tts-1",
  "input": "Chat message text",
  "voice": "nova",
  "response_format": "wav",
  "speed": 1
}
```

The bridge returns the upstream response to SSN with browser-safe CORS headers. Binary audio is preferred. SSN also supports JSON responses containing an audio URL or base64 audio, but the bridge itself does not rewrite OpenAI-compatible responses.

SSN currently buffers the returned audio before playback. Upstream streaming endpoints can still be proxied through a custom bridge later, but the current SSN custom/local TTS client does not progressively play streamed chunks.

## OpenAI-Compatible Servers

Use this for openedai-speech, Chatterbox-TTS-Server, chatterbox-tts-api, Kokoro-FastAPI, and any server that accepts `POST /v1/audio/speech`.

```powershell
$env:SSN_TTS_TARGET="http://127.0.0.1:8000/v1/audio/speech"
node server.cjs
```

SSN URL:

```text
dock.html?session=YOUR_SESSION&speech=en-US&ttsprovider=customtts&openaiendpoint=http://127.0.0.1:8124/v1/audio/speech&voiceopenai=nova&openaiformat=wav
```

## GPT-SoVITS

GPT-SoVITS uses its own `/tts` JSON shape, so use bridge mode:

```powershell
$env:SSN_TTS_TARGET="http://127.0.0.1:9880/tts"
$env:SSN_TTS_REF_AUDIO_PATH="C:\voices\speaker.wav"
$env:SSN_TTS_REF_TEXT="Reference transcript for the speaker audio."
$env:SSN_TTS_TEXT_LANG="en"
$env:SSN_TTS_REF_LANG="en"
node server.cjs --mode gptsovits
```

SSN URL:

```text
dock.html?session=YOUR_SESSION&speech=en-US&ttsprovider=customtts&openaiendpoint=http://127.0.0.1:8124/v1/audio/speech&openaiformat=wav
```

## F5-TTS Server Wrappers

Some F5-TTS wrappers expose `GET /synthesize_speech/?text=...&voice=...`.

```powershell
$env:SSN_TTS_TARGET="http://127.0.0.1:7860/synthesize_speech/"
node server.cjs --mode f5
```

SSN URL:

```text
dock.html?session=YOUR_SESSION&speech=en-US&ttsprovider=customtts&openaiendpoint=http://127.0.0.1:8124/v1/audio/speech&voiceopenai=default_en&openaiformat=wav
```

## Options

```text
--host 127.0.0.1
--port 8124
--target http://127.0.0.1:8000/v1/audio/speech
--mode openai|gptsovits|f5
```

Environment variables:

```text
SSN_TTS_TARGET
SSN_TTS_TARGET_MODE
SSN_TTS_BRIDGE_HOST
SSN_TTS_BRIDGE_PORT
SSN_TTS_TARGET_BEARER
SSN_TTS_FORWARD_AUTH=1
SSN_TTS_EXTRA_JSON={}
```

## Desktop App Notes

The standalone Social Stream Ninja desktop app uses the same `dock.html` URL parameters as the Chrome extension. Local app windows may be less CORS constrained than Chrome, but this bridge is still the safest path for third-party servers that do not allow browser requests or do not expose an OpenAI-compatible endpoint.
