var settings = {};

// Listen for IRC messages from the page
window.addEventListener('bilibiliMessage', function(e) {
    if (e.detail) {
        pushMessage(e.detail);
    }
});

function pushMessage(data) {
    try {
        chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e) {});
    } catch(e) {
        console.error('Error sending message to extension:', e);
    }
}

// Handle extension messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        try {
            if ("getSource" == request){sendResponse("bilibili");	return;	}
			if ("focusChat" == request) {
                document.getElementById('messageInput').focus();
                sendResponse(true);
                return;
            }
            
            if (typeof request === "object") {
                if ("settings" in request) {
                    settings = request.settings;
                    sendResponse(true);
                    return;
                }
                
                // Handle sending messages from extension to IRC
                if (request.type === "SEND_MESSAGE") {
                    const event = new CustomEvent('ExtensionMessage', {
                        detail: {
                            type: 'SEND_IRC_MESSAGE',
                            message: request.message
                        },
                        bubbles: true
                    });
                    window.dispatchEvent(event);
                    sendResponse(true);
                    return;
                }
            }
        } catch(e) {
            console.error('Error handling extension message:', e);
        }
        sendResponse(false);
    }
);

// Get initial settings
chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
    if ("settings" in response) {
        settings = response.settings;
    }
});

var settings = {};

// Create a MessageBridge class to handle communication with the page
class MessageBridge {
    constructor() {
        this.initialized = false;
        this.initializeMessaging();
    }

    initializeMessaging() {
        if (this.initialized) return;
        
        // Listen for messages from the extension
        window.addEventListener('ExtensionMessage', (e) => {
            if (e.detail && e.detail.type === 'SEND_BILIBILI_MESSAGE') {
                const messageInput = document.getElementById('messageInput');
                const sendBtn = document.getElementById('sendBtn');
                
                if (messageInput && sendBtn) {
                    messageInput.value = e.detail.message;
                    sendBtn.click();
                }
            }
        });

        this.initialized = true;
    }

    broadcast(messageData) {
        // Create a new CustomEvent each time
        const messageEvent = new CustomEvent('bilibiliMessage', {
            detail: messageData,
            bubbles: true
        });
        window.dispatchEvent(messageEvent);
    }
}

// Listen for bilibili message events from the page
window.addEventListener('bilibiliMessage', function(e) {
    if (e.detail) {
        pushMessage(e.detail);
    }
});

function pushMessage(data) {
    try {
        chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e) {});
    } catch(e) {
        console.error('Error sending message to extension:', e);
    }
}

// Handle extension messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        try {
            if ("getSource" == request){
                sendResponse("bilibili");
                return;
            }
            
            if ("focusChat" == request) {
                document.getElementById('messageInput').focus();
                sendResponse(true);
                return;
            }
            
            if (typeof request === "object") {
                if ("settings" in request) {
                    settings = request.settings;
                    sendResponse(true);
                    return;
                }
                
                // Handle sending messages from extension to Bilibili
                if (request.type === "SEND_MESSAGE") {
                    const event = new CustomEvent('ExtensionMessage', {
                        detail: {
                            type: 'SEND_BILIBILI_MESSAGE',
                            message: request.message
                        },
                        bubbles: true
                    });
                    window.dispatchEvent(event);
                    sendResponse(true);
                    return;
                }
            }
        } catch(e) {
            console.error('Error handling extension message:', e);
        }
        sendResponse(false);
    }
);

// Get initial settings
chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
    if (response && "settings" in response) {
        settings = response.settings;
    }
});

// Initialize the message bridge
const messageBridge = new MessageBridge();

console.log("Social stream ninja injected for Bilibili");
