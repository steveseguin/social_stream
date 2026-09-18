var settings = {};

window.addEventListener("TestSourceMessage", function (e) {
	if (e.detail) {
		pushMessage(e.detail);
	}
});

function pushMessage(data) {
	try {
		chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
	} catch (e) {
		console.error("Error sending test source message:", e);
	}
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	try {
		if ("getSource" == request) {
			sendResponse("testsource");
			return;
		}
		if ("focusChat" == request) {
			var input = document.getElementById("messageInput");
			if (input) {
				input.focus();
			}
			sendResponse(true);
			return;
		}
		if (typeof request === "object" && "settings" in request) {
			settings = request.settings || {};
			sendResponse(true);
			return;
		}
	} catch (e) {
		console.error("Error handling test source request:", e);
	}
	sendResponse(false);
});

chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
	if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
		return;
	}
	response = response || {};
	if ("settings" in response) {
		settings = response.settings || {};
	}
});

console.log("Social Stream Ninja test source injected");
