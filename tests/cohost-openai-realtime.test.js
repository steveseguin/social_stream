const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cohost = fs.readFileSync(path.join(root, "cohost.html"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const popup = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const guide = fs.readFileSync(path.join(root, "docs", "ai-modes-guide.html"), "utf8");

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `Missing ${name}`);
    const bodyStart = source.indexOf("{", start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`Could not extract ${name}`);
}

const getGeneratedLinkDisplayUrl = new Function(
    `${extractFunction(popup, "getGeneratedLinkDisplayUrl")}; return getGeneratedLinkDisplayUrl;`
)();

assert(cohost.includes('defaultModel: "gpt-realtime-2.1"'), "OpenAI Realtime should use the current model by default");
assert(!cohost.includes("openai-beta.realtime-v1"), "OpenAI Realtime should not advertise the retired beta protocol");
assert(cohost.includes("class OpenAIWebRTCPublisher extends RealtimePublisher"), "OpenAI Realtime should use its WebRTC publisher");
assert(cohost.includes("new RTCPeerConnection()"), "OpenAI Realtime should create a browser peer connection");
assert(cohost.includes('peer.createDataChannel("oai-events")'), "OpenAI Realtime events should use a WebRTC data channel");
assert(cohost.includes('fetch("https://api.openai.com/v1/realtime/calls"'), "The ephemeral client secret should authenticate the WebRTC SDP exchange");
assert(cohost.includes("Authorization: \"Bearer \" + clientSecret.value"), "Only the short-lived client secret should authenticate the browser connection");
assert(cohost.includes("if (clientSecret.model) this.model = clientSecret.model"), "The co-host should use the broker-approved Realtime model");
assert(cohost.includes("audioSender.replaceTrack(microphoneTrack)"), "Changing microphones should replace the active WebRTC sender track");
assert(cohost.includes('type: "semantic_vad"'), "OpenAI native audio should use server-side voice activity detection");
assert(cohost.includes('id="openaiRealtimeModel"'), "OpenAI Realtime should expose full and mini model choices");
assert(cohost.includes('id="openaiRealtimeReasoning"'), "OpenAI Realtime should expose reasoning latency control");
assert(cohost.includes('id="openaiRealtimeVadEagerness"'), "OpenAI Realtime should expose turn-taking latency control");
assert(cohost.includes('id="diagLatency"'), "OpenAI Realtime should display measured first-output latency");
assert(cohost.includes('create_response: false'), "OpenAI voice activity should wait until chat context is ordered on the data channel");
assert(cohost.includes('case "input_audio_buffer.committed":'), "OpenAI should wait for the committed voice turn");
assert(cohost.includes('this.createResponse({ origin: "streamer_voice", allowTools: true, eventPrefix: "voice_response_create" })'), "OpenAI should explicitly request the trusted voice response after context is attached");
assert(cohost.includes('interrupt_response: true'), "The streamer should be able to interrupt the co-host");
assert(cohost.includes('const selectedVideoValue = videoSelect.disabled ? "none" : videoSelect.value'), "OpenAI Realtime should not request a disabled camera");
assert(cohost.includes('defaultVideoSelection: "none"'), "OpenAI visual input should remain off by default");
assert(cohost.includes('videoStorageKey: "selectedOpenAIRealtimeVideoId"'), "OpenAI visual input should use a provider-specific opt-in");
assert(cohost.includes('{ type: "input_image", image_url: imageDataUrl, detail: "auto" }'), "OpenAI direct turns should accept an optional current image frame");
assert(cohost.includes('this.sendVisualContext("streamer_voice")'), "OpenAI voice turns should receive an opted-in current image frame");
assert(cohost.includes('responseTypeValue === "audio" ? ["audio"] : ["text"]'), "Realtime sessions must request one output modality");
assert(cohost.includes('Context only - answer when asked (default)'), "Live chat should expose context-only mode clearly");
assert(cohost.includes("function formatCohostLiveChatContext(messages)"), "Live-chat context should be added without an automatic response");
assert(cohost.includes("publisher.sendContext(formatCohostLiveChatContext(messages))"), "Context-only chat should use the realtime conversation");
assert(!cohost.includes('localStorage.setItem(`apiKey_'), "Provider API keys must not be persisted in localStorage");
assert(!cohost.includes('apiKeyInput.value = localStorage.getItem'), "Legacy API keys must not be restored into the page");
assert(!cohost.includes("openai-insecure-api-key"), "The browser must not authenticate OpenAI Realtime with a standard API key");
assert(cohost.includes('.replace(/</g, "&lt;")'), "AI output must be escaped before Markdown is rendered");
assert(cohost.includes('case "session.updated":'), "OpenAI startup should wait for the configured session acknowledgement");
assert(cohost.includes("Connection timed out waiting for the OpenAI WebRTC session"), "OpenAI startup must wait for the configured WebRTC session");
assert(cohost.includes("webrtc.interruption.server-managed"), "WebRTC interruption should rely on OpenAI's server-managed output buffer");
assert(cohost.includes("this.maxReconnectAttempts = 5"), "OpenAI Realtime should use bounded reconnection attempts");
assert(cohost.includes('this.handleWebRTCTransportFailure("webrtc.data.error"'), "OpenAI data-channel errors should trigger recovery");
assert(cohost.includes('this.handleWebRTCTransportFailure("webrtc.peer.failed"'), "OpenAI peer failures should trigger recovery");
assert(cohost.includes('this.scheduleReconnect("session.health.timeout")'), "Open-but-unresponsive OpenAI sessions should be recovered");
assert(cohost.includes('session: { type: "realtime" }'), "Idle OpenAI sessions should receive a lightweight health probe");
assert(!cohost.includes("this.cohostToolStatus = await requestCohostToolStatus"), "Optional stream-tool discovery must not delay the Realtime connection");
assert(cohost.includes("55 * 60 * 1000"), "OpenAI Realtime should roll over before the session limit");
assert(cohost.includes('type: "conversation.item.delete"'), "Temporary live-chat context should be removed after the turn");
const localBrowserPublisherSource = cohost.slice(cohost.indexOf("class LocalBrowserPublisher"), cohost.indexOf("class ConfiguredLLMPublisher"));
const realtimePublisherSource = cohost.slice(cohost.indexOf("class RealtimePublisher"), cohost.indexOf("class OpenAIWebRTCPublisher"));
assert(!localBrowserPublisherSource.includes("this.deleteTemporaryContextItems()"), "Local browser responses must not call Realtime-only cleanup methods");
assert(realtimePublisherSource.includes("this.deleteTemporaryContextItems()"), "Realtime response completion should delete temporary live-chat context");
assert(realtimePublisherSource.includes("this.contextItemIds = []"), "Realtime reconnect should discard context ids from the old session");
assert(realtimePublisherSource.includes('lastEvent: "session.rollover.deferred"'), "Session rollover should wait until the streamer and co-host are idle");
assert(cohost.includes('aria-label="Mute co-host voice"'), "The co-host voice should have its own mute control");
assert(cohost.includes('id="muteSystemAudio"'), "Shared system audio should have a separate input mute control");
assert(cohost.includes('id="stopCohostSpeech"'), "The streamer should be able to stop the co-host immediately");
assert(cohost.includes('id="cohostOutputVolume"'), "The co-host voice should expose a volume control");
assert(cohost.includes('id="cohostOutputDevice"'), "OpenAI voice should expose an output-device selector when supported");
assert(cohost.includes("await this.remoteAudio.setSinkId"), "OpenAI voice should route to the selected OBS or system output");
assert(cohost.includes('type: "output_audio_buffer.clear"'), "Stop speaking should clear OpenAI WebRTC playout");
assert(cohost.includes("this.remoteAudio.pause()"), "Stop speaking should immediately pause local WebRTC audio");
assert(cohost.includes('lastEvent: wasManuallyStopped ? "response.done:stopped"'), "A manually interrupted OpenAI response should not be reported as an error");
assert(cohost.includes("max_output_tokens: 512"), "OpenAI Realtime replies should have a conservative output cap");
assert(cohost.includes("recordResponseUsage"), "OpenAI Realtime usage should be visible in diagnostics");
assert(cohost.includes('id="testCohostOverlay"'), "The co-host should expose an overlay test action");
assert(cohost.includes('const donation = cohostLiveChatHtmlToText(payload.hasDonation'), "Paid chat metadata should reach the co-host context");
assert(cohost.includes('image.getAttribute("alt")'), "Emote-only chat should preserve image alt text");
assert(!cohost.includes("COHOST_LIVE_CHAT_CONTEXT_BATCH_MS"), "Context-only chat must not grow server history on a timer");
assert(cohost.includes('source === "streamer_voice" || source === "streamer_text"'), "Only streamer prompts may expose side-effecting co-host tools");
assert(cohost.includes('tool_choice: responseTools.length ? "auto" : "none"'), "Untrusted Realtime turns must explicitly disable tool use");
assert(cohost.includes('name: "ssn_switch_obs_scene"'), "OpenAI Realtime should expose the allowlisted OBS scene tool");
assert(cohost.includes('name: "ssn_feature_recent_chat"'), "OpenAI Realtime should expose recent-chat featuring when permissioned");
assert(cohost.includes('type: "function_call_output"'), "Realtime tool results must be returned using the official function-call output item");
assert(cohost.includes('origin: "tool_result", allowTools: false'), "Tool-result continuations must not be able to invoke another tool");
assert(cohost.includes('if (mutationExecuted)'), "Only one stream-changing action may execute per trusted turn");
assert(cohost.includes('id="greetOnConnect"'), "Automatic greetings should be an explicit opt-in");
assert(/id="responses"[^>]*role="log"[^>]*aria-live="off"[^>]*aria-label="Co-host conversation"/.test(cohost), "Conversation output should expose accessible log semantics without duplicating audio responses");
assert(background.includes('"https://api.openai.com/v1/realtime/client_secrets"'), "The SSN background should mint short-lived Realtime client secrets");
assert(background.includes("settings?.chatgptApiKey?.textsetting"), "The broker should use the OpenAI key configured in the SSN background");
assert(background.includes('headers["OpenAI-Safety-Identifier"]'), "Realtime client secrets should be bound to a privacy-preserving safety identifier");
assert(background.includes('request.action === "openaiRealtimeClientSecret"'), "The private SSN bridge should expose the client-secret broker");
assert(background.includes("suppliedCapability !== expectedCapability"), "Hosted co-host token minting should require a capability from the popup link");
assert(background.includes("enforceOpenAIRealtimeMintRateLimit(UUID, suppliedCapability)"), "Hosted co-host token minting should be rate limited per peer and capability");
const directBrokerHandler = background.slice(background.indexOf('request.cmd && request.cmd === "createOpenAIRealtimeClientSecret"'), background.indexOf('request.cmd && request.cmd === "testLLMProvider"'));
const hostedBrokerHandler = background.slice(background.indexOf('request.action === "openaiRealtimeClientSecret"'), background.indexOf('request.action === "cohostTool"'));
assert(!directBrokerHandler.includes("settings.allowChatBot"), "Direct OpenAI Realtime must not require the legacy Private Chat Bot setting");
assert(!hostedBrokerHandler.includes("settings.allowChatBot"), "Capability-protected OpenAI Realtime must not require the legacy Private Chat Bot setting");
assert(background.includes("function assertOpenAIRealtimeBrokerAvailable()"), "OpenAI Realtime should still require the SSN service to be on");
assert(background.includes("function getCohostObsSceneAllowlist()"), "OBS co-host control should enforce an explicit scene allowlist");
assert(background.includes('tool === "featuredChat"'), "The guarded broker should handle featured-chat tools");
assert(background.includes("COHOST_CAPABILITY_LIFETIME_MS = 12 * 60 * 60 * 1000"), "Hosted co-host capabilities should expire");
assert(popup.includes('`#cohostauth=${encodeURIComponent(cohostAccessCapability)}`'), "The popup-generated co-host link should keep its private capability out of the query string");
assert(popup.includes('displayURL + "#private-cohost-access"'), "The popup must not visibly print the bearer capability");
assert(popup.includes('function getGeneratedLinkDisplayUrl(element, url)'), "Generated links should centralize capability redaction");
assert(popup.includes('value.replace(/#cohostauth=[^&\\s]*/i, "#private-cohost-access")'), "Cohost link text should redact the bearer capability");
assert(popup.includes('getGeneratedLinkDisplayUrl(cohostElement, cohostElement.raw)'), "AI overlay link updates must preserve cohost capability redaction");
assert(popup.includes('getGeneratedLinkDisplayUrl(linkElement, cleanedUrl)'), "Popup link cleanup must preserve cohost capability redaction");
assert(popup.includes('getGeneratedLinkDisplayUrl(divElement, cleanedUrl)'), "Popup link refresh must preserve cohost capability redaction");
const cohostCapabilityUrl = "https://socialstream.ninja/cohost.html?session=test#a=1&cohostauth=" + "a".repeat(64);
assert.strictEqual(
    getGeneratedLinkDisplayUrl({ id: "cohost" }, cohostCapabilityUrl),
    cohostCapabilityUrl,
    "Unrecognized fragments must remain unchanged"
);
const standardCohostCapabilityUrl = "https://socialstream.ninja/cohost.html?session=test#cohostauth=" + "a".repeat(64);
assert.strictEqual(
    getGeneratedLinkDisplayUrl({ id: "cohost" }, standardCohostCapabilityUrl),
    "https://socialstream.ninja/cohost.html?session=test#private-cohost-access",
    "Cohost link text must not expose the bearer capability"
);
assert.strictEqual(
    getGeneratedLinkDisplayUrl({ id: "dock" }, standardCohostCapabilityUrl),
    standardCohostCapabilityUrl,
    "Capability redaction must remain scoped to the cohost link"
);
assert(cohost.includes('sessionStorage.setItem("cohostAccessCapability", cohostBridgeCapability)'), "The hosted co-host should retain the fragment capability only for its tab session");
assert(cohost.includes("history.replaceState"), "The hosted co-host should scrub the capability from the address bar");
assert(background.includes('request.cmd === "createOpenAIRealtimeClientSecret"'), "Extension/Desktop pages should be able to request a client secret directly");
assert(guide.includes("Microphone and AI voice audio then travel over WebRTC"), "The AI guide should explain native OpenAI voice transport");
assert(guide.includes("standard key stays in the SSN extension/Desktop background"), "The AI guide should explain secure Realtime key handling");

console.log("OpenAI Realtime co-host contract passed.");
