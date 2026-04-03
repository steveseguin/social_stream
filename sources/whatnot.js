let usingElectron = false;
(() => {
  console.log("Initializing Whatnot source");
  const badgeIcons = {
    BRONZE: "icons/whatnot_badge_01.svg",
    SILVER: "icons/whatnot_badge_02.svg",
    GOLD: "icons/whatnot_badge_03.svg",
    PLATINUM: "icons/whatnot_badge_04.svg",
    DIAMOND: "icons/whatnot_badge_05.svg",
  };


  /**
   * @typedef {{ type: typeof WSEventType.RECEIVE | typeof WSEventType.SEND, data: string }} WSEventPayload
   */

  const WSEventType = /** @type {const} */ ({
    /** When a message is received from the Whatnot WS */
    RECEIVE: "receive",
    /** When a message is sent through the Whatnot WS */
    SEND: "send"
  });

  /**
   * Ensures that the given data is a string.
   * @param {string|ArrayBuffer|ArrayBufferView} data 
   * @returns {string}
   */
  function normalizeToString(data) {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return new TextDecoder().decode(data);
    }
    throw new Error("Unsupported data type");
    //return String(data);
  }

  /**
   * Checks that the runtime environment is available and functional.
   * @returns {boolean}
   */
  function checkRuntime() {
    if (usingElectron) return true;
    if (!chrome?.runtime?.id) return false;
    if (chrome.runtime.lastError) return false;

    return true;
  }
  const isElectron = window.ninjafy !== undefined || !!(typeof process !== "undefined" && process.versions?.electron);
  console.log("Detected environment:", isElectron ? "Electron (ninjafy)" : "Web (injected WS)");
  //const isElectron = false;
  if (isElectron) {
    setupElectron();
  } else {
    injectWebSocketInterceptor();
    setupWeb();
  }

  /**
   * 
   * @param {number} ms Time in milliseconds to sleep
   * @returns {Promise<void>}
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  /**
   * Intercepts WS connections via ninjafy
   * @returns {Promise<void>}
   */
  async function setupElectron() {
    console.log("Checking for ninjafy WebSocket interception:", !!window.ninjafy?.onWebSocketMessage);
    for (let i = 0; i < 20 && !window.ninjafy?.onWebSocketMessage; i++) {
      await sleep(100);
    }

    if (!window.ninjafy?.onWebSocketMessage) {
      console.log("Failed to set up ninjafy WebSocket interception. Forcing WS injection.");

      //TODO: Add sources/inject/whatnot-ws.js into web_accessible_resources for Electron
      await injectWebSocketInterceptor();

      return setupWeb();
    }

    console.log("Setting up ninjafy WebSocket interception");
    usingElectron = true;

    const handler = createMessageHandler(cleanUp);
    // Currently no cleanup mechanism for ninjafy
    function cleanUp() { }

    const NinjafyPayloadType = /** @type {const} */ ({
      SEND: "send",
      RECEIVE: "message",
      OPEN: "open",
      CLOSE: "close",
    });


    const NinjafyPayloadTypeToWSEventTypeMap = /** @satisfies {Record<(typeof NinjafyPayloadType)[keyof typeof NinjafyPayloadType], typeof WSEventType[keyof typeof WSEventType]>} */ ({
      [NinjafyPayloadType.SEND]: WSEventType.SEND,
      [NinjafyPayloadType.RECEIVE]: WSEventType.RECEIVE,
    });

    /**
     * @typedef {Object} NinjafyPayload
     * @property {string | ArrayBuffer | ArrayBufferView} data - The raw WebSocket message data, either as a string or binary.
     * @property {NinjafyPayloadType} type - The type of WebSocket event.
     * @property {string} url - The URL of the WebSocket connection.
     * @property {number} timestamp - The timestamp when the event occurred.
     */
    window.ninjafy.onWebSocketMessage((/** @type {NinjafyPayload} */ payload) => {
      const type = NinjafyPayloadTypeToWSEventTypeMap[payload.type];
      if (type === undefined) return;
      try {
        handler({
          type,
          data: normalizeToString(payload.data),
        });
      } catch (e) {
        console.log("Failed to process ninjafy WS message:", e);
      }
    });

    console.log("Ninjafy WebSocket interception set up successfully");
  }

  async function injectWebSocketInterceptor() {
    if (typeof runWS === "function") {
      console.log("Running WebSocket interceptor in page context");
      return runWS();
    }

    console.log("Injecting WebSocket interceptor script into page context");
    return await chrome.runtime.sendMessage({ type: "injectCustomSource", source: "inject/whatnot-ws.js" });
  }

  /**
   * @typedef {Object} Money
   * @property {number} amount - The amount of money in cents (e.g., 500 for $5.00).
   * @property {string} currency - The ISO 4217 currency code (e.g., "USD", "EUR").
   */

  /**
   * @param {Money} money 
   * @param {number} [magnitude=0.01] - The factor to convert the amount to standard units (e.g., 0.01 to convert cents to dollars).
   * @returns {string}
   */
  function formatMoney({ amount, currency }, magnitude = 0.01) {
    const formattedAmount = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount * magnitude);

    return `${formattedAmount} ${currency}`;
  }

  /**
   * 
   * @param {(...args: any[]) => void} cleanUp 
   * @returns {(wsEvent: WSEventPayload) => void}
   */
  function createMessageHandler(cleanUp) {
    return async function onMessage(wsEvent) {
      if (!checkRuntime()) return cleanUp();
      if (!isIncomingPayload(wsEvent)) return;

      // Handle the incoming message from the page
      //console.log("Received posted message:", wsEvent);
      // Only handle incoming messages for now
      if (wsEvent.type !== WSEventType.RECEIVE) return console.log("Not receive type");

      // Parse Phoenix WS message
      const parsedArray = JSON.parse(wsEvent.data);

      // Must be a properly sized array
      if (!Array.isArray(parsedArray) || parsedArray.length < 5) return;

      const [eventId, _, wsChannel, eventType, payload] = parsedArray;

      switch (eventType) {
        case "raid_selected": {
          return await createAndPushMessage({
            chatname: payload.fromUser.username,
            chatmessage: "has started a raid",
          }, payload.fromUser);
        }

        case "has_been_raided": {
          return await createAndPushMessage({
            chatname: payload.fromUser.username,
            chatmessage: `is raiding with a party of ${payload.numRaiders}`,
            event: "raid",
          }, payload.fromUser);
        }

        case "new_msg": {
          // Booster message "Ads Community Boost"
          // {amount: number (cents), currency: string}
          if (payload.properties.adscb) {
            return createAndPushMessage({
              chatname: payload.user.username,
              chatmessage: payload.message,
              event: "boost",
              hasDonation: formatMoney(payload.properties.adscb),
            });
          }

          return await createAndPushMessage({
            chatname: payload.user.username,
            chatmessage: payload.message,
          }, payload.user);
        }

        case "tip_sent": {
          return await createAndPushMessage({
            event: "donation",
            hasDonation: formatMoney(payload.tip.tipValue, payload.tip.magnitude),
            donoValue: payload.tip.tipValue * (payload.tip.magnitude || 0.01),

          }, payload.tip.senderUser);
        }

        case "presence_diff": {
          const joins = payload.joins[wsChannel]?.metas;

          // Likely only contains leaves
          if (!Array.isArray(joins)) return;

          if (!settings.capturejoinedevents) return;
          for (const join of joins) {
            await createAndPushMessage({
              chatname: join.username,
              chatmessage: "has joined the stream",
              event: "join",
            }, join);
          }
        }
      }
    };
  }

  /**
   * Intercepts WS connections by script injections
   */
  function setupWeb() {
    const handler = createMessageHandler(cleanUp);
    const onMessage = (/** @type {MessageEvent<WSEventPayload>} */ event) => handler(event.data);

    function cleanUp() {
      window.removeEventListener("message", onMessage);
      console.log("Cleaned up injected script message listener");
    }

    window.addEventListener("message", onMessage);
  }
  /**
   * 
   * @param {any} data 
   * @returns {data is WSEventPayload}
   */
  function isIncomingPayload(data) {
    if (typeof data !== "object" || data === null) return false;
    if (typeof data.data !== "string") return false;
    switch (data.type) {
      case WSEventType.RECEIVE:
      case WSEventType.SEND:
        return true;

      default:
        return false;
    }
  }


  /**
   * @typedef {Object} BadgeDescriptor
   * @property {string} [type] The system identifier or category of the badge (e.g., "moderator", "vip").
   * @property {string} [text] The hover tooltip or alt text describing the badge.
   * @property {string} [src] The URL of the badge image.
   */

  /**
   * @typedef {Object} SourceEventData
   * @property {string} chatname Display name that will be rendered in overlays.
   * @property {(string | BadgeDescriptor)[]} [chatbadges=[]] Badge icons shown beside the author. Strings are image URLs; `BadgeDescriptor` objects can include `{ type, text, src }` for richer badges.
   * @property {string} [backgroundColor] Overrides the background color for highlighted message cards.
   * @property {string} [textColor] Overrides the rendered message text color.
   * @property {string} [nameColor] Overrides the rendered display-name color.
   * @property {string} [chatmessage] Message body; can contain sanitized HTML/emote markup when `textonly` is false.
   * @property {string} [chatimg] Author avatar. Absolute URLs preferred; legacy data URIs remain supported.
   * @property {string} [hasDonation] Donation amount with units, e.g., "3 roses" or "$50 USD".
   * @property {number} [donoValue] Numeric donation value in standard currency units (e.g., `5` for $5.00), used for integrations that consume raw donation totals.
   * @property {string} [membership] Short description of a membership/subscription state or label (e.g., "Member" or "Tier 3 Upgrade").
   * @property {string} [contentimg] Optional media attachment for the message (image/gif/mp4/webm).
   * @property {string} type Primary source identifier such as `twitch`, `youtube`, `kick`.
   * @property {string|false} [event=false] Identifies structured events ("follow", "raid", etc.) or false/omitted when the message is standard chat.
   * @property {string} [sourceImg] Optional alternate icon representing a sub-source (ex: channel avatar, Restream origin). 
   * @property {string} [sourceName] Channel title, profile name, or host identifier associated with the source feed.
   * @property {boolean} [textonly] Indicates whether `chatmessage` should be treated as plain text (`true`) or may contain markup (`false`).
   * @property {string} [title] Display title for donations or other highlighted events.
   * @property {string} [subtitle] Additional detail for memberships or donations.
   * @property {boolean} [moderator] Marks the author as a moderator for the source platform.
   * @property {boolean} [admin] Flags elevated/privileged accounts.
   * @property {boolean} [bot] Flags automated or host-generated messages.
   * @property {boolean} [question] Indicates the message has been classified as a question.
   * @property {string} [userid] Stable user identifier from the source platform.
   * @property {number} [karma] Sentiment score; `1.0` positive, `0.0` negative. Provided by AI heuristics when available.
   * @property {number} [id] Internal message identifier assigned by SSN for de-duplication/routing.
   * @property {boolean} [private] Marks direct/private messages that should not be surfaced publicly by default.
   * @property {object} [meta] Extra structured data that doesn't fit elsewhere (viewer counts, membership details, `eventTypeMapping`, etc.).
   */

  /**
   * @param {Omit<SourceEventData, "type" | "question" | "chatname" | "membership" | "userid"> & { chatname?: string }} data
   * @param {any} [user]
   * @returns {Promise<void>}
   */
  async function createAndPushMessage(data, user) {
    /** @type {SourceEventData & {chatbadges: BadgeDescriptor[]}} */
    const message = {
      chatname: user?.username,
      userid: user?.id,
      question: !data.event && data.chatmessage?.includes("?"),
      chatimg: user?.profileImage?.url ?? generateDefaultAvatar(user.username),
      chatbadges: [],
      // Stream moderators (appointed by host)
      moderator: user?.isNominatedModerator,
      // Whatnot employees
      admin: user?.isModerator || user?.isEmployee,
      ...data,
      type: "whatnot",
    };
    if (user?.loyaltyVisibilityStatusEnabled && user.loyaltyTierForSeller && user.loyaltyTierForSeller !== "NO_TIER") {
      message.membership = user.loyaltyTierForSeller;
      if (badgeIcons[user.loyaltyTierForSeller]) {
        message.chatbadges.push({
          type: "loyalty",
          text: user.loyaltyTierForSeller,
          src: badgeIcons[user.loyaltyTierForSeller],
        });
      }
    }


    console.log("Pushing message", message);
    await sendMessage(message);
  }

  /**
   * 
   * @param {any} data
   * @returns {Promise<any>} 
   */
  async function sendMessage(data) {
    try {
      return await chrome.runtime.sendMessage({ message: data });
    } catch (e) {
      console.log(e);
    }
  }
  /**
   * @typedef {Object} ExtensionSettings
   * @property {boolean} [bttv] - Whether BTTV emotes are enabled.
   * @property {boolean} [seventv] - Whether 7TV emotes are enabled.
   * @property {boolean} [ffz] - Whether FFZ emotes are enabled.
   * @property {boolean} [delayyoutube] - Whether to delay YouTube capture.
   * @property {boolean} [youtubeLargerFont] - Whether to apply a larger font on YouTube.
   * @property {boolean} [textonlymode] - Whether text-only mode is enabled.
   * @property {boolean} [captureevents] - Whether to capture events.
   * @property {boolean} [capturejoinedevents] - Whether to capture joined events.
   */
  /**
   * @typedef {Object} GetSettingsResponse
   * @property {boolean} state - The current on/off state of the extension.
   * @property {string} [streamID] - The stream ID for WebRTC/transport connection.
   * @property {string} [password] - The password for WebRTC/transport connection.
   * @property {ExtensionSettings} [settings] - The current configuration settings of the extension.
   * @property {any} [documents] - RAG documents if generated/available.
   * @property {any} [handleStatus] - A snapshot of current UI/handle states.
   */
  /**
   * Requests the current settings from the extension.
   * @returns {Promise<GetSettingsResponse?>} A promise that resolves with the settings response from the extension.
   */
  async function requestSettings() {
    if (!checkRuntime()) return null;

    try {
      return await sendMessage({ "getSettings": true });
    } catch (e) {
      return null;
    }
  }

  /** @type {ExtensionSettings} */
  let settings = {};
  requestSettings().then(response => {
    if (response?.settings && typeof response.settings === "object") {
      settings = response.settings;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request === "getSource") return sendResponse("whatnot");
      if (request === "focusChat") {
        /** @type {HTMLInputElement?} */
        const chatInput = document.querySelector("input.chatInput")
          // New design, currently used when a user that isn't the host is viewing the stream
          || document.querySelector("input[data-testid='chat-input']");

        if (!chatInput) return sendResponse(false);
        try {
          chatInput.focus();
        } catch (e) {
          return sendResponse(false);
        }

        return sendResponse(true);
      }
      if (typeof request?.settings === "object") {
        settings = request.settings;
        return sendResponse(true);
      }
    } catch (e) { }

    return sendResponse(true);
  });

  /**
 * Generates a default avatar html string based on the given username as Whatnot would display it.
 * @param {string} username 
 * @returns {string} A html string representing the default avatar for the given username.
 */
  function generateDefaultAvatarHTML(username) {
    if (!username) return "";
    const initial = username[0].toUpperCase();

    // Whatnot typical hex colors for default avatars
    const bgColors = [
      '#F2994A', '#F2C94C', '#F2C94C', '#27AE60', '#2F80ED',
      '#56CCF2', '#2D9CDB', '#9B51E0', '#BB6BD9', '#EB5757'
    ];

    // Determine color based on simple character code sum
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash += username.charCodeAt(i);
    }
    const color = bgColors[hash % bgColors.length];

    return `<div style="
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: ${color};
      color: white;
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 50%;
    ">
    <span>${initial}</span>
  </div>`;
  }


  /**
   * Generates a data URI for a default avatar based on the given username, using the same method as Whatnot for default avatars.
   * @param {string} username 
   * @returns {string} A data URI representing the default avatar for the given username.
   */
  function generateDefaultAvatar(username) {
    const html = generateDefaultAvatarHTML(username);
    const encoded = Buffer.from(html).toString('base64');
    return `data:text/html;base64,${encoded}`;
  }
})();