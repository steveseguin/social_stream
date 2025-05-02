var settings = {};

function pushMessage(data) {
	try {
		// Send message to Chrome extension
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
			document.querySelector('#sendmessage').focus();
			sendResponse(true);
			return;
		}
		if (typeof request === "object") {
			if ("state" in request) {
				isExtensionOn = request.state;
			}
			if ("settings" in request) {
				settings = request.settings;
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
		}
		if ("state" in response) {
			isExtensionOn = response.state;
		}
	});
} catch(e) {
	console.error('Error requesting settings from extension:', e);
}

console.log("INJECTED YOUTUBE INTEGRATION");