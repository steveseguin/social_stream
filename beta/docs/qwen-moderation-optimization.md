# Qwen 0.8B moderation readout

Stateless text moderation on the default `qwen3.5-0.8b-onnx-opt` model now compares the final OK/BLOCK vocabulary scores directly. All 24 layers and the vocabulary projection still run. No task head was trained and no layer is skipped.

With no history or compact candidates, the existing moderation policy becomes the system instruction and the chat stays in the user message. With context, the existing prompt framing is retained: isolated-message results did not justify changing contextual behavior. All recent chat messages, authors and compact candidates remain present. Remembered co-host facts are excluded from moderation.

Two reused 50-message ToxicChat sets were tested in actual SSApp with the packaged Transformers.js 4.2.0 runtime and pinned public q4 OPT weights. On the second set, the combined prompt/readout change improved 31/50 to 38/50 correct and 853.9 to 395.7 ms/message. A separate production-worker repeat reproduced the same 50 decisions at 421.0 ms/message. These results are exploratory and single-message; they do not establish conversation-level moderation quality or verify the production-hosted weight bytes.

Shorter rewritten rules performed worse. Prefix caching changed borderline decisions; a conservative recomputation guard removed those disagreements but lost its speed advantage. Neither change is enabled here. Model-file download caching remains unchanged.

The moderation client now carries its initialized model/source/provider into generation, preventing a second initialization from silently selecting another host. This fix is gated to Qwen moderation. Co-host, vision, Gemma, Qwen 2B, alternate model overrides and cloud/numeric moderation retain their existing paths.

Evidence and raw outputs are in the sibling SkinDeep repository, `docs/moderation-transfer.md` and `results/moderation-transfer/`. Tests: `tests/moderation-regressions.test.js`, `tests/qwen-moderation-readout.test.cjs`, `tests/qwen-moderation-client.test.cjs`, and `tests/local-browser-model-registry.test.js`. The SkinDeep `experiments/moderation_transfer.cjs` harness also checks the real SSApp `ai.js → client → worker` path with local weights and a separate user profile.
