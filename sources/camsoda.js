(function () {
	if (!/(^|\.)camsoda\.com$/.test(location.hostname)) return;
	function room() { return location.pathname.toLowerCase().replace(/\/$/, ""); }
	function startModerationReader() {
		if (window.__ssnCamModerationReader) return;
		window.__ssnCamModerationReader = true;
		var attached, waiting = [];
		var detach, sodaHandler, sodaRoom = "";
		function publish(data) {
			data.type = "camsoda";
			if (!data.room) data.room = room();
			if (waiting) {
				waiting.push(data);
				if (waiting.length > 5000) waiting.shift();
			} else document.dispatchEvent(new CustomEvent("ssn-cam-moderation", { detail: JSON.stringify(data) }));
		}
		document.addEventListener("ssn-camsoda-moderation-ready", function () {
			var early = waiting;
			waiting = null;
			if (early) early.forEach(publish);
		});
		function walk(row, visit) {
			if (!row) return;
			var key = Object.keys(row).find(function (key) { return key.indexOf("__reactFiber") === 0; });
			var fiber = key && row[key];
			for (var depth = 0; fiber && depth < 180; depth++, fiber = fiber.return) {
				if (visit(fiber.memoizedProps || {})) return;
			}
		}
		function connectSoda() {
			var username = room().split("/")[1];
			var client = null;
			walk(document.querySelector("[class*='message-module__wrapper--']") || document.querySelector("[class*='chat-module__wrapper--']"), function (props) {
				var value = props.value && props.value[username];
				if (!value || typeof value.on !== "function" || typeof value.off !== "function" || !value.socket) return false;
				client = value;
				return true;
			});
			if (!client && room() === sodaRoom) return;
			if (client && client === attached && (typeof client.listeners !== "function" || client.listeners("v3.chat.moderate").indexOf(sodaHandler) !== -1)) return;
			if (detach) detach();
			attached = client;
			detach = null;
			if (!client) return;
			var currentRoom = room();
			sodaRoom = currentRoom;
			function moderate(event) {
				if (!event || !event.username) return;
				if ((event.action === "banned" && event.type === "add") || event.action === "silenced") {
					publish({ room: currentRoom, username: String(event.username) });
				}
			}
			client.on("v3.chat.moderate", moderate);
			sodaHandler = moderate;
			detach = function () { client.off("v3.chat.moderate", moderate); };
		}
		function attach() {
			try { connectSoda(); } catch (_) {}
		}
		attach();
		setInterval(attach, 2000);
	}
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		startModerationReader();
		return;
	}
	if (window.__ssnCamsodaChatSource) return;
	window.__ssnCamsodaChatSource = true;

	var deleted = new Set(), rowIds = new WeakMap();
	var serial = 0, instance = Date.now().toString(36) + Math.random().toString(36).slice(2);
	var records = new Map(), deletedRows = new WeakSet();
	function trim(collection) {
		if (collection.size > 5000) collection.delete(collection.keys().next().value);
	}
	function removeMessage(id) {
		if (deleted.has(id)) return;
		deleted.add(id);
		trim(deleted);
		records.delete(id);
		try { chrome.runtime.sendMessage(chrome.runtime.id, { delete: { type: "camsoda", meta: { messageId: id } } }, function () {}); } catch (_) {}
	}
	function trackModeration(row, data) {
		if (deletedRows.has(row)) return false;
		var id = rowIds.get(row);
		if (!id) {
			id = room() + ":ssn:" + instance + ":" + (++serial);
			rowIds.set(row, id);
		}
		if (deleted.has(id)) return false;
		data.meta = data.meta || {};
		data.meta.messageId = id;
		records.set(id, { room: room(), user: (data.chatname || "").toLowerCase() });
		trim(records);
		return true;
	}
	document.addEventListener("ssn-cam-moderation", function (event) {
		try {
			var data = JSON.parse(event.detail);
			if (!data || data.type !== "camsoda" || data.room !== room()) return;
			var username = typeof data.username === "string" && data.username.toLowerCase();
			if (!username) return;
			records.forEach(function (record, id) {
				if (record.room === data.room && record.user === username) removeMessage(id);
			});
			document.querySelectorAll("[class*='message-module__wrapper--']").forEach(function (row) {
				var name = row.querySelector("[class*='chat-user-module__user--']");
				if (name && name.textContent.trim().replace(/:$/, "").toLowerCase() === username) deletedRows.add(row);
			});
		} catch (_) {}
	});
	if (window.ninjafy) startModerationReader();
	document.dispatchEvent(new Event("ssn-camsoda-moderation-ready"));

	 
	 
	var checking = false;
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

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

	function escapeHtml(unsafe){ // when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		if (!element) return "";
		if (element.nodeType === 3) {
			return settings.textonlymode ? element.textContent : escapeHtml(element.textContent);
		}
		if (element.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|BUTTON)$/.test(element.tagName)) return "";
		if (element.tagName === "IMG") {
			var alt = element.getAttribute("alt") || element.getAttribute("data-token") || "";
			if (settings.textonlymode) return alt;
			var src = element.src || "";
			return /^(https?:|data:image\/|blob:)/i.test(src) ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		if (element.tagName === "BR") return settings.textonlymode ? "\n" : "<br>";
		var text = "";
		for (var i = 0; i < element.childNodes.length; i++) {
			text += getAllContentNodes(element.childNodes[i]);
		}
		return text;
	}

	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
	// settings.captureevents
	
	
	var dataIndex = -5;
	
	var channelName = "";
	
	function processMessage(ele){
		//console.log(ele);
		if (!ele || !ele.isConnected){
		//	console.log("no connected");
			return;
		}
		
		if (ele.skip){
			return;
		}

		
		if (!isExtensionOn) { ele.skip = true; return; }

		var chatimg = ""

		try {
			chatimg = ele.querySelector("img[class^='chat-user-module__userAvatar'][src]").src;
		} catch(e){
			//console.error(e);
		}
		
		var name="";
		var author = ele.querySelector("[class*='chat-user-module__user--']");
		var tip = null;
		try {
			if (author){
				name = author.textContent;
			} else {
				var tipLine = ele.querySelector("span");
				var tipParts = tipLine && tipLine.querySelectorAll("b");
				if (!tipParts || tipParts.length !== 2 || !/ tipped \d+ tokens?$/i.test(tipLine.textContent.trim())){return;}
				name = tipParts[0].textContent;
				tip = tipParts[1].textContent.trim() + " tokens";
			}
			name = name.split(":")[0];
			name = name.trim();
		} catch(e){
		//	console.error(e);
			return;
		}
		
		var namecolor="";
		try {
			//namecolor = ele.querySelector(".css-1jxf684").style.color;
		} catch(e){
		}
		
		var badges=[];
		/* try {
			ele.querySelectorAll("img[class^='ChatBadge_image_'][src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		} */
		var hasDonation = tip || '';
		
		var msg="";
		
		
			
			
		try {
			var content = ele.querySelector("p.break-words");
			if (!content && author){
				var next = author.nextElementSibling;
				while (next && next.matches("[class*='badge-module__badge--']")){
					next = next.nextElementSibling;
				}
				if (next && next.tagName === "SPAN"){content = next;}
			}
			msg = getAllContentNodes(content).trim();
		} catch(e){
			
		}
		
		if (!msg){
			try {
				msg = getAllContentNodes(ele.querySelector("a p.text-xs.font-semibold")).trim();
				if (msg.startsWith("Tipped")){
					hasDonation = msg.split(" ")[1] + " " + msg.split(" ")[2];
				}
			} catch(e){
			//	console.error(e);
			}
		}
		
		if ((!msg && !hasDonation) || !name){
			//console.log("no name", msg, name);
			return;
		}
		
		ele.skip = true;
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "camsoda";
		if (!trackModeration(ele, data)) return;
		
		//console.log(data);
		pushMessage(data);
	}

	var lastViewerCount = null;
	var viewerRoom = location.pathname;
	function checkViewers() {
		if (viewerRoom !== location.pathname) {
			viewerRoom = location.pathname;
			lastViewerCount = null;
		}
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			lastViewerCount = null;
			return;
		}
		var element = document.querySelector("[class*=\"chat-module__usersCount--\"]");
		if (!element) return;
		var match = element.textContent.trim().match(/^(\d+(?:[,\s]\d{3})*(?:\.\d+)?)([KM])?(?:\s|$)/i);
		if (!match) return;
		var count = Number(match[1].replace(/[,\s]/g, ""));
		if (match[2]) count *= match[2].toUpperCase() === "K" ? 1000 : 1000000;
		if (!isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) return;
		lastViewerCount = count;
		pushMessage({ type: "camsoda", event: "viewer_update", meta: count });
	}
	setInterval(checkViewers, 10000);

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response={}){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
		if (!checking){
			startCheck();
		}
		checkViewers();
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				
				if (!checking){
					startCheck();
				}
				
				if ("getSource" == request){sendResponse("camsoda");	return;	}
				if ("focusChat" == request){
					var inputs = document.querySelectorAll('input[class*="chat-input-module__input--"], .comments-section textarea, .comments-section input[type="text"]');
					for (var i = 0; i < inputs.length; i++){
						var input = inputs[i];
						if (input.disabled || input.readOnly || !input.getClientRects().length){continue;}
						input.focus();
						if (document.activeElement === input){
							sendResponse(true);
							return;
						}
					}
					sendResponse(false);
					return;
				}
				if (request && typeof request === "object") {
					if ("state" in request) { isExtensionOn = request.state; }
					if ("settings" in request) { settings = request.settings || {}; }
					lastViewerCount = null;
					checkViewers();
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL =  "";
	var observer = null;
	var observerTarget = null;
	
	function queueMessage(row) {
		if (!row || row.skip || row.ssnPending){return;}
		if (!isExtensionOn) { row.skip = true; return; }
		row.ssnPending = true;
		setTimeout(function(){
			row.ssnPending = false;
			processMessage(row);
		},300);
	}
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				var changed = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
				var row = changed && changed.closest("[class*='message-module__wrapper--']");
				if (row && target.contains(row)){queueMessage(row);}
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							if (addedNode.nodeType !== 1) continue; // Only process element nodes

							if (addedNode.matches("[class*='message-module__wrapper--']")){
								queueMessage(addedNode);
							} else {
								var nested = addedNode.querySelectorAll("[class*='message-module__wrapper--']");
								nested.forEach(queueMessage);
								if (!nested.length && addedNode.parentElement === target){queueMessage(addedNode);}
							}

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true, characterData: true };
		if (!target){return;}
		if (observer && observerTarget === target && target.isConnected) {
			return;
		}
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		// Rows already present when chat connects are history, not new messages.
		Array.from(target.children).forEach(function(row){row.skip = true;});
		target.querySelectorAll("[class*='message-module__wrapper--']").forEach(function(row){row.skip = true;});
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		observerTarget = target;
	}
	
	console.log("social stream injected");


	function startCheck(){
		if (checking){return;}

		clearInterval(checking);
		checking = false;
		checking = setInterval(function(){
			try {
				var container = document.querySelector("div[class*='chat-module__wrapper--']");
				if (container && (!container.marked || !observer || observerTarget !== container || !container.isConnected)){
					container.marked=true;

					console.log("CONNECTED");

					onElementInserted(container);
				}

			} catch(e){}
		},2000);
	}
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				remoteConnection.datachannel.send("KEEPALIVE");
			}, 1000);
		};
		var errorHandle = function (e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = e => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = e => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function (e) {};
		localConnection.sendChannel.onmessage = function (e) {};
		localConnection
			.createOffer()
			.then(offer => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then(answer => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}
	
	
	function preventBackgroundThrottling() {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.mozHidden = false;
		document.webkitHidden = false;
		
		document.hasFocus = () => true;
		window.onFocus = () => true;

		Object.defineProperties(document, {
			mozHidden: { value: false, configurable: true },
			msHidden: { value: false, configurable: true },
			webkitHidden: { value: false, configurable: true },
			hidden: { value: false, configurable: true, writable: true },
			visibilityState: { 
				get: () => "visible",
				configurable: true
			}
		});
	}

	const events = [
		"visibilitychange",
		"webkitvisibilitychange",
		"blur",
		"mozvisibilitychange",
		"msvisibilitychange"
	];

	events.forEach(event => {
		window.addEventListener(event, (e) => {
			e.stopImmediatePropagation();
			e.preventDefault();
		}, true);
	});

	setInterval(preventBackgroundThrottling, 200);

})();
