var settings = {};

// Listen for IRC messages from the page
window.addEventListener('IRCMessage', function(e) {
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
            if ("getSource" == request){sendResponse("irc");	return;	}
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
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
    response = response || {};
    if ("settings" in response) {
        settings = response.settings;
    }
});

console.log("Social stream ninja injected");