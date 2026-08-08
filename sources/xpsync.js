(function () {
	function hasChromeRuntime(){
		return typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback){
		try {
			if (hasChromeRuntime()){
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function(){});
				return true;
			}
		} catch(e){}
		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function"){
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return true;
			}
		} catch(e){}
		try {
			var forwarded = {};
			for (var key in payload){
				if (Object.prototype.hasOwnProperty.call(payload, key)){
					forwarded[key] = payload[key];
				}
			}
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined"){
				forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			}
			window.postMessage(forwarded, "*");
			return true;
		} catch(e){}
		return false;
	}

	function escapeHtml(unsafe){
		return String(unsafe || "")
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		var resp = "";

		if (!element){return resp;}
		if (element.nodeType === 3){
			return settings.textonlymode ? (element.textContent || "") : escapeHtml(element.textContent || "");
		}
		if (element.nodeType !== 1){return resp;}
		if (element.nodeName === "BR"){
			return settings.textonlymode ? "\n" : "<br>";
		}
		if (element.nodeName === "IMG"){
			if (settings.textonlymode){
				return element.getAttribute("alt") || element.getAttribute("title") || "";
			}
			if (element.src){
				var imageClone = element.cloneNode(false);
				imageClone.src = element.src + "";
				imageClone.className = "";
				return imageClone.outerHTML;
			}
			return resp;
		}

		for (var i = 0; i < element.childNodes.length; i++){
			resp += getAllContentNodes(element.childNodes[i]);
		}
		return resp;
	}

	var settings = {};
	// settings.textonlymode
	// settings.captureevents

	function parseViewerCount(value){
		if (typeof value === "number" && isFinite(value)){
			return Math.max(0, Math.floor(value));
		}
		if (typeof value === "string"){
			var parsed = parseInt(value.replace(/[^0-9.-]/g, ""), 10);
			if (!isNaN(parsed)){
				return Math.max(0, parsed);
			}
		}
		return null;
	}

	function getViewerCountFromPage(){
		try {
			var node = document.querySelector("[data-ssn-xpsync-viewer-count], [data-viewer-count], [data-viewers], .viewer-count, .viewer_count");
			if (!node){return null;}
			return parseViewerCount(node.getAttribute("data-ssn-xpsync-viewer-count") || node.getAttribute("data-viewer-count") || node.getAttribute("data-viewers") || node.textContent);
		} catch(e){}
		return null;
	}

	function sendViewerCount(count){
		count = parseViewerCount(count);
		if (count === null){return;}
		sendToApp({message:{
			type: "xpsync",
			event: "viewer_update",
			meta: count
		}});
	}

	function checkViewers(){
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)){return;}

		var pageCount = getViewerCountFromPage();
		if (pageCount !== null){
			sendViewerCount(pageCount);
		}
	}

	var processedIds = {};
	var processedIdsQueue = [];

	function markProcessed(id){
		if (!id || processedIds[id]){return false;}
		processedIds[id] = true;
		processedIdsQueue.push(id);
		if (processedIdsQueue.length > 500){
			delete processedIds[processedIdsQueue.shift()];
		}
		return true;
	}

	function isSparksRow(ele){
		try {
			return !!(ele && ele.nodeType === 1 && ele.querySelector("svg.lucide-zap"));
		} catch(e){}
		return false;
	}

	function retryMessage(ele){
		try {
			if (!ele || !ele.isConnected){return;}
			ele.__ssnXpsyncRetries = (ele.__ssnXpsyncRetries || 0) + 1;
			if (ele.__ssnXpsyncRetries > 3){return;}
			setTimeout(function(){processMessage(ele);}, 400);
		} catch(e){}
	}

	function processMessage(ele){
		if (!isExtensionOn){return;}
		if (!ele){return;}
		var sparksRow = isSparksRow(ele);
		var standardRow = !!(ele.id && ele.id.indexOf("chat-") === 0);
		if (!standardRow && !sparksRow){return;}
		if (standardRow){
			if (processedIds[ele.id]){return;}
		} else {
			if (ele.__ssnXpsyncProcessed){return;}
		}

		var content = standardRow ? ele.querySelector(":scope > div") : ele;
		if (!content || !content.children.length){retryMessage(ele); return;}

		var children = content.children;

		var colonSpan = null;
		for (var i = 0; i < children.length; i++){
			if (children[i].tagName === "SPAN" && (children[i].textContent || "").trim() === ":"){
				colonSpan = children[i];
				break;
			}
		}
		var nameSpan = colonSpan ? colonSpan.previousElementSibling : null;
		if (!nameSpan && sparksRow){
			for (var nameIndex = children.length - 1; nameIndex >= 0; nameIndex--){
				if (children[nameIndex].tagName === "SPAN" && children[nameIndex].style && children[nameIndex].style.cursor === "pointer"){
					nameSpan = children[nameIndex];
					break;
				}
			}
		}
		if (!nameSpan){retryMessage(ele); return;}

		var chatimg = "";
		var avatarIndex = -1;
		try {
			var avatarSpan = null;
			for (var avatarSearch = 0; avatarSearch < children.length; avatarSearch++){
				if (children[avatarSearch].tagName === "SPAN" && children[avatarSearch].style.width === "26px" && children[avatarSearch].style.height === "26px"){
					avatarSpan = children[avatarSearch];
					avatarIndex = avatarSearch;
					break;
			}
			}
			if (!avatarSpan && children[0] && children[0].tagName === "SPAN"){
				avatarSpan = children[0];
				avatarIndex = 0;
			}
			if (avatarSpan && avatarSpan.tagName === "SPAN"){
				var av = avatarSpan.querySelector("img[src]");
				if (av){chatimg = av.src;}
			}
		} catch(e){}

		var name = "";
		try {
			if (nameSpan.childNodes.length && nameSpan.childNodes[0].nodeType === 3){
				name = escapeHtml(nameSpan.childNodes[0].textContent.trim());
			} else {
				name = escapeHtml(nameSpan.textContent.trim());
			}
		} catch(e){}

		var nameColor = "";
		try {
			nameColor = nameSpan.style.color || "";
			if (nameColor.indexOf("var(") > -1){
				nameColor = getComputedStyle(nameSpan).color || "";
			}
		} catch(e){}

		var badges = [];
		var membership = "";
		var isModerator = false;
		for (var j = avatarIndex + 1; j < children.length; j++){
			var badgeNode = children[j];
			if (badgeNode === nameSpan){break;}
			try {
				var badgeText = (badgeNode.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
				if (badgeText === "ADMIN" || badgeText === "MOD" || badgeText === "MODERATOR" || badgeText.indexOf("ADMIN") > -1){
					isModerator = true;
				}
				if (badgeNode.tagName === "IMG" && badgeNode.src){
					badges.push(badgeNode.src);
					if ((badgeNode.title || "").toLowerCase().indexOf("subscriber") > -1){
						membership = badgeNode.title;
					}
				} else if (badgeNode.tagName === "SPAN"){
					badgeNode.querySelectorAll("img[src]").forEach(function(im){
						badges.push(im.src);
						if ((im.title || "").toLowerCase().indexOf("subscriber") > -1){
							membership = im.title;
						}
					});
					badgeNode.querySelectorAll("svg").forEach(function(svg){
						badges.push({html: svg.outerHTML, type: "svg"});
					});
				}
			} catch(e){}
		}

		var msg = "";
		var msgSpan = null;
		for (var k = 0; k < children.length; k++){
			if (children[k].style && children[k].style.whiteSpace === "pre-wrap"){
				msgSpan = children[k];
				break;
			}
		}
		if (!msgSpan && colonSpan && colonSpan.nextElementSibling){
			msgSpan = colonSpan.nextElementSibling;
		}
		if (msgSpan){
			try {
				msg = getAllContentNodes(msgSpan).trim();
			} catch(e){}
		}

		var sparksAmount = null;
		if (sparksRow){
			try {
				var zap = content.querySelector("svg.lucide-zap");
				var amountNode = zap ? zap.parentElement : null;
				sparksAmount = parseViewerCount(amountNode ? amountNode.textContent : "");
			} catch(e){}
		}

		if (!name || (!msg && !badges.length && sparksAmount === null)){
			retryMessage(ele);
			return;
		}

		var originalMessage = "";
		var replyLabel = "";
		if (!settings.excludeReplyingTo && msg){
			try {
				var replyButton = content.querySelector('button[title="Jump to quoted message"]');
				var replyText = replyButton ? (replyButton.textContent || "").replace(/^\s*↪\s*/, "").trim() : "";
				if (replyText){
					var replyColon = replyText.indexOf(":");
					replyLabel = (replyColon > 0 ? replyText.substring(0, replyColon) : replyText).trim();
					if (replyLabel){
						originalMessage = msg;
						if (settings.textonlymode){
							msg = replyLabel + ": " + msg;
						} else {
							msg = "<i><small>" + escapeHtml(replyLabel) + ":&nbsp;</small></i> " + msg;
						}
					}
				}
			} catch(e){}
		}

		var isBot = false;
		try {
			isBot = Array.prototype.some.call(nameSpan.querySelectorAll("span"), function(node){
				return (node.textContent || "").trim().toUpperCase() === "BOT";
			});
		} catch(e){}

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		if (replyLabel){data.initial = replyLabel;}
		if (originalMessage){data.reply = originalMessage;}
		data.hasDonation = sparksAmount === null ? "" : sparksAmount + " Sparks";
		data.membership = membership;
		if (membership){data.member = true;}
		if (isModerator){data.mod = true;}
		if (isBot){data.bot = true;}
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "xpsync";
		if (standardRow){data.id = ele.id.substring(5);}

		if (settings.captureevents !== false){
			if (/just followed|followed the channel/i.test(msgSpan ? msgSpan.textContent : "")){
				data.event = "new_follower";
			}
		}
		if (settings.hideevents && data.event){ return; }

		if (standardRow){
			if (!markProcessed(ele.id)){return;}
		} else {
			ele.__ssnXpsyncProcessed = true;
		}

		pushMessage(data);
	}

	function pushMessage(data){
		sendToApp({ "message": data });
	}

	var isExtensionOn = true;

	document.addEventListener("ssn-xpsync-viewer-count", function(event){
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)){return;}
		try { sendViewerCount(event.detail); } catch(e){}
	});

	if (hasChromeRuntime()){
		chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
			response = response || {};
			if ("settings" in response){
				settings = response.settings || {};
			}
			if ("state" in response){
				isExtensionOn = response.state;
			}
		});

		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("getSource" == request){sendResponse("xpsync");	return;	}
					if ("focusChat" == request){
						var input = document.querySelector('input[placeholder^="Send a message"]');
						if (input){input.focus();}
						sendResponse(true);
						return;
					}
					if (typeof request === "object" && request){
						if ("state" in request) {
							isExtensionOn = request.state;
						}
						if ("settings" in request){
							settings = request.settings || {};
							sendResponse(true);
							return;
						}
					}

				} catch(e){}
				sendResponse(false);
			}
		);
	}

	var observer = null;

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							var node = mutation.addedNodes[i];
							if (node.skip){continue;}
							node.skip = true;
							if (node.nodeType !== 1){continue;}
							if ((!node.classList || !node.classList.contains("chat-row")) && !isSparksRow(node)){continue;}

							setTimeout(function(ee){
								processMessage(ee);
							}, 200, node);

						} catch(e){}
					}
				}
			});
		};

		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);

		try {
			for (var i = 0; i < target.children.length; i++){
				var row = target.children[i];
				if (row.id && row.id.indexOf("chat-") === 0){
					markProcessed(row.id);
				} else if (isSparksRow(row)){
					row.__ssnXpsyncProcessed = true;
				}
			}
		} catch(e){}
	}

	console.log("social stream injected");

	setInterval(function(){
		try {
			var container = document.querySelector(".vw-chat-messages");
			if (container && !container.marked){
				container.marked = true;

				console.log("CONNECTED chat detected");

				if (observer){
					try { observer.disconnect(); } catch(e){}
				}
				onElementInserted(container);
			}
		} catch(e){}
	}, 2000);

	setTimeout(function(){checkViewers();}, 2500);
	setInterval(function(){checkViewers();}, 30000);

})();
