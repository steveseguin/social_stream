# Local Qwen 3.5 Browser Model

This folder is the local runtime target for the in-browser cohost provider:

- Provider: `Local Qwen 3.5 (Browser)` in `cohost.html`
- Runtime: `thirdparty/transformersjs/` (fully local)
- Worker: `local-browser-model-worker.js` (`cohost-local-qwen-worker.js` is a compatibility shim)

Mirror the quantized Qwen 3.5 ONNX export into this folder or serve the same folder structure from your own asset host.

Expected files:

- `config.json`
- `generation_config.json`
- `tokenizer.json`
- `tokenizer_config.json`
- `preprocessor_config.json`
- `special_tokens_map.json`
- `chat_template.json` (if available)
- `onnx/embed_tokens_q4.onnx`
- `onnx/embed_tokens_q4.onnx_data`
- `onnx/decoder_model_merged_q4.onnx`
- `onnx/decoder_model_merged_q4.onnx_data`
- `onnx/vision_encoder_q4.onnx`
- `onnx/vision_encoder_q4.onnx_data`

Use `scripts/setup-local-qwen35-browser.ps1` to fetch these files from your self-hosted asset origin into this folder.

The local browser providers are configured for self-hosted assets only. Do not point them at Hugging Face.
