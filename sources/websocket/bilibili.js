var settings = {};

function getTranslation(key, fallback) {
    try {
        if (settings && settings.translation && settings.translation.innerHTML && Object.prototype.hasOwnProperty.call(settings.translation.innerHTML, key)) {
            return settings.translation.innerHTML[key];
        }
        if (settings && settings.translation && settings.translation.miscellaneous && Object.prototype.hasOwnProperty.call(settings.translation.miscellaneous, key)) {
            return settings.translation.miscellaneous[key];
        }
    } catch (e) {}
    return fallback || String(key || '').replace(/-/g, ' ');
}

function translateBilibiliPayload(data) {
    if (!data || typeof data !== "object") {
        return data;
    }
    if (data.title === "DONATION") {
        data.title = getTranslation("donation", "DONATION");
    } else if (data.title === "SUPER CHAT") {
        data.title = getTranslation("super-chat-label", "SUPER CHAT");
    }
    if (data.chatmessage === "has entered the room") {
        data.chatmessage = getTranslation("source-user-entered-room", "has entered the room");
    } else if (data.chatmessage === "Stream is now LIVE") {
        data.chatmessage = getTranslation("stream-is-now-live", "Stream is now LIVE");
    } else if (data.chatmessage === "Stream is now OFFLINE") {
        data.chatmessage = getTranslation("stream-is-now-offline", "Stream is now OFFLINE");
    }
    return data;
}

// Listen for IRC messages from the page
window.addEventListener('bilibiliMessage', function(e) {
    if (e.detail) {
        pushMessage(translateBilibiliPayload(e.detail));
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


console.log("Social stream ninja injected for Bilibili");
