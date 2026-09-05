# Local Gemma 4 Browser Model

This folder is the local runtime target for the in-browser Gemma provider:

- Provider: `Local Gemma 4 (Browser)` in `cohost.html` and the extension AI settings
- Runtime: `thirdparty/transformersjs/` (fully local, self-hosted)
- Worker: `local-browser-model-worker.js`

Mirror the full quantized Gemma 4 E2B ONNX export into this folder or serve the same folder structure from your own asset host.

Expected layout:

- `config.json`
- `generation_config.json`
- `tokenizer.json`
- `tokenizer_config.json`
- `preprocessor_config.json`
- `chat_template.jinja`
- `onnx/`

The selected q4 decoder, embeddings, vision, and audio files total roughly 3.9 GB. They require a WebGPU-capable runtime. The largest files must be published with the R2 S3 API, a streaming R2 Worker binding, or another upload path beyond Wrangler's per-object limit.

The app is configured to use self-hosted assets only. Do not point this provider at Hugging Face.
