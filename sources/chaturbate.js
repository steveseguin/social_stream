(function () {
    var settings = {}; // Settings object for additional configurations

    function escapeHtml(unsafe) {
		if (settings.textonlymode) {
			return unsafe;
		}
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;") || "";
    }

    function getAllContentNodes(element) {
        var resp = "";
		
		if (!element) {
			return resp;
		}
		
        if (!element.childNodes || !element.childNodes.length) {
            if (element.textContent) {
                return escapeHtml(element.textContent) || "";
            } else {
                return "";
            }
        }

        element.childNodes.forEach(node => {
            if (node.childNodes.length) {
                resp += getAllContentNodes(node);
            } else if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                resp += escapeHtml(node.textContent);
            } else if (node.nodeType === 1) {
                if (!settings.textonlymode) {
                    if (node.nodeName === "IMG" && node.src) {
                        node.src = node.src + "";
                    }
                    resp += node.outerHTML;
                }
            }
        });
        return resp;
    }

    function processMessage(ele) {
        var chatName = "";
        var chatMessage = "";
        var nameColor = "";
        var msgType = "public"; // Default message type

        // Check if it's a notice
        var isNotice = ele.querySelector('[data-testid="room-notice"]') !== null;

        // Detect private messages
        var isPrivate = ele.getAttribute("ts") === "Ce";

        try {
            if (isNotice) {
                // Handling notices differently
                chatName = "CB Notice";
                chatMessage = getAllContentNodes(ele.querySelector('[data-testid="room-notice"]'));
                nameColor = "rgb(239, 253, 95)"; // Default color for notices
                msgType = "notice";
            } else if (isPrivate) {
                // Private message processing
                chatName = escapeHtml(ele.querySelector('[data-testid="username"]').textContent.trim());
                chatMessage = getAllContentNodes(ele.querySelector('[data-testid="chat-message-text"]'));
                nameColor = getUsernameColor(ele.querySelector('[data-testid="username"]'));
                msgType = "private";
            } else {
                // Regular chat message processing
                chatName = escapeHtml(ele.querySelector('[data-testid="username"]').textContent.trim());
                chatMessage = getAllContentNodes(ele.querySelector('[data-testid="chat-message-text"]'));
                nameColor = getUsernameColor(ele.querySelector('[data-testid="username"]'));
            }
        } catch (e) {
            console.error("Error processing message:", e);
            return; // Skip this message if errors occur
        }
		
		if (!(chatName && chatMessage)){
			// requires a name and message
			return;
		}

        var data = {
            chatname: chatName,
            nameColor: nameColor,
            chatmessage: chatMessage,
            textonly: settings.textonlymode || false,
            type: "chaturbate",
			event: isNotice,
        };

        console.log("Processed chat data:", data);
        pushMessage(data);
    }

    function getUsernameColor(element) {
        var classes = element.className.split(/\s+/);
        var colorMap = {
            'broadcaster': '#dc5500',
            'mod': '#dc0000',
            'inFanclub': '#090',
            'tippedTonsRecently': '#804baa',
            'tippedALotRecently': '#be6aff',
            'tippedRecently': '#1e5cfb',
            'hasTokens': '#069',
            'defaultUser': '#939393'
        };
        for (var i = 0; i < classes.length; i++) {
            if (colorMap[classes[i]]) {
                return colorMap[classes[i]];
            }
        }
        return '#000'; // Default color if no specific class is found
    }

    function pushMessage(data) {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function (response) { });
        } catch (e) {
            console.log("Error sending message:", e);
        }
    }
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelectorAll("#ChatTabContainer [ts='g'] .customInput[contenteditable]").focus();
					// document.querySelectorAll("#ChatTabContainer [ts='Ce'] .customInput[contenteditable]").focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch(e){}
			sendResponse(false);
		}
	);

    function onElementInserted(containerSelector) {
        var target = document.querySelector(containerSelector);
        if (!target) { return; }

        var observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('[data-testid="chat-message"]')) {
                        processMessage(node);
                    }
                });
            });
        });

        observer.observe(target, { childList: true, subtree: false });
		// subtree is for grand-children, but that's not needed here it seems
    }

    console.log("Chaturbate chat observer script injected");
    setInterval(function () {
        var chatContainer = document.querySelector('.msg-list-fvm.message-list');
        if (chatContainer && !chatContainer.marked) {
            chatContainer.marked = true;
            console.log("Chaturbate chat detected");
			setTimeout(function(){
				// let's allow old messages to load first, so we don't trigger on them
				onElementInserted('.msg-list-fvm.message-list');
			},3000);
        }
    }, 2000);

})();
