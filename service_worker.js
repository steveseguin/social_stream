// service_worker.js
let backgroundPageTabId = null;
let backgroundPageTabIdLoaded = false;
let messageQueue = [];

async function updateIconToOn() {
  if (chrome.action && chrome.action.setIcon) {
    //await chrome.action.setIcon({ path: "/icons/on.png" });
  }
}

async function updateIconToOff() {
  if (chrome.action && chrome.action.setIcon) {
    await chrome.action.setIcon({ path: "/icons/off.png" });
  }
}

async function checkBackgroundPageIsOpen() {
  console.log("Checking if background page is open", backgroundPageTabId);
  
  if (backgroundPageTabId !== null) {
    try {
      await chrome.tabs.get(backgroundPageTabId);
      return backgroundPageTabIdLoaded;
    } catch (error) {
      console.log("Background page tab no longer exists");
      backgroundPageTabId = null;
      backgroundPageTabIdLoaded = false;
      await updateIconToOff();
      return false;
    }
  }
  await updateIconToOff();
  return false;
}

async function ensureBackgroundPageIsOpen() {
  console.log("Ensuring background page is open", backgroundPageTabId);
  
  const isOpen = await checkBackgroundPageIsOpen();
  if (isOpen) {
    console.log("Background page is already open");
    await updateIconToOn();
    return;
  }

  try {
    const existingTabs = await chrome.tabs.query({url: chrome.runtime.getURL('../background.html')});
    if (existingTabs.length > 0) {
      console.log("Found existing background page");
      backgroundPageTabId = existingTabs[0].id;
      backgroundPageTabIdLoaded = true;
    } else {
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('../background.html'),
        active: false,
		pinned: true
      });
      backgroundPageTabId = tab.id;
      console.log("Background page created with ID:", backgroundPageTabId);
      // Wait for the background page to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      backgroundPageTabIdLoaded = true;
      console.log("Background page loaded");
    }
    await updateIconToOn();
    // Process any queued messages
    console.log("Message queue:", messageQueue);
    await processMessageQueue();
  } catch (error) {
    console.error("Error ensuring background page is open:", error);
    await updateIconToOff();
    throw error;
  }
}

async function processMessageQueue() {
  while (messageQueue.length > 0 && backgroundPageTabIdLoaded) {
    const { message, sendResponse } = messageQueue.shift();
    sendMessageToBackgroundPage(message, sendResponse);
  }
}

// Listener for tab removal to reset state if the background page is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === backgroundPageTabId) {
    console.log("Background page tab was closed");
    backgroundPageTabId = null;
    backgroundPageTabIdLoaded = false;
    await updateIconToOff();
  }
});

function sendMessageToBackgroundPage(message, sendResponse) {
  console.log("sending message", message);
  chrome.runtime.sendMessage(message.data, (response) => {
    console.log("response", response);
    if (chrome.runtime.lastError) {
      console.error("Error sending message to background:", chrome.runtime.lastError);
      sendResponse({error: 'Failed to communicate with background page'});
    } else {
      sendResponse(response);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toBackground') {
    console.log("SERVICE WORKER: ", message);
    
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
          sendResponse({error: 'Failed to open background page'});
        });
      } else {
        sendMessageToBackgroundPage(message, sendResponse);
      }
    });
    
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Ensure the background page is opened when the extension starts
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed, opening background page");
  ensureBackgroundPageIsOpen();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension starting up, opening background page");
  ensureBackgroundPageIsOpen();
});

// Initialize the icon state on service worker startup
chrome.tabs.query({url: chrome.runtime.getURL('background.html')}, async (tabs) => {
  if (tabs.length > 0) {
    backgroundPageTabId = tabs[0].id;
    backgroundPageTabIdLoaded = true;
    await updateIconToOn();
  } else {
    await updateIconToOff();
  }
});