(function () {

	function escapeHtml(unsafe){
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		var resp = "";

		if (!element){return resp;}

		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}

		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node);
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent)+" ";
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						node.className = "";
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}

	var settings = {};
	// settings.textonlymode
	// settings.captureevents

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

	function processMessage(ele){
		if (!isExtensionOn){return;}
		if (!ele || !ele.id || ele.id.indexOf("chat-") !== 0){return;}
		if (!markProcessed(ele.id)){return;}

		var content = ele.querySelector(":scope > div");
		if (!content || !content.children.length){return;}

		var children = content.children;

		var colonSpan = null;
		for (var i = 0; i < children.length; i++){
			if (children[i].tagName === "SPAN" && (children[i].textContent || "").trim() === ":"){
				colonSpan = children[i];
				break;
			}
		}
		if (!colonSpan){return;}

		var nameSpan = colonSpan.previousElementSibling;
		if (!nameSpan){return;}

		var chatimg = "";
		try {
			var avatarSpan = children[0];
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
		for (var j = 1; j < children.length; j++){
			var badgeNode = children[j];
			if (badgeNode === nameSpan){break;}
			try {
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
		if (!msgSpan && colonSpan.nextElementSibling){
			msgSpan = colonSpan.nextElementSibling;
		}
		if (msgSpan){
			try {
				msg = getAllContentNodes(msgSpan).trim();
			} catch(e){}
		}

		if (!name || (!msg && !badges.length)){
			return;
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = membership;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "xpsync";

		if (settings.captureevents !== false){
			if (/just followed|followed the channel/i.test(msgSpan ? msgSpan.textContent : "")){
				data.event = "new_follower";
			}
		}

		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}

	var isExtensionOn = true;

	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
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
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
					}
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
							if (!node.classList || !node.classList.contains("chat-row")){continue;}

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
			target.querySelectorAll(".chat-row[id^='chat-']").forEach(function(row){
				markProcessed(row.id);
			});
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

})();
