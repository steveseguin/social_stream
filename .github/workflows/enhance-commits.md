# Commit Message Enhancer

Runs on pushes to `beta`, skipping commits marked `[auto-enhanced]` or `[skip pages]`.
The script summarizes the latest diff, generates a commit message, then amends and pushes it.

## OpenCode configuration

Keep the existing `ZEN_API_TOKEN` repository secret; its name is retained for compatibility.
It must contain a key for your OpenCode workspace with Go access. The scripts also accept
`OPENCODE_API_KEY` when run directly.

The client checks the live Zen and Go model catalogs. It tries these available free
chat models first: Nemotron 3.5 Lightning, MiMo V2.5, Ling 3.0 Flash Fin,
Nemotron 3 Ultra, Big Pickle, and DeepSeek V4 Flash Free.
Free calls use `https://opencode.ai/zen/v1/chat/completions`.

If the free models fail, the permitted Go fallbacks are `glm-5.3-flash`,
`mimo-v2.5`, and `deepseek-v4-flash`, through
`https://opencode.ai/zen/go/v1/chat/completions`.
These consume the Go subscription allowance. The client does not send paid requests
to the Zen pay-as-you-go endpoint or change account billing settings.

Every request carries a descriptive user agent and an `x-opencode-session` ID
that stays stable across the workflow's model attempts. Requests have timeouts and
an output-token limit; unavailable models are skipped for the rest of the invocation.
API errors include the failing model and service error message, without logging credentials.

The manually triggered AI Code Review workflow uses the same client and requires a PR number.

Model API references: https://opencode.ai/docs/zen/ and https://opencode.ai/docs/go/.
