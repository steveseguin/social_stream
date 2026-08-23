const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "cohost.html")).href);
    const result = await page.evaluate(async () => {
      document.getElementById("cohostSessionSpotify").checked = true;
      document.getElementById("cohostSessionObs").checked = true;
      document.getElementById("cohostSessionFeaturedChat").checked = true;

      function createMock(sent) {
        const mock = Object.create(RealtimePublisher.prototype);
        Object.assign(mock, {
          provider: "chatgpt",
          cohostToolStatus: {
            tools: {
              spotify: { available: true },
              obs: { available: true, scenes: ["Main", "BRB"] },
              featuredChat: { available: true }
            }
          },
          ws: { readyState: WebSocket.OPEN, send: value => sent.push(JSON.parse(value)) },
          sessionConfigured: true,
          responseActive: false,
          currentResponseText: "",
          manualResponseStopPending: false,
          eventCounter: 0,
          responseTimeout: null,
          responseCancelTimeout: null,
          pendingResponseOrigins: [],
          processedToolCallIds: new Set(),
          toolContinuationDepth: 0,
          activeResponseOrigin: "",
          contextItemIds: [],
          currentAssistantItemId: "",
          currentAssistantAudioStartedAt: 0
        });
        return mock;
      }

      const sent = [];
      const mock = createMock(sent);
      mock.createResponse({ origin: "viewer_chat", allowTools: false });
      clearTimeout(mock.responseTimeout);
      mock.responseActive = false;
      mock.createResponse({ origin: "streamer_text", allowTools: true });
      clearTimeout(mock.responseTimeout);

      const toolEvents = [];
      const toolMock = createMock(toolEvents);
      await toolMock.handleCohostFunctionCalls({
        output: [{ type: "function_call", call_id: "viewer-call", name: "ssn_switch_obs_scene", arguments: '{"scene_name":"Main"}' }]
      }, "viewer_chat");
      clearTimeout(toolMock.responseTimeout);

      return {
        viewerResponse: sent[0].response,
        streamerResponse: sent[1].response,
        viewerToolOutput: JSON.parse(toolEvents[0].item.output),
        viewerContinuation: toolEvents[1].response
      };
    });

    assert.strictEqual(result.viewerResponse.tool_choice, "none");
    assert.deepStrictEqual(result.viewerResponse.tools, []);
    assert.strictEqual(result.streamerResponse.tool_choice, "auto");
    assert.deepStrictEqual(result.streamerResponse.tools.map(tool => tool.name), [
      "ssn_spotify_control",
      "ssn_switch_obs_scene",
      "ssn_feature_recent_chat",
      "ssn_clear_featured_chat"
    ]);
    assert.deepStrictEqual(result.streamerResponse.tools[1].parameters.properties.scene_name.enum, ["Main", "BRB"]);
    assert.strictEqual(result.viewerToolOutput.success, false);
    assert.match(result.viewerToolOutput.message, /direct streamer request/);
    assert.strictEqual(result.viewerContinuation.tool_choice, "none");
    assert.deepStrictEqual(result.viewerContinuation.tools, []);
  } finally {
    await browser.close();
  }
  console.log("Co-host stream tools UI passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
