const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      window.__runtimeRequests = [];
      window.__fetchRequests = [];
      window.__dataChannelMessages = [];
	  window.__replaceTrackCount = 0;

      const runtime = {
        id: "test-extension",
        lastError: null,
        sendMessage(request, callback) {
          window.__runtimeRequests.push(request);
          callback({
            success: true,
            clientSecret: {
              value: "ek_test_short_lived",
              expires_at: Date.now() + 60000,
              model: request.model || "gpt-realtime-2.1"
            }
          });
        }
      };
      window.chrome = window.chrome || {};
      window.chrome.runtime = runtime;

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (url, options) => {
        if (String(url) === "https://api.openai.com/v1/realtime/calls") {
          window.__fetchRequests.push({
            url: String(url),
            authorization: options && options.headers && options.headers.Authorization,
            contentType: options && options.headers && options.headers["Content-Type"],
            body: options && options.body
          });
          return { ok: true, status: 200, text: async () => "fake-answer-sdp" };
        }
        return originalFetch(url, options);
      };

      class FakeDataChannel {
        constructor() {
          this.readyState = "connecting";
          this.bufferedAmount = 0;
          this.onopen = null;
          this.onmessage = null;
          this.onerror = null;
          this.onclose = null;
		  window.__testDataChannel = this;
        }
        send(value) {
          const event = JSON.parse(value);
          window.__dataChannelMessages.push(event);
          if (event.type === "session.update") {
            setTimeout(() => {
              if (this.onmessage) this.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
            }, 0);
          }
		  if (event.type === "response.cancel") {
			setTimeout(() => {
			  if (this.onmessage) this.onmessage({ data: JSON.stringify({ type: "response.output_audio_transcript.delta", delta: "late text" }) });
			}, 50);
			setTimeout(() => {
			  if (this.onmessage) this.onmessage({ data: JSON.stringify({
				type: "response.done",
				response: { id: "response-test", status: "incomplete", status_details: { reason: "client_cancelled" } }
			  }) });
			}, 5200);
		  }
        }
        close() {
          this.readyState = "closed";
          if (this.onclose) this.onclose();
        }
      }

      class FakePeerConnection {
        constructor() {
          this.connectionState = "new";
          this.iceConnectionState = "new";
          this.ontrack = null;
          this.onconnectionstatechange = null;
          this.oniceconnectionstatechange = null;
          this.senders = [];
          this.channel = null;
        }
        createDataChannel() {
          this.channel = new FakeDataChannel();
          return this.channel;
        }
        addTrack(track) {
          const sender = {
            track,
			replaceTrack: async replacement => {
			  sender.track = replacement;
			  window.__replaceTrackCount += 1;
			}
          };
          this.senders.push(sender);
          return sender;
        }
        getSenders() {
          return this.senders;
        }
        async createOffer() {
          return { type: "offer", sdp: "fake-offer-sdp" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          this.connectionState = "connected";
          if (this.onconnectionstatechange) this.onconnectionstatechange();
          this.channel.readyState = "open";
          if (this.channel.onopen) this.channel.onopen();
        }
        close() {
          this.connectionState = "closed";
        }
      }
      window.RTCPeerConnection = FakePeerConnection;

      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const oscillator = audioContext.createOscillator();
      oscillator.connect(destination);
      oscillator.start();
      window.__testMicrophoneStream = destination.stream;
	  const screenCanvas = document.createElement("canvas");
	  screenCanvas.width = 640;
	  screenCanvas.height = 360;
	  const screenContext = screenCanvas.getContext("2d");
	  screenContext.fillStyle = "#112233";
	  screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
	  screenContext.fillStyle = "#ffffff";
	  screenContext.font = "24px sans-serif";
	  screenContext.fillText("OpenAI screen-share test", 30, 60);
	  window.__testScreenStream = screenCanvas.captureStream(1);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
		  enumerateDevices: async () => [
			{ kind: "audioinput", deviceId: "test-mic", label: "Test microphone" },
			{ kind: "audioinput", deviceId: "test-mic-2", label: "Second test microphone" }
          ],
          getUserMedia: async () => window.__testMicrophoneStream.clone(),
		  getDisplayMedia: async () => window.__testScreenStream.clone(),
          addEventListener() {}
        }
      });
    });

    const url = pathToFileURL(path.resolve(__dirname, "..", "cohost.html")).href;
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById("providerSelect"));
    await page.selectOption("#providerSelect", "chatgpt");
	await page.waitForFunction(() => Array.from(document.getElementById("videoSource").options).some(option => option.value === "screen"));
	assert.strictEqual(await page.$eval("#videoSource", select => select.disabled), false);
	assert.strictEqual(await page.inputValue("#videoSource"), "none", "OpenAI visual input should be off by default");
    await page.selectOption("#openaiRealtimeModel", "gpt-realtime-2.1-mini");
    await page.selectOption("#openaiRealtimeReasoning", "low");
    await page.selectOption("#openaiRealtimeVadEagerness", "high");
    await page.selectOption("#audioSource", "test-mic");
    await page.click("#startButton");
    await page.waitForFunction(() => document.getElementById("startButton").textContent.trim() === "Stop Co-host");

    const running = await page.evaluate(() => ({
      runtimeRequests: window.__runtimeRequests,
      fetchRequests: window.__fetchRequests,
      dataChannelMessages: window.__dataChannelMessages,
      keyValue: document.getElementById("apiKey").value,
      status: document.getElementById("startButton").textContent.trim()
    }));
    assert.strictEqual(running.runtimeRequests[0].cmd, "createOpenAIRealtimeClientSecret");
    assert.strictEqual(running.runtimeRequests[0].model, "gpt-realtime-2.1-mini");
    assert.strictEqual(running.runtimeRequests[0].reasoningEffort, "low");
    assert.strictEqual(running.runtimeRequests[0].vadEagerness, "high");
    assert.strictEqual(running.fetchRequests[0].authorization, "Bearer ek_test_short_lived");
    assert.strictEqual(running.fetchRequests[0].contentType, "application/sdp");
    assert.strictEqual(running.fetchRequests[0].body, "fake-offer-sdp");
    assert(running.dataChannelMessages.some(event => event.type === "session.update"));
    const initialSessionUpdate = running.dataChannelMessages.find(event => event.type === "session.update");
    assert.strictEqual(initialSessionUpdate.session.reasoning.effort, "low");
    assert.strictEqual(initialSessionUpdate.session.audio.input.transcription.model, "gpt-4o-mini-transcribe");
    assert.strictEqual(initialSessionUpdate.session.audio.input.turn_detection.eagerness, "high");
    assert.strictEqual(running.keyValue, "");
    assert.strictEqual(running.status, "Stop Co-host");

	await page.click("#muteAudio");
	const mutedOutput = await page.evaluate(() => {
	  const remoteAudio = document.querySelector('audio[aria-hidden="true"]');
	  const button = document.getElementById("muteAudio");
	  return {
		muted: remoteAudio ? remoteAudio.muted : null,
		pressed: button.getAttribute("aria-pressed"),
		label: button.getAttribute("aria-label")
	  };
	});
	assert.deepStrictEqual(mutedOutput, { muted: true, pressed: "true", label: "Mute co-host voice" });
	await page.locator("#cohostOutputVolume").fill("25");
	assert.strictEqual(await page.$eval('audio[aria-hidden="true"]', audio => audio.volume), 0.25);
	await page.click("#muteAudio");
	assert.strictEqual(await page.$eval('audio[aria-hidden="true"]', audio => audio.muted), false);

	const tokenRequestsBeforeLiveTuning = await page.evaluate(() => window.__runtimeRequests.filter(request => request.cmd === "createOpenAIRealtimeClientSecret").length);
	await page.selectOption("#openaiRealtimeReasoning", "minimal");
	await page.selectOption("#openaiRealtimeVadEagerness", "auto");
	await page.waitForFunction(() => window.__dataChannelMessages.some(event => event.type === "session.update" && event.session.reasoning && event.session.reasoning.effort === "minimal" && event.session.audio.input.turn_detection.eagerness === "auto"));
	assert.strictEqual(await page.evaluate(() => window.__runtimeRequests.filter(request => request.cmd === "createOpenAIRealtimeClientSecret").length), tokenRequestsBeforeLiveTuning, "Reasoning and VAD changes should apply without reconnecting");

	await page.evaluate(() => {
	  window.__testDataChannel.onmessage({ data: JSON.stringify({ type: "response.created", response: { id: "response-test" } }) });
	});
	await page.click("#stopCohostSpeech");
	await page.waitForFunction(() => document.getElementById("diagEvent").textContent === "response.done:stopped");
	const stoppedResponse = await page.evaluate(() => ({
	  state: document.getElementById("diagState").textContent,
	  error: document.getElementById("diagError").textContent,
	  voice: document.getElementById("voiceStatusLine").textContent,
	  events: window.__dataChannelMessages.map(event => event.type)
	}));
	assert.strictEqual(stoppedResponse.state, "connected");
	assert.strictEqual(stoppedResponse.error, "-");
	assert(stoppedResponse.voice.includes("Stopped by streamer"));
	assert(stoppedResponse.events.includes("response.cancel"));
	assert(stoppedResponse.events.includes("output_audio_buffer.clear"));

	await page.selectOption("#audioSource", "test-mic-2");
	await page.waitForFunction(() => window.__replaceTrackCount > 0);

	const visualEventStart = await page.evaluate(() => window.__dataChannelMessages.length);
	await page.selectOption("#videoSource", "screen");
	await page.waitForFunction(() => {
	  const preview = document.getElementById("preview");
	  return preview && preview.readyState >= 2 && preview.videoWidth > 0;
	});
	await page.fill(".message-input", "Remember the reconnect codeword ORCHID.");
	await page.click("#sendButton");
	await page.waitForFunction(() => window.__dataChannelMessages.some(event => event.type === "response.create" && event.response && event.response.metadata && event.response.metadata.ssn_source === "streamer_text"));
	const visualItem = await page.evaluate(start => window.__dataChannelMessages.slice(start).find(event => event.type === "conversation.item.create" && event.item && String(event.item.id || "").startsWith("cohost_visual_")), visualEventStart);
	assert(visualItem, "An opted-in OpenAI direct turn should include a visual context item");
	assert.strictEqual(visualItem.item.content[1].type, "input_image");
	assert.strictEqual(visualItem.item.content[1].detail, "auto");
	assert.match(visualItem.item.content[1].image_url, /^data:image\/jpeg;base64,/);
	await page.evaluate(() => {
	  window.__testDataChannel.onmessage({ data: JSON.stringify({ type: "response.created", response: { id: "continuity-response", metadata: { ssn_source: "streamer_text" } } }) });
	  window.__testDataChannel.onmessage({ data: JSON.stringify({
		type: "response.done",
		response: {
		  id: "continuity-response",
		  status: "completed",
		  metadata: { ssn_source: "streamer_text" },
		  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "I will remember ORCHID." }] }]
		}
	  }) });
	});
	await page.waitForFunction(() => document.getElementById("openaiRealtimeContinuitySummary").textContent.includes("2 recent messages"));

	const tokenRequestsBeforeRecovery = await page.evaluate(() => window.__runtimeRequests.filter(request => request.cmd === "createOpenAIRealtimeClientSecret").length);
	const recoveryEventStart = await page.evaluate(() => window.__dataChannelMessages.length);
	await page.evaluate(() => window.__testDataChannel.onerror());
	await page.waitForFunction(expected => window.__runtimeRequests.filter(request => request.cmd === "createOpenAIRealtimeClientSecret").length > expected, tokenRequestsBeforeRecovery);
	await page.waitForFunction(() => document.getElementById("diagEvent").textContent === "reconnect.success.memory.restored:2");
	assert.strictEqual(await page.$eval("#startButton", button => button.textContent.trim()), "Stop Co-host");
	const restoredConversation = await page.evaluate(start => window.__dataChannelMessages.slice(start).filter(event => event.type === "conversation.item.create").map(event => event.item), recoveryEventStart);
	assert.deepStrictEqual(restoredConversation.map(item => item.role), ["user", "assistant"]);
	assert.strictEqual(restoredConversation[0].content[0].type, "input_text");
	assert.strictEqual(restoredConversation[0].content[0].text, "Remember the reconnect codeword ORCHID.");
	assert.strictEqual(restoredConversation[1].content[0].type, "output_text");
	assert.strictEqual(restoredConversation[1].content[0].text, "I will remember ORCHID.");

	const contextEventStart = await page.evaluate(() => {
	  handleCohostLiveChatPayload({ id: "context-test", chatname: "Test Viewer", chatmessage: "The chat code word is ORCHID.", type: "youtube" });
	  return window.__dataChannelMessages.length;
	});
	await page.fill(".message-input", "Give me a very short latency test.");
	await page.click("#sendButton");
	await page.waitForFunction(start => window.__dataChannelMessages.slice(start).some(event => event.type === "response.create" && event.response && event.response.metadata && event.response.metadata.ssn_source === "streamer_text"), contextEventStart);
	await page.evaluate(() => {
	  window.__testDataChannel.onmessage({ data: JSON.stringify({ type: "response.created", response: { id: "latency-response", metadata: { ssn_source: "streamer_text" } } }) });
	  setTimeout(() => window.__testDataChannel.onmessage({ data: JSON.stringify({ type: "response.output_audio.delta", item_id: "latency-item", content_index: 0, delta: "AAAA" }) }), 25);
	  setTimeout(() => window.__testDataChannel.onmessage({ data: JSON.stringify({ type: "response.done", response: { id: "latency-response", status: "completed" } }) }), 40);
	});
	await page.waitForFunction(() => document.getElementById("diagLatency").textContent.includes("audio"));
	await page.waitForFunction(start => window.__dataChannelMessages.slice(start).some(event => event.type === "conversation.item.delete"), contextEventStart);
	const contextOrdering = await page.evaluate(start => {
	  const events = window.__dataChannelMessages.slice(start);
	  return {
		context: events.findIndex(event => event.type === "conversation.item.create" && event.item && String(event.item.id || "").startsWith("cohost_context_")),
		prompt: events.findIndex(event => event.type === "conversation.item.create" && event.item && event.item.content && event.item.content.some(part => part.text === "Give me a very short latency test.")),
		response: events.findIndex(event => event.type === "response.create"),
		deleted: events.some(event => event.type === "conversation.item.delete")
	  };
	}, contextEventStart);
	assert(contextOrdering.context >= 0 && contextOrdering.context < contextOrdering.prompt && contextOrdering.prompt < contextOrdering.response, "Recent live chat should be ordered before the streamer prompt and response request");
	assert.strictEqual(contextOrdering.deleted, true, "Temporary live-chat context should be removed after the response");

    await page.click("#startButton");
    await page.waitForFunction(() => document.getElementById("startButton").textContent.trim() === "Start Co-host");
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
  console.log("OpenAI WebRTC co-host UI passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
