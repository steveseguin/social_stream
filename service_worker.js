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

function log(msg, msg2=""){
	//console.log(msg, msg2);
}

async function checkBackgroundPageIsOpen() {
  log("Checking if background page is open", backgroundPageTabId);
  
  if (backgroundPageTabId !== null) {
    try {
      await chrome.tabs.get(backgroundPageTabId);
      return backgroundPageTabIdLoaded;
    } catch (error) {
      log("Background page tab no longer exists");
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
  log("Ensuring background page is open", backgroundPageTabId);
  
  const isOpen = await checkBackgroundPageIsOpen();
  if (isOpen) {
    log("Background page is already open");
    await updateIconToOn();
    return;
  }

  try {
    const existingTabs = await chrome.tabs.query({url: chrome.runtime.getURL('../background.html')});
    if (existingTabs.length > 0) {
		log("Found existing background page");
		if (existingTabs.length > 1) {
			log(`Found ${tabs.length} background tabs. Closing extras.`);
			for (let i = 1; i < tabs.length; i++) {
				await chrome.tabs.remove(tabs[i].id);
			}
		}
		// Set the remaining tab as our active background page
		backgroundPageTabId = tabs[0].id;
		backgroundPageTabIdLoaded = true;
    } else {
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('../background.html'),
        active: false,
		pinned: true
      });
      backgroundPageTabId = tab.id;
      log("Background page created with ID:", backgroundPageTabId);
      // Wait for the background page to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      backgroundPageTabIdLoaded = true;
      log("Background page loaded");
    }
    await updateIconToOn();
    // Process any queued messages
    log("Message queue:", messageQueue);
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
    log("Background page tab was closed");
    backgroundPageTabId = null;
    backgroundPageTabIdLoaded = false;
    await updateIconToOff();
  }
});

function sendMessageToBackgroundPage(message, sendResponse) {
  log("sending message", message);
  chrome.runtime.sendMessage(message.data, (response) => {
    log("response", response);
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
  log("Extension installed, opening background page");
  ensureBackgroundPageIsOpen();
});

chrome.runtime.onStartup.addListener(() => {
  log("Extension starting up, opening background page");
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