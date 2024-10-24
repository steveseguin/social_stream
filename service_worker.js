// serviceworker.js
// this service worker is part of a chrome manifest v3 script
// service workers can only stay active a few minutes at a time before being forced closed by the browser
// local variables will lose their state with each service worker restart, which needs to be considered when updating this code

let backgroundPageTabId = null;
let backgroundPageTabIdLoaded = false;
let messageQueue = [];

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

async function ensureBackgroundPageIsOpen(load = true) {
  log("Ensuring background page is open", backgroundPageTabId);

  const isOpen = await checkBackgroundPageIsOpen();
  if (isOpen) {
    log("Background page is already open");
    return;
  }

  if (load) {
    // Check if enough time has passed since last attempt
    const now = Date.now();
    if (now - lastBackgroundPageCreated < BACKGROUND_PAGE_COOLDOWN) {
      log("Skipping background page creation - cooldown period");
      return;
    }

    try {
      lastBackgroundPageCreated = now;
      
      // Close any existing background tabs first to prevent duplicates
      const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL('background.html') });
      for (const tab of existingTabs) {
        await chrome.tabs.remove(tab.id);
      }

      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('background.html'),
        active: false,
        pinned: true
      });
      
      backgroundPageTabId = tab.id;
      log("Background page created with ID:", backgroundPageTabId);
      
      // Wait for the background page to initialize
      await new Promise(resolve => {
        const listener = function(tabId, info) {
          if (tabId === backgroundPageTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      
      backgroundPageTabIdLoaded = true;
      log("Background page loaded");
    } catch (error) {
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
    
    // Optional: Attempt to reopen after a delay if extension is still on
    if (isExtensionOn) {
      setTimeout(() => {
        ensureBackgroundPageIsOpen();
      }, BACKGROUND_PAGE_COOLDOWN);
    }
  }
});

function sendMessageToBackgroundPage(message, sendResponse) {
  log("sending message", message);
  chrome.runtime.sendMessage(message.data, (response) => {
    log("response", response);
    if (chrome.runtime.lastError) {
      console.error("Error sending message to background:", chrome.runtime.lastError);
      sendResponse({ error: 'Failed to communicate with background page' });
    } else {
      sendResponse(response);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toBackground') {
    log("SERVICE WORKER: ", message);

    checkBackgroundPageIsOpen().then((isOpen) => {
      if (!isOpen) {
        ensureBackgroundPageIsOpen().then(() => {
          if (backgroundPageTabIdLoaded) {
            sendMessageToBackgroundPage(message, sendResponse);
          } else {
            // Queue the message if the background page is not ready
            messageQueue.push({ message, sendResponse });
          }
        }).catch(error => {
          console.error("Error ensuring background page is open:", error);
          sendResponse({ error: 'Failed to open background page' });
        });
      } else {
        sendMessageToBackgroundPage(message, sendResponse);
      }
    });

    return true; // Indicates that the response will be sent asynchronously
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
  }
});

// Ensure the background page is opened when the extension starts
chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed, opening background page");
  ensureBackgroundPageIsOpen();
});

chrome.runtime.onStartup.addListener(async () => {
  log("Extension starting up, opening background page");
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
    backgroundPageTabIdLoaded = true;
    await updateIconToOn();
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
