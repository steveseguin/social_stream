(function () {
    var settings = {};

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
        if (!element) return "";
        element.childNodes.forEach(node => {
            if (node.childNodes.length) {
                resp += getAllContentNodes(node);
            } else if (node.nodeType === 3) {
                resp += escapeHtml(node.textContent);
            } else if (node.nodeType === 1 && !settings.textonlymode) {
                if (node.nodeName === "IMG" && node.src) {
                    resp += `<img src="${node.src}">`;
                } else {
                    resp += node.outerHTML;
                }
            }
        });
        return resp;
    }

    function processMessage(ele) {
        if (!ele) {
            console.error("Element not found");
            return;
        }

        var chatName = "";
        var chatMessage = "";
        var nameColor = "";
        var msgType = "public";
        var event = ele.querySelector('[data-testid="room-notice"]') || false;
        var private = ele.closest('.TheatermodeChatDivPm') || false;
        

        try {
            if (event) {
                chatName = "CB Notice";
                chatMessage = getAllContentNodes(event);
                nameColor = "rgb(239, 253, 95)";
                msgType = "notice";
            } else if (private) {
                var usernameEle = ele.querySelector('[data-testid="chat-message-username"]');
                var messageEle = ele.querySelector('[data-testid="chat-message-text"]');
                if (!usernameEle || !messageEle) {
                    console.error("Private message elements not found");
                    return;
                }
                chatName = escapeHtml(usernameEle.textContent.trim());
                chatMessage = getAllContentNodes(messageEle);
                nameColor = getUsernameColor(usernameEle);
                msgType = "private";
            } else {
                var usernameEle = ele.querySelector('[data-testid="username"]');
                var messageEle = ele.querySelector('[data-testid="chat-message-text"]');
                if (!usernameEle || !messageEle) {
                    console.error("Chat message elements not found");
                    return;
                }
                chatName = escapeHtml(usernameEle.textContent.trim());
                chatMessage = getAllContentNodes(messageEle);
                nameColor = getUsernameColor(usernameEle);
            }
        } catch (e) {
            console.error("Error processing message:", e);
            return;
        }

        if (!chatName || !chatMessage) {
            console.log("Name or message missing");
            return;
        }

        var data = {
            chatname: chatName,
            nameColor: nameColor,
            chatmessage: chatMessage,
            textonly: settings.textonlymode || false,
            type: "chaturbate",
            event: event,
            private: private
        };

        console.log("Processed chat data:", data);
        pushMessage(data);
    }

    function getUsernameColor(element) {
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
        var classes = element.className.split(/\s+/);
        for (var cls of classes) {
            if (colorMap[cls]) {
                return colorMap[cls];
            }
        }
        return '#000';
    }

    function pushMessage (data) {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function (response) { });
        } catch (e) {
            console.log("Error sending message:", e);
        }
    }

    function onElementInserted(containerSelector) {
        var target = document.querySelector(containerSelector);
        if (!target) return;

        var observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('[data-testid="chat-message"]')) {
                        processMessage(node);
                    }
                });
            });
        });

        observer.observe(target, { childList: true, subtree: true });
    }

    setInterval(function () {
        var publicChatContainer = document.querySelector('.TheatermodeChatDivChat .msg-list-fvm.message-list');
        var privateChatContainer = document.querySelector('.TheatermodeChatDivPm .msg-list-fvm.message-list');

        if (publicChatContainer && !publicChatContainer.marked) {
            publicChatContainer.marked = true;
            onElementInserted('.TheatermodeChatDivChat .msg-list-fvm.message-list');
        }

        if (privateChatContainer && !privateChatContainer.marked) {
            privateChatContainer.marked = true;
            onElementInserted('.TheatermodeChatDivPm .msg-list-fvm.message-list');
        }
    }, 1000);

    console.log("Chaturbate chat observer script injected");
})();
