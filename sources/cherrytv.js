(function () {
    try {
        var isExtensionOn = true;
        var settings = {};

        function sendData(data) {
            if (!isExtensionOn) {
                return;
            }
            try {
                chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function (response) { });
            } catch (e) { }
        }

        function escapeHtml(unsafe) {
            try {
                unsafe = unsafe || "";
                if (settings.textonlymode) {
                    return unsafe;
                }
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            } catch (e) {
                return "";
            }
        }

        function getAllContentNodes(element) {
            var resp = "";
            element.childNodes.forEach(node => {
                if (node.childNodes.length) {
                    resp += getAllContentNodes(node);
                } else if (node.nodeType === 3) {
                    resp += escapeHtml(node.textContent);
                } else if (node.nodeType === 1) {
                    if (node.nodeName === "IMG" && node.src) {
                        if (settings.textonlymode) {
                            resp += escapeHtml(node.alt || "");
                        } else {
                            resp += `<img src="${node.src}">`;
                        }
                    } else if (!settings.textonlymode) {
                        resp += node.outerHTML;
                    }
                }
            });
            return resp;
        }

        function processMessage(ele) {
            if (!isExtensionOn) {
                return;
            }
            if (!ele || ele.nodeType !== 1) {
                console.error("Element not found");
                return;
            }
            try {
                if (ele.querySelector('img[alt*="User Joined"]')) {
                    if (!settings.capturejoinedevent) {
                        return;
                    }
                    console.log("User joined:", ele.textContent.trim());
                    let data = {};
                    data.chatmessage = ele.textContent.trim();
                    data.event = "joined";
                    data.type = "cherrytv";
                    data.textonly = settings.textonlymode || false;
                    sendData(data);
                    return;
                }

                if (ele.querySelector('img[alt*="Gift image"]')) {
                    var giftUser = ele.querySelector('.text-white.font-medium').textContent.trim();
                    var giftDescription = ele.querySelector('div.px-2').textContent.trim();
                    console.log("Gift detected:", { user: giftUser, description: giftDescription });
                    return;
                }

                if (ele.querySelector('img[alt*="vibrator"]')) {
                    var lushUser = ele.querySelector('p.font-medium').textContent.trim();
                    var lushDetails = ele.querySelectorAll('div.px-2.py-0.5')[0].textContent.trim();
                    console.log("Lovense Lush activated:", { user: lushUser, details: lushDetails });
                    return;
                }

                if (ele.querySelector('.vip-join-room')) {
                    var vipUser = ele.textContent.trim();
                    console.log("VIP user joined:", vipUser);
                    return;
                }

                var usernameEle = ele.querySelector('span.text-white.font-medium');
                var messageEle = ele.querySelector('span[style*="word-break"]');
                if (!usernameEle || !messageEle) {
                    console.warn("Chat message elements not found. Probably not a message but a divider");
                    return;
                }
                var chatName = escapeHtml(usernameEle.textContent.trim());
                var chatMessage = getAllContentNodes(messageEle);
                var chatImg = ele.querySelector('img[src]') || ""
                if (chatImg) { chatImg = chatImg.src + ""; }

                console.log("Processed chat data:", { username: chatName, message: chatMessage });

                var data = {};
                data.chatname = chatName;
                data.chatmessage = chatMessage;
                data.type = "cherrytv";
                data.chatimg = chatImg;
                data.textonly = settings.textonlymode || false;

                sendData(data);
            } catch (e) {
                console.error("Error processing message:", e);
                return;
            }
        }

        chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
            response = response || {};
            if ("settings" in response) {
                settings = response.settings || {};
            }
            if ("state" in response) {
                isExtensionOn = response.state;
            }
        });

        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {
                try {
                    if ("getSource" == request){sendResponse("cherrytv");	return;	}
					if ("focusChat" == request) {
                        document.querySelector('input[data-test="field-message-box-public"]').focus();
                        sendResponse(true);
                        return;
                    }
                    if (typeof request === "object") {
                        if ("state" in request) {
                            isExtensionOn = request.state;
                        }
                        if ("settings" in request) {
                            settings = request.settings || {};
                            sendResponse(true);
                            return;
                        }
                        if ("state" in request) {
                            sendResponse(true);
                            return;
                        }
                    }
                } catch (e) { }
                sendResponse(false);
            }
        );
        function onElementInserted(containerSelector) {
            function attachObserver(target) {
                var observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        mutation.addedNodes.forEach(node => {
                            processMessage(node); // subree=false allows us to do this
                        });
                    });
                });

                observer.observe(target, { childList: true, subtree: false }); // subtree - we want only children, not grandchildren
                console.log("Observer attached to chatbox messages");
            }

            var target = document.querySelector(containerSelector);
            if (target) {
                attachObserver(target);
            } else {
                // Keep checking until the element is found
                setTimeout(() => onElementInserted(containerSelector), 1000);
            }
        }

    } catch (e) {
        console.error(e);
    }
    console.log("SOCIAL STREAM INJECTED");

    var hasRun = false;
    document.addEventListener("DOMContentLoaded", function () {
        if (!hasRun) {
            hasRun = true;
            onElementInserted('[data-test="chatbox-messages"]'); // Make sure this selector targets the correct container element
        }
    });
    setTimeout(function () {
        if (!hasRun) {
            hasRun = true;
            onElementInserted('[data-test="chatbox-messages"]'); // Make sure this selector targets the correct container element
        }
    }, 5000);
})();
