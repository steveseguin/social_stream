

(() => {
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
   * @param {*} data 
   * @returns {string}
   */
  function normalizeToString(data) {
    if (typeof data === "string") return data;
    try {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        return new TextDecoder().decode(data);
      }
      return typeof data === "object" ? JSON.stringify(data) : String(data);
    } catch (e) {
      return String(data);
    }
  }

  const OriginalWS = window.WebSocket;
  /**
   * Prevent site scripts from overwriting and intercepting window.postMessage
   * @type {typeof window.postMessage}
   */
  const _postMessage = window.postMessage.bind(window);
  /**
   * 
   * @param {WSEventPayload} data 
   * @returns 
   */
  const postMessage = (data) => _postMessage({
    ...data,
    source: "whatnot-ws-interceptor"
  }, window.location.origin);
  let exited = false;
  /**
   * Safely executes a callback, handling extension context invalidation. Will not execute if already exited.
   * @param {() => any} cb The callback to attempt to execute
   * @param {() => any} onExit Executed when the extension context is invalidated
   */
  async function safely(cb, onExit) {
    if (exited) return;
    try {
      return await cb();
    } catch (e) {
      if (e instanceof Error && e.message === "Extension context invalidated.") {
        return onExit();
      }

      throw e;
    }
  }

  window.WebSocket = function (/** @type {string | URL} */ url, /** @type {string | string[] | undefined} */ protocols) {
    const ws = new OriginalWS(url, protocols);

    let tUrl = typeof url === "string" ? url : url.href;
    if (tUrl.startsWith("wss://www.whatnot.com/")) {
      /**
       * @type {typeof WebSocket.prototype.send}
       * @this {WebSocket}
       */
      function wsSend(data) {
        OriginalWS.prototype.send.call(this, data);
        safely(() => postMessage({
          type: WSEventType.SEND,
          data: normalizeToString(data)
        }), cleanUp);
      };

      /**
       * @param {MessageEvent} event 
       */
      function onMessage(event) {
        console.log("Received message:", event.data);
        safely(() => postMessage({
          type: WSEventType.RECEIVE,
          data: normalizeToString(event.data)
        }), cleanUp);
      }
      ws.send = wsSend;
      ws.addEventListener("message", onMessage);

      function cleanUp() {
        if (exited) return;
        ws.send = OriginalWS.prototype.send.bind(ws);
        ws.removeEventListener("message", onMessage);
        window.WebSocket = OriginalWS;
        exited = true;
        console.log("Cleaned up WebSocket interception");
      }
    }

    return ws;
  };

  for (const prop in OriginalWS) {
    window.WebSocket[prop] = OriginalWS[prop];
  }

  console.log("WebSocket interception script loaded");
})();