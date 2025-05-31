var settings = {};
var textonlymode = false;

window.addEventListener('youtubeMessage', function(e) {
    if (e.detail) {
        pushMessage(e.detail);
    }
});

function pushMessage(data) {
    try {
        // Send message to SSN
        chrome.runtime.sendMessage(chrome.runtime.id, {
            "message": data 
        }, function(response) {
            // Handle response if needed
        });
    } catch(e) {
        console.error('Error sending message to socialstream:', e);
    }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    try {
        if ("getSource" == request) {
            sendResponse("youtube");
            return;
        }
        if ("focusChat" == request) {
            document.querySelector('#input-text').focus();
            sendResponse(true);
            return;
        }
        if (typeof request === "object") {
            if ("state" in request) {
                isExtensionOn = request.state;
            }
            if ("settings" in request) {
                settings = request.settings;
                
                // Check for text-only mode and notify the page if changed
                const newtextonlymode = settings.textonlymode || false;
                if (newtextonlymode !== textonlymode) {
                    textonlymode = newtextonlymode;
                    window.dispatchEvent(new CustomEvent('settingsChanged', {
                        detail: { textonlymode: textonlymode },
                        bubbles: true
                    }));
                }
                
                sendResponse(true);
                return;
            }
        }
    } catch(e) {
        console.error('Error handling Chrome message:', e);
    }
    sendResponse(false);
});

// Request settings from extension on load
try {
    chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
        if (!response) return;
        
        if ("settings" in response) {
            settings = response.settings;
            textonlymode = settings.textonlymode || false;
            
            // Notify the page about initial text-only mode setting
            window.dispatchEvent(new CustomEvent('settingsChanged', {
                detail: { textonlymode: textonlymode },
                bubbles: true
            }));
        }
        if ("state" in response) {
            isExtensionOn = response.state;
        }
    });
} catch(e) {
    console.error('Error requesting settings from extension:', e);
}

console.log("INJECTED YOUTUBE INTEGRATION");