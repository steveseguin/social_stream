# Third-Party Notices (Local Browser LLM Runtime)

This directory contains local runtime assets for browser inference.

- `transformers.web.min.js`: from `@huggingface/transformers` (Apache-2.0)
  - Runtime file currently used: `transformers.min.js`
  - License file: `thirdparty/transformersjs/LICENSE`
- `ort/*`: from `onnxruntime-web` (MIT)
  - License file: `thirdparty/transformersjs/ort/LICENSE`

These files are vendored to avoid CDN/runtime network dependencies.
