/**
 * Social Stream Ninja - Nostr Content Script
 * 
 * This content script is injected into nostr.html by the Chrome extension.
 * It acts as a bridge between the HTML page and the extension:
 * - Receives NostrMessage events from the page
 * - Forwards messages to the extension via chrome.runtime.sendMessage
 * - Handles extension commands (settings, focus, etc.)
 */

var settings = {};

// Listen for Nostr messages from the page
window.addEventListener('NostrMessage', function(e) {
    if (e.detail) {
        pushMessage(e.detail);
    }
});

function pushMessage(data) {
    try {
        // Check if extension context is still valid
        if (!chrome.runtime || !chrome.runtime.id) {
            console.warn('[Nostr] Extension context not available');
            return;
        }
        chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e) {
            // Check for runtime errors (extension invalidated)
            if (chrome.runtime.lastError) {
                console.warn('[Nostr] Extension error:', chrome.runtime.lastError.message);
            }
        });
    } catch(e) {
        // Silently handle extension context invalidated errors
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.warn('[Nostr] Extension was reloaded. Please refresh this page.');
        } else {
            console.error('[Nostr] Error sending message to extension:', e);
        }
    }
}

// Handle extension messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    try {
        if ("getSource" == request) {
            sendResponse("nostr");
            return;
        }
        
        if ("focusChat" == request) {
            // Nostr is read-only for now, no chat input to focus
            sendResponse(false);
            return;
        }
        
        if (typeof request === "object") {
            if ("settings" in request) {
                settings = request.settings;
                sendResponse(true);
                return;
            }
        }
    } catch(e) {
        console.error('Error handling extension message:', e);
    }
    sendResponse(false);
});

// Get initial settings
chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
    response = response || {};
    if ("settings" in response) {
        settings = response.settings;
    }
});

console.log("Social Stream Ninja - Nostr content script loaded");
