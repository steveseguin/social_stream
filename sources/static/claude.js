(function() {

    function toDataURL(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var reader = new FileReader();
            reader.onloadend = function() {
                callback(reader.result);
            }
            reader.readAsDataURL(xhr.response);
        };
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.send();
    }

	console.log("Socialstream injected");

	let observer = null;

	var isExtensionOn = false;
	var stored = "";
	const desiredValue = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

	function configure() {
		if (isExtensionOn) {
			if (!stored) {
				stored = getComputedStyle(document.documentElement).getPropertyValue('--font-claude-message');
				console.log(stored);
			}
			document.documentElement.style.setProperty('--font-claude-message', desiredValue);
			
			if (!observer) {
				observer = new MutationObserver(() => {
					const currentValue = getComputedStyle(document.documentElement)
						.getPropertyValue('--font-claude-message');
					
					if (isExtensionOn && currentValue !== desiredValue) {
						document.documentElement.style.setProperty('--font-claude-message', desiredValue);
					}
				});
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['style']
				});
			}
		} else {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			if (stored) {
				document.documentElement.style.setProperty('--font-claude-message', stored);
				stored = ""; // Reset stored value after using it
			}
		}
	}

    function pushMessage(data) {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, {
                "message": data
            }, function(e) {});
        } catch (e) {}
    }

    var settings = {};
    // settings.textonlymode
    // settings.captureevents
    chrome.runtime.sendMessage(chrome.runtime.id, {
        "getSettings": true
    }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
        response = response || {};
        if ("settings" in response) {
            settings = response.settings;
        }
        if ("state" in response) {
            isExtensionOn = response.state;
            configure();
        }
    });

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            try {
                if ("getSource" == request){sendResponse("claude");	return;	}
				if ("focusChat" == request) { // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
                    return;
                }
                if (typeof request === "object") {
                    if ("settings" in request) {
                        settings = request.settings;
                    }
                    if ("state" in request) {
                        isExtensionOn = request.state;
						configure();
                    }
                    sendResponse(true);
                    return;
                }
            } catch (e) {}
            sendResponse(false);
        }
    );

})();