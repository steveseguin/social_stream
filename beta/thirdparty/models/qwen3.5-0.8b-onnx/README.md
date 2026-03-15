# Local Qwen 3.5 Browser Model

This folder is the local runtime target for the in-browser cohost provider:

- Provider: `Local Qwen 3.5 (Browser)` in `cohost.html`
- Runtime: `thirdparty/transformersjs/` (fully local)
- Worker: `cohost-local-qwen-worker.js`

Populate this folder with the ONNX artifacts from `onnx-community/Qwen3.5-0.8B-ONNX`.

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

Use `scripts/setup-local-qwen35-browser.ps1` to fetch these files into this folder.
