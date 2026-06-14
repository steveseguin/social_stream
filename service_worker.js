// serviceworker.js
// this service worker is part of a chrome manifest v3 script
// service workers can only stay active a few minutes at a time before being forced closed by the browser
// local variables will lose their state with each service worker restart, which needs to be considered when updating this code

let backgroundPageTabId = null;
let backgroundPageTabIdLoaded = false;
let messageQueue = [];
let lastBackgroundRecoveryNotification = 0;

const BACKGROUND_RECOVERY_NOTIFICATION_COOLDOWN = 60000;

async function updateIconToOn() {
  if (chrome.action && chrome.action.setIcon) {
   // await chrome.action.setIcon({ path: "/icons/on.png" });
  }
}

async function updateIconToOff() {
  if (chrome.action && chrome.action.setIcon) {
    await chrome.action.setIcon({ path: "/icons/off.png" });
  }
}

function log(msg, msg2 = "") {
  //console.log(msg, msg2);
}

function getStorageValue(area, keys) {
  return new Promise((resolve) => {
    try {
      area.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      resolve({});
    }
  });
}

async function getStoredExtensionState() {
  const syncItem = await getStorageValue(chrome.storage.sync, ["state"]);
  if (typeof syncItem.state === "boolean") {
    return syncItem.state;
  }

  const localItem = await getStorageValue(chrome.storage.local, ["state"]);
  if (typeof localItem.state === "boolean") {
    return localItem.state;
  }

  return null;
}

async function getStoredSettingsSnapshot(stateOverride = null) {
  const syncItem = await getStorageValue(chrome.storage.sync, ["streamID", "password", "state"]);
  const localItem = await getStorageValue(chrome.storage.local, ["settings"]);
  const settings = localItem.settings || {};
  const state = typeof stateOverride === "boolean"
    ? stateOverride
    : (typeof syncItem.state === "boolean" ? syncItem.state : false);

  return {
    state,
    streamID: syncItem.streamID || "",
    password: syncItem.password || "",
    settings,
    beginnerMode: !!(settings.beginnerMode && settings.beginnerMode.setting === true)
  };
}

function isSettingsRequest(message) {
  return Boolean(
    message &&
    typeof message === "object" &&
    (message.getSettings || (message.cmd && message.cmd === "getSettings"))
  );
}

function isEnableRequest(message) {
  return Boolean(
    message &&
    typeof message === "object" &&
    message.cmd === "setOnOffState" &&
    message.data &&
    message.data.value === true
  );
}

function isBackgroundWriteRequest(message) {
  if (!message || typeof message !== "object" || !message.cmd) {
    return false;
  }

  return [
    "setOnOffState",
    "saveSetting",
    "sidUpdated",
    "uploadCustomJs",
    "deleteCustomJs",
    "uploadBadwords",
    "deleteBadwords",
    "uploadRAGfile",
    "deleteRAGfile",
    "clearRag",
    "savePoll",
    "createNewPoll",
    "bigwipe",
    "resettipjar",
    "manageUserPoints",
    "resetAllPoints",
    "importPointsData",
    "spotifySignOut",
    "spotifyManualCallback",
    "spotifyAuthCallback"
  ].includes(message.cmd);
}

function shouldRouteWhileDisabled(message) {
  return isEnableRequest(message) || isBackgroundWriteRequest(message);
}

function isBackgroundBoundMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.type === "toBackground") {
    return true;
  }
  if (message.cmd) {
    return true;
  }
  if (message.type) {
    return false;
  }
  return Boolean(
    "message" in message ||
    "messages" in message ||
    "delete" in message ||
    "getSettings" in message ||
    "getBTTV" in message ||
    "getSEVENTV" in message ||
    "getFFZ" in message ||
    "pokeMe" in message ||
    "keepAlive" in message
  );
}

function wrapBackgroundMessage(message) {
  return message.type === "toBackground" ? message : { type: "toBackground", data: message };
}

function notifyBackgroundRecoveryFailure(error) {
  const now = Date.now();
  if (now - lastBackgroundRecoveryNotification < BACKGROUND_RECOVERY_NOTIFICATION_COOLDOWN) {
    return;
  }
  lastBackgroundRecoveryNotification = now;

  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: "Social Stream background stopped",
      message: "Could not reopen the background page. Open the extension popup to restart capture."
    });
  } catch (notificationError) {
    console.warn("Could not show background recovery notification:", notificationError);
  }

  if (error) {
    console.error("Background recovery failed:", error);
  }
}

function queueBackgroundMessage(message, sendResponse) {
  messageQueue.push({ message, sendResponse });
  scheduleQueuedMessageRetry(BACKGROUND_PAGE_COOLDOWN);
}

async function routeBackgroundBoundMessage(message, sendResponse) {
  const backgroundMessage = wrapBackgroundMessage(message);
  const payload = backgroundMessage.data;
  const isOpen = await checkBackgroundPageIsOpen();
  if (isOpen) {
    sendMessageToBackgroundPage(backgroundMessage, sendResponse);
    return true;
  }

  const storedState = await getStoredExtensionState();
  if (isSettingsRequest(payload)) {
    const snapshot = await getStoredSettingsSnapshot(storedState);
    if (snapshot.streamID) {
      sendResponse(snapshot);
      if (storedState !== false) {
        ensureBackgroundPageIsOpen().catch((error) => {
          notifyBackgroundRecoveryFailure(error);
        });
      }
      return true;
    }
  }
  if (storedState === false && !shouldRouteWhileDisabled(payload)) {
    if (isSettingsRequest(payload)) {
      sendResponse(await getStoredSettingsSnapshot(false));
    } else {
      sendResponse({ state: false });
    }
    return true;
  }

  try {
    await ensureBackgroundPageIsOpen(true, shouldRouteWhileDisabled(payload));
    if (backgroundPageTabIdLoaded) {
      sendMessageToBackgroundPage(backgroundMessage, sendResponse);
    } else {
      queueBackgroundMessage(backgroundMessage, sendResponse);
    }
  } catch (error) {
    notifyBackgroundRecoveryFailure(error);
    sendResponse({ error: "Failed to open background page" });
  }
  return true;
}


async function checkBackgroundPageIsOpen() {
  log("Checking if background page is open", backgroundPageTabId);

  try {
    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL('background.html') });
    
    if (existingTabs.length > 0) {
      log(`Found ${existingTabs.length} background tab(s).`);
      
      // Keep track of original background page state
      const wasLoaded = backgroundPageTabIdLoaded;
      const originalTabId = backgroundPageTabId;

      // If there are multiple tabs, close all but the first one
      if (existingTabs.length > 1) {
        log("Closing extra background tabs.");
        for (let i = 1; i < existingTabs.length; i++) {
          await chrome.tabs.remove(existingTabs[i].id);
        }
      }
      
      backgroundPageTabId = existingTabs[0].id;
      backgroundPageTabIdLoaded = existingTabs[0].status === "complete";
      
      // Only update icon if state changed
      if (backgroundPageTabIdLoaded && !wasLoaded) {
        await updateIconToOn();
        return true;
      }

      return wasLoaded || backgroundPageTabIdLoaded;
    }

    backgroundPageTabId = null;
    backgroundPageTabIdLoaded = false;
    await updateIconToOff();
    return false;

  } catch (error) {
    console.error("Error checking background page:", error);
    return false;
  }
}

let lastBackgroundPageCreated = 0;
const BACKGROUND_PAGE_COOLDOWN = 5000; // 5 second cooldown between attempts
const BACKGROUND_PAGE_LOAD_TIMEOUT = 10000; // 10 second timeout waiting for background tab load
let queuedMessageRetryTimer = null;

function isTransientTabEditError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('tabs cannot be edited right now') || message.includes('dragging a tab');
}

function scheduleQueuedMessageRetry(delayMs) {
  if (queuedMessageRetryTimer !== null) {
    return;
  }

  queuedMessageRetryTimer = setTimeout(() => {
    queuedMessageRetryTimer = null;
    ensureBackgroundPageIsOpen().catch((error) => {
      console.error("Error retrying queued background message delivery:", error);
    });
  }, Math.max(delayMs, 0));
}

async function waitForTabComplete(tabId, timeoutMs = BACKGROUND_PAGE_LOAD_TIMEOUT) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.status === "complete") {
      return;
    }
  } catch (error) {
    // Fall through to listener-based wait for transient tab lookup errors.
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;

    const finish = (error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      chrome.tabs.onUpdated.removeListener(listener);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        finish();
      }
    };

    timeoutId = setTimeout(() => {
      finish(new Error(`Timed out waiting for background page tab ${tabId} to load`));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(listener);

    // Re-check status immediately after listener registration to avoid race conditions.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === "complete") {
        finish();
      }
    }).catch(() => {});
  });
}

async function ensureBackgroundPageIsOpen(load = true, force = false) {
  log("Ensuring background page is open", backgroundPageTabId);

  const isOpen = await checkBackgroundPageIsOpen();
  if (isOpen) {
    log("Background page is already open");
    return;
  }

  if (load) {
    // Check if enough time has passed since last attempt
    const now = Date.now();
    const elapsed = now - lastBackgroundPageCreated;
    if (!force && elapsed < BACKGROUND_PAGE_COOLDOWN) {
      log("Skipping background page creation - cooldown period");
      scheduleQueuedMessageRetry(BACKGROUND_PAGE_COOLDOWN - elapsed);
      return;
    }

    try {
      lastBackgroundPageCreated = now;
      
      const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL('background.html') });
      if (existingTabs.length > 0) {
        backgroundPageTabId = existingTabs[0].id;
        log("Reusing existing background page with ID:", backgroundPageTabId);
      } else {
        const tab = await chrome.tabs.create({
          url: chrome.runtime.getURL('background.html'),
          active: false,
          pinned: true
        });
        
        backgroundPageTabId = tab.id;
        log("Background page created with ID:", backgroundPageTabId);
      }
      
      // Wait for the background page to initialize
      await waitForTabComplete(backgroundPageTabId);
      
      backgroundPageTabIdLoaded = true;
      log("Background page loaded");
    } catch (error) {
      if (isTransientTabEditError(error)) {
        console.warn("Background page tab edit was blocked by Chrome; retrying shortly:", error);
        backgroundPageTabIdLoaded = false;
        scheduleQueuedMessageRetry(BACKGROUND_PAGE_COOLDOWN);
        return;
      }
      console.error("Error ensuring background page is open:", error);
      throw error;
    }
  }
  
  await updateIconToOn();
  await processMessageQueue();
}

async function processMessageQueue() {
  while (messageQueue.length > 0 && backgroundPageTabIdLoaded) {
    const { message, sendResponse } = messageQueue.shift();
    sendMessageToBackgroundPage(message, sendResponse);
  }
}

// Modified tab removal listener
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === backgroundPageTabId) {
    log("Background page tab was closed");
    backgroundPageTabId = null;
    backgroundPageTabIdLoaded = false;
    await updateIconToOff();
  }
});

function sendMessageToBackgroundPage(message, sendResponse) {
  log("sending message", message);

  const payload = message.data;

  const deliverResponse = (response) => {
    log("response", response);
    if (chrome.runtime.lastError) {
      console.error("Error sending message to background:", chrome.runtime.lastError);
      sendResponse({ error: 'Failed to communicate with background page' });
    } else if (typeof response === 'undefined') {
      sendResponse({ error: 'Background page did not respond' });
    } else {
      sendResponse(response);
    }
  };

  const sendViaRuntime = () => {
    chrome.runtime.sendMessage(payload, deliverResponse);
  };

  if (backgroundPageTabId !== null) {
    chrome.tabs.sendMessage(backgroundPageTabId, payload, (response) => {
      if (chrome.runtime.lastError || typeof response === 'undefined') {
        console.warn("Tab messaging failed, falling back to runtime:", chrome.runtime.lastError);
        sendViaRuntime();
      } else {
        deliverResponse(response);
      }
    });
  } else {
    sendViaRuntime();
  }
}

function injectCustomSource(source, tabId) {
  const scriptPath = `./sources/${source}.js`;
  
  chrome.scripting.executeScript({
    target: {tabId: tabId},
    files: [scriptPath]
  }).catch(error => {
    console.error('Error injecting script:', error);
    
    // Notify the user of the error
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Injection Error',
      message: `Failed to inject ${source}.js into the page. ${error.message}`
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }
	
  if (message.type === 'injectCustomSource') {
    injectCustomSource(message.source, message.tabId);
  } else if (message.type === 'toBackground') {
    log("SERVICE WORKER: ", message);

    if (message?.data?.cmd === 'spotifyAuth') {
      // Fire-and-forget Spotify auth so the popup gets an immediate ack
      sendResponse({ success: false, waitingForCallback: true, message: 'Starting Spotify authorization…' });
      sendMessageToBackgroundPage(message, () => {});
      return true;
    }

    if (backgroundPageTabIdLoaded) {
      return false;
    }

    routeBackgroundBoundMessage(message, sendResponse);

    return true; // Indicates that the response will be sent asynchronously
  } else if (isBackgroundBoundMessage(message)) {
    if (backgroundPageTabIdLoaded) {
      return false;
    }

    routeBackgroundBoundMessage(message, sendResponse);
    return true;
  } else if (message.type === 'checkBackgroundPage') {
    // New message type to handle background page check
    checkBackgroundPageIsOpen().then((isOpen) => {
      if (isOpen) {
        sendResponse({ alreadyOpen: true, tabId: backgroundPageTabId });
      } else {
        sendResponse({ alreadyOpen: false });
      }
    });
    return true; // Indicates that the response will be sent asynchronously
  } else if (message.type === 'openEventFlowEditor') {
    // Handle opening the Event Flow Editor
    (async () => {
      try {
        const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL('background.html') });
        
        if (existingTabs.length > 0) {
          // Background.html is already open, switch to it with #editor hash
          const tab = existingTabs[0];
          await chrome.tabs.update(tab.id, { 
            url: chrome.runtime.getURL('background.html#editor'),
            active: true 
          });
          
          // Focus the window containing the tab
          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
          
          sendResponse({ success: true, message: 'Switched to existing background tab' });
        } else {
          // No background.html tab exists, create a new one
          const newTab = await chrome.tabs.create({
            url: chrome.runtime.getURL('background.html#editor'),
            active: true
          });
          
          sendResponse({ success: true, message: 'Created new background tab' });
        }
      } catch (error) {
        console.error('Error in openEventFlowEditor handler:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates that the response will be sent asynchronously
  } else if (message.type === 'captureTabAudio') {
	  if (!chrome.tabCapture || typeof chrome.tabCapture.capture !== 'function') {
		  sendResponse({ error: 'Tab audio capture is not available in this browser' });
		  return true;
	  }

	  chrome.tabCapture.capture({
		  audio: true,
		  video: false
	  }, (stream) => {
		  if (chrome.runtime.lastError) {
			  sendResponse({ error: chrome.runtime.lastError.message });
		  } else {
			  // Create a stream ID to track this capture
			  const streamId = stream.id;
			  sendResponse({ streamId: streamId });

			  // You can't directly pass the MediaStream to content script
			  // Instead, you'd need to use it in the background or
			  // inject it into the page context
		  }
	  });
	  return true; // Will respond asynchronously
  }
  
});

// Ensure the background page is opened when the extension starts
chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed, opening background page");
  getStoredExtensionState().then((storedState) => {
    if (storedState === false) {
      updateIconToOff();
      return;
    }
    ensureBackgroundPageIsOpen();
  });
});

chrome.runtime.onStartup.addListener(async () => {
  log("Extension starting up, opening background page");
  const storedState = await getStoredExtensionState();
  if (storedState === false) {
    await updateIconToOff();
    return;
  }

  await ensureBackgroundPageIsOpen();
  
  // Periodically check and ensure only one background page is open
  setInterval(async () => {
    await checkBackgroundPageIsOpen();
  }, 60000); // Check every minute
});

// Initialize the icon state on service worker startup
chrome.tabs.query({ url: chrome.runtime.getURL('background.html') }, async (tabs) => {
  if (tabs.length > 0) {
    backgroundPageTabId = tabs[0].id;
    backgroundPageTabIdLoaded = tabs[0].status === "complete";
    if (backgroundPageTabIdLoaded) {
      await updateIconToOn();
    } else {
      await updateIconToOff();
    }
  } else {
    await updateIconToOff();
  }
});

function isBackgroundPage(tab) {
  return tab.url === chrome.runtime.getURL('background.html');
}

chrome.tabs.onCreated.addListener((tab) => {
  if (isBackgroundPage(tab)) {
    ensureBackgroundPageIsOpen();
  }
});

// Modify the existing chrome.tabs.onUpdated listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isBackgroundPage(tab) && changeInfo.status === 'complete') {
    ensureBackgroundPageIsOpen();
  }
});

/* chrome.webRequest.onSendHeaders.addListener(
  function(details) {
    const authHeader = details.requestHeaders.find(
      header => header.name.toLowerCase() === 'authorization'
    );
    if (authHeader) {
      chrome.storage.local.set({'authToken': authHeader.value });
    }
  },
  {urls: ["https://*.host.bsky.network/*"]},["requestHeaders"]
);
 */
