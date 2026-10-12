# Third-Party Notices (Local Browser LLM Runtime)

This directory contains local runtime assets for browser inference.

- `transformers.min.js` and `transformers.web.min.js`: from `@huggingface/transformers` 4.2.0 (Apache-2.0)
  - Browser worker runtime file: `transformers.web.min.js`, bundled as self-contained ESM from the package's browser export and pinned browser dependencies
  - Local browser-bundle patch: forwards `num_logits_to_keep` through the generic text decoder and sets it to one in Qwen VL generation, avoiding full-prompt logits during generation. Direct scoring retains its existing default. Backported from [Transformers.js #1681](https://github.com/huggingface/transformers.js/pull/1681).
  - License file: `thirdparty/transformersjs/LICENSE`
- `ort/*`: from the `onnxruntime-web` 1.26.0-dev.20260416-b7804b056c version pinned by Transformers.js 4.2.0 (MIT)
  - License file: `thirdparty/transformersjs/ort/LICENSE`

These files are vendored to avoid CDN/runtime network dependencies.
