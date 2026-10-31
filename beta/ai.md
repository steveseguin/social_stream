# Connect an AI to Social Stream Ninja

The web version of this guide, with a tabbed backend picker, lives at https://socialstream.ninja/ai.html

Run a free model on your own computer, or plug in a paid API key. Then point the chat bot at it.

Every option on this page is the same idea. A server runs a language model and answers requests. Social Stream Ninja sends it the chat message and your instructions, then posts the reply. The **Provider** setting only tells Social Stream which API style to speak. Ollama has its own native API. Almost everything else, local or cloud, speaks the OpenAI chat format, which is what **Custom API** is for.

## Which setup is right for you?

| You want… | Use | Section |
|---|---|---|
| Free, private, and the easiest install | Ollama | [Ollama](#ollama-free-and-local) |
| A point-and-click app with a built-in model browser | LM Studio | [LM Studio](#lm-studio) |
| Full control, or you already have `.gguf` files | llama.cpp | [llama.cpp](#llamacpp) |
| A Linux GPU server, or one model shared by many bots | vLLM | [vLLM](#vllm) |
| Jan, KoboldCpp, LocalAI, a server on another PC, or a cloud service with an OpenAI-style API | Custom API | [Other servers](#other-openai-compatible-servers) |
| No install, pay per use or a free tier | OpenAI, Gemini, Groq, OpenRouter, and others | [Hosted APIs](#hosted-apis) |
| To try it in the next two minutes | SSN Hosted Trial LLM | [Hosted APIs](#hosted-apis) |
| No install and nothing leaves your browser | Local Qwen 3.5 (Browser) | Pick it in the provider list. The model downloads once and runs on your GPU inside the browser. Slower than a real server, fine for testing. |

**Speed matters more than smarts for live chat.** A reply that lands in one or two seconds feels natural. A reply that takes ten seconds feels broken, even if it is cleverer. Small models like Gemma 4 E2B and E4B are usually the right call. See [Pick a model](#pick-a-model-fast-beats-smart-for-live-chat).

## Ollama (free and local)

Ollama is the simplest way to run a model on Windows, macOS, or Linux. It works on NVIDIA and AMD GPUs and on Apple Silicon, and falls back to the CPU for small models.

1. Download and install Ollama from https://ollama.com/download, then open it. Keep it running while you stream.

   ![Ollama download page](https://github.com/user-attachments/assets/b6a0b236-f550-4a5a-a2a7-2b5063bd2a7a)

2. Download a model. Open PowerShell or Command Prompt on Windows, or Terminal on macOS and Linux, and run:

   ```
   ollama pull gemma4:e4b
   ```

   Want the fastest replies on a small GPU or laptop? Use `ollama pull gemma4:e2b`. Have a 24 GB GPU or a 32 GB Mac? Try `ollama pull gemma4:26b`. More choices are in [Pick a model](#pick-a-model-fast-beats-smart-for-live-chat) and the [Ollama library](https://ollama.com/library).

   ![ollama pull in a terminal](https://github.com/user-attachments/assets/4852506e-7761-47d1-99ce-8b2b01f34bac)

3. Check it is installed with `ollama list`. Copy the exact name shown, tag included. (The screenshots show an older `gemma3:1b` model. The steps are the same.)

   ![ollama list output](https://github.com/user-attachments/assets/b7eee74f-b2f4-47c0-8f55-80d239a3c3b2)

4. Enter these values in Social Stream Ninja (see [Connect and test](#connect-and-test-in-social-stream-ninja)):

| Setting | Value |
|---|---|
| Provider | Ollama (Native Local API) |
| Ollama API endpoint | `http://localhost:11434` |
| Ollama Model to use | `gemma4:e4b`, or whatever `ollama list` shows |
| Keep-alive model time | `-1` keeps the model loaded so replies stay fast. The default unloads it after 5 idle minutes. |

**Chrome extension or web version?** Ollama refuses requests from browser origins it does not know, so you must set `OLLAMA_ORIGINS`. The desktop app does not need this. Steps for each operating system are in [Fix CORS and connection errors](#fix-cors-and-connection-errors).

**Ollama on another computer:** set `OLLAMA_HOST=0.0.0.0` on that machine, restart Ollama, and use `http://ITS-IP-ADDRESS:11434` as the endpoint. Ollama also serves an OpenAI-style API at `/v1`, so Custom API works with it too, but the native option above is the better fit.

## LM Studio

LM Studio lets you search for and download models from a graphical interface, then serves them over an OpenAI-compatible API.

1. Install LM Studio from https://lmstudio.ai/ and open it.
2. In **Discover** (the magnifier icon), search for **gemma 4** and download an E4B or E2B build. Any instruction-tuned chat model works.
3. Open the **Developer** tab and switch the server to **Running**. The default address is `http://localhost:1234`.
4. In the server settings, turn on **Enable CORS**. It is off by default. Turning on **Just in Time Model Loading** lets the model named in the request load automatically. Otherwise load the model yourself at the top of the window. Prefer a terminal? `lms server start --port 1234 --cors` does the same.
5. Enter these values in Social Stream Ninja:

| Setting | Value |
|---|---|
| Provider | Custom API (OpenAI-compatible / llama.cpp) |
| Custom endpoint | `http://localhost:1234` |
| Model to use | The model's API identifier shown in the Developer tab. It is the server's model id, not the `.gguf` file name. You can also read it from `http://localhost:1234/v1/models`. |
| Optional API key | Leave blank unless you turned on authentication in LM Studio. |

Quick check: open http://localhost:1234/v1/models on the same computer. It should list your model ids.

## llama.cpp

`llama-server` is small, fast, and runs almost anywhere. It is the right pick if you want full control, already have `.gguf` files, or run on an unusual GPU.

1. Get a build. On macOS, `brew install llama.cpp`. On Windows and Linux, download the release for your GPU (CUDA for NVIDIA, Vulkan for most others) from https://github.com/ggml-org/llama.cpp/releases and unzip it.
2. Start the server. This example downloads Gemma 4 E4B from Hugging Face on first run and caches it:

   ```
   llama-server -hf unsloth/gemma-4-E4B-it-GGUF:Q8_0 --port 8080
   ```

   Already have a file? Use `llama-server -m path\to\model.gguf --port 8080`. For a larger model on a 24 GB GPU: `-hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q4_K_XL`. Add `--api-key yourkey` if the server is reachable by anyone else.

3. Enter these values in Social Stream Ninja:

| Setting | Value |
|---|---|
| Provider | Custom API (OpenAI-compatible / llama.cpp) |
| Custom endpoint | `http://localhost:8080` |
| Model to use | Any name works when one model is loaded. If you serve several models, use the name the server lists at `/v1/models`. |
| Optional API key | Blank, or the value you gave `--api-key`. |

`llama-server` allows browser requests by default, so no CORS flag is needed. Vision works when the model's `mmproj` file is loaded. With `-hf` it is fetched automatically when the repo has one.

## vLLM

vLLM is built to serve many requests at once on Linux with NVIDIA (and some AMD) GPUs. It is more than one streamer needs, but if you already run it, Social Stream Ninja connects in a minute. On Windows, run it inside WSL2 or Docker.

1. Install it: `pip install vllm`, or use the `vllm/vllm-openai` Docker image.
2. Start the server with a model from Hugging Face:

   ```
   vllm serve google/gemma-4-E4B-it --port 8000 --max-model-len 8192
   ```

   `--max-model-len` caps the context to save GPU memory. Add `--served-model-name gemma` to give it a short alias, and `--api-key yourkey` if other machines can reach it.

3. Enter these values in Social Stream Ninja:

| Setting | Value |
|---|---|
| Provider | Custom API (OpenAI-compatible / llama.cpp) |
| Custom endpoint | `http://localhost:8000`, or the server's address |
| Model to use | The exact id you served, for example `google/gemma-4-E4B-it`, or your `--served-model-name` alias |
| Optional API key | Blank, or the value you gave `--api-key`. |

vLLM allows all browser origins by default (`--allowed-origins` is `*`), so CORS only comes up if you restricted it.

## Other OpenAI-compatible servers

If a server speaks the OpenAI chat format, Custom API can use it. The recipe is always the same.

1. Start the server and find its address. Most listen on `http://localhost:PORT` and serve `/v1/chat/completions`.
2. In Social Stream Ninja pick **Custom API**. The endpoint box accepts the base address, the address ending in `/v1`, or the full `/v1/chat/completions` URL. Social Stream fills in the rest.
3. Set the model to one of the ids the server lists at `/v1/models`. Add an API key only if the server asks for one.
4. Click **Test selected chat bot**. If the desktop app works but the extension or web version fails, see [Fix CORS and connection errors](#fix-cors-and-connection-errors).

| Server | Endpoint to enter | Model | Notes |
|---|---|---|---|
| Jan | `http://localhost:1337` | The id Jan shows for the model | Start Jan's Local API Server. CORS is enabled by default; copy any configured API key into Social Stream. |
| KoboldCpp | `http://localhost:5001` | Any name | Browser requests are allowed by default. |
| LocalAI | `http://localhost:8080` | The model name from its gallery or config | Start it with `--cors` for browser-page requests. |
| Ollama on another PC | `http://THAT-PC-IP:11434` | The tag from `ollama list` | Use the Ollama provider, not Custom API. That PC needs `OLLAMA_HOST=0.0.0.0`. |
| Cloud services with an OpenAI-style API | The base URL from their docs | Their model id | Mistral, Together, Fireworks, Cerebras, and similar. Paste their API key in the key box. |

## Hosted APIs

Cloud models are fast and good, and nothing to maintain. The trade-off is that your chat goes to that company and most of them bill per request. Set a monthly spending limit in the provider's dashboard before you go live.

1. Create an account with the provider and make an API key. Many need a payment method or a small prepaid credit before the key works.
2. In Social Stream Ninja pick that provider, paste the key, and leave the model box blank to use the default shown below, or type a model name.
3. Click **Test selected chat bot**.

| Provider in Social Stream | Get a key | Default model if blank | Notes |
|---|---|---|---|
| ChatGPT API | https://platform.openai.com/ | `gpt-5.4-mini` | Also unlocks OpenAI Realtime for the voice co-host. Understands images. |
| Gemini API | https://aistudio.google.com/ | `gemini-2.5-flash` | Has a free tier. Understands images. Gemini Live is available for the voice co-host. |
| DeepSeek API | https://platform.deepseek.com/ | `deepseek-v4-flash` | Very cheap. Text only in Social Stream. |
| xAI API (Grok) | https://console.x.ai/ | `grok-4.3` | xAI Realtime is available for the voice co-host. |
| Groq API | https://console.groq.com/ | `openai/gpt-oss-120b` | Very fast hosting of open models, with a free tier. Images only with its vision models. |
| OpenRouter API | https://openrouter.ai/ | `openai/gpt-5.4-mini` | One key for hundreds of models, including Claude. Pick a fast one for chat. |
| AWS Bedrock API | AWS console (access key, secret key, region) | `anthropic.claude-sonnet-5` | For people already on AWS. Text only in Social Stream. |
| OpenCode API | https://opencode.ai/go?ref=8V3339P30P (referral link) | Auto, picks a free model | Free models are available. A Go subscription adds more. The model list loads inside Social Stream. |
| SSN Hosted Trial LLM | None needed | Server default | Free while the trial lasts, and may be rate limited or switched off. Good for a first test, not for relying on. |
| Custom API | Any OpenAI-compatible cloud service | Whatever you type | Base URL, key, and model id from the service's docs. |

For live chat, the small tier of each service is the right choice: `gpt-5.4-mini`, `gemini-2.5-flash`, `deepseek-v4-flash`. They usually cost less than flagship models. Use the connection test to check response time before going live.

## Pick a model: fast beats smart for live chat

A chat bot has a few seconds to answer before the conversation moves on. You do not need the best model, you need one that fits in your GPU memory and starts talking quickly. The Gemma 4 family is a good place to start. Every size understands images, and the same models exist as `.gguf` files for LM Studio and llama.cpp.

| Model | Ollama tag | Download | Runs well on | Good for |
|---|---|---|---|---|
| Gemma 4 E2B | `gemma4:e2b` | 4.6 to 7.5 GB | Laptops, 6 to 8 GB GPUs, even CPU only | Fastest replies. Moderation, short chat answers, the voice co-host. |
| Gemma 4 E4B | `gemma4:e4b` (also plain `gemma4`) | 6.6 to 9.5 GB | 8 to 12 GB GPUs, 16 GB Macs | The default pick for a live chat bot. |
| Gemma 4 12B | `gemma4:12b` | about 8 GB | 12 GB GPUs, 16 to 24 GB Macs | More knowledge, still quick. |
| Gemma 4 26B (mixture of experts, 3.8B active) | `gemma4:26b` | 16 to 19 GB | 24 GB GPUs, 32 GB Macs | Noticeably better conversation that is still quick per word, because only a slice of the model runs for each token. |
| Gemma 4 31B | `gemma4:31b` | 19 to 20 GB | 24 GB GPUs with room to spare | Highest quality, slowest. Not needed for chat. |

Download sizes are the ranges Ollama lists for each tag. You need roughly that much free GPU or unified memory, plus a few GB for context.

- **Fits in GPU memory means fast.** After a test reply, run `ollama ps`. It should say `100% GPU`. If it shows CPU, pick a smaller model.
- **Keep it loaded.** The first reply after a few idle minutes is slow because the model reloads from disk. Set Ollama keep-alive to `-1` in Social Stream, or turn off auto-unload in LM Studio.
- **Skip thinking modes.** Reasoning adds seconds before the first word. Social Stream hides the reasoning text, but it still has to wait for it. Thinking settings vary by model and server. Social Stream uses the server's default thinking behavior for Ollama. If replies are too slow, choose a non-thinking model or configure a non-thinking default on your server. [Ollama thinking controls](https://docs.ollama.com/capabilities/thinking).
- **Other families work too.** Qwen 3.5, Llama, Mistral, and Phi are all fine. Pick an instruction-tuned chat model (often marked `-it` or `instruct`) and paste its exact tag.
- **Bigger is not safer.** A model that spills out of GPU memory can be ten times slower than one that fits. When in doubt, go one size down.

## Connect and test in Social Stream Ninja

1. In Social Stream settings, open **Bots & AI → Chat Bots and AI services → Configure LLM Service Provider**.
2. Under **Configure LLM**, pick your provider and fill in the endpoint, model, and key from your section above.
3. Click **Test selected chat bot** and wait for a reply. The first reply can take a while when the model is still loading. Read any error that appears under the button. It usually names the problem.
4. Open **Chat Bot - Primary** and turn on **Enable the LLM AI chat bot**.

   ![Chat bot toggle in the Social Stream menu](https://github.com/user-attachments/assets/63f1f98f-adff-4faf-8d39-206d5a76d5af)

5. For your first live test, turn on **Bot replies ONLY go to the bot overlay page** and open the bot overlay link under **Overlay Page and TTS for Chat Bot**. Nothing is posted to your real chat until you turn that off.

The [chat bot setup guide](https://socialstream.ninja/docs/chatbot-basics-guide.html#first-test) covers trigger words, reply targets, bot names, and why a connected AI can still stay silent in chat.

![Bot replies appearing in chat](https://github.com/user-attachments/assets/ed5d417e-4b1e-4f69-a81b-0a6380b8c2f3)

## Fix CORS and connection errors

CORS is a browser rule. A web page may only call another address if that server says the page is allowed. Whether it affects you depends on where Social Stream Ninja is running.

| Where it runs | Does CORS apply? | What to do |
|---|---|---|
| Desktop app | No. Requests leave from the app itself, not from a web page. | Read the test error: check the server address, model name, API key and quota. For connection failures, confirm the server is running and reachable on that computer. |
| Chrome extension | Mostly no. The extension is allowed to call any local address, so LM Studio, llama.cpp, and vLLM work without changes. | Ollama is the exception. It checks the request origin and answers `403` unless `OLLAMA_ORIGINS` includes `chrome-extension://*`. Steps are below. |
| Web version in a browser tab | Yes, the full browser rules. | The server must allow the origin `https://socialstream.ninja`. Ollama: add it to `OLLAMA_ORIGINS`. LM Studio: turn on Enable CORS. llama.cpp and vLLM allow it by default. If Chrome asks for permission to reach devices on your local network, allow it. Current Chrome can allow HTTP requests to a private IP address or `.local` hostname after local-network permission is granted. If your browser still blocks the connection as mixed content, use the desktop app or an HTTPS endpoint. [Chrome local-network access](https://developer.chrome.com/blog/local-network-access). |

### Set OLLAMA_ORIGINS

Use `chrome-extension://*,https://socialstream.ninja` to allow the extension and Social Stream website. A value of `*` allows requests from any website. Ollama only reads the variable when it starts, so always quit and reopen it afterwards.

**Windows**

1. Quit Ollama from the system tray.
2. Open the Start menu and search for **Edit environment variables for your account**.
3. Add a user variable named `OLLAMA_ORIGINS` with the value `chrome-extension://*,https://socialstream.ninja`, then click OK.
4. Start Ollama again and click **Test selected chat bot**.

![OLLAMA_ORIGINS in the Windows environment variables dialog](https://github.com/user-attachments/assets/7587ed12-aa85-498c-8cd4-25fdb56a6543)

**macOS** (Ollama app): run this in Terminal, then quit and reopen Ollama. Repeat it after a reboot.

```
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,https://socialstream.ninja"
```

**Linux** (systemd service): run `sudo systemctl edit ollama.service`, add the lines below, then run `sudo systemctl daemon-reload && sudo systemctl restart ollama`.

```
[Service]
Environment="OLLAMA_ORIGINS=chrome-extension://*,https://socialstream.ninja"
```

**Quick test on any system:** quit Ollama, then start it from a terminal with the variable set for that session only.

```
# PowerShell
$env:OLLAMA_ORIGINS="chrome-extension://*,https://socialstream.ninja"; ollama serve

# macOS or Linux
OLLAMA_ORIGINS="chrome-extension://*,https://socialstream.ninja" ollama serve
```

### What the error means

| You see | Likely cause | Fix |
|---|---|---|
| `403 Forbidden` from Ollama | Origin blocked | Set `OLLAMA_ORIGINS` as above and restart Ollama. |
| `Failed to fetch`, or a CORS message in the browser console | Server not running, wrong port, or CORS off on a browser surface | Open the endpoint in a browser. Ollama shows "Ollama is running". OpenAI-style servers list models at `/v1/models`. For browser-page requests, enable CORS on the server; for Ollama, check its allowed origins as above. |
| `404` or model not found | Model not downloaded, or the name does not match | Compare with `ollama list` or `/v1/models`. For Custom API the model must be the server's id, not the `.gguf` file name. |
| `401` or `403` from a cloud provider | Missing or wrong key, or no billing set up | Make a fresh key, paste it without spaces, and add credit or a payment method. |
| `429` | Rate limit or quota reached | Add credit, pick a cheaper model, or make the bot reply less often. |
| The first reply takes 20 to 60 seconds, then it is fine | The model is loading from disk | Set keep-alive to `-1`, or choose a smaller model. |
| Every reply is slow or times out | The model does not fit in GPU memory and is running on the CPU | Run `ollama ps`. Go one size down, or use a hosted API. |
| Empty or rambling replies | A base model instead of a chat model, or a thinking model that ran out of time | Use an instruction-tuned model and turn thinking off. |
| Test works, but the bot never replies in chat | The AI is fine. The bot settings decide which messages it answers. | See [Fix problems](https://socialstream.ninja/docs/chatbot-basics-guide.html#problems) in the chat bot guide. |

## Images, voice, and realtime AI

### Vision

Social Stream Ninja sends pictures to the AI when a feature attaches them. The private chat bot can attach screenshots, and the voice co-host can send one still image from your camera or screen share with each request. It never streams live video. For that to work, the model has to understand images.

- **Ollama:** every Gemma 4 size, Gemma 3 from 4B up, Qwen 2.5 VL, and LLaVA all accept images.
- **LM Studio and llama.cpp:** use a vision model and make sure its `mmproj` file is loaded alongside it.
- **vLLM:** serve a vision model such as Gemma 4.
- **Hosted:** OpenAI, Gemini, and OpenRouter vision models accept images. Grok and Groq only with their vision models. DeepSeek and Bedrock are text only in Social Stream, so images are not sent to them.

If the model is text only, the picture is dropped or the request fails, so check this before relying on it on stream.

### Voice co-host and realtime

The [voice co-host](https://socialstream.ninja/docs/ai-cohost-guide.html) listens to your microphone and talks back on stream. There are two routes, and the model you picked on this page matters for the second one.

- **Speech-to-speech services:** OpenAI Realtime (uses your ChatGPT API key), xAI Realtime, and Google Gemini Live. Lowest delay and the most natural voice, billed per minute of audio.
- **SSN Configured LLM:** uses whatever you set up on this page. The desktop app transcribes your voice locally with Whisper (a 42 MB download on first use), sends the text to your model, and reads the reply with text-to-speech. In the Chrome extension, Chrome's speech recognition does the listening. Here speed is everything, so use Gemma 4 E2B or E4B, or a hosted mini or flash model, and keep it loaded.
- **Local Qwen or Gemma (Browser):** the co-host page can also run a small model inside the browser with no server at all. Good for trying it, not the fastest.

Chat bot replies have the same time budget. A model that answers in one or two seconds keeps up with chat. One that needs ten seconds does not, however smart it is.

## Text-to-speech

Bot replies can be read aloud from the bot overlay page. Turn it on under **Overlay Page and TTS for Chat Bot**, then capture that page's audio in OBS. The voice is separate from the AI model, so you can mix a local model with a cloud voice or the other way around.

- [TTS setup guide](https://socialstream.ninja/docs/tts-setup-guide.html): browser voices, OBS audio, and the main options in plain language.
- [Local AI TTS guide](https://socialstream.ninja/docs/local-tts.html): private voices that run on your own computer, voice cloning, and self-hosted servers.
- [TTS voice reference](https://socialstream.ninja/docs/tts.html): every provider, URL parameter, and troubleshooting step.

## Next steps

- [AI chat bot setup](https://socialstream.ninja/docs/chatbot-basics-guide.html): trigger words, where replies go, and safe testing.
- [Answers from your files](https://socialstream.ninja/docs/chatbot-knowledge-guide.html): give the bot a knowledge base about your channel.
- [Complete AI guide](https://socialstream.ninja/docs/ai-modes-guide.html): moderation, translation, summaries, the ChatGPT browser companion, and AI-built overlays.
- [Voice AI co-host](https://socialstream.ninja/docs/ai-cohost-guide.html): microphone conversation, stage overlay, and stream controls.
- [Commands & API](https://socialstream.ninja/docs/commands.html): the full provider list and the local control API.
